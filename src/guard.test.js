// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// node --test js/guard.test.js  (from hardwarestore/site). The app's guard module cases, ported.
// Synthetic fixtures only, as in the app: Stripe's test card, a common synthetic SIN.
const { test } = require("node:test"), assert = require("node:assert");
require("./guard.js");
const G = globalThis.SendGuard;

test("luhnValid", () => {
  assert.strictEqual(G.luhnValid("4242424242424242"), true);
  assert.strictEqual(G.luhnValid("4242424242424241"), false);
});
test("detectCard", () => {
  assert.strictEqual(G.detectCard("my card is 4242 4242 4242 4242 please"), true);
  assert.strictEqual(G.detectCard("4242-4242-4242-4242"), true);
  assert.strictEqual(G.detectCard("4242 4242 4242 4241"), false);
  assert.strictEqual(G.detectCard("I need help with my deck please"), false);
});
test("detectSin", () => {
  assert.strictEqual(G.detectSin("my sin is 046 454 286"), true);
  assert.strictEqual(G.detectSin("046-454-286"), true);
  assert.strictEqual(G.detectSin("046 454 287"), false);
  assert.strictEqual(G.detectSin("04 645 428"), false);
});
test("detectSsn", () => {
  assert.strictEqual(G.detectSsn("my ssn is 123-45-6789"), true);
  assert.strictEqual(G.detectSsn("social security number: 123-45-6789"), true);
  assert.strictEqual(G.detectSsn("invoice 123-45-6789 for the truck parts"), false);
});
test("detectPassport", () => {
  assert.strictEqual(G.detectPassport("my passport number is AB123456"), true);
  assert.strictEqual(G.detectPassport("AB123456 " + "x".repeat(60) + " passport"), false);
  assert.strictEqual(G.detectPassport("I need a new one soon, ok"), false);
});
test("detectSecret", () => {
  assert.strictEqual(G.detectSecret("here is " + "sk_" + "test_" + "x".repeat(24)), false); // underscore variant not in the set
  assert.strictEqual(G.detectSecret("key: sk-xxxxxxxxxxxxxxxxxxxxxxxx"), true);
  assert.strictEqual(G.detectSecret("can you summarize this for me"), false);
});
test("detectHealth", () => {
  assert.strictEqual(G.detectHealth("the diagnosis was confirmed last week"), true);
  assert.strictEqual(G.detectHealth("the test came back positive for HIV"), true);
  assert.strictEqual(G.detectHealth("please archive this file"), false);
  assert.strictEqual(G.detectHealth("can you help me plan my week"), false);
});
test("firstCategory", () => {
  assert.strictEqual(G.firstCategory("card 4242 4242 4242 4242 and sin 046 454 286"), "card");
  assert.strictEqual(G.firstCategory("how many 2x10 joists for a 12 by 16 deck"), null);
  assert.strictEqual(G.firstCategory("my diagnosis is PTSD and I was prescribed sertraline"), null); // health off, as in the app
});
test("removeMatch", () => {
  const out = G.removeMatch("card", "please charge 4242 4242 4242 4242 to my account");
  assert.strictEqual(out, "please charge to my account");
  assert.strictEqual(G.detectCard(out), false);
  assert.strictEqual(G.removeMatch("card", "nothing sensitive here"), "nothing sensitive here");
});
