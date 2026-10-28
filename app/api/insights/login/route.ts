import { cookies } from "next/headers";
import {
  createSessionToken,
  getPasscode,
  passcodeMatches,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/insights-auth";

export const runtime = "nodejs";

const MAX_PASSCODE_CHARS = 200;

export async function POST(request: Request) {
  const passcode = getPasscode();
  if (!passcode) return Response.json({ ok: false, error: "Insights is not enabled." }, { status: 503 });

  let input: unknown;
  try {
    input = ((await request.json()) as { passcode?: unknown }).passcode;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_PASSCODE_CHARS) {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!passcodeMatches(input, passcode)) {
    // A short pause makes guessing slower.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return Response.json({ ok: false, error: "Incorrect passcode." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(passcode), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return Response.json({ ok: true });
}
