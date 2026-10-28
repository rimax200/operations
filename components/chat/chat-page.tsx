import { Suspense } from "react";
import { ChatMain } from "./chat-main";
import { GridPattern } from "@/components/ui/grid-pattern";

export function ChatPage() {
  return (
    <>
      <GridPattern className="pointer-events-none" />
      <div className="relative z-10 h-full">
        <Suspense>
          <ChatMain />
        </Suspense>
      </div>
    </>
  );
}
