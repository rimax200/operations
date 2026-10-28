import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { redact } from "./redact";

export interface LogEvent {
  type: "question" | "feedback";
  conversationId: string;
  /** The latest user message only, never the whole conversation. */
  question: string;
  grounded: boolean;
  fallback: boolean;
  /** Titles of the manual sections used. */
  sources: string[];
  cached: boolean;
  retrievalMs: number | null;
  rewriteMs: number | null;
  llmMs: number | null;
  messageId?: string;
  rating?: "up" | "down";
  reason?: string;
  /** The request failed (LLM error, busy, not configured). */
  error?: boolean;
}

// Swap this for a hosted database at deployment by implementing EventLogger and calling setEventLogger.
export interface EventLogger {
  write(event: LogEvent & { ts: string }): Promise<void>;
}

// Appends one JSON object per line. Needs a writable disk; serverless hosts usually don't have one.
export class FileEventLogger implements EventLogger {
  private file: string;
  private dir: string;

  constructor(dir = path.join(process.cwd(), "data", "logs")) {
    this.dir = dir;
    this.file = path.join(dir, "events.jsonl");
  }

  async write(event: LogEvent & { ts: string }) {
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(event)}\n`, "utf8");
  }
}

let logger: EventLogger = new FileEventLogger();

export function setEventLogger(next: EventLogger) {
  logger = next;
}

const MAX_QUESTION_CHARS = 500;

// Logging must never break a request: failures are reported to the console and swallowed.
export async function logEvent(event: LogEvent): Promise<void> {
  try {
    await logger.write({
      ts: new Date().toISOString(),
      ...event,
      question: redact(event.question).slice(0, MAX_QUESTION_CHARS),
    });
  } catch (err) {
    console.error("[log] could not write event:", err);
  }
}
