// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
/* Window sizing: measured opening, maker allowances held in writing, Ontario bedroom escape checks
   and the install materials count. Pure functions, no DOM, no network. The page passes its own
   translate function T(template, vars); without one the English templates are filled in as is.
   Sources: WINDOW_SOURCES.md (makers' measuring and installation guides; Ontario Building Code
   Art. 9.9.10.1, edition updated to January 2025, checked by a second reader). */
(function (root) {
"use strict";
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? vars[k] : m);

const TYPES = ["Single hung", "Double hung", "Slider", "Casement", "Awning", "Picture (fixed)", "Bay or bow"];
// Maker allowances held in writing (inches off the measured opening, width x height).
// ponytail: four makers; any other brand sets its own allowance at the counter.
const MAKERS = {
  "Marvin (insert, replacement)": { w: 0.375, h: 0.25, src: "Marvin insert measuring instruction" },
  "Pella (new construction)": { w: 0.5, h: 0.5, src: "Pella installation guide" },
  "Loewen (new construction)": { range: "3/4 to 1", src: "Loewen installation guide" },
  "Andersen": { note: true, src: "Andersen measuring guide" },
  "Other or not sure": { note: true }
};

// "35 1/2", "35.5", "35-1/2" -> 35.5 inches; anything else -> NaN
function inches(s) {
  const m = String(s).trim().match(/^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?$/);
  if (!m) return NaN;
  return parseFloat(m[1]) + (m[2] ? +m[2] / +m[3] : 0);
}
function eighths(x) { // 35.375 -> 35 3/8
  const n = Math.floor(x + 1e-9), f = Math.round((x - n) * 8);
  if (f === 0) return String(n);
  if (f === 8) return String(n + 1);
  const g = f % 4 === 0 ? [f / 4, 2] : f % 2 === 0 ? [f / 2, 4] : [f, 8];
  return n + " " + g[0] + "/" + g[1];
}

// One window {type, maker, w1..w3, h1..h3, bedroom, basement, sill} -> {ok, W, H, lines, warn}
function assess(r, T) {
  T = T || fill;
  const W = Math.min(...["w1", "w2", "w3"].map(k => inches(r[k]))), H = Math.min(...["h1", "h2", "h3"].map(k => inches(r[k])));
  if (!(W > 0 && H > 0)) return { ok: false };
  const out = { ok: true, W, H, lines: [], warn: [] };
  out.lines.push(T("Measured opening: {w} x {h} in (the smallest of each).", { w: eighths(W), h: eighths(H) }));
  const m = MAKERS[r.maker] || {};
  if (m.w) out.lines.push(T("{maker} order size: {w} x {h} in, after its written allowance.", { maker: T(r.maker), w: eighths(W - m.w), h: eighths(H - m.h) }));
  else if (m.range) out.lines.push(T("{maker} takes {range} in off the rough opening; the counter sets the exact size.", { maker: T(r.maker), range: m.range }));
  else out.lines.push(T("The maker sets its own allowance; the counter works out the order size from these measurements."));
  if (r.type === "Bay or bow") out.warn.push(T("Bay and bow windows are measured at the counter or on site; bring photos and these measurements."));
  if (r.bedroom) {
    // Ontario Building Code Art. 9.9.10.1: 0.35 m2 openable, no side under 380 mm, sill 1 000 mm max except basements
    const mm = x => x * 25.4;
    // the code applies to the part that opens (9.9.10.1). Halving is a rejection filter only: the
    // clear opening is a little less than half, so a narrow pass is sent to the maker's figures
    // ponytail: the 15 percent near-threshold margin is this file's own choice, not in the code book;
    // it only adds a warning. Replace it with the maker's clear-opening data when held per model.
    const oW = r.type === "Slider" ? W / 2 : W, oH = /hung/.test(r.type) ? H / 2 : H;
    if (oW !== W || oH !== H) out.lines.push(T("A little less than half of a {type} window opens, and the code applies to the part that opens, so size it from that part, not the whole frame.", { type: T(r.type).toLowerCase() }));
    if (mm(oW) < 380 || mm(oH) < 380) out.warn.push(T("Too small for a bedroom escape window: no side of the opening may be under 380 mm (15 in). Ontario Building Code 9.9.10.1."));
    else if (mm(oW) * mm(oH) / 1e6 < 0.35) out.warn.push(T("Too small for a bedroom escape window: it needs at least 0.35 m2 (3.8 sq ft) that opens. Ontario Building Code 9.9.10.1."));
    else if (mm(oW) < 380 * 1.15 || mm(oH) < 380 * 1.15 || mm(oW) * mm(oH) / 1e6 < 0.35 * 1.15) out.warn.push(T("This one is close. The maker's clear-opening figures for this exact unit decide whether it passes, not this page's arithmetic; ask us for them before you order."));
    else out.lines.push(T("A bedroom window must open to at least 0.35 m2 (3.8 sq ft), no side under 380 mm, and stay open without being held. Check the model's clear opening, not the frame size. Ontario Building Code 9.9.10.1."));
    const sill = inches(r.sill);
    if (!r.basement && sill > 0 && sill * 25.4 > 1000) out.warn.push(T("The sill is higher than 1 000 mm (39 in) above the floor, the most the code allows for a bedroom window above the basement. Ontario Building Code 9.9.10.1."));
    if (r.basement) out.lines.push(T("A basement bedroom window that opens into a window well needs 550 mm (21 3/4 in) clear in front of it, and a sash that swings toward the well must not cut into that space. A well cover must open from inside without keys or tools. Ontario Building Code 9.9.10.1."));
    out.lines.push(T("No escape window is required where a door on the same floor as the bedroom opens directly outside. Ontario Building Code 9.9.10.1."));
    if (r.type === "Picture (fixed)") out.warn.push(T("A fixed window does not open, so it cannot be the bedroom's escape window."));
  }
  return out;
}

// Install materials for a list of windows -> [[item, amount], ...], or [] when none is measured.
// The Loewen installation guide lists these. The tape count is this file's own rule of thumb
// (perimeter plus 10 percent); Loewen's per-piece formulas (sill W+12, jambs H + 2 tape widths - 1,
// head W + 2 tape widths + 2) land within a foot or two.
function materials(windows, T) {
  T = T || fill;
  let perim = 0, ready = 0;
  windows.forEach(r => {
    const a = assess(r, T), q = Math.max(1, Math.min(20, parseInt(r.qty, 10) || 1));
    if (a.ok) { ready += q; perim += q * 2 * (a.W + a.H) / 12; }
  });
  if (!ready) return [];
  return [
    [T("Window flashing tape"), T("{n} linear ft", { n: Math.ceil(perim * 1.1) })],
    [T("Sill pan (flexible, or liquid flashing)"), T("{n}", { n: ready })],
    [T("Low-expansion window and door foam"), T("the counter sets the count")],
    [T("Composite shims"), T("the counter sets the count")],
    [T("Rough opening sealant"), T("the counter sets the count")]
  ];
}

root.WindowSizing = { TYPES, MAKERS, inches, eighths, assess, materials };
})(typeof window !== "undefined" ? window : globalThis);
