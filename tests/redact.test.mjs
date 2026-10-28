import test from "node:test";
import assert from "node:assert/strict";
import { redact } from "../lib/redact.ts";

test("redacts runs of 6 or more digits (account, BVN, card, phone numbers)", () => {
  assert.equal(redact("account 0123456789 failed"), "account [number] failed");
  assert.equal(redact("BVN 22212345678"), "BVN [number]");
  assert.equal(redact("12345678901"), "[number]");
  assert.equal(redact("123456"), "[number]");
});

test("redacts numbers grouped with spaces or hyphens", () => {
  assert.equal(redact("call 0803 123 4567 now"), "call [number] now");
  assert.equal(redact("card 4111-1111-1111-1111"), "card [number]");
});

test("keeps short numbers and ordinary text", () => {
  assert.equal(redact("What is the tier 2 limit?"), "What is the tier 2 limit?");
  assert.equal(redact("within 5 working days"), "within 5 working days");
  assert.equal(redact("12345"), "12345");
});

test("redacts email addresses", () => {
  assert.equal(redact("mail ada.obi+bank@example.com please"), "mail [email] please");
});

test("redacts several items in one message", () => {
  assert.equal(
    redact("customer 08031234567 (ada@example.com) account 0123456789"),
    "customer [number] ([email]) account [number]",
  );
});
