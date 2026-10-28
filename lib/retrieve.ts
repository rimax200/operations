import MiniSearch from "minisearch";
import { getManualChunks, type ManualChunk } from "./manual";

// Minimum MiniSearch score for a chunk to count as relevant. Tune this.
export const MIN_SCORE = 10;

// Lower bar used only to suggest "closest topics" when nothing passes MIN_SCORE.
export const MIN_SUGGEST_SCORE = 5;

export interface ScoredChunk extends ManualChunk {
  score: number;
}

// Generic English filler only. Banking terms (ATM, POS, BVN, NIN, OTP, TAT, KYC)
// are deliberately NOT here so they are never stripped.
const STOPWORDS = new Set(
  (
    "a an and are as at be but by can could did do does for from get had has have how i if in into is it its " +
    "me my of on or our should so than that the their them then there these they this to us was we were what " +
    "when where which who why will with would you your please tell about need want write give " +
    "customer customers staff explain"
  ).split(" "),
);

function processTerm(term: string) {
  const lower = term.toLowerCase();
  return STOPWORDS.has(lower) ? null : lower;
}

let index: MiniSearch<ManualChunk> | null = null;

function getIndex() {
  if (index) return index;
  index = new MiniSearch<ManualChunk>({
    fields: ["title", "category", "text"],
    storeFields: ["title", "category", "text"],
    processTerm,
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: "OR",
      processTerm,
    },
  });
  index.addAll(getManualChunks());
  return index;
}

export function search(query: string, k = 4, minScore = MIN_SCORE): ScoredChunk[] {
  return getIndex()
    .search(query)
    .filter((result) => result.score >= minScore)
    .slice(0, k)
    .map((result) => ({
      id: result.id as string,
      title: result.title as string,
      category: result.category as string,
      text: result.text as string,
      score: result.score,
    }));
}

// Short follow-ups ("how long does it take?") borrow the previous user message.
export function buildQuery(userMessages: string[]): string {
  const latest = userMessages[userMessages.length - 1] ?? "";
  const previous = userMessages[userMessages.length - 2];
  const words = latest.trim().split(/\s+/).filter(Boolean).length;
  return words < 6 && previous ? `${previous} ${latest}` : latest;
}

const POPULAR_CATEGORIES = ["Cards & ATM", "Transfers & Payments", "Security & Fraud"];

// First section title of a few common categories, for greetings and empty fallbacks.
export function popularTopics(): string[] {
  const chunks = getManualChunks();
  return POPULAR_CATEGORIES.map((category) => chunks.find((c) => c.category === category)?.title).filter(
    (title): title is string => Boolean(title),
  );
}

export function closestTopics(query: string, n = 3): string[] {
  const titles = [...new Set(search(query, 10, MIN_SUGGEST_SCORE).map((c) => c.title))].slice(0, n);
  return titles.length > 0 ? titles : popularTopics();
}
