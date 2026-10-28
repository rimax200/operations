export interface MessageSource {
  id: string;
  title: string;
  category: string;
}

export interface MessageFeedback {
  rating: "up" | "down";
  reason?: string;
  /** The user skipped the "why?" question after a thumbs down. */
  reasonSkipped?: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  /** Epoch milliseconds, so it survives JSON persistence. */
  timestamp: number;
  sources?: MessageSource[];
  grounded?: boolean;
  suggestions?: string[];
  /** Served from the answer cache, so it came back instantly. */
  cached?: boolean;
  /** The manual had no answer (not set for greetings). */
  fallback?: boolean;
  timings?: { retrievalMs: number | null; rewriteMs: number | null; llmMs: number | null };
  feedback?: MessageFeedback;
  isError?: boolean;
  /** Error bubble that offers a "Try again" button (rate limited). */
  retryable?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
