"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GapRow {
  question: string;
  count: number;
  lastAskedLabel: string;
  lastAskedIso: string;
}

// Spreadsheet apps run cells that start with = + - @ as formulas; prefix them so they stay text.
function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function GapsPanel({ rows }: { rows: GapRow[] }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const text = rows
      .map((r, i) => `${i + 1}. ${r.question} (asked ${r.count} ${r.count === 1 ? "time" : "times"}, last ${r.lastAskedLabel})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; nothing else to do.
    }
  };

  const exportCsv = () => {
    const lines = [
      ["Question", "Times asked", "Last asked"].join(","),
      ...rows.map((r) => [csvCell(r.question), csvCell(r.count), csvCell(r.lastAskedIso)].join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "manual-gaps.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Gaps in the manual</h2>
          <p className="text-sm text-muted-foreground">Questions staff asked that the manual could not answer.</p>
        </div>
        {rows.length > 0 && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy as list"}
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <DownloadIcon />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No gaps yet. Every question in this period was answered from the manual.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Question</th>
                <th className="px-3 py-2 text-right font-medium">Times asked</th>
                <th className="py-2 pl-3 text-right font-medium">Last asked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.question} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">{r.question}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.count}</td>
                  <td className="whitespace-nowrap py-2.5 pl-3 text-right text-muted-foreground">{r.lastAskedLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
