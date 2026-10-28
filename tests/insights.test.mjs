import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInsights, computeTotals, findGaps, flaggedAnswers, gapKey, questionsPerDay, responseTime, satisfaction, topTopics,
} from "../lib/insights.ts";

let n = 0;
const q = (over = {}) => ({
  ts: "2026-10-20T10:00:00.000Z", type: "question", conversationId: "c", question: "How do I block a card?", grounded: true,
  fallback: false, sources: ["Card Blocking"], cached: false, retrievalMs: 1, rewriteMs: null, llmMs: 500, messageId: `m${++n}`, ...over,
});
const greeting = (over = {}) => q({ question: "hi", grounded: false, sources: [], retrievalMs: null, llmMs: null, ...over });
const gap = (question, over = {}) => q({ question, grounded: false, fallback: true, sources: [], ...over });
const fb = (messageId, rating, over = {}) => ({
  ts: "2026-10-20T11:00:00.000Z", type: "feedback", conversationId: "c", question: "fallback copy", grounded: true, fallback: false,
  sources: ["Copy"], cached: false, retrievalMs: 1, rewriteMs: null, llmMs: 2, messageId, rating, ...over,
});

test("empty input gives zeros and nulls, never NaN", () => {
  const i = buildInsights([]);
  assert.equal(i.totals.questions, 0);
  assert.equal(i.totals.answerRate, null);
  assert.equal(i.responseTime.p50, null);
  assert.equal(i.satisfaction.upRate, null);
  assert.deepEqual(i.questionsPerDay, []);
  assert.deepEqual(i.topTopics, { topics: [], categories: [] });
  assert.deepEqual(i.gaps, []);
  assert.deepEqual(i.flaggedAnswers, []);
});

test("totals exclude greetings and compute rates", () => {
  const events = [
    q(), q({ cached: true, llmMs: null }), gap("mortgage?"), q({ error: true, grounded: false, llmMs: null }), greeting(), greeting(),
    fb("x", "up"),
  ];
  const t = computeTotals(events);
  assert.equal(t.questions, 4);
  assert.equal(t.greetings, 2);
  assert.equal(t.answered, 2);
  assert.equal(t.answerRate, 0.5);
  assert.equal(t.fallbacks, 1);
  assert.equal(t.fallbackRate, 0.25);
  assert.equal(t.cached, 1);
  assert.equal(t.cacheHitRate, 0.25);
  assert.equal(t.errors, 1);
  assert.equal(t.errorRate, 0.25);
});

test("response time: nearest-rank p50/p95 of retrieval+rewrite+llm, cached included, errors and greetings excluded", () => {
  const events = [];
  for (let ms = 100; ms <= 1000; ms += 100) events.push(q({ retrievalMs: 0, rewriteMs: null, llmMs: ms })); // 10 values
  events.push(q({ error: true, llmMs: 99999 }), greeting({ llmMs: 99999 }));
  const r = responseTime(events);
  assert.equal(r.count, 10);
  assert.equal(r.p50, 500);
  assert.equal(r.p95, 1000);
  const withParts = responseTime([q({ retrievalMs: 2, rewriteMs: 300, llmMs: 700 }), q({ cached: true, retrievalMs: 4, llmMs: null })]);
  assert.equal(withParts.p95, 1002);
  assert.equal(withParts.p50, 4);
});

test("satisfaction uses the latest vote per message and keeps reasons", () => {
  const events = [
    fb("a", "up"), fb("b", "down"), fb("b", "down", { reason: "Incomplete", ts: "2026-10-20T11:00:05Z" }),
    fb("c", "down", { ts: "2026-10-20T11:00:00Z" }), fb("c", "up", { ts: "2026-10-20T11:01:00Z" }),
  ];
  const s = satisfaction(events);
  assert.deepEqual([s.up, s.down], [2, 1]);
  assert.ok(Math.abs(s.upRate - 2 / 3) < 1e-9);
  assert.equal(satisfaction([q()]).upRate, null);
});

test("questionsPerDay fills empty days and ignores greetings", () => {
  const events = [
    q({ ts: "2026-10-18T09:00:00Z" }), q({ ts: "2026-10-18T10:00:00Z" }), q({ ts: "2026-10-20T10:00:00Z" }), greeting({ ts: "2026-10-19T10:00:00Z" }),
  ];
  assert.deepEqual(questionsPerDay(events), [
    { date: "2026-10-18", count: 2 }, { date: "2026-10-19", count: 0 }, { date: "2026-10-20", count: 1 },
  ]);
  const ranged = questionsPerDay(events, { from: new Date("2026-10-17T00:00:00Z"), to: new Date("2026-10-21T12:00:00Z") });
  assert.equal(ranged.length, 5);
  assert.equal(ranged[0].count, 0);
  assert.equal(questionsPerDay([], { from: new Date("2026-10-18T00:00:00Z"), to: new Date("2026-10-19T00:00:00Z") }).length, 2);
});

