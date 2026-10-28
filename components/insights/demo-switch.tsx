"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function DemoSwitch({ checked, range }: { checked: boolean; range: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => router.push(`/insights?range=${range}${checked ? "" : "&demo=1"}`)}
      className="flex items-center gap-2 text-sm text-foreground"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background shadow-xs transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      Demo data
    </button>
  );
}
