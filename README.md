# ArrowMem Builders

Small, dependency-free JavaScript engines that turn a homeowner's answers into a materials list,
a drawing, a window order and a chat box that can ask first. Each file runs in the browser as a plain script
and in Node for its tests. No build step, no package manager, no network calls of their own.

## The engines

| File | What it does |
|---|---|
| `src/builders.js` | Asks the questions for a deck (and the shape for sheds and walls) and returns a rounded-up materials list, notes and a plan. It reads a rules table and a climate table that you supply (see Data tables). |
| `src/drawings.js` | Draws the plan and elevation for a builder's answers as inline SVG. |
| `src/window-sizing.js` | Takes three widths and three heights per window, uses the smallest, applies a maker's allowance where the maker publishes one, runs the Ontario bedroom escape-window checks and counts install materials. |
| `src/guard.js` | Checks text a person is about to send for card, SIN, SSN, passport and secret-key shapes so a chat box can ask first. |

## What the lists are, and are not

A reference site built on these engines shows this before every list, and any site using them
should say the same thing in its own words:

> This list is a materials guide only. It is not a design, not a permit drawing and not an
> engineering opinion. Your municipal building department decides what needs a permit and what
> gets inspected, and a designer or an engineer should check anything you are unsure of. A hot
> tub, a second storey or any unusual load needs one. Nobody from the store has seen your site.
> Every line is rounded up and carries 10 percent extra. Prices are set at the counter.

The hot tub zone in `builders.js` is a conservative estimate from the span tables, not a design.

## guard.js: no network, nothing stored, nothing sent

Every function in `guard.js` is pure: same input, same output, no I/O, no storage, no logging, no
network. A caller uses the result only to decide whether to show a prompt. The health-word list is
present and tested but switched off (`HEALTH_ENABLED = false`) until a false-positive measurement
says otherwise.

## Data tables

The deck engine needs two tables: span, footing and fastening rules, and a ground snow and rain
load per location. **They are not in this repository.** The figures come from published building
codes and span guides whose publishers do not license them for redistribution under Apache-2.0.
`SCHEMAS.md` gives their shape; supply your own and pass their URLs:

```js
Builders.load({ rules: "/data/deck-rules.json", snow: "/data/snow.json" })
  .then(() => Builders.setDefaultLocation("A location in your snow table"));
```

**`window-sizing.js` checks against Ontario's figures.** It carries four figures from one article of
the Ontario Building Code, each cited beside the check that uses it. Outside Ontario these checks are
wrong until you replace them with your own jurisdiction's figures.

## Sources

The reference site's tables and checks were built from, and are cited to:

- Ontario Building Code 2024, Division B, read in the 2024 Building Code Compendium (edition updated
  2025-01-16): Art. 9.9.10.1 for bedroom escape windows.
- MMAH Supplementary Standard SB-1, Table 2, for ground snow and rain loads by location.
- Canadian Wood Council, Residential Prescriptive Exterior Wood Deck Span Guide.
- Municipal deck construction and design guides (county and township).
- Window makers' published measuring and installation guides: Andersen, Marvin, Pella, Loewen.

A figure in any of these belongs to its publisher. Read the source, not this list.

## Tests

```sh
node --test src/builders.test.js src/guard.test.js src/window-sizing.test.js
```

`builders.test.js` runs the deck engine and the drawings on an invented table built inside the
test. Its numbers are deliberately not span data; never build from them.

## Licence

Everything in this repository is under the Apache License 2.0 unless a file says otherwise;
see `LICENSE` and `NOTICE`.
