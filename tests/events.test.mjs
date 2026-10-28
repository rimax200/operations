import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEvents, toStoredEvent } from "../lib/events.ts";
import { FileEventLogger } from "../lib/log.ts";

const ev = (over = {}) => ({
  ts: "2026-10-20T10:00:00.000Z", type: "question", conversationId: "c1", question: "q", grounded: true, fallback: false,
  sources: ["A"], cached: false, retrievalMs: 1, rewriteMs: null, llmMs: 500, ...over,
});

test("toStoredEvent rejects junk and coerces bad fields", () => {
  assert.equal(toStoredEvent(null), null);
  assert.equal(toStoredEvent("x"), null);
  assert.equal(toStoredEvent([]), null);
  assert.equal(toStoredEvent({ type: "other", ts: "2026-10-20T10:00:00Z" }), null);
  assert.equal(toStoredEvent({ type: "question", ts: "not a date" }), null);
  const e = toStoredEvent({ type: "question", ts: "2026-10-20T10:00:00Z", sources: ["a", 5], llmMs: -3, grounded: "yes" });
  assert.deepEqual(e.sources, ["a"]);
  assert.equal(e.llmMs, null);
  assert.equal(e.grounded, false);
});

test("parseEvents skips blank and malformed lines", () => {
  const text = [JSON.stringify(ev()), "", "{not json", '{"type":"question"}', JSON.stringify(ev({ question: "second" }))].join("\n");
  const events = parseEvents(text);
  assert.equal(events.length, 2);
  assert.equal(events[1].question, "second");
});

test("parseEvents honors since", () => {
  const text = [JSON.stringify(ev({ ts: "2026-10-01T00:00:00Z" })), JSON.stringify(ev({ ts: "2026-10-25T00:00:00Z" }))].join("\n");
  assert.equal(parseEvents(text, new Date("2026-10-10T00:00:00Z")).length, 1);
  assert.equal(parseEvents("", new Date()).length, 0);
});

test("FileEventLogger: missing file is empty, round trip works, bad lines are skipped", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "events-"));
  try {
    const logger = new FileEventLogger(dir, "events.jsonl");
    assert.deepEqual(await logger.readEvents(), []);
    await logger.write(ev({ question: "first" }));
    await logger.write(ev({ question: "second", ts: "2026-10-26T10:00:00.000Z" }));
    await writeFile(path.join(dir, "events.jsonl"), "garbage line\n", { flag: "a" });
    const all = await logger.readEvents();
    assert.deepEqual(all.map((e) => e.question), ["first", "second"]);
    const recent = await logger.readEvents({ since: new Date("2026-10-25T00:00:00Z") });
    assert.deepEqual(recent.map((e) => e.question), ["second"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
