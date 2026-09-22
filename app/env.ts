import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** .env.local is read once at boot, so keys saved from the dashboard would not
 *  take effect until a restart. Re-read it per request instead. */
export async function readEnvFile(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const file of ["python/.env", ".env.local"]) {
    try {
      const text = await readFile(join(/* turbopackIgnore: true */ process.cwd(), file), "utf-8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    } catch {
      // a missing file is the normal first-run case
    }
  }
  return out;
}

export type LlmConfig = { baseUrl: string; model: string; key: string };

export async function llmConfig(): Promise<LlmConfig> {
  const env = await readEnvFile();
  return {
    baseUrl: env.LLM_BASE_URL || process.env.LLM_BASE_URL || "https://ohhmyagent.com/v1",
    model: env.LLM_MODEL || process.env.LLM_MODEL || "gpt-5.6",
    key: env.LLM_API_KEY || process.env.LLM_API_KEY || "",
  };
}
