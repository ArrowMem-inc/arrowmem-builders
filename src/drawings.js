// Copyright 2026 ArrowMem Inc.
// SPDX-License-Identifier: Apache-2.0
// Dimensioned SVG drawings for the builder. Pure strings, no library, no DOM.
// BuilderDrawings.render(kind, answers, plan, lang, opts) -> { plan_svg, elevation_svg }
// opts.finished: the built look only (decking, guards, stairs, skirt, siding, roof), no joists,
// beams, posts, footings or bracing. The hot tub zone still shows: it is a safety instruction.
// Deck draws from Builders' plan field; shed and wall from their answers. Colours follow currentColor.
(function (root) {
  var W = 640, PAD = 48;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ft(v) { var f = Math.floor(v + 1e-9), i = Math.round((v - f) * 12); if (i === 12) { f++; i = 0; } return i ? f + ' ft ' + i + ' in' : f + ' ft'; }
  function svg(h, body, label) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="' + esc(label) +
      '" style="width:100%;height:auto;color:inherit" font-family="system-ui,sans-serif" font-size="12" fill="none" stroke="currentColor">' + body + '</svg>';
  }
  function L(x1, y1, x2, y2, w, dash) { return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke-width="' + (w || 1) + '"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>'; }
  function T(x, y, s, anchor) { return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="currentColor" stroke="none" text-anchor="' + (anchor || 'middle') + '">' + esc(s) + '</text>'; }
  function R(x, y, w, h, fill, sw) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"' + (fill ? ' fill="currentColor"' : '') + ' stroke-width="' + (sw || 1) + '"/>'; }
  // dimension line with end ticks and a centred label
  function dimH(x1, x2, y, s) { return L(x1, y, x2, y, 0.8) + L(x1, y - 5, x1, y + 5, 0.8) + L(x2, y - 5, x2, y + 5, 0.8) + T((x1 + x2) / 2, y - 6, s); }
  function dimV(x, y1, y2, s) { return L(x, y1, x, y2, 0.8) + L(x - 5, y1, x + 5, y1, 0.8) + L(x - 5, y2, x + 5, y2, 0.8) + '<text x="' + (x - 8) + '" y="' + ((y1 + y2) / 2).toFixed(1) + '" fill="currentColor" stroke="none" text-anchor="middle" transform="rotate(-90 ' + (x - 8) + ' ' + ((y1 + y2) / 2).toFixed(1) + ')">' + esc(s) + '</text>'; }
  function posts(width, sp) { var n = Math.ceil(width / sp) + 1, out = []; for (var i = 0; i < n; i++) out.push(width * i / (n - 1)); return out; }

  // Plan view: house along the top, joists run down (out from the house), beams across.
  function deckPlan(lv, fr, fin) {
    var s = Math.min((W - 2 * PAD) / lv.width, 260 / lv.length), x0 = PAD, y0 = PAD + 10, w = lv.width * s, h = lv.length * s, b = '';
    if (lv.attached) b += L(x0 - 20, y0, x0 + w + 20, y0, 4) + T(x0 + w / 2, y0 - 8, fr ? 'Maison' : 'House');
    var sp = lv.joist.spacing / 12;
    if (fin) {
      b += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="currentColor" fill-opacity="0.07" stroke="none"/>';
      for (var yb = 5.5 / 12; yb < lv.length - 1e-6; yb += 5.75 / 12) b += L(x0, y0 + yb * s, x0 + w, y0 + yb * s, 0.4); // 5-1/2 in boards, 1/4 in gap
      if (lv.guard) { // guard on the open sides, open where the stairs meet the deck
        var gap = lv.stairs ? 2 * s : 0, cx = x0 + w / 2;
        b += '<path d="M' + x0 + ' ' + y0 + ' V' + (y0 + h) + ' H' + (cx - gap) + ' M' + (cx + gap) + ' ' + (y0 + h) + ' H' + (x0 + w) + ' V' + y0 + (lv.attached ? '' : ' H' + x0) + '" stroke-width="4"/>';
      }
    } else for (var x = 0; x <= lv.width + 1e-6; x += sp) b += L(x0 + x * s, y0, x0 + x * s, y0 + h, 0.5);
    b += R(x0, y0, w, h, false, 1.5);
    if (!fin) lv.beams.forEach(function (bm) {
      var y = y0 + bm.at_ft * s;
      b += L(x0, y, x0 + w, y, 3);
      posts(lv.width, lv.post_spacing).forEach(function (p) { b += R(x0 + p * s - 4, y - 4, 8, 8, true); });
    });
    if (lv.zone) { var z = lv.zone; b += '<rect x="' + (x0 + z.x * s).toFixed(1) + '" y="' + (y0 + z.y * s).toFixed(1) + '" width="' + (z.w * s).toFixed(1) + '" height="' + (z.l * s).toFixed(1) + '" fill="currentColor" fill-opacity="0.12" stroke-width="2" stroke-dasharray="6 3"/>' ; z.beams.forEach(function (zb) { var y = y0 + (z.y + zb.at_ft) * s; b += L(x0 + z.x * s, y, x0 + (z.x + z.w) * s, y, 2, true); posts(z.w, z.post_spacing).forEach(function (p) { b += R(x0 + (z.x + p) * s - 3, y - 3, 6, 6, true); }); }); b += T(x0 + (z.x + z.w / 2) * s, y0 + (z.y + z.l / 2) * s - 4, fr ? "Zone renforc\u00e9e : le spa va ici seulement. Le d\u00e9placer peut faire effondrer la terrasse." : "Heavy zone: the tub goes here only. Moving it can collapse the deck."); }
    if (lv.stairs) { var sw = 4 * s, sr = (lv.stairs.risers - 1) * lv.stairs.run_in / 12 * s; b += R(x0 + w / 2 - sw / 2, y0 + h, sw, sr, false, 1) + T(x0 + w / 2, y0 + h + sr / 2 + 4, fr ? 'Escalier' : 'Stairs'); }
    b += dimH(x0, x0 + w, y0 + h + (lv.stairs ? (lv.stairs.risers - 1) * lv.stairs.run_in / 12 * s : 0) + 24, ft(lv.width));
    b += dimV(x0 + w + 30, y0, y0 + h, ft(lv.length));
    var key = fin ? (fr ? 'Vue finie : platelage, garde-corps et escalier' : 'Finished view: decking, guards and stairs') : lv.joist.size + (fr ? ' aux ' : ' at ') + lv.joist.spacing + (fr ? ' po, poutre ' : ' in, beam ') + lv.beams.map(function (x) { return x.size; }).join(' / ') + (fr ? ', poteaux 6x6' : ', 6x6 posts');
    var H = y0 + h + (lv.stairs ? (lv.stairs.risers - 1) * lv.stairs.run_in / 12 * s : 0) + 60;
    return svg(H, b + T(PAD, H - 10, key, 'start'), (fr ? 'Plan de la terrasse ' : 'Deck plan ') + ft(lv.width) + ' x ' + ft(lv.length));
  }

  // Side elevation: looking along the house. Ground, posts to footings, guard, stairs.
  function deckElev(lv, fr, fin) {
    var hFt = lv.height / 12, frost = lv.height <= 24 && !lv.attached ? 0.5 : 4, g = lv.guard ? 3.5 : 0;
    var run = lv.stairs ? (lv.stairs.risers - 1) * lv.stairs.run_in / 12 : 0;
    var s = Math.min((W - 2 * PAD) / (lv.length + run), 220 / (hFt + g + frost));
    var x0 = PAD, gy = PAD + (hFt + g) * s + 10, dy = gy - hFt * s, len = lv.length * s, b = '';
    b += L(PAD / 2, gy, W - PAD / 2, gy, 1.5) + T(W - PAD / 2, gy + 14, fr ? 'Sol' : 'Grade', 'end');
    if (lv.attached) b += L(x0, PAD / 2, x0, gy, 4);
    b += R(x0, dy - 6, len, 6, false, 1.5);
    if (fin) {
      b += '<rect x="' + x0.toFixed(1) + '" y="' + dy.toFixed(1) + '" width="' + len.toFixed(1) + '" height="' + (gy - dy).toFixed(1) + '" fill="currentColor" fill-opacity="0.1" stroke-width="1"/>';
      for (var sx = 0.5; sx < lv.length; sx += 0.5) b += L(x0 + sx * s, dy, x0 + sx * s, gy, 0.3); // skirt boards
    }
    if (!fin) lv.beams.forEach(function (bm) {
      var x = x0 + bm.at_ft * s;
      b += R(x - 3, dy, 6, gy - dy, true);
      b += R(x - 6, gy, 12, frost * s, false, 1).replace('/>', ' stroke-dasharray="4 3"/>');
    });
    if (lv.guard) { b += L(x0, dy - 6 - 3.5 * s, x0 + len, dy - 6 - 3.5 * s, 1.5); for (var x = 0; x <= lv.length + 1e-6; x += 4) b += L(x0 + x * s, dy - 6, x0 + x * s, dy - 6 - 3.5 * s, 1); if (fin) for (var bx = 5 / 12; bx < lv.length; bx += 5 / 12) b += L(x0 + bx * s, dy - 6, x0 + bx * s, dy - 6 - 3.5 * s, 0.4); b += dimV(x0 + len + 16, dy - 6 - 3.5 * s, dy - 6, '42 in'); }
    if (lv.stairs) b += L(x0 + len, dy, x0 + len + run * s, gy, 2);
    b += dimV(x0 - 20, dy, gy, lv.height + ' in');
    b += dimH(x0, x0 + len, gy + (fin ? 0 : frost * s) + 18, ft(lv.length));
    return svg(gy + (fin ? 0 : frost * s) + 30, b, (fr ? 'Élévation, hauteur ' : 'Elevation, height ') + lv.height + ' in');
  }

  function shed(a, fr, fin) {
    var l = a.length || 12, w = a.width || 10, wallH = 8, rise = w / 2 * 4 / 12; // 4 in 12 pitch, drawing only
    var s = Math.min((W - 2 * PAD) / w, 220 / (wallH + rise)), gy = PAD + (wallH + rise) * s, x0 = PAD, b = '';
    b += L(PAD / 2, gy, W - PAD / 2, gy, 1.5);
    b += R(x0, gy - wallH * s, w * s, wallH * s, false, 1.5) + '<polyline points="' + [x0, gy - wallH * s, x0 + w * s / 2, gy - (wallH + rise) * s, x0 + w * s, gy - wallH * s].join(' ') + '" stroke-width="1.5"/>';
    if (fin) {
      for (var yy = 0.5; yy < wallH; yy += 0.5) b += L(x0, gy - yy * s, x0 + w * s, gy - yy * s, 0.3); // lap siding
      b += '<polygon points="' + [x0 - 6, gy - wallH * s, x0 + w * s / 2, gy - (wallH + rise) * s - 4, x0 + w * s + 6, gy - wallH * s].join(' ') + '" fill="currentColor" fill-opacity="0.25" stroke-width="1.5"/>';
      b += '<rect x="' + (x0 + w * s / 2 - 1.5 * s).toFixed(1) + '" y="' + (gy - 6.5 * s).toFixed(1) + '" width="' + (3 * s).toFixed(1) + '" height="' + (6.5 * s).toFixed(1) + '" fill="#fff" stroke-width="2.5"/>';
    }
    b += R(x0 + w * s / 2 - 1.5 * s, gy - 6.5 * s, 3 * s, 6.5 * s, false, 1);
    b += dimH(x0, x0 + w * s, gy + 20, ft(w)) + dimV(x0 - 16, gy - wallH * s, gy, ft(wallH));
    return {
      elevation_svg: svg(gy + 40, b, (fr ? 'Façade du cabanon ' : 'Shed front ') + ft(w)),
      plan_svg: svg(w * s + 80, R(PAD, PAD, l * s, w * s, false, 1.5) + dimH(PAD, PAD + l * s, PAD + w * s + 24, ft(l)) + dimV(PAD + l * s + 24, PAD, PAD + w * s, ft(w)), (fr ? 'Plan du cabanon ' : 'Shed plan ') + ft(l) + ' x ' + ft(w))
    };
  }

  function wall(a, fr) {
    var l = a.length || 20, hIn = a.height || 96, h = hIn / 12, s = Math.min((W - 2 * PAD) / l, 220 / h), x0 = PAD, y0 = PAD, b = '';
    b += R(x0, y0, l * s, h * s, false, 1.5);
    for (var x = 16 / 12; x < l - 1e-6; x += 16 / 12) b += L(x0 + x * s, y0, x0 + x * s, y0 + h * s, 0.6);
    b += L(x0, y0 + 3, x0 + l * s, y0 + 3, 1) + L(x0, y0 + h * s - 3, x0 + l * s, y0 + h * s - 3, 1);
    b += dimH(x0, x0 + l * s, y0 + h * s + 22, ft(l)) + dimV(x0 + l * s + 24, y0, y0 + h * s, hIn + ' in');
    var e = svg(y0 + h * s + 40, b, (fr ? 'Mur de sous-sol ' : 'Basement wall ') + ft(l) + ' x ' + hIn + ' in');
    return { plan_svg: '', elevation_svg: e };
  }

  function render(kind, answers, plan, lang, opts) {
    var fr = lang === 'fr', fin = !!(opts && opts.finished);
    if (kind === 'shed') { return shed(answers || {}, fr, fin); }
    if (kind === 'wall') return wall(answers || {}, fr);
    if (!plan || !plan.levels) return { plan_svg: '', elevation_svg: '' };
    return {
      plan_svg: plan.levels.map(function (lv) { return deckPlan(lv, fr, fin); }).join(''),
      elevation_svg: plan.levels.map(function (lv) { return deckElev(lv, fr, fin); }).join('')
    };
  }

  root.BuilderDrawings = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
