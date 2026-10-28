import { readFileSync } from "node:fs";
import path from "node:path";

export interface ManualChunk {
  id: string;
  title: string;
  category: string;
  text: string;
}

const MAX_CHUNK_CHARS = 1200;

let cache: ManualChunk[] | null = null;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Packs paragraphs (blank-line separated) into pieces of at most MAX_CHUNK_CHARS.
// A single oversized paragraph is split on line (step) boundaries.
function splitBody(body: string): string[] {
  const units = body
    .split(/\n\s*\n/)
    .flatMap((paragraph) =>
      paragraph.length > MAX_CHUNK_CHARS ? paragraph.split("\n") : [paragraph],
    )
    .map((unit) => unit.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length + 2 > MAX_CHUNK_CHARS) {
      pieces.push(current);
      current = unit;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function getManualChunks(): ManualChunk[] {
  if (cache) return cache;

  const raw = readFileSync(path.join(process.cwd(), "data", "manual.md"), "utf8");
  const sections = raw.split(/^## /m).slice(1);
  const chunks: ManualChunk[] = [];

  for (const section of sections) {
    const [titleLine, ...rest] = section.split("\n");
    const title = titleLine.trim();
    let body = rest.join("\n");

    let category = "General";
    const match = body.match(/^\s*Category:\s*(.+)$/m);
    if (match) {
      category = match[1].trim();
      body = body.replace(match[0], "");
    }

    const baseId = slugify(title);
    splitBody(body).forEach((text, index) => {
      chunks.push({
        id: index === 0 ? baseId : `${baseId}-${index + 1}`,
        title,
        category,
        text,
      });
    });
  }

  cache = chunks;
  return chunks;
}

export interface ManualSection {
  id: string;
  title: string;
  category: string;
  text: string;
}

// Whole sections (sub-chunks merged back together), for browsing rather than retrieval.
export function getManualSections(): ManualSection[] {
  const sections: ManualSection[] = [];
  for (const chunk of getManualChunks()) {
    const last = sections[sections.length - 1];
    if (last && last.title === chunk.title) last.text += `\n\n${chunk.text}`;
    else sections.push({ id: chunk.id, title: chunk.title, category: chunk.category, text: chunk.text });
  }
  return sections;
}

export function getManualVersion(): string {
  const raw = readFileSync(path.join(process.cwd(), "data", "manual.md"), "utf8");
  return raw.split("\n", 1)[0].replace(/^Manual version:\s*/i, "").trim();
}
