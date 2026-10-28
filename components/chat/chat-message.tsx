import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { Message } from "@/mock-data/chats";

export type { Message };

interface ChatMessageProps {
  message: Message;
  onSuggestionClick?: (topic: string) => void;
}

export function ChatMessage({ message, onSuggestionClick }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-4",
        message.sender === "user" ? "justify-end" : "justify-start"
      )}
    >
      {message.sender === "ai" && (
        <div className="shrink-0">
          <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
            <Logo className="size-6" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%]",
          message.sender === "user"
            ? "bg-primary text-primary-foreground"
            : message.isError
              ? "bg-destructive/10 text-destructive"
              : message.grounded === false
                ? "bg-muted text-muted-foreground border border-dashed border-border"
                : "bg-secondary"
        )}
      >
        {message.sender === "user" ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <span
                key={source.id}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
              >
                Source: {source.title} · {source.category}
              </span>
            ))}
          </div>
        )}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.suggestions.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onSuggestionClick?.(topic)}
                className="cursor-pointer rounded-full border border-primary/40 bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {message.sender === "user" && (
        <div className="shrink-0">
          <Avatar className="size-8">
            <AvatarImage src="/ln.png" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}

