import test from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, getPasscode, passcodeMatches, verifySessionToken, SESSION_MAX_AGE_SECONDS } from "../lib/insights-auth.ts";

test("getPasscode treats a missing, blank or placeholder value as not configured", () => {
  const saved = process.env.INSIGHTS_PASSCODE;
  try {
    delete process.env.INSIGHTS_PASSCODE;
    assert.equal(getPasscode(), null);
    process.env.INSIGHTS_PASSCODE = "   ";
    assert.equal(getPasscode(), null);
    process.env.INSIGHTS_PASSCODE = "PASTE_PASSCODE_HERE";
    assert.equal(getPasscode(), null);
    process.env.INSIGHTS_PASSCODE = " real-pass ";
    assert.equal(getPasscode(), "real-pass");
  } finally {
    if (saved === undefined) delete process.env.INSIGHTS_PASSCODE;
    else process.env.INSIGHTS_PASSCODE = saved;
  }
});

test("passcodeMatches accepts only the exact passcode, whatever the length", () => {
  assert.equal(passcodeMatches("secret", "secret"), true);
  assert.equal(passcodeMatches("Secret", "secret"), false);
  assert.equal(passcodeMatches("secret-and-more", "secret"), false);
  assert.equal(passcodeMatches("s", "secret"), false);
  assert.equal(passcodeMatches("", "secret"), false);
});

test("session tokens verify, expire after 8 hours, and reject tampering or another passcode", () => {
  const now = 1_700_000_000_000;
  const token = createSessionToken("secret", now);
  assert.equal(verifySessionToken(token, "secret", now + 1000), true);
  assert.equal(verifySessionToken(token, "secret", now + SESSION_MAX_AGE_SECONDS * 1000 + 1), false);
  assert.equal(verifySessionToken(token, "other-passcode", now + 1000), false);
  const [expiry, signature] = token.split(".");
  assert.equal(verifySessionToken(`${Number(expiry) + 99999999}.${signature}`, "secret", now), false);
  assert.equal(verifySessionToken(`${expiry}.${signature.replace(/.$/, signature.endsWith("0") ? "1" : "0")}`, "secret", now), false);
  for (const bad of [undefined, "", "abc", "123.", ".abc", "1.2.3", "x.y"]) assert.equal(verifySessionToken(bad, "secret", now), false);
});
