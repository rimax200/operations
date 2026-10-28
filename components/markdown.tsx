import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// `node` is destructured away so react-markdown does not forward it to the DOM.
/* eslint-disable @typescript-eslint/no-unused-vars */
const markdownComponents: Components = {
  p: ({ node: _node, ...props }) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node: _node, ...props }) => <em className="italic" {...props} />,
  ol: ({ node: _node, ...props }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-0.5" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-medium" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="border border-border px-2 py-1" {...props} />,
};
/* eslint-enable @typescript-eslint/no-unused-vars */

// Renders model/manual Markdown (raw HTML is not enabled). `keepLineBreaks` preserves
// single newlines inside a paragraph, for manual sections written as plain text lines.
export function Markdown({
  children,
  keepLineBreaks = false,
}: {
  children: string;
  keepLineBreaks?: boolean;
}) {
  const components: Components = keepLineBreaks
    ? {
        ...markdownComponents,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        p: ({ node: _node, ...props }) => (
          <p className={cn("my-2 whitespace-pre-line first:mt-0 last:mb-0")} {...props} />
        ),
      }
    : markdownComponents;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
