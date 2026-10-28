import { useChatStore } from "@/store/chat-store";
import type { Message } from "@/mock-data/chats";

// The latest message plus the last 4 turns before it.
const CONTEXT_MESSAGES = 5;

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
  let reply: Message;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation.messages
          .filter((m) => !m.isError)
          .slice(-CONTEXT_MESSAGES)
          .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
    reply = makeMessage({
      content: data.answer,
      sender: "ai",
      sources: data.sources,
      grounded: data.grounded,
      suggestions: data.suggestions,
    });
  } catch (err) {
    reply = makeMessage({
      content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      sender: "ai",
      isError: true,
    });
  }
  addMessage(conversationId, reply);
  setPending(conversationId, false);
}
