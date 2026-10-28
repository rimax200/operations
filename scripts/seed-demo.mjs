// Writes ~300 synthetic usage events to data/logs/demo-events.jsonl for the Insights demo.
// Deterministic: the same seed always produces the same questions, order and numbers (timestamps are
// spread over the 14 days before the moment you run it).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SEED = 20261028;
const DAYS = 14;
const QUESTIONS = 262;
const OUT = path.join(process.cwd(), "data", "logs", "demo-events.jsonl");

// mulberry32: small, fast, seedable PRNG
function prng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(SEED);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (list) => list[int(0, list.length - 1)];
function weighted(items, weight) {
  const total = items.reduce((sum, item, i) => sum + weight(item, i), 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weight(items[i], i);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Section titles come from the real manual, so demo topics match the archive.
const manual = await readFile(path.join(process.cwd(), "data", "manual.md"), "utf8");
const titles = [...manual.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

const phrasing = {
  "Failed ATM Withdrawal (Account Debited, No Cash)": ["customer was debited but the ATM paid no cash", "ATM debited my customer no cash dispensed", "how long does an ATM reversal take?"],
  "Double Debit": ["account dey show debit twice", "customer was debited twice for one transaction", "how do I handle a double debit?"],
  "Failed Transfer (Debited, Beneficiary Not Credited)": ["transfer failed but money left the account", "customer debited, beneficiary not credited", "failed transfer reversal timeline"],
  "KYC Tiers and Limits": ["what are the KYC tier limits?", "tier 2 daily transfer limit", "how do I upgrade a customer to tier 3?"],
  "Card Blocking": ["how do I block a customer's card?", "customer lost his card", "block card after theft"],
  "Suspected Fraud": ["who do I escalate suspected fraud to?", "customer says someone hacked his account", "suspected fraud process"],
  "Unauthorized Debit Dispute": ["customer says he did not authorise a debit", "unauthorized debit dispute steps", "how long does a dispute investigation take?"],
  "Dormant Account Reactivation": ["how do I reactivate a dormant account?", "dormant account requirements", "when does an account become dormant?"],
  "Individual Account Opening": ["documents for opening an individual account", "how do I open a savings account?", "opening deposit for current account"],
  "Corporate Account Opening": ["how do I open a corporate account?", "documents for a company account", "corporate account opening timeline"],
  "Mobile App Login Problems": ["customer cannot login to the app", "app says device not recognised", "customer forgot app password"],
  "Token and OTP Issues": ["customer not receiving OTP", "hardware token replacement fee", "OTP expired what do I do"],
  "Card Replacement": ["how do I replace a damaged card?", "card replacement fee and timeline"],
  "ATM PIN Reset": ["customer forgot his ATM PIN", "how do I reset a card PIN?"],
  "Change of Phone Number or Email": ["customer wants to change phone number", "how to update customer email"],
  "BVN and NIN Issues": ["BVN name does not match ID", "how do I link a NIN to an account?"],
  "Statement Requests": ["customer wants a 12 month statement", "how much is a stamped statement?"],
  "Account Closure": ["customer wan close account", "how do I close an account?"],
  "Complaint Handling and Resolution Timelines": ["what is the complaint resolution timeline?", "customer has a problem with his money"],
  "Escalation Matrix": ["who do I escalate to after 2 hours?", "escalation levels"],
  "Reference Letters and Account Confirmation": ["how do I issue a reference letter?", "reference letter fee"],
  "Wrong Beneficiary Transfer": ["customer sent money to wrong account", "how do I recall a wrong transfer?"],
  "Card Swallowed by ATM": ["ATM swallowed customer's card", "wetin I go do if customer card swallow"],
  "POS Payment Failed but Account Debited": ["POS failed but customer was debited"],
  "Phishing and Shared Credentials": ["customer shared his OTP with a caller"],
  "After-Hours and Emergency Escalation": ["who do I call for fraud after hours?"],
};
// Roughly the order staff would ask about things, most popular first.
const popularity = [
  "Failed ATM Withdrawal (Account Debited, No Cash)", "KYC Tiers and Limits", "Card Blocking", "Failed Transfer (Debited, Beneficiary Not Credited)",
  "Double Debit", "Suspected Fraud", "Dormant Account Reactivation", "Individual Account Opening", "Unauthorized Debit Dispute", "Mobile App Login Problems",
  "Token and OTP Issues", "Card Replacement", "ATM PIN Reset", "Corporate Account Opening", "Change of Phone Number or Email", "BVN and NIN Issues",
  "Statement Requests", "Account Closure", "Complaint Handling and Resolution Timelines", "Escalation Matrix",
];
const topicRank = (title) => {
  const i = popularity.indexOf(title);
  return i === -1 ? popularity.length + 3 : i;
};
const topics = titles.filter((t) => phrasing[t] || popularity.includes(t));

const gapQuestions = [
  { weight: 8, wordings: ["how to process a POS chargeback", "how do I process a POS chargeback?", "POS chargeback process"] },
  { weight: 6, wordings: ["customer wants to change account type", "how do I change a customer's account type?"] },
  { weight: 5, wordings: ["how do I reset a customer's token", "reset customer token"] },
  { weight: 4, wordings: ["mortgage requirements", "what are the mortgage requirements?"] },
  { weight: 4, wordings: ["how do I reverse a wrong NIP transfer", "reverse wrong NIP transfer"] },
  { weight: 3, wordings: ["how to add a joint account holder"] },
  { weight: 2, wordings: ["how do I handle a deceased customer's account?"] },
  { weight: 2, wordings: ["customer wants a loan statement"] },
  { weight: 1, wordings: ["how to update customer signature"] },
  { weight: 1, wordings: ["domiciliary account opening requirements"] },
];

const reasons = ["Wrong answer", "Incomplete", "Should be in the manual", "Hard to follow"];
const now = Date.now();
const DAY = 86_400_000;

function timestamp() {
  // Busier on weekdays, between 08:00 and 17:00 Lagos time (UTC+1).
  for (;;) {
    const daysAgo = int(0, DAYS - 1);
    const day = new Date(now - daysAgo * DAY);
    const weekday = day.getUTCDay();
    if ((weekday === 0 || weekday === 6) && rand() < 0.75) continue;
    const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), int(7, 16), int(0, 59), int(0, 59), int(0, 999));
    if (t < now - 5000) return t;
  }
}

const events = [];
let seq = 0;
let conversation = 0;
const nextConversation = () => `demo-conv-${String(++conversation).padStart(3, "0")}`;

function question({ ts, text, kind }) {
  const messageId = `demo-msg-${String(++seq).padStart(4, "0")}`;
  const base = {
    ts: new Date(ts).toISOString(), type: "question", conversationId: nextConversation(), question: text,
    grounded: false, fallback: false, sources: [], cached: false, retrievalMs: null, rewriteMs: null, llmMs: null, messageId,
  };
  if (kind === "greeting") return { ...base, question: pick(["hi", "hello", "good morning", "thanks", "thank you"]) };
  if (kind === "error") return { ...base, error: true, retrievalMs: int(0, 8), llmMs: int(150, 400) };
  if (kind === "fallback") {
    const rewrote = rand() < 0.8;
    return { ...base, fallback: true, retrievalMs: int(0, 6), rewriteMs: rewrote ? int(300, 700) : null, llmMs: rand() < 0.4 ? int(500, 1100) : null };
  }
  const section = text.section;
  const sources = [section, ...(rand() < 0.2 ? [pick(titles.filter((t) => t !== section))] : [])];
  const cached = rand() < 0.18;
  return {
    ...base, question: text.text, grounded: true, sources, cached,
    retrievalMs: cached ? int(1, 5) : int(0, 10),
    rewriteMs: !cached && rand() < 0.12 ? int(300, 700) : null,
    llmMs: cached ? null : int(600, 1500),
  };
}

for (let i = 0; i < QUESTIONS; i++) {
  const ts = timestamp();
  const r = rand();
  if (r < 0.04) events.push(question({ ts, kind: "greeting" }));
  else if (r < 0.05) events.push(question({ ts, kind: "error", text: pick(Object.values(phrasing).flat()) }));
  else if (r < 0.17) {
    const gap = weighted(gapQuestions, (g) => g.weight);
    events.push(question({ ts, kind: "fallback", text: pick(gap.wordings) }));
  } else {
    const section = weighted(topics, (t) => 1 / Math.pow(topicRank(t) + 1, 0.85));
    const wordings = phrasing[section] ?? [`how do I handle ${section.toLowerCase()}?`];
    events.push(question({ ts, kind: "answer", text: { text: pick(wordings), section } }));
  }
}

// Staff rate about 14% of answers (and fallbacks): ~85% thumbs up, the rest down, usually with a reason.
const feedback = [];
for (const e of events) {
  if (e.error || (!e.grounded && !e.fallback)) continue;
  if (rand() > 0.14) continue;
  const base = {
    type: "feedback", conversationId: e.conversationId, messageId: e.messageId, question: e.question, grounded: e.grounded,
    fallback: e.fallback, sources: e.sources, cached: e.cached, retrievalMs: e.retrievalMs, rewriteMs: e.rewriteMs, llmMs: e.llmMs,
  };
  const at = Date.parse(e.ts) + int(4000, 90_000);
  if (at > now) continue;
  if (rand() < 0.85) {
    feedback.push({ ts: new Date(at).toISOString(), ...base, rating: "up" });
  } else {
    feedback.push({ ts: new Date(at).toISOString(), ...base, rating: "down" });
    if (rand() < 0.75) {
      const reason = e.fallback ? "Should be in the manual" : pick(reasons);
      feedback.push({ ts: new Date(at + int(1000, 8000)).toISOString(), ...base, rating: "down", reason });
    }
  }
}

const all = [...events, ...feedback].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, all.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
console.log(`Wrote ${all.length} demo events (${events.length} questions, ${feedback.length} feedback) to ${path.relative(process.cwd(), OUT)}`);
