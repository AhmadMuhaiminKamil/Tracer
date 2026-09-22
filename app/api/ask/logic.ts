export type ChatMessage = { role: "user" | "assistant"; content: string };

export function sanitizeChat(input: unknown): { question: string; history: ChatMessage[] } {
  if (!input || typeof input !== "object") throw new Error("Body tidak valid");
  const body = input as { question?: unknown; history?: unknown };
  const question = String(body.question ?? "").trim().slice(0, 1000);
  if (!question) throw new Error("Pertanyaan wajib diisi");
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is ChatMessage =>
            item &&
            typeof item === "object" &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string",
        )
        .slice(-12)
        .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }))
    : [];
  return { question, history };
}
