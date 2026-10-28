import { FileStackIcon } from "lucide-react";

export default function ArchivePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <FileStackIcon className="size-5 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">Pick a section to read</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Search or browse the list. Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">/</kbd> to search,
        use the arrow keys to move and Enter to open.
      </p>
    </div>
  );
}
