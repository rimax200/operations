import { useChatStore } from "@/store/chat-store";
import type { Message } from "@/mock-data/chats";

// The latest message plus the last 4 turns before it.
const CONTEXT_MESSAGES = 5;
const REQUEST_TIMEOUT_MS = 30_000;

export function makeMessage(partial: Omit<Message, "id" | "timestamp">): Message {
  return { id: crypto.randomUUID(), timestamp: Date.now(), ...partial };
}

// Asks the assistant about a conversation's latest message and saves the reply (or an error
// bubble) into the store by conversation id. It never touches component state, so an answer that
// arrives after the user navigated elsewhere still lands in the right conversation.
export async function requestReply(conversationId: string) {
  const { conversations, addMessage, setPending } = useChatStore.getState();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation) return;

  setPending(conversationId, true);
  try {
    let reply: Message;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Never wait forever: a stuck request would leave the loading bubble up.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          messages: conversation.messages
            .filter((m) => !m.isError)
            .slice(-CONTEXT_MESSAGES)
            .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        reply = makeMessage({
          content: data?.error ?? "Something went wrong.",
          sender: "ai",
          isError: true,
          retryable: data?.busy === true,
        });
      } else {
        reply = makeMessage({
          content: data.answer,
          sender: "ai",
          sources: data.sources,
          grounded: data.grounded,
          suggestions: data.suggestions,
          cached: data.cached === true,
        });
      }
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      reply = makeMessage({
        content: timedOut
          ? "The assistant took too long to respond. Please try again."
          : "Something went wrong. Please try again.",
        sender: "ai",
        isError: true,
      });
    }
    addMessage(conversationId, reply);
  } finally {
    setPending(conversationId, false);
  }
}
