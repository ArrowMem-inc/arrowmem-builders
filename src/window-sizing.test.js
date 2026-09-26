// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// node --test js/window-sizing.test.js
const { test } = require("node:test"), assert = require("node:assert");
require("./window-sizing.js");
const S = globalThis.WindowSizing;
const win = (o) => Object.assign({ type: "Double hung", maker: "Other or not sure", qty: 1 }, o);
const same = (w, h) => ({ w1: w, w2: w, w3: w, h1: h, h2: h, h3: h });

test("parses inches and prints eighths", () => {
  assert.strictEqual(S.inches("35 1/2"), 35.5);
  assert.strictEqual(S.inches("35-3/8"), 35.375);
  assert.ok(Number.isNaN(S.inches("abc")));
  assert.strictEqual(S.eighths(35.375), "35 3/8");
  assert.strictEqual(S.eighths(46.75), "46 3/4");
  assert.strictEqual(S.eighths(35), "35");
});
test("smallest measurement and a written maker allowance", () => {
  const a = S.assess(win({ maker: "Marvin (insert, replacement)", w1: "35 1/2", w2: "35 3/8", w3: "35 1/2", h1: "47", h2: "47", h3: "47" }));
  assert.strictEqual(a.W, 35.375);
  assert.match(a.lines[1], /order size: 35 x 46 3\/4 in/);
});
test("incomplete measurements are not assessed", () => {
  assert.strictEqual(S.assess(win({ w1: "30" })).ok, false);
});
test("bedroom: a slider is checked on the part that opens", () => {
  const a = S.assess(win(Object.assign({ type: "Slider", bedroom: true }, same("28", "36"))));
  assert.ok(a.warn.some(w => /no side of the opening may be under 380 mm/.test(w)));
});
test("bedroom: a narrow pass warns, a clear pass does not", () => {
  const close = S.assess(win(Object.assign({ type: "Casement", bedroom: true }, same("17", "36"))));
  assert.ok(close.warn.some(w => /This one is close/.test(w)));
  const clear = S.assess(win(Object.assign({ type: "Casement", bedroom: true }, same("30", "40"))));
  assert.ok(!clear.warn.length);
});
test("bedroom: sill over 1 000 mm warns above the basement only", () => {
  const up = S.assess(win(Object.assign({ type: "Casement", bedroom: true, sill: "44" }, same("30", "40"))));
  assert.ok(up.warn.some(w => /higher than 1 000 mm/.test(w)));
  const down = S.assess(win(Object.assign({ type: "Casement", bedroom: true, basement: true, sill: "44" }, same("30", "40"))));
  assert.ok(!down.warn.some(w => /higher than 1 000 mm/.test(w)));
  assert.ok(down.lines.some(l => /550 mm \(21 3\/4 in\)/.test(l)));
});
test("a fixed window cannot be the escape window", () => {
  const a = S.assess(win(Object.assign({ type: "Picture (fixed)", bedroom: true }, same("30", "40"))));
  assert.ok(a.warn.some(w => /cannot be the bedroom's escape window/.test(w)));
});
test("materials: tape is perimeter plus 10 percent, one sill pan per window", () => {
  const m = S.materials([win(Object.assign({ qty: 2 }, same("35 3/8", "47")))]);
  assert.deepStrictEqual(m[0], ["Window flashing tape", "31 linear ft"]); // 2 x 13.73 ft x 1.1 = 30.2 -> 31
  assert.deepStrictEqual(m[1], ["Sill pan (flexible, or liquid flashing)", "2"]);
  assert.deepStrictEqual(S.materials([win({})]), []);
});
