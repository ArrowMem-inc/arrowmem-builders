// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// node --test src/builders.test.js
//
// SYNTHETIC FIXTURE, NOT CODE VALUES. Every number below is invented so the arithmetic is easy
// to check by hand. None of it is a span, load or footing from any building code or span table,
// and none of it may be used to build anything. Real tables are supplied by the host (SCHEMAS.md).
const { test } = require("node:test"), assert = require("node:assert");
require("./builders.js");
require("./drawings.js");
const B = globalThis.Builders, D = globalThis.BuilderDrawings;

const every = (v) => ({ "4": [v, v, v], "6": [v, v, v], "8": [v, v, v] });
const RULES = {
  loads: { occupancy_kpa: 1, table_dead_kpa: 0.5, table_live_kpa: 1, post_table_snow_kpa: 1, cb_narrow: 0.5, cb_other: 0.5, narrow_max_m: 4.3 },
  hot_tub: { safety_factor: 1.5, zone_margin_ft: 2 },
  margin: { joist_span: 1.1, load: 1.1, wide_deck_size_up: 1 },
  joists: {
    spacings_in: [16, 12], stock_max_ft: 16, min_size_with_guard: "2x8",
    spans: {
      CWC: { "12": { "2x8": 10, "2x10": 12, "2x12": 14 }, "16": { "2x8": 8, "2x10": 10, "2x12": 12 } },
      DUF: { "12": { "2x8": 10, "2x10": 12, "2x12": 14 }, "16": { "2x8": 8, "2x10": 10, "2x12": 12 } }
    }
  },
  beams: {
    rank: { "2-2x8": 2, "2-2x10": 3, "2-2x12": 4, "3-2x12": 5 }, by_rank: ["-", "-", "2-2x8", "2-2x10", "2-2x12", "3-2x12"], min_rank: 2,
    post_spacings_ft: [8, 6, 4],
    CWC_single: Object.assign({ rows_ft: [8, 12, 16] }, every("2-2x10")), CWC_two: Object.assign({ rows_ft: [8, 12, 16] }, every("2-2x10")),
    DUF_perimeter: Object.assign({ rows_ft: [8, 12, 16] }, every("2-2x10")), DUF_interior: Object.assign({ rows_ft: [8, 12, 16] }, every("2-2x10"))
  },
  posts: { trib_ft2: { heights_in: [140], area: [999] } },
  footings: {
    frost_depth_in: 48, exempt: { max_height_in: 23.62, max_area_ft2: 592 }, cols_supported_ft: [5, 10],
    dia_in: { "4": [12, 12], "6": [12, 12], "8": [12, 12] }, pad_in: { "4": [10, 10], "6": [10, 10], "8": [10, 10] }, min_dia_in: 8
  },
  ledger: { spacing_by_span_in: { "6": 16, "8": 16, "10": 16, "12": 16 }, max_bay_ft: 12 },
  blocking: { midspan_over_ft: 7, nails_each_end: 2 },
  joist_to_beam: { nails: 2 }, decking: { cover_in: 6, screws_per_joist: 2 },
  guards: { required_over_in: 23.62, post_max_ft: 4, baluster_pitch_in: 5 },
  stairs: { riser_max_in: 7.875, riser_min_in: 4.875, run_in: 10.5, width_in: 48, stringer_max_spacing_in: 35.4, block_every_in: 47 },
  bracing: { over_in: 23.62, per_post: 2 },
  permit: { en: "Synthetic permit note.", fr: "Note de permis synthetique." },
  stock_lengths_ft: [8, 10, 12, 14, 16], waste: 1.1
};
// cb 0.5 x Ss 1 + Sr 0.1 = 0.6 kPa, under the 1 kPa occupancy, so every load factor is exactly 1
const SNOW = { rows: [{ location: "Testville", Ss_kPa: 1, Sr_kPa: 0.1 }] };
B._set(RULES, SNOW);
B.setDefaultLocation("Testville");

function run(over) { let a = {}, r; while ((r = B.next("deck", Object.assign({}, a, over))).question) a[r.question.id] = r.question.default; return r; }
const find = (r, s) => r.lines.find(l => l.item_en.includes(s));

