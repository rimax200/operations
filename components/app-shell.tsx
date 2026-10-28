"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { MenuIcon, Github } from "lucide-react";
import { useChatStore } from "@/store/chat-store";

const REPO_URL = "https://github.com/ln-dev7/square-ui/tree/master/templates/chat";

function GithubLink() {
  return (
    <Link
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Source on GitHub"
      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    >
      <Github className="size-4" />
    </Link>
  );
}

export function AppShell({ manualVersion, children }: { manualVersion: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // Remember which page the mobile sidebar was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const sidebarOpen = openOn === pathname;
  const setSidebarOpen = (open: boolean) => setOpenOn(open ? pathname : null);

  // Saved chats are read after mount so the server HTML and the first client render match.
  useEffect(() => {
    void useChatStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block w-64 border-r border-border">
        <ChatSidebar manualVersion={manualVersion} />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 border-none [&>button]:hidden">
          <ChatSidebar manualVersion={manualVersion} onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex md:hidden items-center justify-between border-b border-border px-4 h-14 bg-background z-20">
          <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)}>
            <MenuIcon className="size-5" />
          </Button>

          <div className="flex items-center gap-2">
            <GithubLink />
            <ThemeToggle />
          </div>
        </div>

        <div className="hidden md:flex absolute top-4 right-4 gap-2 z-20">
          <GithubLink />
          <ThemeToggle />
        </div>

        <div className="flex-1 overflow-hidden relative">{children}</div>
      </div>
    </div>
  );
}
