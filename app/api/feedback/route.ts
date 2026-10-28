import { FEEDBACK_REASONS } from "@/lib/feedback";
import { logEvent } from "@/lib/log";

export const runtime = "nodejs";

const MAX_ID = 64;
const MAX_QUESTION = 1000;
const MAX_SOURCES = 10;
const MAX_TITLE = 120;

const isString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const isMs = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 600_000);

// Records a thumbs up/down. Bad input is rejected with a 400 and never logged.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false }, { status: 400 });

  const { conversationId, messageId, question, rating, reason, grounded, fallback, cached, sources } = body;
  const timings = (body.timings ?? {}) as Record<string, unknown>;
  const retrievalMs = timings.retrievalMs ?? null;
  const rewriteMs = timings.rewriteMs ?? null;
  const llmMs = timings.llmMs ?? null;

  const valid =
    isString(conversationId, MAX_ID) &&
    isString(messageId, MAX_ID) &&
    isString(question, MAX_QUESTION) &&
    (rating === "up" || rating === "down") &&
    (reason === undefined || (typeof reason === "string" && FEEDBACK_REASONS.includes(reason))) &&
    typeof grounded === "boolean" &&
    typeof fallback === "boolean" &&
    typeof cached === "boolean" &&
    Array.isArray(sources) &&
    sources.length <= MAX_SOURCES &&
    sources.every((title) => isString(title, MAX_TITLE)) &&
    isMs(retrievalMs) &&
    isMs(rewriteMs) &&
    isMs(llmMs);
  if (!valid) return Response.json({ ok: false }, { status: 400 });

  await logEvent({
    type: "feedback",
    conversationId,
    messageId,
    question,
    grounded,
    fallback,
    sources: sources as string[],
    cached,
    retrievalMs,
    rewriteMs,
    llmMs,
    rating,
    reason: reason as string | undefined,
  });
  return Response.json({ ok: true });
}
