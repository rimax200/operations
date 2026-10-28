"use client";

import { useRef, useState } from "react";
import { isToday, isYesterday } from "date-fns";
import {
  SearchIcon,
  SparklesIcon,
  FileStackIcon,
  PlusIcon,
  XIcon,
  MessageCircleDashedIcon,
  WandSparklesIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/logo";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Conversation } from "@/mock-data/chats";

const navItems = [
  { href: "/", label: "New chat", icon: PlusIcon, active: () => false },
  { href: "/", label: "Ask AI", icon: SparklesIcon, active: (path: string) => path === "/" },
  {
    href: "/archive",
    label: "Manual Archive",
    icon: FileStackIcon,
    active: (path: string) => path.startsWith("/archive"),
  },
];

const GROUP_ORDER = ["Today", "Yesterday", "Earlier"] as const;

function groupOf(updatedAt: number) {
  if (isToday(updatedAt)) return "Today";
  if (isYesterday(updatedAt)) return "Yesterday";
  return "Earlier";
}

function ConversationItem({
  conversation,
  isActive,
  onNavigate,
}: {
  conversation: Conversation;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const [renaming, setRenaming] = useState(false);
  const renameDone = useRef(false);

  const finishRename = (save: boolean, value: string) => {
    if (renameDone.current) return;
    renameDone.current = true;
    if (save && value.trim()) renameConversation(conversation.id, value);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <Input
          autoFocus
          defaultValue={conversation.title}
          aria-label="Rename chat"
          className="h-[34px] bg-muted/50"
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename(true, e.currentTarget.value);
            if (e.key === "Escape") finishRename(false, "");
          }}
          onBlur={(e) => finishRename(true, e.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/item relative flex items-center rounded-md overflow-hidden",
        isActive && "bg-sidebar-accent"
      )}
    >
      <Link
        href={`/c/${conversation.id}`}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "flex-1 justify-start gap-2 px-2 text-left h-auto py-1.5 min-w-0 pr-8",
          isActive ? "hover:bg-sidebar-accent" : "hover:bg-accent"
        )}
      >
        <MessageCircleDashedIcon className="size-4 shrink-0" />
        <span className="text-sm truncate min-w-0">{conversation.title}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-1 size-7 opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 data-[state=open]:opacity-100 transition-opacity"
          >
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">More</span>
          </Button>
        } />
        <DropdownMenuContent className="w-48" side="right" align="start">
          <DropdownMenuItem
            onClick={() => {
              renameDone.current = false;
              setRenaming(true);
            }}
          >
            <PencilIcon className="size-4 text-muted-foreground" />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              if (!window.confirm(`Delete "${conversation.title}"? This can't be undone.`)) return;
              deleteConversation(conversation.id);
              if (isActive) router.push("/");
            }}
          >
            <Trash2Icon className="size-4" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ChatSidebar({
  manualVersion,
  onNavigate,
}: {
  manualVersion: string;
  onNavigate?: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const hasHydrated = useChatStore((s) => s.hasHydrated);
  const clearAll = useChatStore((s) => s.clearAll);
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(
      (c) =>
        !needle ||
        c.title.toLowerCase().includes(needle) ||
        c.messages.some((m) => m.content.toLowerCase().includes(needle))
    );

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        <div className="flex w-full items-center gap-2.5 px-2 h-10">
          <Logo className="size-6" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-semibold text-sm">Ops Assistant</span>
            <span className="text-xs text-muted-foreground truncate">Manual v{manualVersion}</span>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-10 h-[34px] bg-muted/50"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2 flex items-center justify-center size-5 rounded bg-muted text-muted-foreground hover:bg-accent"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            aria-current={active(pathname) ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "w-full justify-start gap-2 px-2",
              active(pathname) && "bg-sidebar-accent font-medium"
            )}
          >
            <Icon className="size-4" />
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-3 space-y-4">
          {hasHydrated && visible.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {needle ? `No chats match "${query.trim()}".` : "No chats yet. Ask a question to start one."}
            </p>
          )}
          {hasHydrated &&
            GROUP_ORDER.map((group) => {
              const items = visible.filter((c) => groupOf(c.updatedAt) === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {group}
                    </p>
                  </div>
                  {items.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={pathname === `/c/${conversation.id}`}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              );
            })}
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {hasHydrated && conversations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 px-2 text-muted-foreground"
            onClick={() => {
              if (!window.confirm("Clear all chat history? This can't be undone.")) return;
              clearAll();
              if (pathname.startsWith("/c/")) router.push("/");
            }}
          >
            <Trash2Icon className="size-4" />
            <span className="text-xs">Clear all history</span>
          </Button>
        )}
        <p className="px-2 text-xs text-muted-foreground">Chats are saved only on this device.</p>
      </div>

      <div className="p-5 border-t border-sidebar-border">
        <div className="rounded-lg bg-linear-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10 p-3.5 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <WandSparklesIcon className="size-4" />
              <span className="text-sm font-semibold">Square UI</span>
            </div>
            <p className="text-xs text-muted-foreground leading-tight">
              Collection of beautifully crafted open-source layouts UI built
              with shadcn/ui.
            </p>
          </div>
          <Button
            size="sm"
            nativeButton={false}
            className="relative w-fit h-[30px] px-3 overflow-hidden bg-white text-black hover:bg-white/90 shadow-[0px_1px_2px_0px_rgba(8,8,8,0.2),0px_4px_4px_0px_rgba(8,8,8,0.08),inset_0px_1px_1px_0px_rgba(255,255,255,0.2),inset_0px_6px_12px_0px_rgba(255,255,255,0.12)]"
            render={
              <Link
                href="https://square.lndevui.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(205,175,250,1),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(129,169,248,1),transparent_50%),radial-gradient(ellipse_at_top_left,rgba(247,203,191,1),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(164,252,245,1),transparent_50%)]" />
                <span className="relative z-10 font-medium text-xs">
                  square.lndevui.com
                </span>
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