test("asks the location first, defaulting to the host's town", () => {
  const q = B.next("deck", {}).question;
  assert.strictEqual(q.id, "location");
  assert.strictEqual(q.default, "Testville");
});

test("8x8 attached at 30 in: smallest joist with 10 percent span reserve, guards, bracing, 10 percent on every line", () => {
  const r = run({ length: 8, width: 8, height: 30 }), p = r.plan.levels[0];
  // 8 ft x 1.1 = 8.8 ft needed: 2x8 at 16 gives 8, fails; 2x10 at 16 gives 10, passes
  assert.deepStrictEqual(p.joist, { size: "2x10", spacing: 16 });
  assert.strictEqual(p.beams[0].size, "2-2x10");
  assert(p.guard && find(r, "baluster") && find(r, "knee brace"));
  // floor(96 / 16) + 1 = 7 joists, plus 10 percent rounded up = 8
  assert.strictEqual(find(r, "ft pressure treated joist").qty, 8);
  assert(r.lines.every(l => "src" in l && l.qty > 0 && l.sku === null));
  assert(r.notes.some(n => n.kind === "permit"));
});

test("low freestanding deck: no guard, no bracing, surface pads", () => {
  const r = run({ length: 8, width: 8, height: 12, attached: false, stairs: false });
  assert(!r.plan.levels[0].guard && !find(r, "baluster") && !find(r, "knee brace") && find(r, "footing pad"));
});

test("posts are always 6x6", () => {
  const r = run({ length: 8, width: 8, height: 30 });
  assert(find(r, "6x6 x") && !r.lines.some(l => /4x4 x \d+ ft pressure treated post/.test(l.item_en)));
});

test("hot tub: only the zone lines carry the engineer flag, and the warning is on the list", () => {
  const r = run({ length: 16, width: 16, height: 30, hot_tub: true, tub_length: 4, tub_width: 4, hot_tub_filled_kg: 500, tub_from_house: 3, tub_from_left: 3 });
  assert(r.plan && r.plan.levels[0].zone, "zone built");
  const zone = r.lines.filter(l => l.item_en.startsWith("Hot tub zone:"));
  assert(zone.length && zone.every(l => l.note_en !== ""));
  assert(r.lines.filter(l => !l.item_en.startsWith("Hot tub zone:")).every(l => l.note_en === ""));
  assert(r.notes.some(n => n.kind === "engineering"));
  // 500 kg x 1.5 x 9.81 / 1000 over 16 ft2 x 0.0929 = 4.95 kPa
  assert.strictEqual(r.plan.levels[0].zone.kpa.toFixed(2), "4.95");
});

test("refuses past the tables instead of guessing", () => {
  const r = run({ length: 16, width: 16, height: 30, hot_tub: true, tub_length: 4, tub_width: 4, hot_tub_filled_kg: 6000, tub_from_house: 3, tub_from_left: 3 });
  assert(!r.plan && r.lines.length === 0 && r.notes[0].kind === "engineering");
});

test("refuses a tub without 2 ft of deck all round", () => {
  assert(!run({ length: 16, width: 16, height: 30, hot_tub: true, tub_length: 4, tub_width: 4, tub_from_house: 12, tub_from_left: 3 }).plan);
});

test("refuses bad numbers at the trust boundary", () => {
  const ok = { location: "Testville", length: 8, width: 8, height: 30, attached: true, stairs: false, hot_tub: false, level2: false };
  assert(B.next("deck", ok).plan);
  for (const bad of [{ length: 0 }, { length: NaN }, { length: "8" }, { width: Infinity }, { height: -1 }])
    assert(!B.next("deck", Object.assign({}, ok, bad)).plan, JSON.stringify(bad));
});

test("drawings render plan and elevation from the plan field", () => {
  const r = run({ length: 8, width: 8, height: 30 }), o = D.render("deck", {}, r.plan, "en");
  assert(o.plan_svg.startsWith("<svg") && o.elevation_svg.startsWith("<svg"));
  assert(o.plan_svg.includes("8 ft"));
  assert(D.render("wall", { length: 10, height: 96 }).elevation_svg.includes("96 in"));
});
