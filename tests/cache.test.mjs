import test from "node:test";
import assert from "node:assert/strict";
import { LruCache, cacheKey, normalizeQuestion } from "../lib/cache.ts";

test("normalizes case, whitespace and punctuation", () => {
  assert.equal(normalizeQuestion("  How do I   BLOCK a card?!  "), "how do i block a card");
  assert.equal(cacheKey("How do I block a card?", ["b", "a"]), cacheKey("how do i  block a card", ["a", "b"]));
});

test("different wording or different retrieved sections gives a different key", () => {
  assert.notEqual(cacheKey("how long does it take?", ["atm"]), cacheKey("how long does it take?", ["kyc"]));
  assert.notEqual(cacheKey("block a card", ["card-blocking"]), cacheKey("how to block a card", ["card-blocking"]));
});

test("evicts the least recently used entry beyond the max", () => {
  const cache = new LruCache(2, 1000);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a"); // a is now most recent
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 2);
});

test("entries expire after the TTL", async () => {
  const cache = new LruCache(10, 20);
  cache.set("a", 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(cache.get("a"), undefined);
});
