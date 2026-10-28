// Pure analytics over logged events: no I/O, no clock reads (pass `now` where it matters).
import type { StoredEvent } from "./events.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_N = 10;

// ---------- helpers ----------

const isQuestion = (e: StoredEvent) => e.type === "question";

// Greetings and thanks are answered instantly without the manual: not grounded, not a fallback, not an error.
export const isGreeting = (e: StoredEvent) => isQuestion(e) && !e.grounded && !e.fallback && !e.error;

/** Question events that count as real questions (greetings excluded). */
export function questionEvents(events: StoredEvent[]): StoredEvent[] {
  return events.filter((e) => isQuestion(e) && !isGreeting(e));
}

const rate = (part: number, whole: number) => (whole === 0 ? null : part / whole);
const time = (e: StoredEvent) => Date.parse(e.ts);

/** Latest feedback event per assistant message (a vote can change, and a reason arrives as a second event). */
function latestFeedback(events: StoredEvent[]): StoredEvent[] {
  const latest = new Map<string, StoredEvent>();
  const ordered = events.filter((e) => e.type === "feedback" && e.messageId && e.rating).sort((a, b) => time(a) - time(b));
  for (const e of ordered) {
    const previous = latest.get(e.messageId as string);
    // A reason belongs to the vote it was given for; keep it only if the rating did not change.
    latest.set(e.messageId as string, e.reason || !previous || previous.rating !== e.rating ? e : { ...e, reason: previous.reason });
  }
  return [...latest.values()];
}

// ---------- totals ----------

export interface Totals {
  questions: number;
  greetings: number;
  answered: number;
  answerRate: number | null;
  fallbacks: number;
  fallbackRate: number | null;
  cached: number;
  cacheHitRate: number | null;
  errors: number;
  errorRate: number | null;
}

export function computeTotals(events: StoredEvent[]): Totals {
  const questions = questionEvents(events);
  const n = questions.length;
  const answered = questions.filter((e) => e.grounded).length;
  const fallbacks = questions.filter((e) => e.fallback).length;
  const cached = questions.filter((e) => e.cached).length;
  const errors = questions.filter((e) => e.error).length;
  return {
    questions: n,
    greetings: events.filter(isGreeting).length,
    answered,
    answerRate: rate(answered, n),
    fallbacks,
    fallbackRate: rate(fallbacks, n),
    cached,
    cacheHitRate: rate(cached, n),
    errors,
    errorRate: rate(errors, n),
  };
}

// ---------- response time ----------

export interface ResponseTime {
  count: number;
  p50: number | null;
  p95: number | null;
}

// Nearest-rank percentile of an ascending list.
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

// Total time = retrieval + rewrite + LLM. Cached answers are included; failed requests are not.
export function responseTime(events: StoredEvent[]): ResponseTime {
  const totals = questionEvents(events)
    .filter((e) => !e.error)
    .map((e) => (e.retrievalMs ?? 0) + (e.rewriteMs ?? 0) + (e.llmMs ?? 0))
    .sort((a, b) => a - b);
  return { count: totals.length, p50: percentile(totals, 0.5), p95: percentile(totals, 0.95) };
}

// ---------- satisfaction ----------

export interface Satisfaction {
  up: number;
  down: number;
  /** Thumbs-up share among rated answers. */
  upRate: number | null;
}

export function satisfaction(events: StoredEvent[]): Satisfaction {
  const votes = latestFeedback(events);
  const up = votes.filter((e) => e.rating === "up").length;
  const down = votes.filter((e) => e.rating === "down").length;
  return { up, down, upRate: rate(up, up + down) };
}

// ---------- questions per day ----------

export interface DayCount {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

const dayKey = (ms: number, offsetMinutes: number) => new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 10);

export function questionsPerDay(
  events: StoredEvent[],
  options: { from?: Date; to?: Date; tzOffsetMinutes?: number } = {},
): DayCount[] {
  const offset = options.tzOffsetMinutes ?? 0;
  const questions = questionEvents(events);
  if (questions.length === 0 && !options.from) return [];
  const times = questions.map(time);
  const from = options.from?.getTime() ?? Math.min(...times);
  const to = options.to?.getTime() ?? Math.max(...times, from);

  const counts = new Map<string, number>();
  for (const t of times) counts.set(dayKey(t, offset), (counts.get(dayKey(t, offset)) ?? 0) + 1);

  const days: DayCount[] = [];
  const last = dayKey(to, offset);
  for (let t = from; ; t += DAY_MS) {
    const key = dayKey(t, offset);
    days.push({ date: key, count: counts.get(key) ?? 0 });
    if (key >= last) break;
  }
  return days;
}

