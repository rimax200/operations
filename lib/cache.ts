import { createHash } from "node:crypto";

// In-memory LRU answer cache. On serverless hosting every instance has its own copy that is lost
// when the instance is recycled, so this is a per-instance, best-effort cache, not shared storage.
export const CACHE_MAX_ENTRIES = 300;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class LruCache<T> {
  private entries = new Map<string, Entry<T>>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = CACHE_MAX_ENTRIES, ttlMs = CACHE_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Map keeps insertion order, so re-inserting marks it most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }

  get size() {
    return this.entries.size;
  }
}

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Same normalized question AND the same top retrieved sections => the same cached answer.
export function cacheKey(question: string, chunkIds: string[]): string {
  return createHash("sha256")
    .update(`${normalizeQuestion(question)}|${[...chunkIds].sort().join(",")}`)
    .digest("hex");
}