test("questionsPerDay can bucket days in another timezone", () => {
  const events = [q({ ts: "2026-10-18T23:30:00Z" })];
  assert.equal(questionsPerDay(events)[0].date, "2026-10-18");
  assert.equal(questionsPerDay(events, { tzOffsetMinutes: 60 })[0].date, "2026-10-19");
});

test("topTopics counts each section once per grounded question, top 10, with categories", () => {
  const events = [
    q({ sources: ["A", "A", "B"] }), q({ sources: ["A"] }), q({ sources: ["B"] }), q({ sources: ["C"] }),
    gap("x", { sources: ["Z"] }), greeting({ sources: ["Z"] }),
  ];
  const cat = { A: "Cards", B: "Cards", C: "Accounts" };
  const t = topTopics(events, (title) => cat[title]);
  assert.deepEqual(t.topics.map((x) => [x.title, x.count, x.category]), [["A", 2, "Cards"], ["B", 2, "Cards"], ["C", 1, "Accounts"]]);
  assert.deepEqual(t.categories, [{ category: "Cards", count: 4 }, { category: "Accounts", count: 1 }]);
  const many = Array.from({ length: 15 }, (_, i) => q({ sources: [`S${String(i).padStart(2, "0")}`] }));
  assert.equal(topTopics(many).topics.length, 10);
  assert.deepEqual(topTopics([q()]).categories, []);
});

test("gapKey ignores case, punctuation, stopwords and word order", () => {
  assert.equal(gapKey("How to reverse a NIP transfer?"), gapKey("reverse nip transfer"));
  assert.equal(gapKey("transfer NIP reverse!!"), gapKey("reverse nip transfer"));
  assert.notEqual(gapKey("reverse nip transfer"), gapKey("mortgage requirements"));
  assert.equal(gapKey("how do i"), "do how i".split(" ").sort().join(" "));
});

test("findGaps groups by meaning, picks the most common wording, counts, sorts, caps at 10", () => {
  const events = [
    gap("How to reverse a NIP transfer?", { ts: "2026-10-18T10:00:00Z" }),
    gap("reverse NIP transfer", { ts: "2026-10-19T10:00:00Z" }),
    gap("reverse NIP transfer", { ts: "2026-10-20T10:00:00Z" }),
    gap("mortgage requirements", { ts: "2026-10-21T10:00:00Z" }),
    q(), greeting(), gap("   "),
  ];
  const g = findGaps(events);
  assert.equal(g.length, 2);
  assert.deepEqual([g[0].question, g[0].count, g[0].lastAsked], ["reverse NIP transfer", 3, "2026-10-20T10:00:00.000Z"]);
  assert.deepEqual([g[1].question, g[1].count], ["mortgage requirements", 1]);
  const many = Array.from({ length: 14 }, (_, i) => gap(`unique topic number ${["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november"][i]}`));
  assert.equal(findGaps(many).length, 10);
});

test("flaggedAnswers joins thumbs-down to the question by messageId and falls back to the feedback copy", () => {
  const events = [
    q({ messageId: "m-a", question: "Real question", sources: ["KYC Tiers and Limits"] }),
    fb("m-a", "down", { reason: "Wrong answer", ts: "2026-10-20T12:00:00Z" }),
    fb("m-orphan", "down", { ts: "2026-10-21T12:00:00Z" }),
    fb("m-good", "up"),
    q({ messageId: "m-ok" }), fb("m-ok", "down"), fb("m-ok", "up", { ts: "2026-10-20T13:00:00Z" }),
  ];
  const f = flaggedAnswers(events);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], { messageId: "m-orphan", question: "fallback copy", sources: ["Copy"], ts: "2026-10-21T12:00:00Z" });
  assert.deepEqual(f[1], { messageId: "m-a", question: "Real question", sources: ["KYC Tiers and Limits"], reason: "Wrong answer", ts: "2026-10-20T12:00:00Z" });
});

test("functions tolerate events with missing or odd fields", () => {
  const junk = [{ type: "question", ts: "2026-10-20T10:00:00Z" }, { type: "feedback", ts: "2026-10-20T10:00:00Z" }, { type: "question", ts: "2026-10-20T10:00:00Z", sources: null }];
  assert.doesNotThrow(() => buildInsights(junk.map((e) => ({ question: "", sources: [], grounded: false, fallback: false, cached: false, ...e }))));
});
