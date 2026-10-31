/* "Make pattern PDF": The Yarn Side pattern template, built in the browser with jsPDF (vendored).
   Every color, stitch count, row count and row range comes from the current chart. */
(function (root) {
  'use strict';
  const C = () => root.MosaicColors, Wr = () => root.MosaicWritten;
  const TEAL = '#125765', DARK = '#222222', GREY = '#666666', LOGO_AR = 960 / 300;
  const clean = s => String(s).replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, '');
  const rgbOf = h => C().hexToRgb(h), lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const SUBTITLE = 'Overlay Mosaic Crochet Pattern', SKILL = 'Beginner';
  const STORES = [['Ravelry', 'https://www.ravelry.com/designers/the-yarn-side']]; // add more [name, url] pairs here (e.g. Etsy)
  const GAUGE = 15; // sts and rows per 4"
  const half = v => Math.round(v * 2) / 2, fmtIn = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  function sizeEstimate(n, H) { const w = half(n * 4 / GAUGE), h = half((H + 1) * 4 / GAUGE); return { w: Math.max(0.5, w), h: Math.max(0.5, h) }; }
  // Unique yarn entries in use, in order: [{key, yarn, idx, label, hex, from, to}]
  function yarns(plan, H) {
    const leg = C().legend(plan, H), cnt = { A: plan.A.length, B: plan.B.length }, out = [];
    for (const y of ['A', 'B']) plan[y].forEach((e, i) => { const l = leg.find(q => q.yarn === y && q.from === e.row);
      out.push({ key: y + i, yarn: y, idx: i, label: 'Color ' + (cnt[y] > 1 ? y + (i + 1) : y), hex: e.hex, from: e.row, to: Math.min(l ? l.to : H, H) }); });
    return out.filter(e => e.from <= H);
  }
  function yarnFor(Y, r) { const y = r % 2 ? 'A' : 'B'; let best = null; for (const e of Y) if (e.yarn === y && e.from <= r) best = e; return best; }
  function chartRanges(H, per) { const pages = greedy(H, per).length; per = Math.ceil((H + 2 * (pages - 1)) / pages); return greedy(H, per); }
  function greedy(H, per) { const out = []; let r0 = 1; while (true) { const r1 = Math.min(H, r0 + per - 1); out.push([r0, r1]); if (r1 >= H) break; r0 = r1 - 1; } return out; }

  function build(o) {
    const { X, plan } = o, H = X.length, Wd = X[0].length, n = Wd + 2;
    const title = clean(o.title).trim(), names = o.names || {}, Y = yarns(plan, H);
    const nm = e => { const v = clean(names[e.key] || '').trim(); return v ? `${e.label} - ${v}` : e.label; };
    const doc = new root.jspdf.jsPDF({ unit: 'pt', format: 'letter', compress: true });
    doc.setProperties({ title: `${title} Overlay Mosaic Pattern - The Yarn Side`, author: 'The Yarn Side' });
    let PW = 612, PH = 792, page = 0, y = 0;
    const T = v => PH - v; // reportlab-style bottom-up y -> jsPDF top-down
    const fill = h => doc.setFillColor(h), stroke = h => doc.setDrawColor(h), ink = h => doc.setTextColor(h);
    const font = (st, sz) => { doc.setFont('helvetica', st); doc.setFontSize(sz); };
    const text = (s, x, yy, opt) => doc.text(clean(s), x, T(yy), opt);
    const width = (s, st, sz) => { font(st, sz); return doc.getTextWidth(clean(s)); };
    const wrap = (s, st, sz, w) => { font(st, sz); return doc.splitTextToSize(clean(s), w); };
    const rect = (x, yy, w, h, f, s) => doc.rect(x, T(yy + h), w, h, f && s ? 'FD' : f ? 'F' : 'S');
    const line = (x1, y1, x2, y2) => doc.line(x1, T(y1), x2, T(y2));
    const logo = (x, yy, w) => o.logo && doc.addImage(o.logo, 'PNG', x, T(yy + w / LOGO_AR), w, w / LOGO_AR);
    const footTxt = `\u00a9 The Yarn Side  \u00b7  ${title} Overlay Mosaic Pattern  \u00b7  For personal use only`;
    function footer() { page++; stroke(TEAL); doc.setLineWidth(1); line(54, 40, PW - 54, 40); font('normal', 8); ink(GREY); text(footTxt, 54, 28); text('Page ' + page, PW - 54, 28, { align: 'right' }); }
    function header(t) { logo(PW - 54 - 120, PH - 72, 120); ink(GREY); font('bold', 8.5); text(`${title.toUpperCase()}  \u00b7  OVERLAY MOSAIC PATTERN`, 54, PH - 40, { maxWidth: PW - 108 - 135 });
      let hs = 20; while (hs > 12 && width(t, 'bold', hs) > PW - 108 - 135) hs -= 1; ink(TEAL); font('bold', hs); text(t, 54, PH - 66); stroke(TEAL); doc.setLineWidth(2); line(54, PH - 80, PW - 54, PH - 80); }
    function newPage(orient) { doc.addPage('letter', orient || 'p'); PW = orient === 'l' ? 792 : 612; PH = orient === 'l' ? 612 : 792; }
    let curHead = '';
    function ensure(need) { if (y - need < 60) { footer(); newPage(); header(curHead + ' (continued)'); y = PH - 110; } }
    let K = 1;
    function sec(t) { ensure(40); ink(TEAL); font('bold', 13 * K); text(t, 54, y); y -= 18 * K; }
    function para(t, indent = 64, size = 10.5, bullet = true) { size *= K; const ls = wrap(t, 'normal', size, PW - 54 - indent - 6);
      ls.forEach((l, i) => { ensure(14 * K); ink(DARK); font('normal', size); if (i === 0 && bullet) { fill(DARK); doc.circle(indent - 7, T(y + size * 0.33), 1.3, 'F'); } text(l, indent, y); y -= 14 * K; }); y -= 3 * K; }
    function fit(fn) { const before = doc.getNumberOfPages(), p0 = page; for (K = 1; ; K -= 0.05) { fn(); if (doc.getNumberOfPages() === before + 1 || K < 0.8) break;
        while (doc.getNumberOfPages() > before) doc.deletePage(doc.getNumberOfPages()); page = p0; } K = 1; }
    function swatch(hex, label, mark) { ensure(20 * K); fill(hex); stroke(DARK); doc.setLineWidth(.5); rect(64, y - 3, 14, 14, true, true);
      const ik = lum(rgbOf(hex)) < 140 ? '#ffffff' : DARK;
      if (mark === 'X') { stroke(ik); doc.setLineWidth(1); line(66, y - 1, 76, y + 9); line(66, y + 9, 76, y - 1); }
      if (mark === 'BS') { ink(ik); font('bold', 6); text('BS', 71, y + 2, { align: 'center' }); }
      ink(DARK); font('normal', 10.5 * K); wrap(label, 'normal', 10.5 * K, PW - 86 - 60).forEach((l, i) => { if (i) { y -= 13 * K; } text(l, 86, y); }); y -= 20 * K; }
    const yarnRows = e => { const par = e.yarn === 'A' ? 'odd' : 'even'; return e.from === e.to ? `row ${e.from}` : `${par} rows ${e.from}-${e.to}`; };
    const yarnLine = e => `${nm(e)}: ${yarnRows(e)}${e.yarn === 'A' && e.from === 1 ? ', plus the row 0 chain' : ''}`;
    const twoColor = Y.length === 2;

    // ---------- 1. Cover ----------
    fill(TEAL); rect(0, PH - 150, PW, 150, true); fill('#ffffff'); doc.roundedRect(PW / 2 - 160, T(PH - 35), 320, 100, 12, 12, 'F'); logo(PW / 2 - 150, PH - 132, 300);
    let ts = 34; while (ts > 18 && width(title, 'bold', ts) > PW - 100) ts -= 1;
    const tl = wrap(title, 'bold', ts, PW - 100).slice(0, 2); ink(TEAL); font('bold', ts); tl.forEach((l, i) => text(l, PW / 2, PH - 198 - i * ts * 1.05, { align: 'center' }));
    const sy = PH - 222 - (tl.length - 1) * ts * 1.05; ink(DARK); font('normal', 16); text(SUBTITLE, PW / 2, sy, { align: 'center' });
    if (o.preview) { const top = sy - 18, bot = 112, mh = top - bot, mw = PW - 120, ar = o.previewW / o.previewH; let iw = mw, ih = iw / ar; if (ih > mh) { ih = mh; iw = ih * ar; }
      doc.addImage(o.preview, 'PNG', PW / 2 - iw / 2, T(top), iw, ih); }
    ink(DARK); font('normal', 12); text(`Written row-by-row instructions  \u00b7  Enlarged multi-page chart  \u00b7  ${n} sts x ${H} rows`, PW / 2, 95, { align: 'center' });
    ink(TEAL); font('bold', 12); text('Skill level: ' + SKILL, PW / 2, 75, { align: 'center' }); footer();

    // ---------- 2. What is overlay mosaic ----------
    fit(() => {
    newPage(); curHead = 'What Is Overlay Mosaic Crochet?'; header(curHead); y = PH - 110;
    para('Overlay mosaic crochet makes a bold picture using only simple stitches. Each row is worked in just one color, and the colors alternate every row. Instead of carrying yarn along, you cut it at the end of each row.', 54, 10.5, false);
    y -= 4; sec('How this pattern works');
    ['Worked flat, bottom up. Every row is worked right to left (RS facing). Cut yarn at the end of each row, leaving tails.',
      'Odd rows use yarn A, even rows use yarn B. The foundation chain is row 0, in A.',
      'BS = border stitch: sc through both loops at each end of the row.', 'sc = single crochet in back loop only.',
      "dc = double crochet in front loop of the stitch two rows below, worked in front of the previous row (these are the X's on the chart).",
      '(...) xN = repeat what is inside the parentheses N times.'].forEach(t => para(t));
    y -= 4; sec('Why the color "drops down"');
    para('Because you always work on the right side, the back-loop sc stitches sit in the background, showing the color of the current row. When you reach an X, you reach down in front of the row you just made and work a dc into the front loop of the stitch two rows below. That tall stitch covers the row behind it and shows the same color as the row two below, which is how the picture forms.');
    para(`The BS at each end of every row keeps the edges neat and the stitch count steady at ${n} stitches.`);
    y -= 4; sec('Colors'); Y.forEach(e => swatch(e.hex, yarnLine(e)));
    if (!twoColor) para('Where a yarn changes color, start the new color at the beginning of the row shown and use it for that yarn from then on.', 64, 10.5, false);
    para(`These colors are suggestions; any ${twoColor ? 'two ' : ''}high-contrast colors work.`, 64, 10.5, false);
    const sz = sizeEstimate(n, H);
    y -= 4; sec('Yarn, hook and size');
    para(`Use any yarn and a hook that suits it; size depends on your yarn and hook. Chart is ${n} sts (including the BS at each end) x ${H} rows, plus the foundation chain.`, 64, 10.5, false);
    para(`Estimated finished size with worsted weight (#4) yarn and a size H (5.0 mm) hook: approximately ${fmtIn(sz.w)}" wide x ${fmtIn(sz.h)}" tall (based on a typical overlay mosaic gauge of about ${GAUGE} sts and ${GAUGE} rows = 4"). Size varies with your tension, yarn and hook.` + ((o.project || 'chart') === 'blanket' || o.project === 'wall' ? ` With the envelope border (see Finishing), about ${fmtIn(half(n * 4 / GAUGE + 2))}" x ${fmtIn(half((H + 1) * 4 / GAUGE + 2))}".` : ''), 64, 10.5, false);
    if (clean(o.notes || '').trim()) { y -= 4; sec("Designer's notes"); clean(o.notes).split(/\n+/).filter(s => s.trim()).forEach(t => para(t.trim(), 64, 10.5, false)); }
    y -= 4; sec('Ideas for using this chart');
    para(clean(o.ideas || '').trim() || 'This chart can be used for a blanket, pillow, sweater panel, tapestry or wall hanging, bag, and more.', 64, 10.5, false);
    y -= 4; sec('New to overlay mosaic?');
    para('There are lots of video tutorials online that will help explain the overlay mosaic process. Try searching "overlay mosaic crochet tutorial" on YouTube.', 64, 10.5, false); footer(); });

    // chart pagination (needed for the read-the-chart page)
    const LW = 792, LH = 612, cs = Math.min(12, (LW - 108 - 80) / n), gridTop = LH - 118, keyRows = Math.ceil((Y.length + 2) / 4), gridBot = 70 + 30 + keyRows * 16;
    const per = Math.max(6, Math.floor((gridTop - gridBot) / cs)), ranges = chartRanges(H, per);

    // ---------- 3. How to read the chart ----------
    fit(() => {
    newPage(); curHead = 'How to Read the Chart'; header(curHead); y = PH - 110;
    const ex = (() => { for (let r = 1; r <= H; r++) if (X[r - 1].some(v => v)) return r; return 1; })();
    const exStr = 'B' + Wr().rowString(X, ex) + 'B', runs = []; for (let i = 0; i < exStr.length; i++) { const t = exStr[i], l = runs[runs.length - 1]; if (l && l.t === t && t !== 'B') l.n++; else runs.push({ t, n: 1, i0: i }); }
    const SHOW = Math.min(16, n), shown = runs.filter(r => r.i0 < SHOW), exY = yarnFor(Y, ex);
    const desc = r => r.t === 'B' ? 'BS' : `${r.t === 'd' ? 'dc' : 'sc'} ${r.n}`;
    const tipRuns = shown.filter(r => r.i0 + r.n <= SHOW).slice(1, 3);
    const lineFull = Wr().directions(X, plan).split('\n').find(l => l.startsWith(`Row ${ex} (`)), exBody = lineFull.replace(/^Row \d+ \([^)]*\):\s*/, '');
    const shortBody = exBody.split(', ').slice(0, 4).join(', ') + (exBody.split(', ').length > 4 ? ', ...' : '');
    const rangeTxt = ranges.map(([a, b]) => `${a}-${b}`), joinList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const splitTxt = ranges.length === 1 ? `The whole chart fits on one page (rows 1-${H}).` : `The chart is split over ${ranges.length} pages: rows ${joinList(rangeTxt)}. The first two rows on each page after the first repeat the top of the previous page, below a teal line, so you can find your place. Work each row once.`;
    const colorTxt = twoColor ? `Odd rows (A) use ${nm(Y[0])}; even rows (B) use ${nm(Y[1])}.` : 'Each square is shaded in the yarn color for that row; see the color key on each chart page.';
    const tip = tipRuns.length ? `Tip: check your work against the written row in the instructions, e.g. Row ${ex}: "${shortBody}". Counting from the right of the chart, you will see BS, then ` + tipRuns.map(r => `${r.n} ${r.t === 'd' ? 'X' : 'plain'} square${r.n > 1 ? 's' : ''}`).join(', then ') + '.' : '';
    [`Start at the bottom. Row 0 is the foundation chain (ch ${n} in ${nm(Y[0])}); it is not drawn on the chart. Row 1 is the first charted row.`,
      `Read every row from RIGHT to LEFT, the same direction you crochet. Stitch 1 is at the right edge and stitch ${n} is at the left edge; stitch numbers run across the top and bottom.`,
      `Row numbers are printed on both sides, next to an A or B showing which yarn to use. ${colorTxt}`,
      'Plain square = sc in back loop only, in the color of that row.', 'X square = dc in front loop of the stitch two rows below, worked in front of the previous row.',
      'BS square = border stitch at each end of the row (sc through both loops). Every row starts and ends with BS.', splitTxt, tip].filter(Boolean).forEach(t => para(t));
    y -= 6; sec(`Example: Row ${ex} (${SHOW === n ? 'all' : 'first ' + SHOW} stitches, right edge)`);
    { const ecs = 22, x0 = PW - 54 - SHOW * ecs - 26, yy = y - ecs - 14, f = exY.hex, ik = lum(rgbOf(f)) < 140 ? '#ffffff' : DARK;
      for (let i = 0; i < SHOW; i++) { const xx = x0 + (SHOW - 1 - i) * ecs, k = exStr[i]; fill(f); stroke('#555555'); doc.setLineWidth(.5); rect(xx, yy, ecs, ecs, true, true);
        if (k === 'd') { stroke(ik); doc.setLineWidth(1.6); const p = 4; line(xx + p, yy + p, xx + ecs - p, yy + ecs - p); line(xx + p, yy + ecs - p, xx + ecs - p, yy + p); }
        else if (k === 'B') { ink(ik); font('bold', 8); text('BS', xx + ecs / 2, yy + ecs / 2 - 3, { align: 'center' }); }
        ink(DARK); font('normal', 8); text(String(i + 1), xx + ecs / 2, yy + ecs + 4, { align: 'center' }); }
      ink(DARK); font('bold', 10); text(`${ex} ${ex % 2 ? 'A' : 'B'}`, x0 + SHOW * ecs + 6, yy + 7); ink(TEAL); font('bold', 11); text('<< work this way', 54, yy + 30);
      shown.forEach((r, j) => { const i1 = Math.min(r.i0 + r.n, SHOW) - 1, cut = r.i0 + r.n > SHOW, xa = x0 + (SHOW - 1 - i1) * ecs, xb = x0 + (SHOW - r.i0) * ecs, yb = yy - 6 - (j % 2) * 14;
        stroke(TEAL); doc.setLineWidth(1.2); line(xa + 2, yb, xb - 2, yb); line(xa + 2, yb, xa + 2, yb + 4); line(xb - 2, yb, xb - 2, yb + 4);
        ink(TEAL); font('bold', 8.5); const lab = r.t === 'B' ? 'BS' : desc(r) + (cut ? ' ...' : r.t === 'd' ? ' (X)' : ' (plain)'); text(lab, (xa + xb) / 2, yb - 11, { align: 'center' }); });
      y = yy - 62; }
    para(`Written: Row ${ex} (${nm(exY)}): ${shortBody} The X squares are the dc stitches; the plain squares are the sc stitches.`, 54, 10.5, false);
    y -= 6; sec('Chart key'); Y.forEach(e => swatch(e.hex, yarnLine(e)));
    swatch(Y[0].hex, 'X = dc in front 2 rows down', 'X'); swatch(Y[0].hex, 'BS = border stitch', 'BS');
    y -= 8; sec('Abbreviations (US terms)');
    [['ch', 'chain'], ['sc', 'single crochet (back loop only, see notes)'], ['dc', 'double crochet (front loop, 2 rows below, see notes)'], ['BS', 'border stitch (sc through both loops)'], ['st(s)', 'stitch(es)'], ['RS', 'right side']]
      .forEach(([a, b]) => { ensure(14); font('bold', 10.5 * K); ink(DARK); text(a, 64, y); font('normal', 10.5 * K); text(b, 110, y); y -= 14 * K; }); footer(); });

    // ---------- 4. Written instructions ----------
    const dirs = Wr().directions(X, plan).split('\n').filter(l => /^Row \d+ \(/.test(l)).map(l => { const m = l.match(/^Row (\d+) \(([^)]*)\):\s*(.*)$/), r = +m[1];
      const e = yarnFor(Y, Math.max(1, r)), chg = /change to new color/.test(m[2]); return { r, e, lab: `Row ${r} (${nm(e)}):`, body: (chg ? `Change to ${nm(e)}. ` : '') + m[3] }; });
    const labW = Math.min(230, Math.max(...dirs.map(d => width(d.lab, 'bold', 10))) + 16), bx = 68 + labW;
    newPage(); curHead = 'Written Instructions'; header(curHead); y = PH - 108;
    for (const d of dirs) { const ls = wrap(d.body, 'normal', 10, PW - 54 - bx), need = ls.length * 13 + 5;
      if (y - need < 56) { footer(); newPage(); header(curHead + ' (continued)'); y = PH - 108; }
      fill(d.e.hex); stroke(DARK); doc.setLineWidth(.5); rect(54, y - 2, 9, 9, true, true); ink(DARK); font('bold', 10); text(d.lab, 68, y);
      font('normal', 10); ls.forEach(l => { text(l, bx, y); y -= 13; }); y -= 5; }
    footer();

    // ---------- 5. Chart pages ----------
    ranges.forEach(([r0, r1], pi) => {
      newPage('l'); header(`Chart - Rows ${r0} to ${r1}` + (pi ? ' (continued)' : ''));
      const gw = n * cs, x0 = (LW - gw) / 2, ybot = gridTop - (r1 - r0 + 1) * cs, fs = Math.max(3.2, Math.min(7.5, cs * 0.62));
      ink(GREY); font('normal', 8.5); text(`Part ${pi + 1} of ${ranges.length}. Work bottom up, every row RIGHT to LEFT.` + (pi ? ` Rows ${r0}-${r0 + 1} repeat the top of the previous page (below the teal line).` : ''), 54, LH - 96);
      for (let r = r0; r <= r1; r++) { const yy = ybot + (r - r0) * cs, e = yarnFor(Y, r), ik = lum(rgbOf(e.hex)) < 140 ? '#ffffff' : '#1a1a1a';
        fill(e.hex); stroke('#555555'); doc.setLineWidth(.3);
        for (let k = 0; k < n; k++) rect(x0 + k * cs, yy, cs, cs, true, true);
        for (let k = 0; k < n; k++) { const xx = x0 + k * cs;
          if (k === 0 || k === n - 1) { if (cs >= 6) { ink(ik); font('bold', Math.min(5, cs * 0.42)); text('BS', xx + cs / 2, yy + cs / 2 - cs * 0.15, { align: 'center' }); } else { fill(ik); rect(xx + cs * .35, yy + cs * .35, cs * .3, cs * .3, true); } }
          else if (X[r - 1][k - 1]) { stroke(ik); doc.setLineWidth(Math.max(.5, cs / 11)); const p = cs * 0.2; line(xx + p, yy + p, xx + cs - p, yy + cs - p); line(xx + p, yy + cs - p, xx + cs - p, yy + p); } }
        ink(DARK); font('normal', fs); text(String(r), x0 - 14, yy + cs * .3, { align: 'right' }); text(String(r), x0 + gw + 14, yy + cs * .3);
        font('bold', fs); text(r % 2 ? 'A' : 'B', x0 - 6, yy + cs * .3, { align: 'center' }); text(r % 2 ? 'A' : 'B', x0 + gw + 7, yy + cs * .3, { align: 'center' });
        if (pi && r === r0 + 1) { stroke(TEAL); doc.setLineWidth(1.5); line(x0 - 30, yy + cs, x0 + gw + 30, yy + cs); } }
      const top = ybot + (r1 - r0 + 1) * cs, nf = Math.max(2.8, Math.min(6.5, cs * 0.55)); ink(DARK); font('normal', nf);
      for (let k = 0; k < n; k++) { const s = String(n - k), xx = x0 + k * cs + cs / 2; if (cs < 6 && (n - k) % 5 && n - k !== 1 && n - k !== n) continue; text(s, xx, top + 3, { align: 'center' }); text(s, xx, ybot - nf - 2, { align: 'center' }); }
      const items = Y.map(e => [e.hex, null, yarnLine(e)]).concat([[Y[0].hex, 'X', 'X = dc in front 2 rows down'], [Y[0].hex, 'BS', 'BS = border stitch (both loops)']]);
      let kx = 54, ky = ybot - 30; font('normal', 8);
      items.forEach(([hx, m, t]) => { const tw = width(t, 'normal', 8) + 30; if (kx + tw > LW - 54) { kx = 54; ky -= 16; }
        fill(hx); stroke(DARK); doc.setLineWidth(.4); rect(kx, ky - 3, 10, 10, true, true); const ik = lum(rgbOf(hx)) < 140 ? '#ffffff' : '#1a1a1a';
        if (m === 'X') { stroke(ik); line(kx + 2, ky - 1, kx + 8, ky + 5); line(kx + 2, ky + 5, kx + 8, ky - 1); }
        if (m === 'BS') { ink(ik); font('bold', 4.5); text('BS', kx + 5, ky, { align: 'center' }); }
        ink(DARK); font('normal', 8); text(t, kx + 14, ky); kx += Math.max(160, tw); });
      if (pi < ranges.length - 1) { ink(TEAL); font('bold', 9); text('Continued on next page >>', LW - 54, LH - 96, { align: 'right' }); }
      footer();
    });

    // ---------- 5b. Finishing (project type chosen when publishing) ----------
    const proj = o.project || 'chart';
    if (proj !== 'chart') {
      const Wst = n, R = H + 1, bY = o.border === 'B' ? Y.find(e => e.yarn === 'B') : o.border === 'C' ? null : Y[0];
      const bName = bY ? nm(bY) : 'your border color (a contrast or coordinating yarn)';
      const pn = proj === 'pillow' ? 'Pillow' : proj === 'wall' ? 'Wall Hanging' : 'Blanket';
      const withB = { w: half(Wst * 4 / GAUGE + 2), h: half(R * 4 / GAUGE + 2) }, panel = { w: half(Wst * 4 / GAUGE), h: half(R * 4 / GAUGE) };
      newPage(); curHead = 'Finishing: ' + pn; header(curHead); y = PH - 110;
      para(`All counts below come from this chart: W = ${Wst} stitches across (including the BS at each end) and R = ${R} rows (including the row 0 chain). Sizes are estimated for worsted (#4) yarn and an H (5.0 mm) hook at about ${GAUGE} sts and ${GAUGE} rows = 4".`, 54, 10.5, false);
      const envelope = () => {
        y -= 4; sec('Envelope border');
        para(`An envelope border hides all the yarn tails inside two flaps. Use ${bName} for the border.`, 54, 10.5, false);
        [`Tails: at each row end, knot each pair of tails together and trim to about 1".`,
          `Base round: with RS facing, loosely surface slip stitch around the piece just inside the edge, beside the BS on the sides: about ${Wst} sl st across the top and bottom and ${R} sl st up each side (1 per row end), about ${2 * Wst + 2 * R} sl st in all. Join and fasten off.`,
          'Back flap (WS facing): Rnd 1: hdc in the back loop of each sl st, ch 2 at each corner; join. Rnd 2: hdc in each st, (hdc, ch 2, hdc) in each corner ch-2 space (8 sts added); join and fasten off.',
          'Front flap (RS facing): work the same 2 rounds into the other loop of the same sl sts.',
          'Join: hold the two flaps together with the knotted tails tucked between them, and sc through both flaps all the way around, working 3 sc in each corner. Join and fasten off. Weave in the last ends.']
          .forEach((t, i) => para(`${i + 1}. ${t}`, 64, 10.5, false));
        para(`The border adds about 1" on each side. Finished size: about ${fmtIn(withB.w)}" wide x ${fmtIn(withB.h)}" tall.`, 54, 10.5, false); };
      if (proj === 'blanket') envelope();
      if (proj === 'pillow') {
        y -= 4; sec('Pillow front and back');
        para(`Front: the finished chart panel, about ${fmtIn(panel.w)}" x ${fmtIn(panel.h)}". Knot each pair of tails at the row ends and trim to about 1"; they will be hidden inside the pillow.`, 54, 10.5, false);
        para(`Back: with ${Y[0] ? nm(Y[0]) : 'color A'}, ch ${Wst}. Work rows of sc (or your favorite simple stitch) until the back matches the front's height, about ${R} rows. Fasten off.`, 54, 10.5, false);
        y -= 4; sec('Joining');
        para(`Hold the front and back wrong sides together. With ${bName}, sc through both layers around three sides, working 3 sc in each corner. Insert a pillow form about the size of your panel (a ${Math.ceil(Math.max(panel.w, panel.h))}" form, or stuffing), then sc the last side closed. Join and fasten off.`, 54, 10.5, false);
        para(`Finished pillow: about ${fmtIn(panel.w)}" x ${fmtIn(panel.h)}".`, 54, 10.5, false); }
      if (proj === 'wall') {
        envelope();
        y -= 4; sec('Hanging');
        para(`Rod pocket: with ${bName}, join at the top right corner of the border and work about 6 rows of sc across the top edge. Fold the strip to the back and sew it down, leaving the ends open for a dowel or rod.`, 64, 10.5, true);
        para('Or tabs: work 4-6 evenly spaced tabs (a few sc wide and about 3" long) along the top edge, fold each to the back and sew in place, then slide a rod through.', 64, 10.5, true);
        para(`Finished hanging (without rod): about ${fmtIn(withB.w)}" x ${fmtIn(withB.h)}".`, 54, 10.5, false); }
      footer(); }

    // ---------- 6. Terms ----------
    newPage(); header('Copyright & Terms of Use'); y = PH - 120;
    ['\u00a9 The Yarn Side. For personal use; you may sell finished items, not the pattern.', 'Please do not copy, share, resell, or distribute this pattern or its chart, in whole or in part, in print or digital form.',
      'If you sell finished items, a credit to The Yarn Side is appreciated.', 'Questions? Message The Yarn Side.']
      .forEach(t => { wrap(t, 'normal', 12, PW - 120).forEach(l => { ink(DARK); font('normal', 12); text(l, 60, y); y -= 17; }); y -= 10; });
    STORES.forEach(([nmS, url]) => { ink(DARK); font('bold', 12); text(`Find more patterns on ${nmS}:`, 60, y); y -= 17; ink(TEAL); font('normal', 12); doc.textWithLink(url, 60, T(y), { url }); y -= 27; });
    logo(PW / 2 - 150, y - 130, 300); ink(TEAL); font('bold', 16); text('Thank you & happy hooking!', PW / 2, y - 160, { align: 'center' }); footer();
    return doc;
  }
  const fileName = t => `${clean(t).replace(/[\\/:*?"<>|]+/g, '').trim() || 'Pattern'} - The Yarn Side.pdf`;
  root.MosaicPDF = { STORES, build, yarns, sizeEstimate, chartRanges, fileName };
})(window);
