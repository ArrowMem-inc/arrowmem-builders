// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// SEND GUARD for the store chat. A plain JS copy of the ArrowMem app's guard module (its src/guard
// folder, R-446, R-431), types stripped, detectors VERBATIM; the app copied them from its browser
// extension the same way. Copied rather than imported: the app is a separate repo this site does
// not depend on. ⚠️ NOTHING REMINDS EITHER SIDE: if the app's detector list changes, this copy needs the
// same change, or the app and the store disagree on what a card number looks like. Named SendGuard, as the app names its keys, because a content guard reads the
// other name followed by a dot as a paste-site address.
//
// NO NETWORK, NOTHING RETAINED. Every function below is pure: same input, same output, no I/O, no
// storage, no console, no network. The chat composer (js/shell.js) only uses the return value to
// decide whether to show the inline sheet, and matchSpan only to compute what "Remove it" deletes,
// in memory, for one click.
(function (root) {
"use strict";

// Luhn checksum, used by the card and Canadian SIN detectors.
function luhnValid(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// Card (PG3): 13-19 digits, spaces or dashes allowed, Luhn-valid.
const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;
function detectCard(text) {
  const matches = text.match(CARD_CANDIDATE);
  if (!matches) return false;
  for (const raw of matches) {
    const digits = raw.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return true;
  }
  return false;
}

// Canadian SIN (PG3): 9 digits, Luhn-valid, spaces or dashes (usual 3-3-3 grouping).
const SIN_CANDIDATE = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g;
function detectSin(text) {
  const matches = text.match(SIN_CANDIDATE);
  if (!matches) return false;
  for (const raw of matches) {
    const digits = raw.replace(/[ -]/g, "");
    if (digits.length === 9 && luhnValid(digits)) return true;
  }
  return false;
}

// US SSN (PG3): the 3-2-4 shape with a label nearby - shape alone is too common a false positive.
const SSN_SHAPE = /\b\d{3}-\d{2}-\d{4}\b/g;
const SSN_LABELS = ["ssn", "social security"];
const LABEL_WINDOW = 40;
function detectSsn(text) {
  const lower = text.toLowerCase();
  let m;
  SSN_SHAPE.lastIndex = 0;
  while ((m = SSN_SHAPE.exec(text)) !== null) {
    const start = Math.max(0, m.index - LABEL_WINDOW);
    const end = Math.min(text.length, m.index + m[0].length + LABEL_WINDOW);
    const context = lower.slice(start, end);
    if (SSN_LABELS.some((label) => context.includes(label))) return true;
  }
  return false;
}

// Passport (PG3): the word "passport" within 40 characters of a 6-9 character alphanumeric run.
const PASSPORT_RUN = /\b[A-Za-z0-9]{6,9}\b/g;
const PASSPORT_LABEL = "passport";
function detectPassport(text) {
  const lower = text.toLowerCase();
  let m;
  PASSPORT_RUN.lastIndex = 0;
  while ((m = PASSPORT_RUN.exec(text)) !== null) {
    if (m[0].toLowerCase() === PASSPORT_LABEL) continue; // skip the label word itself
    const start = Math.max(0, m.index - LABEL_WINDOW);
    const end = Math.min(text.length, m.index + m[0].length + LABEL_WINDOW);
    const context = lower.slice(start, end);
    if (context.includes(PASSPORT_LABEL)) return true;
  }
  return false;
}

// Secret keys (PG3): known vendor key/token prefixes and PEM private key headers.
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}/, // sk-prefixed secret key, including sk-proj- / sk-ant- shapes
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bghp_[A-Za-z0-9]{20,}\b/, // GitHub personal access token
  /\bxox[abp]-[A-Za-z0-9-]{10,}\b/, // Slack token
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key header
  /\bAIza[0-9A-Za-z_-]{20,}\b/, // AIza-prefixed API key
];
function detectSecret(text) {
  return SECRET_PATTERNS.some((p) => p.test(text));
}

// Health (PG3): a SHORT published word list, label-based only, never a symptom guess.
const HEALTH_WORDS = ["diagnosis", "prescription", "prescribed", "test result", "positive for", "HIV", "cancer", "therapy notes"];
const HEALTH_PATTERNS = HEALTH_WORDS.map(
  (word) => new RegExp("(?<![a-z])" + word.replace(/ /g, "\\s+") + "(?![a-z])", "i"),
);
function detectHealth(text) {
  return HEALTH_PATTERNS.some((p) => p.test(text));
}

// ponytail: HEALTH_ENABLED is false, as in the app, until an operator-approved false-positive
// measurement says otherwise. detectHealth stays exported and tested; this is the only gate.
const HEALTH_ENABLED = false;

// Combined. Secret keys and card numbers first, as in the extension and the app.
const DETECTORS = [
  { category: "secret", test: detectSecret },
  { category: "card", test: detectCard },
  { category: "sin", test: detectSin },
  { category: "ssn", test: detectSsn },
  { category: "passport", test: detectPassport },
  ...(HEALTH_ENABLED ? [{ category: "health", test: detectHealth }] : []),
];

/** The single category to show in the sheet: the first (highest priority) hit, or null. */
function firstCategory(text) {
  for (const d of DETECTORS) {
    if (d.test(text)) return d.category;
  }
  return null;
}

// Composer-local support for "Remove it": what to delete from the visitor's own draft, computed
// fresh on click and used in memory only. Re-runs the same regex shapes.
function matchSpan(category, text) {
  const push = (re, verify) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (verify(m[0])) return { start: m.index, end: m.index + m[0].length };
      if (re.lastIndex === m.index) re.lastIndex++; // guard against a zero-width match looping
    }
    return null;
  };
  switch (category) {
    case "card":
      return push(new RegExp(CARD_CANDIDATE.source, "g"), (raw) => {
        const digits = raw.replace(/[ -]/g, "");
        return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
      });
    case "sin":
      return push(new RegExp(SIN_CANDIDATE.source, "g"), (raw) => {
        const digits = raw.replace(/[ -]/g, "");
        return digits.length === 9 && luhnValid(digits);
      });
    case "ssn": {
      const lower = text.toLowerCase();
      const re = new RegExp(SSN_SHAPE.source, "g");
      let m;
      while ((m = re.exec(text)) !== null) {
        const start = Math.max(0, m.index - LABEL_WINDOW);
        const end = Math.min(text.length, m.index + m[0].length + LABEL_WINDOW);
        if (SSN_LABELS.some((label) => lower.slice(start, end).includes(label))) {
          return { start: m.index, end: m.index + m[0].length };
        }
      }
      return null;
    }
    case "passport": {
      const lower = text.toLowerCase();
      const re = new RegExp(PASSPORT_RUN.source, "g");
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].toLowerCase() === PASSPORT_LABEL) continue;
        const start = Math.max(0, m.index - LABEL_WINDOW);
        const end = Math.min(text.length, m.index + m[0].length + LABEL_WINDOW);
        if (lower.slice(start, end).includes(PASSPORT_LABEL)) {
          return { start: m.index, end: m.index + m[0].length };
        }
      }
      return null;
    }
    case "secret": {
      for (const p of SECRET_PATTERNS) {
        const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
        re.lastIndex = 0;
        const m = re.exec(text);
        if (m) return { start: m.index, end: m.index + m[0].length };
      }
      return null;
    }
    case "health": {
      for (const p of HEALTH_PATTERNS) {
        const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
        re.lastIndex = 0;
        const m = re.exec(text);
        if (m) return { start: m.index, end: m.index + m[0].length };
      }
      return null;
    }
    default:
      return null;
  }
}

/** Removes the matched span for `category` from `text`, collapsing a double space left behind.
 *  Returns `text` unchanged if no match is found; never throws. */
function removeMatch(category, text) {
  const span = matchSpan(category, text);
  if (!span) return text;
  const before = text.slice(0, span.start);
  const after = text.slice(span.end);
  return (before + after).replace(/[ \t]{2,}/g, " ").trim();
}

root.SendGuard = { luhnValid, detectCard, detectSin, detectSsn, detectPassport, detectSecret, detectHealth, HEALTH_WORDS, firstCategory, matchSpan, removeMatch };
})(typeof window !== "undefined" ? window : globalThis);
