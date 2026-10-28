const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type GroqResult =
  | { ok: true; content: string; finishReason: string | null; ms: number }
  | { ok: false; status: number; timedOut: boolean; ms: number };

interface GroqOptions {
  model: string;
  messages: GroqMessage[];
  maxTokens: number;
  timeoutMs: number;
}

// Free-tier tokens-per-minute limits return 429 with "try again in 967ms" / "3.2s".
// Short waits are retried once; longer ones surface as a "busy" error.
const MAX_RETRY_WAIT_MS = 4_000;

function retryDelayMs(body: string): number | null {
  const match = body.match(/try again in ([\d.]+)(ms|s)\b/i);
  if (!match) return null;
  const ms = Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1);
  return ms <= MAX_RETRY_WAIT_MS ? Math.ceil(ms) + 100 : null;
}

export async function callGroq(opts: GroqOptions, isRetry = false): Promise<GroqResult> {
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
      const wait = res.status === 429 && !isRetry ? retryDelayMs(text) : null;
      if (wait !== null) {
        console.warn(`[chat] Groq 429, retrying in ${wait}ms`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        const retried = await callGroq(opts, true);
        return { ...retried, ms: elapsed() };
      }
      console.error(`[chat] Groq error ${res.status}: ${text.slice(0, 300)}`);
      return { ok: false, status: res.status, timedOut: false, ms: elapsed() };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    return {
      ok: true,
      content: String(choice?.message?.content ?? "").trim(),
      finishReason: choice?.finish_reason ?? null,
      ms: elapsed(),
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(`[chat] Groq request failed: ${timedOut ? "timeout" : err}`);
    return { ok: false, status: 0, timedOut, ms: elapsed() };
  }
}
