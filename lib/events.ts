// Event shapes and parsing. Pure (no I/O) so it can be unit tested and shared.
export interface LogEvent {
  type: "question" | "feedback";
  conversationId: string;
  /** The latest user message only, never the whole conversation. */
  question: string;
  grounded: boolean;
  fallback: boolean;
  /** Titles of the manual sections used. */
  sources: string[];
  cached: boolean;
  retrievalMs: number | null;
  rewriteMs: number | null;
  llmMs: number | null;
  /** Id of the assistant message; links a question event to its feedback events. */
  messageId?: string;
  rating?: "up" | "down";
  reason?: string;
  /** The request failed (LLM error, busy, not configured). */
  error?: boolean;
}

export type StoredEvent = LogEvent & { ts: string };

const ms = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

// Accepts one parsed JSON value and returns a clean event, or null if it is not a usable event.
export function toStoredEvent(value: unknown): StoredEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>;
  if (e.type !== "question" && e.type !== "feedback") return null;
  if (typeof e.ts !== "string" || Number.isNaN(Date.parse(e.ts))) return null;
  return {
    ts: e.ts,
    type: e.type,
    conversationId: typeof e.conversationId === "string" ? e.conversationId : "unknown",
    question: typeof e.question === "string" ? e.question : "",
    grounded: e.grounded === true,
    fallback: e.fallback === true,
    sources: Array.isArray(e.sources) ? e.sources.filter((s): s is string => typeof s === "string") : [],
    cached: e.cached === true,
    retrievalMs: ms(e.retrievalMs),
    rewriteMs: ms(e.rewriteMs),
    llmMs: ms(e.llmMs),
    ...(typeof e.messageId === "string" && { messageId: e.messageId }),
    ...((e.rating === "up" || e.rating === "down") && { rating: e.rating }),
    ...(typeof e.reason === "string" && { reason: e.reason }),
    ...(e.error === true && { error: true }),
  };
}

// Parses JSONL text. Blank and malformed lines are skipped; `since` keeps only newer events.
export function parseEvents(text: string, since?: Date): StoredEvent[] {
  const events: StoredEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const event = toStoredEvent(parsed);
    if (!event) continue;
    if (since && Date.parse(event.ts) < since.getTime()) continue;
    events.push(event);
  }
  return events;
}
