"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import { ChatConversationView } from "./chat-conversation-view";
import { makeMessage, requestReply } from "@/lib/chat-client";
import { useChatStore } from "@/store/chat-store";
import type { MessageFeedback } from "@/mock-data/chats";

export function ChatMain() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // "/" is a fresh chat; "/c/<id>" is a saved conversation.
  const conversationId = pathname.startsWith("/c/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;
  const hasHydrated = useChatStore((s) => s.hasHydrated);
  const conversation = useChatStore((s) =>
    conversationId ? s.conversations.find((c) => c.id === conversationId) : undefined,
  );
  const isLoading = useChatStore((s) => conversationId !== null && s.pendingIds.includes(conversationId));
  const createConversation = useChatStore((s) => s.createConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const setActive = useChatStore((s) => s.setActive);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);

  const [message, setMessage] = useState("");

  const send = (content: string) => {
    const text = content.trim();
    if (!text || isLoading) return;
    const userMessage = makeMessage({ content: text, sender: "user" });
    let id = conversation?.id;
    if (id) {
      addMessage(id, userMessage);
    } else {
      id = createConversation(userMessage);
      // Give the conversation its own URL without a navigation, so this view keeps its state.
      window.history.replaceState(null, "", `/c/${id}`);
    }
    setMessage("");
    void requestReply(id);
  };

  // "Try again" on a rate-limited error: drop the error bubble and resend the last question once.
  const retry = () => {
    if (!conversation || isLoading) return;
    const last = conversation.messages[conversation.messages.length - 1];
    if (!last?.isError) return;
    removeMessage(conversation.id, last.id);
    void requestReply(conversation.id);
  };

  // Thumbs up/down: saved on the message (so it persists) and recorded in the server log.
  const sendFeedback = (messageId: string, feedback: MessageFeedback) => {
    if (!conversation) return;
    const index = conversation.messages.findIndex((m) => m.id === messageId);
    const message = conversation.messages[index];
    const question = conversation.messages
      .slice(0, index)
      .reverse()
      .find((m) => m.sender === "user")?.content;
    if (!message || !question) return;
    updateMessage(conversation.id, messageId, { feedback });
    // Skipping the "why?" question adds nothing new to log.
    if (feedback.reasonSkipped) return;
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: conversation.id,
        messageId,
        question: question.slice(0, 1000),
        rating: feedback.rating,
        reason: feedback.reason,
        grounded: message.grounded === true,
        fallback: message.fallback === true,
        cached: message.cached === true,
        sources: (message.sources ?? []).map((source) => source.title),
        timings: message.timings,
      }),
    }).catch(() => {
      // Feedback logging is best effort; the vote is already saved on the message.
    });
  };

  // An unknown conversation id goes back to a fresh chat.
  useEffect(() => {
    if (hasHydrated && conversationId && !conversation) router.replace("/");
  }, [hasHydrated, conversationId, conversation, router]);

  useEffect(() => {
    setActive(conversation?.id ?? null);
  }, [conversation?.id, setActive]);

  // "Ask AI about this" in the archive lands here as /?q=...; it starts a new conversation once.
  const prefill = searchParams.get("q");
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (!hasHydrated || !prefill || prefillHandled.current || conversationId) return;
    prefillHandled.current = true;
    send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, prefill]);

  if (conversationId) {
    // Nothing to show until saved chats are loaded; an unknown id is redirected above.
    if (!conversation) return null;
    return (
      <ChatConversationView
        messages={conversation.messages}
        isLoading={isLoading}
        message={message}
        onMessageChange={setMessage}
        onSend={send}
        onReset={() => router.push("/")}
        onRetry={retry}
        onFeedback={sendFeedback}
      />
    );
  }

  return (
    <ChatWelcomeScreen
      message={message}
      onMessageChange={setMessage}
      onSend={() => send(message)}
      onStarterClick={send}
    />
  );
}
