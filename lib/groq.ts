const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Free-tier limits are per model, so a rate-limited model can be swapped for another one.
const MAX_RETRY_WAIT_SECONDS = 8;
const DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqUsage {
  promptTokens: number;
  completionTokens: number;
}

export type GroqResult =
  | { ok: true; content: string; finishReason: string | null; ms: number; model: string; usage: GroqUsage | null }
  | {
      ok: false;
      status: number;
      timedOut: boolean;
      ms: number;
      /** Set when the request was rate limited and could not be completed on any model. */
      retryAfterSeconds?: number;
    };

interface GroqOptions {
  model: string;
  messages: GroqMessage[];
  maxTokens: number;
  timeoutMs: number;
}

// One request to one model. A 429 is reported with how long Groq asked us to wait.
async function attempt(opts: GroqOptions): Promise<GroqResult & { retryAfter?: number }> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0,
        max_tokens: opts.maxTokens,
        // gpt-oss models spend completion tokens on reasoning; keep it short.
        ...(opts.model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
        messages: opts.messages,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[chat] Groq error ${res.status} (${opts.model}): ${text.slice(0, 200)}`);
      let retryAfter: number | undefined;
      if (res.status === 429) {
        const header = Number(res.headers.get("retry-after"));
        const body = text.match(/try again in ([\d.]+)(ms|s)\b/i);
        retryAfter = Number.isFinite(header) && header > 0
          ? header
          : body
            ? Number(body[1]) / (body[2].toLowerCase() === "ms" ? 1000 : 1)
            : 30;
      }
      return { ok: false, status: res.status, timedOut: false, ms: elapsed(), retryAfter };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    return {
      ok: true,
      content: String(choice?.message?.content ?? "").trim(),
      finishReason: choice?.finish_reason ?? null,
      ms: elapsed(),
      model: opts.model,
      usage: data?.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
        : null,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(`[chat] Groq request failed (${opts.model}): ${timedOut ? "timeout" : err}`);
    return { ok: false, status: 0, timedOut, ms: elapsed() };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// On 429: honor retry-after and retry once if the wait is short; otherwise (or if that fails)
// try the fallback model once; only then report "busy" with retryAfterSeconds.
export async function callGroq(opts: GroqOptions): Promise<GroqResult> {
  const started = performance.now();
  const total = () => Math.round(performance.now() - started);

  let result = await attempt(opts);
  if (result.ok || result.status !== 429) return { ...result, ms: total() } as GroqResult;

  let retryAfter = result.retryAfter ?? 30;
  if (retryAfter <= MAX_RETRY_WAIT_SECONDS) {
    console.warn(`[chat] Groq 429 on ${opts.model}, waiting ${retryAfter}s to retry`);
    await sleep(Math.ceil(retryAfter * 1000) + 100);
    result = await attempt(opts);
    if (result.ok || result.status !== 429) return { ...result, ms: total() } as GroqResult;
    retryAfter = result.retryAfter ?? retryAfter;
  }

  const fallbackModel = process.env.GROQ_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  if (fallbackModel !== opts.model) {
    console.warn(`[chat] Groq 429 on ${opts.model}, trying fallback model ${fallbackModel}`);
    const fallback = await attempt({ ...opts, model: fallbackModel });
    if (fallback.ok || fallback.status !== 429) return { ...fallback, ms: total() } as GroqResult;
    retryAfter = Math.min(retryAfter, fallback.retryAfter ?? retryAfter);
  }

  return { ok: false, status: 429, timedOut: false, ms: total(), retryAfterSeconds: Math.ceil(retryAfter) };
}
