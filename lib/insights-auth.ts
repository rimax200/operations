import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "insights_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const PLACEHOLDER = "PASTE_PASSCODE_HERE";

/** The configured passcode, or null when the env var is missing, blank or still the placeholder. */
export function getPasscode(): string | null {
  const value = process.env.INSIGHTS_PASSCODE?.trim();
  return value && value !== PLACEHOLDER ? value : null;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

// Hashing first gives both sides the same length, so timingSafeEqual works and no length leaks.
export function passcodeMatches(input: string, passcode: string): boolean {
  return timingSafeEqual(digest(input), digest(passcode));
}

// The session is stateless: "<expiry ms>.<HMAC of the expiry>". The HMAC key is derived from the
// passcode, so changing the passcode signs everyone out. Nothing secret is stored in the cookie.
const sign = (expiry: string, passcode: string) =>
  createHmac("sha256", digest(`insights-session:${passcode}`)).update(expiry).digest("hex");

export function createSessionToken(passcode: string, now = Date.now()): string {
  const expiry = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiry}.${sign(expiry, passcode)}`;
}

export function verifySessionToken(token: string | undefined, passcode: string, now = Date.now()): boolean {
  if (!token) return false;
  const [expiry, signature, ...rest] = token.split(".");
  if (!expiry || !signature || rest.length > 0 || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) <= now) return false;
  const expected = Buffer.from(sign(expiry, passcode), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
