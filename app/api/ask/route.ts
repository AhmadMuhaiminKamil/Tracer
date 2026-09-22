import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "../../snapshot";
import { acquireSlot, runAgent, type Completion } from "./agent";
import { sanitizeChat } from "./logic";
import { TOOLS } from "./tools";
import { llmConfig } from "../../env";

// The gateway intermittently returns HTTP 200 with a truncated body (no `choices`).
// Retry those, plus transient 429/5xx; never retry a well-formed refusal.
const RETRIES = 2;

class GatewayError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function attempt(messages: Record<string, unknown>[]) {
  // Read per request: keys are saved from the dashboard after boot.
  const { baseUrl, model, key } = await llmConfig();
  if (!key) throw new GatewayError("LLM_API_KEY belum diisi", false);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, tools: TOOLS, stream: false, max_completion_tokens: 2200 }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
      redirect: "error",
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "tidak terjangkau";
    throw new GatewayError(`Gateway ${reason}`, true);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new GatewayError(`Gateway sibuk (${response.status})`, true);
  }
  if (!response.ok) throw new GatewayError(`Gateway menolak permintaan (${response.status})`, false);

  const text = await response.text();
  let data: { choices?: { message?: Completion["message"] }[]; usage?: Completion["usage"] };
  try {
    if (text.trim().startsWith("data:")) {
      // Fallback for streaming SSE response
      let content = "";
      let role = "assistant";
      let tool_calls: any[] = [];
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") continue;
        try {
          const chunk = JSON.parse(trimmed.slice(5).trim());
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) content += delta.content;
          if (delta?.role) role = delta.role;
          if (Array.isArray(delta?.tool_calls)) tool_calls.push(...delta.tool_calls);
        } catch {}
      }
      data = {
        choices: [{
          message: {
            role,
            content: content || null,
            ...(tool_calls.length ? { tool_calls } : {})
          }
        }]
      };
    } else {
      data = JSON.parse(text);
    }
  } catch {
    throw new GatewayError("Gateway mengirim respons yang tidak dapat dibaca", true);
  }
  const rawError = (data as any)?.error;
  if (rawError) {
    const msg = typeof rawError === "object" ? String(rawError.message || rawError.type || "Gateway upstream error") : String(rawError);
    throw new GatewayError(`Gateway error: ${msg}`, false);
  }
  const message = data?.choices?.[0]?.message;
  // no choices at all = truncated upstream response, worth another try
  if (!message || typeof message !== "object") {
    throw new GatewayError("Gateway mengirim respons tidak lengkap", true);
  }
  return { message, usage: data.usage };
}

async function complete(messages: Record<string, unknown>[]): Promise<Completion> {
  for (let tryIndex = 0; tryIndex <= RETRIES; tryIndex++) {
    try {
      return await attempt(messages);
    } catch (error) {
      const failure = error instanceof GatewayError ? error : new GatewayError("Gateway gagal", true);
      if (!failure.retryable || tryIndex === RETRIES) {
        throw new Error(
          tryIndex > 0 ? `${failure.message} setelah ${tryIndex + 1} percobaan. Coba lagi sebentar.` : failure.message,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (tryIndex + 1)));
    }
  }
  throw new Error("Gateway gagal");
}

// nextUrl.origin reflects the bind address (0.0.0.0), not the browser's host, so compare against Host.
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
    }
    release = acquireSlot();
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 64_000) return NextResponse.json({error: "Body terlalu besar"}, {status: 413});
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({error: "JSON tidak valid"}, {status: 400}); }
    const { question, history } = sanitizeChat(body);
    const watchlist = Array.isArray(body.watchlist)
      ? Array.from(new Set<string>(body.watchlist.map((value: unknown) => String(value).trim().toUpperCase().replace(/\.JK$/, "")).filter((value: string) => /^[A-Z0-9-]{1,20}$/.test(value)))).slice(0, 50)
      : [];
    return NextResponse.json(await runAgent(question, history, watchlist, complete, getSnapshot));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent gagal";
    const status = /menit|bersamaan/.test(message) ? 429 : /wajib|valid|Content-Type/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  } finally {
    release?.();
  }
}
