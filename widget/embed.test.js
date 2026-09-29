// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// node --test widget/embed.test.js
const { test } = require("node:test"), assert = require("node:assert");
require("./embed.js");
const W = globalThis.ArrowMemWidget;

test("sandbox string matches the documented constant", () => {
  assert.strictEqual(
    W.SANDBOX,
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
  );
});

test("a height message from the wrong origin is ignored", () => {
  assert.strictEqual(W.heightFromMessage("https://evil.example.com", "https://widget.example.com", { h: 500 }), null);
});

test("a height above the cap is ignored, the cap itself is accepted", () => {
  assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", { h: 100001 }), null);
  assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", { h: 100000 }), 100000);
});

test("a valid height from the matching origin resizes", () => {
  assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", { h: 742 }), 742);
});

test("non-integer, zero, negative and missing heights are ignored", () => {
  for (const h of [0, -5, 1.5, "742", null, undefined])
    assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", { h }), null);
});

test("a non-object message body is ignored", () => {
  assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", null), null);
  assert.strictEqual(W.heightFromMessage("https://widget.example.com", "https://widget.example.com", "742"), null);
});
