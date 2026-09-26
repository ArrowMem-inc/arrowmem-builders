# Table shapes

The builders read two tables the host page supplies (`Builders.load({ rules, snow })`). This file
gives their SHAPE only: key names and value types, no values. The values are building-code and
span-table figures that belong to their publishers and are not licensed here.

## rules (deck)

Every key below is read by `src/builders.js`. Numbers are feet, inches, kPa or counts as the key
name says; span strings are feet-inches such as `"12-6"`. `src` fields hold the citation for that
block.

```json
{
 "_about": "string or object of strings, the host's own citation text",
 "edition": "string or object of strings, the host's own citation text",
 "sources": "string or object of strings, the host's own citation text",
 "loads": {
  "occupancy_kpa": "number",
  "table_dead_kpa": "number",
  "table_live_kpa": "number",
  "post_table_snow_kpa": "number",
  "cb_narrow": "number",
  "cb_other": "number",
  "narrow_max_m": "number",
  "src": "string"
 },
 "hot_tub": {
  "safety_factor": "number",
  "zone_margin_ft": "number",
  "src": "string"
 },
 "margin": {
  "joist_span": "number",
  "load": "number",
  "wide_deck_size_up": "number",
  "scaling_src": "string",
  "src": "string"
 },
 "joists": {
  "spacings_in": [
   "number"
  ],
  "stock_max_ft": "number",
  "min_size_with_guard": "string",
  "spans": {
   "CWC": {
    "12": {
     "2x6": "number",
     "2x8": "number",
     "2x10": "number",
     "2x12": "number"
    },
    "16": {
     "2x6": "number",
     "2x8": "number",
     "2x10": "number",
     "2x12": "number"
    }
   },
   "DUF": {
    "12": {
     "2x8": "number",
     "2x10": "number",
     "2x12": "number"
    },
    "16": {
     "2x8": "number",
     "2x10": "number",
     "2x12": "number"
    }
   }
  },
  "cantilever_in": "number",
  "src": "string"
 },
 "beams": {
  "rank": {
   "1-2x6": "number",
   "2-2x6": "number",
   "2-2x8": "number",
   "2-2x10": "number",
   "3-2x8": "number",
   "2-2x12": "number",
   "3-2x10": "number",
   "3-2x12": "number",
   "4-2x12": "number"
  },
  "by_rank": [
   "string"
  ],
  "min_rank": "number",
  "post_spacings_ft": [
   "number"
  ],
  "CWC_single": {
   "rows_ft": [
    "number"
   ],
   "4": [
    "string"
   ],
   "6": [
    "string"
   ],
   "8": [
    "string"
   ]
  },
  "CWC_two": {
   "rows_ft": [
    "number"
   ],
   "4": [
    "string"
   ],
   "6": [
    "string"
   ],
   "8": [
    "string"
   ]
  },
  "DUF_perimeter": {
   "rows_ft": [
    "number"
   ],
   "4": [
    "string"
   ],
   "6": [
    "string"
   ],
   "8": [
    "string"
   ]
  },
  "DUF_interior": {
   "rows_ft": [
    "number"
   ],
   "4": [
    "string"
   ],
   "6": [
    "string"
   ],
   "8": [
    "string"
   ]
  },
  "src": "string"
 },
 "posts": {
  "size": "string",
  "max_height_in": "number",
  "trib_ft2": {
   "heights_in": [
    "number"
   ],
   "area": [
    "number"
   ]
  },
  "src": "string"
 },
 "footings": {
  "frost_depth_in": "number",
  "exempt": {
   "max_height_in": "number",
   "max_area_ft2": "number",
   "freestanding": "bool"
  },
  "rows_beam_ft": [
   "number"
  ],
  "cols_supported_ft": [
   "number"
  ],
  "dia_in": {
   "4": [
    "number"
   ],
   "6": [
    "number"
   ],
   "8": [
    "number"
   ]
  },
  "pad_in": {
   "4": [
    "number"
   ],
   "6": [
    "number"
   ],
   "8": [
    "number"
   ]
  },
  "min_dia_in": "number",
  "src": "string"
 },
 "ledger": {
  "bolt": "string",
  "spacing_by_span_in": {
   "6": "number",
   "8": "number",
   "10": "number",
   "12": "number"
  },
  "max_bay_ft": "number",
  "src": "string"
 },
 "blocking": {
  "midspan_over_ft": "number",
  "nails_each_end": "number",
  "nail": "string",
  "src": "string"
 },
 "joist_to_beam": {
  "nails": "number",
  "nail": "string",
  "src": "string"
 },
 "decking": {
  "board": "string",
  "cover_in": "number",
  "screws_per_joist": "number",
  "screw": "string",
  "src": "string"
 },
 "guards": {
  "required_over_in": "number",
  "height_in": "number",
  "post_max_ft": "number",
  "baluster_pitch_in": "number",
  "src": "string"
 },
 "stairs": {
  "riser_max_in": "number",
  "riser_min_in": "number",
  "run_in": "number",
  "tread": "string",
  "width_in": "number",
  "stringer": "string",
  "stringer_max_spacing_in": "number",
  "block_every_in": "number",
  "src": "string"
 },
 "bracing": {
  "over_in": "number",
  "brace": "string",
  "per_post": "number",
  "src": "string"
 },
 "permit": "string or object of strings, the host's own citation text",
 "stock_lengths_ft": [
  "number"
 ],
 "waste": "number"
}
```

## snow (climate)

```json
{ "source": "string", "note": "string",
  "rows": [ { "location": "string", "elev_m": "number", "Ss_kPa": "number", "Sr_kPa": "number" } ] }
```

`Ss_kPa` is the 1-in-50 ground snow load and `Sr_kPa` the associated rain load for the location,
as the host's jurisdiction publishes them.
