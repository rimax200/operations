"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, CopyIcon, SparklesIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { emphasizeLabels } from "./format";
import type { ArchiveSection } from "./archive-shell";

export function SectionReader({ section, version }: { section: ArchiveSection; version: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${section.title}\n${section.category}\n\n${section.text}`);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; nothing else to do.
    }
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/archive"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3 mb-4 md:hidden")}
      >
        <ArrowLeftIcon className="size-4" />
        All sections
      </Link>

      <header className="border-b border-border pb-5 md:pr-20">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
            {section.category}
          </span>
          <span className="text-muted-foreground">Manual version {version}</span>
        </div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{section.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Link
            href={`/?q=${encodeURIComponent(`Explain: ${section.title}`)}`}
            className={buttonVariants({ size: "sm" })}
          >
            <SparklesIcon />
            Ask AI about this
          </Link>
        </div>
      </header>

      <div className="pt-5 text-[15px] leading-relaxed [&_li::marker]:font-semibold [&_li::marker]:text-muted-foreground">
        <Markdown keepLineBreaks>{emphasizeLabels(section.text)}</Markdown>
      </div>
    </article>
  );
}