// ---------- top topics ----------

export interface Topic {
  title: string;
  count: number;
  category?: string;
}

export interface TopicStats {
  topics: Topic[];
  /** Only filled when a title -> category lookup is given. */
  categories: { category: string; count: number }[];
}

export function topTopics(events: StoredEvent[], categoryOf?: (title: string) => string | undefined): TopicStats {
  const byTitle = new Map<string, number>();
  for (const e of questionEvents(events)) {
    if (!e.grounded) continue;
    for (const title of new Set(e.sources)) byTitle.set(title, (byTitle.get(title) ?? 0) + 1);
  }
  const topics = [...byTitle]
    .map(([title, count]) => ({ title, count, ...(categoryOf?.(title) && { category: categoryOf(title) }) }) as Topic)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, TOP_N);

  const byCategory = new Map<string, number>();
  if (categoryOf) {
    for (const [title, count] of byTitle) {
      const category = categoryOf(title);
      if (category) byCategory.set(category, (byCategory.get(category) ?? 0) + count);
    }
  }
  const categories = [...byCategory]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return { topics, categories };
}

// ---------- gaps ----------

const STOPWORDS = new Set(
  (
    "a an the is are was were be do does did how to i we you my your our of for on in at it its this that can could " +
    "should would will what when where who why with and or if by as me us please customer customers staff"
  ).split(" "),
);

// Lowercase, strip punctuation, drop stopwords, sort the words: "How to reverse a NIP transfer?" and
// "reverse NIP transfer" end up with the same key.
export function gapKey(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  return [...(meaningful.length > 0 ? meaningful : words)].sort().join(" ");
}

export interface Gap {
  key: string;
  /** The most common original wording (ties go to the most recent). */
  question: string;
  count: number;
  lastAsked: string;
}

// Questions the manual could not answer, grouped by meaning.
export function findGaps(events: StoredEvent[]): Gap[] {
  const groups = new Map<string, { wordings: Map<string, { count: number; last: number }>; count: number; last: number }>();
  for (const e of questionEvents(events)) {
    if (!e.fallback || !e.question.trim()) continue;
    const key = gapKey(e.question);
    const group = groups.get(key) ?? { wordings: new Map(), count: 0, last: 0 };
    const wording = e.question.trim();
    const w = group.wordings.get(wording) ?? { count: 0, last: 0 };
    w.count += 1;
    w.last = Math.max(w.last, time(e));
    group.wordings.set(wording, w);
    group.count += 1;
    group.last = Math.max(group.last, time(e));
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, group]) => {
      const [question] = [...group.wordings].sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)[0];
      return { key, question, count: group.count, lastAsked: new Date(group.last).toISOString() };
    })
    .sort((a, b) => b.count - a.count || Date.parse(b.lastAsked) - Date.parse(a.lastAsked))
    .slice(0, TOP_N);
}

// ---------- flagged answers ----------

export interface FlaggedAnswer {
  messageId: string;
  question: string;
  sources: string[];
  reason?: string;
  /** When the thumbs-down was given. */
  ts: string;
}

// Thumbs-down votes joined to their question event by messageId. If the question event is not in the
// data (for example it is outside the date range), the feedback event's own copy is used.
export function flaggedAnswers(events: StoredEvent[]): FlaggedAnswer[] {
  const questionById = new Map<string, StoredEvent>();
  for (const e of events) if (isQuestion(e) && e.messageId) questionById.set(e.messageId, e);
  return latestFeedback(events)
    .filter((e) => e.rating === "down")
    .map((feedback) => {
      const question = questionById.get(feedback.messageId as string);
      return {
        messageId: feedback.messageId as string,
        question: question?.question || feedback.question,
        sources: question?.sources ?? feedback.sources,
        ...(feedback.reason && { reason: feedback.reason }),
        ts: feedback.ts,
      };
    })
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

// ---------- everything at once ----------

export interface Insights {
  totals: Totals;
  responseTime: ResponseTime;
  satisfaction: Satisfaction;
  questionsPerDay: DayCount[];
  topTopics: TopicStats;
  gaps: Gap[];
  flaggedAnswers: FlaggedAnswer[];
}

export function buildInsights(
  events: StoredEvent[],
  options: { from?: Date; to?: Date; tzOffsetMinutes?: number; categoryOf?: (title: string) => string | undefined } = {},
): Insights {
  return {
    totals: computeTotals(events),
    responseTime: responseTime(events),
    satisfaction: satisfaction(events),
    questionsPerDay: questionsPerDay(events, options),
    topTopics: topTopics(events, options.categoryOf),
    gaps: findGaps(events),
    flaggedAnswers: flaggedAnswers(events),
  };
}
