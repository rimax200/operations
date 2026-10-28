"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import MiniSearch from "minisearch";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildSnippet, splitHighlight } from "./format";

export interface ArchiveSection {
  id: string;
  title: string;
  category: string;
  text: string;
}

interface Row {
  key: string;
  group: "recent" | "all" | "results";
  section: ArchiveSection;
  terms: string[];
}

const RECENT_KEY = "manual-archive:recent";
const RECENT_MAX = 5;

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {splitHighlight(text, terms).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode, quota); recents are optional.
  }
}

export function ArchiveShell({
  sections,
  children,
}: {
  sections: ArchiveSection[];
  children: React.ReactNode;
}) {
  const { id: activeId } = useParams<{ id?: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const categories = useMemo(() => [...new Set(sections.map((s) => s.category))], [sections]);
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  const index = useMemo(() => {
    const ms = new MiniSearch<ArchiveSection>({ fields: ["title", "category", "text"] });
    ms.addAll(sections);
    return ms;
  }, [sections]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecent());
  }, []);

  // Record the section being read.
  useEffect(() => {
    if (!activeId || !byId.has(activeId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent((prev) => {
      const next = [activeId, ...prev.filter((id) => id !== activeId)].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, [activeId, byId]);

  const trimmed = query.trim();
  const rows = useMemo<Row[]>(() => {
    const inCategory = (s: ArchiveSection) => !category || s.category === category;
    if (trimmed) {
      // Fuzzy matching only for longer words, so "atm" does not match "at" or "am".
      const options = { boost: { title: 3 }, fuzzy: (term: string) => (term.length > 3 ? 0.2 : false), prefix: true };
      let results = index.search(trimmed, { ...options, combineWith: "AND" });
      if (results.length === 0) results = index.search(trimmed, { ...options, combineWith: "OR" });
      return results
        .map((r) => ({ section: byId.get(r.id as string)!, terms: r.terms }))
        .filter((r) => inCategory(r.section))
        .map((r) => ({ key: `r-${r.section.id}`, group: "results" as const, ...r }));
    }
    const recentRows = recent
      .map((id) => byId.get(id))
      .filter((s): s is ArchiveSection => Boolean(s) && inCategory(s!))
      .map((section) => ({ key: `recent-${section.id}`, group: "recent" as const, section, terms: [] }));
    const allRows = sections
      .filter(inCategory)
      .map((section) => ({ key: `all-${section.id}`, group: "all" as const, section, terms: [] }));
    return [...recentRows, ...allRows];
  }, [trimmed, category, index, byId, recent, sections]);

  const activeCursor = Math.min(cursor, Math.max(rows.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row-index="${activeCursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeCursor]);

  // "/" focuses the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setCursor(Math.min(Math.max(activeCursor + delta, 0), Math.max(rows.length - 1, 0)));
    } else if (e.key === "Enter" && e.target === inputRef.current && rows[activeCursor]) {
      e.preventDefault();
      router.push(`/archive/${rows[activeCursor].section.id}`);
    } else if (e.key === "Escape" && e.target === inputRef.current) {
      setQuery("");
    }
  };

  const hasFilters = Boolean(trimmed || category);
  const countLabel = trimmed
    ? `${rows.length} ${rows.length === 1 ? "result" : "results"}`
    : `${rows.length - rows.filter((r) => r.group === "recent").length} sections`;

  return (
    <div className="flex h-full">
      <div
        className={cn(
          "w-full flex-col border-r border-border bg-background md:flex md:w-80 lg:w-96 md:shrink-0",
          activeId ? "hidden" : "flex",
        )}
        onKeyDown={onListKeyDown}
      >
        <div className="space-y-3 border-b border-border p-3">
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-3 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              placeholder="Search the manual"
              aria-label="Search the manual"
              className="h-[34px] bg-muted/50 pl-9 pr-8"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <div className="absolute right-2 flex size-5 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                /
              </div>
            )}
          </div>

          <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setCursor(0);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                {c ?? "All"}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {countLabel}
          </p>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-sm font-medium">Nothing matches {trimmed ? `“${trimmed}”` : "that filter"}</p>
              <p className="text-xs text-muted-foreground">
                Try a different word or a shorter search. If the manual doesn&apos;t cover it, check with your
                supervisor.
              </p>
              {hasFilters && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setCategory(null);
                  }}
                >
                  Clear search and filters
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {rows.map((row, i) => {
                const heading =
                  row.group !== "results" && rows[i - 1]?.group !== row.group
                    ? row.group === "recent"
                      ? "Recently viewed"
                      : "All sections"
                    : null;
                const isActive = row.section.id === activeId;
                return (
                  <li key={row.key}>
                    {heading && (
                      <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground first:pt-1">
                        {heading}
                      </p>
                    )}
                    <Link
                      href={`/archive/${row.section.id}`}
                      data-row-index={i}
                      aria-current={isActive ? "page" : undefined}
                      onMouseMove={() => i !== activeCursor && setCursor(i)}
                      className={cn(
                        "block rounded-md px-2.5 py-2 outline-none transition-colors",
                        isActive ? "bg-accent" : "hover:bg-accent/60",
                        i === activeCursor && "ring-2 ring-ring/50",
                      )}
                    >
                      <span className="block text-sm font-medium leading-snug">
                        <Highlight text={row.section.title} terms={row.terms} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{row.section.category}</span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground/90">
                        <Highlight text={buildSnippet(row.section.text, row.terms)} terms={row.terms} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className={cn("min-w-0 flex-1 overflow-y-auto", activeId ? "block" : "hidden md:block")}>
        {children}
      </div>
    </div>
  );
}
