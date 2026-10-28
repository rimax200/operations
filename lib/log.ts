import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseEvents, type LogEvent, type StoredEvent } from "./events.ts";
import { redact } from "./redact.ts";

export type { LogEvent, StoredEvent };

// Swap this for a hosted database at deployment by implementing EventLogger and calling setEventLogger.
export interface EventLogger {
  write(event: StoredEvent): Promise<void>;
  readEvents(options?: { since?: Date }): Promise<StoredEvent[]>;
}

const LOG_DIR = path.join(process.cwd(), "data", "logs");

// One JSON object per line. Needs a writable disk. On Vercel (and other serverless hosts) the
// filesystem is read-only or temporary, so this file log does not persist there; use a hosted
// EventLogger in production.
export class FileEventLogger implements EventLogger {
  private file: string;
  private dir: string;

  constructor(dir = LOG_DIR, filename = "events.jsonl") {
    this.dir = dir;
    this.file = path.join(dir, filename);
  }

  async write(event: StoredEvent) {
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.file, `${JSON.stringify(event)}\n`, "utf8");
  }

  // A missing or unreadable file is an empty log; malformed lines are skipped.
  async readEvents(options: { since?: Date } = {}) {
    try {
      return parseEvents(await readFile(this.file, "utf8"), options.since);
    } catch {
      return [];
    }
  }
}

let logger: EventLogger = new FileEventLogger();

export function setEventLogger(next: EventLogger) {
  logger = next;
}

/** Reads real usage events from the active logger; returns [] if they can't be read. */
export async function readEvents(options?: { since?: Date }): Promise<StoredEvent[]> {
  try {
    return await logger.readEvents(options);
  } catch {
    return [];
  }
}

// Synthetic events written by scripts/seed-demo.mjs. Kept in a separate file so demo data never
// mixes with real usage.
export const demoEventLogger = new FileEventLogger(LOG_DIR, "demo-events.jsonl");

const MAX_QUESTION_CHARS = 500;

// Logging must never break a request, even on a read-only filesystem (failed mkdir or append):
// every failure is reported to the console and swallowed.
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
