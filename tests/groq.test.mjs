import test from "node:test";
import assert from "node:assert/strict";
import { callGroq } from "../lib/groq.ts";

process.env.GROQ_API_KEY = "test-key";
const realFetch = globalThis.fetch;
const opts = { model: "openai/gpt-oss-120b", messages: [{ role: "user", content: "hi" }], maxTokens: 50, timeoutMs: 2000 };

const ok = (content) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
const limited = (retryAfter) =>
  new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "retry-after": String(retryAfter) } });

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body).model);
    return responses.shift();
  };
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GROQ_FALLBACK_MODEL;
});

test("short retry-after: waits, then retries the same model once", async () => {
  const calls = mockFetch([limited(1), ok("answer")]);
  const started = Date.now();
  const result = await callGroq(opts);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["openai/gpt-oss-120b", "openai/gpt-oss-120b"]);
  assert.ok(Date.now() - started >= 1000, "should have waited about 1s");
});

test("long retry-after: switches to the fallback model without waiting", async () => {
  const calls = mockFetch([limited(30), ok("answer from fallback")]);
  const started = Date.now();
  const result = await callGroq(opts);
  assert.equal(result.ok, true);
  assert.equal(result.model, "openai/gpt-oss-20b");
  assert.deepEqual(calls, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  assert.ok(Date.now() - started < 1000);
});

test("GROQ_FALLBACK_MODEL overrides the default fallback", async () => {
  process.env.GROQ_FALLBACK_MODEL = "other/model";
  const calls = mockFetch([limited(30), ok("x")]);
  await callGroq(opts);
  assert.deepEqual(calls, ["openai/gpt-oss-120b", "other/model"]);
});

test("both models rate limited: busy result with retryAfterSeconds", async () => {
  const calls = mockFetch([limited(30), limited(12)]);
  const result = await callGroq(opts);
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 12);
  assert.equal(calls.length, 2);
});

test("retry also rate limited: still tries the fallback model before giving up", async () => {
  const calls = mockFetch([limited(1), limited(1), ok("fallback ok")]);
  const result = await callGroq(opts);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["openai/gpt-oss-120b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
});

test("non-429 errors are not retried", async () => {
  const calls = mockFetch([new Response("boom", { status: 500 })]);
  const result = await callGroq(opts);
  assert.equal(result.ok, false);
  assert.equal(result.retryAfterSeconds, undefined);
  assert.equal(calls.length, 1);
});
