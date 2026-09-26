// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// Deck, shed and basement wall builder. Pure: no DOM, no network except its own data loads.
// Interface (DES): Builders.load() -> Promise; Builders.kinds; Builders.next(kind, answers) ->
// {question, lines, notes, plan}. Every structural number comes from data/deck-rules.json, which
// cites its source per block. Shed and wall are still sample data until their sources are read.
(function (root) {
  var R = null, SNOW = null;
  var TOWN = null; // the default location, supplied by the host page with setDefaultLocation

  function fit(n) { return Math.ceil(n * R.waste); } // every line plus 10 percent, rounded up
  function stock(ft) { var s = R.stock_lengths_ft.filter(function (x) { return x >= ft; })[0]; return s || null; }
  function row(rows, v) { for (var i = 0; i < rows.length; i++) if (rows[i] >= v - 1e-9) return i; return -1; }

  // Design loads. OBC 9.4.2.2 and 9.4.2.3; a hot tub is spread over its footprint as a uniform load.
  function loads(a, lenFt, widFt, withTub) {
    var loc = SNOW.rows.filter(function (r) { return r.location === a.location; })[0];
    var narrow = Math.min(lenFt, widFt) * 0.3048 <= R.loads.narrow_max_m;
    var snow = (narrow ? R.loads.cb_narrow : R.loads.cb_other) * loc.Ss_kPa + loc.Sr_kPa;
    // maker's filled weight (kg) x our factor, spread over the tub footprint (ft2 to m2), in kPa
    var tub = withTub ? a.hot_tub_filled_kg * R.hot_tub.safety_factor * 9.81 / 1000 / (a.tub_length * a.tub_width * 0.0929) : 0;
    var live = Math.max(snow, R.loads.occupancy_kpa, tub);
    var total = live + R.loads.table_dead_kpa;
    var tl = R.loads.table_live_kpa, tt = tl + R.loads.table_dead_kpa;
    return {
      loc: loc, narrow: narrow, snow: snow, tub: tub, live: live,
      // a table span at the table load stays safe at a higher load when shortened by these factors:
      // bending goes with w L^2; deflection w L^4 against an L/360 limit, so w L^3
      spanF: Math.max(Math.sqrt(total / tt), Math.pow(live / tl, 1 / 3)),
      // beams, posts and footings carry load in proportion to w
      loadF: Math.max(total / tt, live / tl),
      postF: Math.max(live / R.loads.post_table_snow_kpa, total / (R.loads.post_table_snow_kpa + R.loads.table_dead_kpa))
    };
  }

  function pickJoist(span, L, guard, bump) {
    var sizes = ['2x6', '2x8', '2x10', '2x12'];
    if (guard) sizes = sizes.slice(sizes.indexOf(R.joists.min_size_with_guard));
    var need = span * R.margin.joist_span * L.spanF;
    for (var s = 0; s < R.joists.spacings_in.length; s++) {
      var sp = String(R.joists.spacings_in[s]), ok = [];
      for (var i = 0; i < sizes.length; i++) {
        var c = R.joists.spans.CWC[sp][sizes[i]], d = R.joists.spans.DUF[sp][sizes[i]];
        if (c && d && Math.min(c, d) >= need) ok.push(sizes[i]);
      }
      var k = bump ? 1 : 0;
      if (ok.length > k) return { size: ok[k], spacing: +sp };
    }
    return null;
  }

  function beamRank(table, sp, jspan) {
    var t = R.beams[table], i = row(t.rows_ft, jspan);
    return i < 0 ? -1 : R.beams.rank[t[String(sp)][i]];
  }
  function pickBeam(interior, sp, jspan, bump) {
    var c = beamRank(interior ? 'CWC_two' : 'CWC_single', sp, jspan);
    var d = beamRank(interior ? 'DUF_interior' : 'DUF_perimeter', sp, jspan);
    if (c < 0 || d < 0) return null;
    var r = Math.max(c, d, R.beams.min_rank) + (bump ? 1 : 0);
    return R.beams.by_rank[r] || null;
  }

  function postArea(h) { var p = R.posts.trib_ft2, i = row(p.heights_in, h); return i < 0 ? 0 : p.area[i]; }
  function footing(sp, supported, exempt) {
    var f = R.footings, i = row(f.cols_supported_ft, supported);
    if (i < 0) return null;
    return exempt ? { pad: f.pad_in[String(sp)][i] } : { dia: Math.max(f.dia_in[String(sp)][i], f.min_dia_in) };
  }

  // One platform. Joists run out from the house (length); beams run along it (width).
  function frame(a, lenFt, widFt, hIn, attached, L) {
    var guard = hIn > R.guards.required_over_in;
    var wide = !L.narrow;
    var areaFt2 = lenFt * widFt;
    var exempt = !attached && hIn <= R.footings.exempt.max_height_in && areaFt2 <= R.footings.exempt.max_area_ft2;
    for (var bays = 1; bays <= 6; bays++) {
      var bay = lenFt / bays;
      if (attached && bay > R.ledger.max_bay_ft) continue;
      if (bay > R.joists.stock_max_ft) continue;
      var j = pickJoist(bay, L, guard, wide);
      if (!j) continue;
      var lines = attached ? bays : bays + 1; // beam lines
      var jload = bay * R.margin.load * L.loadF;
      for (var s = 0; s < R.beams.post_spacings_ft.length; s++) {
        var sp = R.beams.post_spacings_ft[s], beams = [], ok = true;
        for (var b = 0; b < lines && ok; b++) {
          var interior = attached ? b < lines - 1 : b > 0 && b < lines - 1;
          var size = pickBeam(interior, sp, jload, wide);
          var supported = (interior ? bay : bay / 2) * R.margin.load * L.loadF;
          var foot = footing(sp, supported, exempt);
          var trib = sp * (interior ? bay : bay / 2) * R.margin.load * L.postF;
          if (!size || !foot || trib > postArea(hIn)) ok = false;
          else beams.push({ at_ft: attached ? bay * (b + 1) : bay * b, size: size, footing: foot, interior: interior });
        }
        if (ok) return { bays: bays, bay: bay, joist: j, post_spacing: sp, beams: beams, guard: guard, exempt: exempt, wide: wide };
      }
    }
    return null;
  }

  function line(en, fr, qty, src, eng) {
    return { sku: null, item_en: en, item_fr: fr, qty: fit(qty), note_en: eng ? 'Engineer’s review required' : '', note_fr: eng ? 'Examen par un ingénieur requis' : '', src: src };
  }

  function deckLines(a, f, lenFt, widFt, hIn, attached, eng) {
    var out = [], J = R.joists.src, B = R.beams.src;
    var jPer = Math.floor(widFt * 12 / f.joist.spacing) + 1;
    var jLen = stock(f.bay);
    var perStock = Math.max(1, Math.floor(jLen / f.bay + 1e-9)); // short bays: cut several joists from one board
    out.push(line(f.joist.size + ' x ' + jLen + ' ft pressure treated joist', 'Solive traitée ' + f.joist.size + ' x ' + jLen + ' pi', Math.ceil(jPer * f.bays / perStock), J, eng));
    var rim = Math.ceil(widFt / 16) * (attached ? 1 : 2);
    out.push(line(f.joist.size + ' x 16 ft pressure treated rim joist', 'Solive de rive traitée ' + f.joist.size + ' x 16 pi', rim, J, eng));
    if (attached) {
      var spans = [6, 8, 10, 12], spacing = R.ledger.spacing_by_span_in[String(spans[row(spans, f.bay)])];
      out.push(line(f.joist.size + ' x 16 ft pressure treated ledger', 'Lambourde traitée ' + f.joist.size + ' x 16 pi', Math.ceil(widFt / 16), R.ledger.src, eng));
      out.push(line('1/2 in ledger bolt with washers', 'Boulon de lambourde 1/2 po avec rondelles', Math.ceil(widFt * 12 / spacing) + 1, R.ledger.src, eng));
      out.push(line('Joist hanger for ' + f.joist.size + ', ledger side', 'Étrier à solive ' + f.joist.size + ', côté lambourde', jPer, R.ledger.src, eng));
      out.push(line('Ledger flashing with drip edge, 10 ft', 'Solin de lambourde avec larmier, 10 pi', Math.ceil(widFt / 10), R.ledger.src, false));
    }
    var posts = 0, conc = 0;
    f.beams.forEach(function (b) {
      var plies = +b.size[0], ply = b.size.slice(2);
      out.push(line(ply + ' x 16 ft pressure treated beam ply (' + b.size + ' beam)', 'Pli de poutre traité ' + ply + ' x 16 pi (poutre ' + b.size + ')', plies * Math.ceil(widFt / 16), B, eng));
      var n = Math.ceil(widFt / f.post_spacing) + 1;
      posts += n;
      var d = (b.footing.dia || b.footing.pad) / 12, depth = f.exempt ? 0.5 : R.footings.frost_depth_in / 12 + 0.5;
      conc += n * (b.footing.dia ? Math.PI * d * d / 4 : d * d) * depth;
    });
    var postLen = stock(Math.max(hIn / 12, 4));
    out.push(line('6x6 x ' + postLen + ' ft pressure treated post', 'Poteau traité 6x6 x ' + postLen + ' pi', posts, R.posts.src, eng));
    var foot = f.beams[0].footing;
    if (f.exempt) out.push(line('Concrete footing pad, ' + foot.pad + ' in square', 'Semelle de béton, ' + foot.pad + ' po carré', posts, R.footings.src, eng));
    else out.push(line('Form tube ' + foot.dia + ' in, set 48 in below grade', 'Tube de coffrage ' + foot.dia + ' po, 48 po sous le sol', posts, R.footings.src, eng));
    out.push(line('Concrete, cubic feet (mix at the counter)', 'Béton, pieds cubes (mélange au comptoir)', Math.ceil(conc), R.footings.src, eng));
    out.push(line('6x6 post base anchored to the footing', 'Base de poteau 6x6 ancrée à la semelle', posts, R.posts.src, eng));
    var threePly = f.beams.some(function (b) { return +b.size[0] >= 3; });
    if (threePly) out.push(line('Post cap for 6x6 and a 3-ply beam', 'Chapeau de poteau 6x6 pour poutre 3 plis', posts, R.posts.src, eng));
    else out.push(line('1/2 in through bolt with nut and 2 washers, post to beam', 'Boulon traversant 1/2 po, écrou et 2 rondelles, poteau à poutre', posts * 2, 'DUF D03 (notch the 6x6, two 1/2 in through bolts)', eng));
    var bearings = jPer * f.beams.length;
    out.push(line('3-1/4 in galvanized nail, joist to beam (count)', 'Clou galvanisé 3-1/4 po, solive à poutre (nombre)', bearings * R.joist_to_beam.nails, R.joist_to_beam.src, false));
    var rows = (f.bay > R.blocking.midspan_over_ft ? f.bays : 0) + f.beams.length;
    var blocks = rows * (jPer - 1), blockIn = f.joist.spacing - 1.5;
    out.push(line(f.joist.size + ' x 8 ft blocking stock', 'Bois de blocage ' + f.joist.size + ' x 8 pi', Math.ceil(blocks * blockIn / 96), R.blocking.src, false));
    out.push(line('2-1/4 in galvanized nail, blocking (count)', 'Clou galvanisé 2-1/4 po, blocage (nombre)', blocks * 2 * R.blocking.nails_each_end, R.blocking.src, false));
    var boardRows = Math.ceil(lenFt * 12 / R.decking.cover_in), perRow = Math.ceil(widFt / 16);
    out.push(line('5/4x6 x 16 ft pressure treated deck board', 'Planche de terrasse traitée 5/4x6 x 16 pi', boardRows * perRow, R.decking.src, false));
    out.push(line('2-1/2 in deck screw (count)', 'Vis à terrasse 2-1/2 po (nombre)', boardRows * jPer * R.decking.screws_per_joist, R.decking.src, false));
    if (hIn > R.bracing.over_in) {
      out.push(line('4x4 x 8 ft pressure treated knee brace stock (2 braces each)', 'Contreventement traité 4x4 x 8 pi (2 appuis chacun)', posts, R.bracing.src, eng));
      out.push(line('1/2 in through bolt with nut and 2 washers, brace', 'Boulon traversant 1/2 po, écrou et 2 rondelles, contreventement', posts * R.bracing.per_post * 2, R.bracing.src, eng));
    }
    return { lines: out, posts: posts };
  }

  function guardLines(runFt) {
    var G = R.guards, posts = Math.ceil(runFt / G.post_max_ft) + 1;
    return [
      line('4x4 x 8 ft pressure treated guard post', 'Poteau de garde-corps traité 4x4 x 8 pi', Math.ceil(posts / 2), G.src, false),
      line('2x6 x 16 ft pressure treated top rail', 'Main courante traitée 2x6 x 16 pi', Math.ceil(runFt / 16), G.src, false),
      line('2x4 x 16 ft pressure treated bottom rail', 'Lisse basse traitée 2x4 x 16 pi', Math.ceil(runFt / 16), G.src, false),
      line('2x2 x 42 in pressure treated baluster', 'Barreau traité 2x2 x 42 po', Math.ceil(runFt * 12 / G.baluster_pitch_in), G.src, false),
      line('#9 x 3 in exterior screw, guard (count)', 'Vis extérieure no 9 x 3 po, garde-corps (nombre)', posts * 8 + Math.ceil(runFt * 12 / G.baluster_pitch_in) * 4, 'DUF D09 (SB-7 detail EB-1, four #9 x 3 in screws per side)', false)
    ];
  }

  function stairLines(riseIn, guard) {
    var S = R.stairs, n = Math.ceil(riseIn / S.riser_max_in);
    if (riseIn / n < S.riser_min_in) n = Math.max(1, Math.floor(riseIn / S.riser_min_in));
    var runIn = (n - 1) * S.run_in, len = Math.sqrt(riseIn * riseIn + runIn * runIn) / 12 + 1;
    var sLen = stock(len);
    if (!sLen) return null; // longer than stock stringers: needs a landing, not in the tables
    var stringers = Math.ceil(S.width_in / S.stringer_max_spacing_in) + 1;
    var out = [
      line('2x12 x ' + sLen + ' ft pressure treated stair stringer', 'Limon traité 2x12 x ' + sLen + ' pi', stringers, S.src, false),
      line('2x12 x 8 ft pressure treated stair tread (2 treads each)', 'Marche traitée 2x12 x 8 pi (2 marches chacune)', Math.ceil((n - 1) / 2), S.src, false),
      line('2x4 x 8 ft stringer blocking', 'Blocage de limon 2x4 x 8 pi', Math.ceil((stringers - 1) * Math.ceil(len * 12 / S.block_every_in) * 24 / 96), S.src, false),
      line('Precast concrete landing pad at the bottom', 'Dalle de béton préfabriquée au bas', 1, 'DUF D07 (stringers anchored to precast concrete, two 3/8 in through bolts)', false),
      line('3/8 in through bolt with washers, stringer to pad', 'Boulon traversant 3/8 po avec rondelles, limon à dalle', stringers * 2, 'DUF D07', false)
    ];
    if (guard) out = out.concat(guardLines(2 * runIn / 12));
    else out.push(line('2x6 x ' + sLen + ' ft pressure treated handrail', 'Main courante traitée 2x6 x ' + sLen + ' pi', 1, 'DCK above-code choice', false));
    return { lines: out, risers: n, run_in: S.run_in, rise_in: riseIn / n };
  }

  var DECK_Q = function () {
    return [
      { id: 'location', label_en: 'Where is the deck?', label_fr: 'Où est la terrasse?', type: 'choice', default: TOWN,
        options: SNOW.rows.map(function (r) { return { value: r.location, label_en: r.location, label_fr: r.location }; }) },
      { id: 'length', label_en: 'Out from the house', label_fr: 'À partir de la maison', type: 'number', unit: 'ft', min: 4, max: 40, default: 12 },
      { id: 'width', label_en: 'Along the house', label_fr: 'Le long de la maison', type: 'number', unit: 'ft', min: 4, max: 40, default: 12 },
      { id: 'height', label_en: 'Height of the deck top above the ground', label_fr: 'Hauteur du dessus de la terrasse au-dessus du sol', type: 'number', unit: 'in', min: 8, max: 137, default: 30 },
      { id: 'attached', label_en: 'Attached to the house?', label_fr: 'Fixée à la maison?', type: 'yesno', default: true },
      { id: 'stairs', label_en: 'Stairs down to the ground?', label_fr: 'Escalier jusqu’au sol?', type: 'yesno', default: true },
      { id: 'hot_tub', label_en: 'Hot tub on the deck?', label_fr: 'Spa sur la terrasse?', type: 'yesno', default: false },
      { id: 'tub_length', when: 'hot_tub', label_en: 'Hot tub length', label_fr: 'Longueur du spa', type: 'number', unit: 'ft', min: 4, max: 12, default: 7 },
      { id: 'tub_width', when: 'hot_tub', label_en: 'Hot tub width', label_fr: 'Largeur du spa', type: 'number', unit: 'ft', min: 4, max: 12, default: 7 },
      { id: 'hot_tub_make', when: 'hot_tub', type: 'text', label_en: 'Hot tub make', label_fr: 'Marque du spa' },
      { id: 'hot_tub_model', when: 'hot_tub', type: 'text', label_en: 'Hot tub model', label_fr: 'Modèle du spa' },
      { id: 'hot_tub_label_image', when: 'hot_tub', type: 'photo', label_en: 'Photo of the spec label or barcode', label_fr: 'Photo de l’étiquette technique ou du code-barres' },
      { id: 'hot_tub_filled_kg', when: 'hot_tub', label_en: 'Filled weight with people, from the spec label', label_fr: 'Poids rempli avec baigneurs, selon l’étiquette technique', type: 'number', unit: 'kg', min: 300, max: 6000, default: 2300 },
      { id: 'tub_from_house', when: 'hot_tub', label_en: 'Tub distance from the house side', label_fr: 'Distance du spa depuis le côté maison', type: 'number', unit: 'ft', min: 2, max: 36, default: 2 },
      { id: 'tub_from_left', when: 'hot_tub', label_en: 'Tub distance from the left end', label_fr: 'Distance du spa depuis l’extrémité gauche', type: 'number', unit: 'ft', min: 2, max: 36, default: 2 },
      { id: 'level2', label_en: 'Add a second level?', label_fr: 'Ajouter un deuxième niveau?', type: 'yesno', default: false },
      { id: 'l2_length', when: 'level2', label_en: 'Second level, out from the house', label_fr: 'Deuxième niveau, à partir de la maison', type: 'number', unit: 'ft', min: 4, max: 24, default: 8 },
      { id: 'l2_width', when: 'level2', label_en: 'Second level, along the house', label_fr: 'Deuxième niveau, le long de la maison', type: 'number', unit: 'ft', min: 4, max: 24, default: 10 },
      { id: 'l2_height', when: 'level2', label_en: 'Second level height above the ground', label_fr: 'Hauteur du deuxième niveau au-dessus du sol', type: 'number', unit: 'in', min: 8, max: 137, default: 14 }
    ];
  };

  // one number formatter by language: French takes a comma decimal
  function num(x, fr) { var t = String(x); return fr ? t.replace('.', ',') : t; }
  function note(en, fr, kind) { return { en: en, fr: fr, kind: kind }; }

  // trust boundary: every number answer the flow sends must be finite and inside its question's range
  function badNumber(a) {
    return DECK_Q().filter(function (q) { return q.type === 'number' && (!q.when || a[q.when]); }).filter(function (q) {
      var v = a[q.id]; return typeof v !== 'number' || !isFinite(v) || v < q.min || v > q.max;
    })[0];
  }

  function deck(a) {
    var notes = [], lines = [], plan = { levels: [] };
    var bad = badNumber(a);
    if (bad) return { lines: [], notes: [note('Check this answer: ' + bad.label_en + '.', 'Vérifiez cette réponse : ' + bad.label_fr + '.', 'info')], plan: null };
    var L = loads(a, a.length, a.width, false);
    if (a.hot_tub && a.tub_length * a.tub_width > a.length * a.width) return { lines: [], notes: [note('The hot tub is bigger than the deck.', 'Le spa est plus grand que la terrasse.', 'info')], plan: null };
    var eng = false; // the main deck carries no tub; only the zone lines are flagged
    var f = frame(a, a.length, a.width, a.height, a.attached, L);
    if (!f) return { lines: [], notes: [note('This size and load is past what the published span tables cover. It needs a designer or an engineer.', 'Cette taille et cette charge dépassent les tables de portées publiées. Il faut un concepteur ou un ingénieur.', 'engineering')], plan: null };
    var d = deckLines(a, f, a.length, a.width, a.height, a.attached, eng);
    lines = d.lines;
    if (f.guard) lines = lines.concat(guardLines(2 * a.length + (a.attached ? 0 : 1) * a.width + a.width - (a.stairs ? 4 : 0)));
    var zone = null;
    if (a.hot_tub) {
      var m = R.hot_tub.zone_margin_ft;
      zone = { x: a.tub_from_left - m, y: a.tub_from_house - m, w: a.tub_width + 2 * m, l: a.tub_length + 2 * m };
      if (zone.x < 0 || zone.y < 0 || zone.x + zone.w > a.width || zone.y + zone.l > a.length)
        return { lines: [], notes: [note('The tub needs 2 ft of deck on every side of it, inside the deck.', 'Le spa doit avoir 2 pi de terrasse de chaque côté, à l’intérieur de la terrasse.', 'info')], plan: null };
      var Lz = loads(a, zone.l, zone.w, true);
      var fz = frame({}, zone.l, zone.w, a.height, false, Lz);
      if (!fz) return { lines: [], notes: [note('This hot tub is past what the published span tables cover. It needs an engineer’s design.', 'Ce spa dépasse les tables de portées publiées. Il faut une conception d’ingénieur.', 'engineering')], plan: null };
      // zone joists sit beside the main joists on the zone beams, so they are never shallower than the main joists
      var depth = ['2x6', '2x8', '2x10', '2x12'];
      if (depth.indexOf(fz.joist.size) < depth.indexOf(f.joist.size)) fz.joist = { size: f.joist.size, spacing: fz.joist.spacing };
      zone.joist = fz.joist; zone.beams = fz.beams; zone.post_spacing = fz.post_spacing; zone.kpa = Lz.tub;
      // the zone is its own frame (beams, posts, footings, joists) sized to carry the tub alone; the main deck is framed over it and is not counted on for the tub; no decking or rims of its own
      lines = lines.concat(deckLines(a, fz, zone.l, zone.w, a.height, false, true).lines.filter(function (x) { return !/deck board|deck screw|rim joist/.test(x.item_en); }).map(function (x) {
        x.item_en = 'Hot tub zone: ' + x.item_en; x.item_fr = 'Zone du spa : ' + x.item_fr;
        x.note_en = 'Engineer’s review required'; x.note_fr = 'Examen par un ingénieur requis'; return x;
      }));
    }
    var st = null;
    if (a.stairs) {
      var low = a.level2 ? Math.min(a.height, a.l2_height) : a.height;
      st = stairLines(low, low > R.guards.required_over_in);
      if (!st) notes.push(note('The stairs are too long for one flight. They need a landing, which a designer lays out.', 'L’escalier est trop long pour une seule volée. Il faut un palier, à faire concevoir.', 'engineering'));
      else lines = lines.concat(st.lines);
    }
    plan.levels.push({ zone: zone, length: a.length, width: a.width, height: a.height, attached: a.attached, joist: f.joist, bays: f.bays, post_spacing: f.post_spacing, beams: f.beams, guard: f.guard, stairs: st && { risers: st.risers, run_in: st.run_in } });
    if (a.level2) {
      var L2 = loads(a, a.l2_length, a.l2_width);
      var f2 = frame({}, a.l2_length, a.l2_width, a.l2_height, false, L2);
      if (!f2) notes.push(note('The second level is past the span tables. It needs a designer.', 'Le deuxième niveau dépasse les tables de portées. Il faut un concepteur.', 'engineering'));
      else {
        lines = lines.concat(deckLines(a, f2, a.l2_length, a.l2_width, a.l2_height, false, false).lines);
        if (f2.guard) lines = lines.concat(guardLines(2 * (a.l2_length + a.l2_width) - 4));
        var between = stairLines(Math.abs(a.height - a.l2_height), Math.abs(a.height - a.l2_height) > R.guards.required_over_in);
        if (between) lines = lines.concat(between.lines);
        plan.levels.push({ length: a.l2_length, width: a.l2_width, height: a.l2_height, attached: false, joist: f2.joist, bays: f2.bays, post_spacing: f2.post_spacing, beams: f2.beams, guard: f2.guard });
      }
    }
    var snowT = function (t, fr) { return t.replace('{place}', L.loc.location).replace('{ss}', num(L.loc.Ss_kPa, fr)).replace('{sr}', num(L.loc.Sr_kPa, fr)); };
    notes.push(note(snowT("The published ground snow load for {place} is Ss {ss} kPa, with a rain load of Sr {sr} kPa (Ontario Supplementary Standard SB-1, Table 2).") + ' The list is sized for ' + num(L.live.toFixed(2)) + ' kPa.', snowT("La charge de neige au sol publi\u00e9e pour {place} est de Ss {ss} kPa, avec une charge due \u00e0 la pluie Sr de {sr} kPa (norme suppl\u00e9mentaire SB-1 de l'Ontario, tableau 2).", true) + ' La liste est dimensionnée pour ' + num(L.live.toFixed(2), true) + ' kPa.', 'info'));
    if (f.guard) notes.push(note('More than 600 mm (23 5/8 in) above the ground, so it needs a 42 in guard.', 'Plus de 600 mm (23 5/8 po) au-dessus du sol, donc il faut un garde-corps de 42 po.', 'info'));
    else notes.push(note('600 mm (23 5/8 in) or less above the ground, so the Code does not require a guard.', '600 mm (23 5/8 po) ou moins au-dessus du sol : le Code n’exige pas de garde-corps.', 'info'));
    if (f.exempt) notes.push(note('Low and freestanding, so the footings can sit on the ground instead of 48 in down.', 'Basse et autoportante, donc les semelles peuvent reposer au sol plutôt qu’à 48 po de profondeur.', 'info'));
    if (zone) {
      // R-504 copy, TMK 69fa4ea, exact strings
      notes.push(note("Only the marked heavy zone is built to carry the tub: its footprint plus two feet all round. The posts, beams and footings under that zone are sized for the tub's filled weight with people in it; the rest of the deck is not. Moving the tub outside that zone, even by a little, can collapse the deck. To put the tub somewhere else, the list has to be built again for the new position and reviewed by an engineer.", "Seule la zone renforc\u00e9e indiqu\u00e9e est construite pour porter le spa : son empreinte plus deux pieds tout autour. Les poteaux, les poutres et les semelles sous cette zone sont dimensionn\u00e9s pour le poids du spa rempli et occup\u00e9; le reste de la terrasse ne l'est pas. D\u00e9placer le spa hors de cette zone, m\u00eame un peu, peut provoquer l'effondrement de la terrasse. Pour installer le spa ailleurs, la liste doit \u00eatre refaite pour la nouvelle position et examin\u00e9e par un ing\u00e9nieur.", 'engineering'));
      notes.push(note("This list is a materials guide for the tub in the position shown, and nothing else. It is not a design, not a permit drawing and not an engineering opinion. Nobody from the store has seen your site, and no one here has checked your ground, your drainage, or the weight of your tub beyond what you told us. A hot tub deck has to be reviewed by an engineer before anything is built, and where the tub sits, what you build, and what you had checked first are your decisions. Ontario law gives you rights that we cannot ask you to give up, and nothing here tries to.", "Cette liste est un guide de mat\u00e9riaux pour le spa \u00e0 la position indiqu\u00e9e, et rien d'autre. Ce n'est pas un plan, ni un dessin pour un permis, ni un avis d'ing\u00e9nieur. Personne du magasin n'a vu votre terrain, et personne ici n'a v\u00e9rifi\u00e9 votre sol, votre drainage, ni le poids de votre spa au-del\u00e0 de ce que vous nous avez indiqu\u00e9. Une terrasse avec spa doit \u00eatre examin\u00e9e par un ing\u00e9nieur avant que quoi que ce soit soit construit, et l'emplacement du spa, ce que vous construisez et ce que vous avez fait v\u00e9rifier d'abord rel\u00e8vent de vos d\u00e9cisions. La loi ontarienne vous accorde des droits auxquels nous ne pouvons pas vous demander de renoncer, et rien ici n'essaie de le faire.", 'engineering'));
    }
    notes.push(note(R.permit.en, R.permit.fr, 'permit'));
    return { lines: lines, notes: notes, plan: plan };
  }

  function next(kind, answers) {
    var STUB = [note('Sample list only, not yet checked against the building code.', 'Liste exemple seulement, pas encore vérifiée selon le code du bâtiment.', 'info')];
    if (kind !== 'deck') {
      var q0 = (kind === 'shed' ? [{ id: 'length', label_en: 'Shed length', label_fr: 'Longueur du cabanon', type: 'number', unit: 'ft', min: 4, max: 16, default: 12 }, { id: 'width', label_en: 'Shed width', label_fr: 'Largeur du cabanon', type: 'number', unit: 'ft', min: 4, max: 16, default: 10 }]
        : [{ id: 'length', label_en: 'Wall length', label_fr: 'Longueur du mur', type: 'number', unit: 'ft', min: 2, max: 60, default: 20 }, { id: 'height', label_en: 'Wall height', label_fr: 'Hauteur du mur', type: 'number', unit: 'in', min: 72, max: 120, default: 96 }])
        .filter(function (x) { return !(x.id in answers); })[0] || null;
      return { question: q0, lines: [], notes: STUB };
    }
    var q = DECK_Q().filter(function (x) { return !(x.id in answers) && (!x.when || answers[x.when]); })[0] || null;
    if (q) return { question: q, lines: [], notes: [] };
    var r = deck(answers);
    return { question: null, lines: r.lines, notes: r.notes, plan: r.plan };
  }

  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }

  root.Builders = {
    kinds: [{ id: 'deck', en: 'Deck', fr: 'Terrasse' }, { id: 'shed', en: 'Shed', fr: 'Cabanon' }, { id: 'wall', en: 'Basement wall', fr: 'Mur de sous-sol' }],
    // The tables are not part of this repository (see README, Data tables). The host page passes
    // the URLs of its own rules and climate tables, shaped as in SCHEMAS.md.
    load: function (urls) {
      if (R) return Promise.resolve();
      return Promise.all([getJSON(urls.rules), getJSON(urls.snow)]).then(function (x) { R = x[0]; SNOW = x[1]; });
    },
    setDefaultLocation: function (name) { TOWN = name; },
    _set: function (rules, snow) { R = rules; SNOW = snow; }, // tests only
    next: next
  };
})(typeof window !== 'undefined' ? window : globalThis);
