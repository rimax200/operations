// Display-only helpers for the manual archive. They never change the manual's wording.

// Bolds short leading labels ("Timeline:", "Level 2:") so sections are easier to scan.
export function emphasizeLabels(text: string): string {
  return text.replace(/^([A-Z][A-Za-z0-9 ,&'()/-]{1,48}):(?=\s|$)/gm, "**$1:**");
}

export function buildSnippet(text: string, terms: string[], length = 130): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const hits = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0);
  if (hits.length === 0) return flat.length > length ? `${flat.slice(0, length).trimEnd()}…` : flat;
  const start = Math.max(0, Math.min(...hits) - 40);
  const end = Math.min(flat.length, start + length);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

export function splitHighlight(text: string, terms: string[]): { text: string; match: boolean }[] {
  const escaped = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return [{ text, match: false }];
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }));
}
