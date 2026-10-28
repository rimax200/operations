"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import type { Message } from "./chat-message";
import { ChatConversationView } from "./chat-conversation-view";

export function ChatMain() {
  const [message, setMessage] = useState("");
  const [selectedMode, setSelectedMode] = useState("fast");
  const [selectedModel, setSelectedModel] = useState("square-3");
  const [isConversationStarted, setIsConversationStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("q");
  const prefillHandled = useRef(false);

  const askAssistant = async (history: Message[]) => {
    setMessages(history);
    setMessage("");
    setIsLoading(true);

    let reply: Message;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      reply = {
        id: `${Date.now()}-ai`,
        content: data.answer,
        sender: "ai",
        timestamp: new Date(),
        sources: data.sources,
        grounded: data.grounded,
        suggestions: data.suggestions,
      };
    } catch (err) {
      reply = {
        id: `${Date.now()}-error`,
        content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        sender: "ai",
        timestamp: new Date(),
        isError: true,
      };
    }
    setMessages((prev) => [...prev, reply]);
    setIsLoading(false);
  };

  const handleSend = () => {
    if (!message.trim() || isLoading) return;

    setIsConversationStarted(true);
    askAssistant([
      { id: `${Date.now()}-user`, content: message, sender: "user", timestamp: new Date() },
    ]);
  };

  // "Ask AI about this" in the archive lands here as /?q=...; send it once, then clean the URL.
  useEffect(() => {
    if (!prefill || prefillHandled.current) return;
    prefillHandled.current = true;
    router.replace("/");
    setIsConversationStarted(true);
    askAssistant([
      { id: `${Date.now()}-user`, content: prefill, sender: "user", timestamp: new Date() },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const handleReset = () => {
    setIsConversationStarted(false);
    setIsLoading(false);
    setMessages([]);
    setMessage("");
  };

  const handleSendMessage = (content: string) => {
    if (isLoading) return;
    askAssistant([
      ...messages,
      { id: `${Date.now()}-user`, content, sender: "user", timestamp: new Date() },
    ]);
  };

  if (isConversationStarted) {
    return (
      <ChatConversationView
        messages={messages}
        isLoading={isLoading}
        message={message}
        onMessageChange={setMessage}
        onSend={handleSendMessage}
        onReset={handleReset}
      />
    );
  }

  return (
    <ChatWelcomeScreen
      message={message}
      onMessageChange={setMessage}
      onSend={handleSend}
      selectedMode={selectedMode}
      onModeChange={setSelectedMode}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
    />
  );
}
