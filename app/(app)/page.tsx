import { Suspense } from "react";
import { ChatMain } from "@/components/chat/chat-main";
import { GridPattern } from "@/components/ui/grid-pattern";

export default function ChatPage() {
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
