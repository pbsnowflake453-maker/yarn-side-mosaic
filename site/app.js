/* The Yarn Side mosaic maker.
   Start: read a picture into a grid and choose letters A / B / C / D for its colors (one time).
   Design: one live editor. The design is a grid of letters; the stitches (X's, carried strands), trouble spots,
   chart, written rows and previews are all worked out from it after every change. Nothing is fixed unless asked.
   Combine: the board (combine.js) sends its result straight into the editor. */
(function () {
  'use strict';
  const M = window.Mosaic, Rn = window.MosaicRender, C = window.MosaicColors, W8 = () => window.MosaicWritten, $ = id => document.getElementById(id);
  const st = {
    // Start
    img: null, det: null, samp: null, role: [], letterHex: {}, selSw: -1, showLetters: false, bg: 0, scale: 1, mergeMode: false, mergeFrom: null, impHist: [],
    // Design: P = letters, bottom row first (row 1 = index 0). G = leaning groups, K = keep exactly,
    // mine = squares painted by hand, auto = squares the fixer changed.
    d: null, hist: [], tool: 'B', showX: false, zoom: 1, opts: [],
    plan: C.defaultPlan(), bank: C.loadBank(), selRow: null, stripeFor: 'row', fixNear: true, fixCarry: false, tab: 'chart', view: 'start'
  };
  const replace = (id, cv) => { const old = $(id); cv.id = id; old.replaceWith(cv); return cv; };
  const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const zeros = (H, W) => [...Array(H)].map(() => new Array(W).fill(0));
  const copy2 = A => A.map(r => r.slice());
  const note = (id, html) => { $(id).innerHTML = html; };

  /* ================= Views ================= */
  function setView(v) { st.view = v; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    ['start', 'design', 'combine'].forEach(k => { $(k + 'View').hidden = k !== v; });
    if (v === 'design') render(); if (v === 'combine' && window.MosaicCombine) window.MosaicCombine.init(); window.scrollTo({ top: 0 }); }
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { if (b.dataset.view === 'design' && !st.d) { note('startNote', 'Upload a picture and tap <b>Start designing</b>, or open a piece from Combine.'); setView('start'); return; } setView(b.dataset.view); });

  /* ================= Start: read the picture ================= */
  /* Each picture color gets a letter (role) by hand; nothing merges on screen until you ask to see the letters. */
  function imgData(im) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); }
  async function loadFile(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode();
    st.img = imgData(im); st.det = M.detectGrid(st.img); st.samp = st.det.sample();
    note('detect', `Detected ${st.samp.nx} × ${st.samp.ny} squares (${st.det.mode}), ${st.samp.palette.length} colors. If the count looks wrong, fix it below.`);
    $('nx').value = st.samp.nx; $('ny').value = st.samp.ny; st.letterHex = {}; afterSample();
    note('palNote', st.samp.palette.length > 6 ? `${st.samp.palette.length} colors found. If some look alike, tap Merge look-alikes.` : '');
  }
  function afterSample() {
    const s = st.samp, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    st.bg = s.palette.reduce((b, c, i) => dist(c, st.det.bg) < dist(s.palette[b], st.det.bg) ? i : b, 0);
    st.impHist = []; st.mergeMode = false; st.mergeFrom = null; $('mergePick').classList.remove('on'); st.selSw = -1; st.showLetters = false;
    // two colors can only mean background and contrast; with more, every color waits for you to pick its letter
    st.role = s.palette.map((c, i) => (s.palette.length <= 2 ? (i === st.bg ? 'A' : 'B') : null));
    $('readBox').hidden = false; drawGridCheck(); drawPalette();
  }
  const roleOf = i => st.role[i];
  const setRole = (i, L) => { st.role[i] = L; };
  /* a letter's color: the color you chose for it, else its most-used picture color */
  function picRGB(L) { if (st.letterHex[L]) return C.hexToRgb(st.letterHex[L]);
    const s = st.samp; let best = -1; s.palette.forEach((c, i) => { if (roleOf(i) === L && (best < 0 || s.counts[i] > s.counts[best])) best = i; });
    return best >= 0 ? s.palette[best] : C.hexToRgb(C.defaultPlan()[L][0].hex); }
  function drawGridCheck() { const w = Math.min(600, $('readBox').clientWidth || 600); replace('gridCv', Rn.drawGridCheck(st.img, st.samp.xs, st.samp.ys, w)); }
  function drawPalette() {
    const s = st.samp, box = $('swatches'); box.innerHTML = '';
    s.palette.forEach((c, i) => { const role = roleOf(i), w = document.createElement('div'), d = document.createElement('div'); w.className = 'swWrap' + (st.selSw === i ? ' picked' : '');
      d.className = 'swatch ' + (role || 'none'); d.style.background = `rgb(${c})`; d.title = `${s.counts[i]} squares`; d.innerHTML = `<span class="badge">${role || '?'}</span>`;
      if (st.mergeMode && st.mergeFrom === i) d.classList.add('from');
      d.onclick = () => { if (st.mergeMode) return mergeTap(i); st.selSw = st.selSw === i ? -1 : i; drawPalette(); };
      const rs = document.createElement('div'); rs.className = 'roles';
      for (const L of 'ABCD') { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = L; bt.className = L === role ? 'on' : '';
        bt.setAttribute('aria-label', `Make this color ${L}`); bt.onclick = () => { setRole(i, role === L ? null : L); st.selSw = i; drawPalette(); }; rs.appendChild(bt); }
      const cnt = document.createElement('div'); cnt.className = 'small swn'; cnt.textContent = `${s.counts[i]} sq`;
      w.append(d, rs, cnt); box.appendChild(w); });
    // letter colors, and which picture colors each letter holds
    const lb = $('letters'); lb.innerHTML = '';
    for (const L of 'ABCD') { const held = s.palette.map((c, i) => i).filter(i => roleOf(i) === L); if (!held.length && (L === 'C' || L === 'D')) continue;
      const wrap = document.createElement('label'); wrap.className = 'small letterChip';
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = toHex(picRGB(L)); inp.oninput = () => { st.letterHex[L] = inp.value; drawPalette(); };
      const dots = held.map(i => `<i class="mini" style="background:rgb(${s.palette[i]})"></i>`).join('');
      wrap.append(document.createTextNode(L + ' '), inp); wrap.insertAdjacentHTML('beforeend', ` <span class="held">${held.length ? '= ' + dots : 'no colors yet'}</span>`); lb.appendChild(wrap); }
    const left = s.palette.filter((c, i) => !roleOf(i)).length;
    note('leftNote', left ? `<b>${left} color${left > 1 ? 's' : ''} still need${left > 1 ? '' : 's'} a letter</b> (marked ?). Tap a color to see where it is in the picture.` : '<b class="ok">✔ Every color has a letter.</b>');
    $('restA').hidden = !left; $('startDesign').disabled = !!left; $('savePic').disabled = !!left;
    $('showLetters').textContent = st.showLetters ? 'Back to picture' : 'Show letters';
    drawPreview(); $('impUndo').disabled = !st.impHist.length;
  }
  /* the picture in its own colors (tapped color highlighted), or in letters when Show letters is on */
  function drawPreview() { const s = st.samp, cell = Math.max(4, Math.min(16, Math.floor(420 / Math.max(s.nx, s.ny))));
    let cv;
    if (st.showLetters) { const G = s.idx.map(r => r.map(v => (roleOf(v) ? 'ABCD'.indexOf(roleOf(v)) : 4)));
      cv = Rn.drawTopDown(G, ['A', 'B', 'C', 'D'].map(picRGB).concat([[205, 200, 194]]), cell, true); }
    else { cv = Rn.drawTopDown(s.idx, s.palette, cell, true);
      if (st.selSw >= 0) { const g = cv.getContext('2d');
        s.idx.forEach((r, y) => r.forEach((v, x) => { if (v === st.selSw) return; g.fillStyle = 'rgba(255,255,255,.72)'; g.fillRect(x * cell, y * cell, cell, cell); }));
        g.strokeStyle = '#125765'; g.lineWidth = Math.max(1.5, cell / 7);
        s.idx.forEach((r, y) => r.forEach((v, x) => { if (v === st.selSw) g.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); })); } }
    replace('monoCv', cv); }
  $('showLetters').onclick = () => { st.showLetters = !st.showLetters; drawPalette(); };
  $('restA').onclick = () => { st.samp.palette.forEach((c, i) => { if (!roleOf(i)) setRole(i, 'A'); }); drawPalette(); };
  $('file').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  $('resample').onclick = () => { st.samp = st.det.sample(+$('nx').value, +$('ny').value); afterSample(); };
  $('autoBtn').onclick = () => { const m = M.autoSplit(st.samp.idx, st.samp.palette, st.bg); st.role = m.map(v => (v ? 'B' : 'A')); drawPalette(); note('palNote', 'Auto A/B filled in every letter. Look it over and change any you want.'); };
  $('thrBtn').onclick = () => { const m = M.thresholdMap(st.samp.palette); m[st.bg] = 0; st.role = m.map(v => (v ? 'B' : 'A')); drawPalette(); note('palNote', 'Letters filled in by brightness. Look it over and change any you want.'); };
  /* up to four colors: A = background, then B, C, D by how many squares use them; other colors join the closest of the four */
  $('auto4Btn').onclick = () => { const s = st.samp, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const order = s.palette.map((c, i) => i).filter(i => i !== st.bg).sort((a, b) => s.counts[b] - s.counts[a]);
    const lead = [st.bg].concat(order.filter(i => s.counts[i] > 0).slice(0, 3)), roles = ['A', 'B', 'C', 'D'];
    s.palette.forEach((c, i) => { let k = lead.indexOf(i); if (k < 0) k = lead.reduce((b, j, q) => (d(c, s.palette[j]) < d(c, s.palette[lead[b]]) ? q : b), 0); setRole(i, roles[k]); });
    drawPalette(); note('palNote', lead.length < 3 ? 'Only two colors here, so there is nothing for C or D.' : `Split into ${lead.length} letters. Look it over and change any you want.`); };
  // merging colors
  const impSnap = () => ({ idx: copy2(st.samp.idx), palette: copy2(st.samp.palette), counts: st.samp.counts.slice(), role: st.role.slice(), bg: st.bg });
  function recount() { const s = st.samp; s.counts = s.palette.map(() => 0); s.idx.forEach(r => r.forEach(v => s.counts[v]++)); }
  function remapMerge(keepI, dropI) { const s = st.samp, fix = v => { v = v === dropI ? keepI : v; return v > dropI ? v - 1 : v; };
    s.idx = s.idx.map(r => r.map(fix)); s.palette.splice(dropI, 1); st.role.splice(dropI, 1); st.bg = fix(st.bg); st.selSw = -1; recount(); }
  function mergeTap(i) {
    if (st.mergeFrom == null) { st.mergeFrom = i; note('palNote', 'Now tap the color to merge into it.'); drawPalette(); return; }
    if (i === st.mergeFrom) { st.mergeFrom = null; note('palNote', 'Tap the color to keep, then the color to merge into it.'); drawPalette(); return; }
    st.impHist.push(impSnap()); const n = st.samp.counts[i]; remapMerge(st.mergeFrom, i);
    st.mergeFrom = null; st.mergeMode = false; $('mergePick').classList.remove('on');   // one merge per tap of the button
    drawPalette(); note('palNote', `Merged ${n} square${n === 1 ? '' : 's'}. Undo puts them back.`); }
  $('mergePick').onclick = () => { st.mergeMode = !st.mergeMode; st.mergeFrom = null; $('mergePick').classList.toggle('on', st.mergeMode);
    note('palNote', st.mergeMode ? 'Tap the color to keep, then the color to merge into it.' : ''); drawPalette(); };
  $('mergeAuto').onclick = () => { const s = st.samp, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), before = s.palette.length; let snapped = false;
    while (s.palette.length > 2) { let best = null;
      for (let i = 0; i < s.palette.length; i++) for (let j = i + 1; j < s.palette.length; j++) { const q = d(s.palette[i], s.palette[j]); if (q < 70 && (!best || q < best.q)) best = { i, j, q }; }
      if (!best) break; if (!snapped) { st.impHist.push(impSnap()); snapped = true; }
      const [keepI, dropI] = s.counts[best.i] >= s.counts[best.j] ? [best.i, best.j] : [best.j, best.i];
      if (!st.role[keepI]) st.role[keepI] = st.role[dropI]; remapMerge(keepI, dropI); }
    if (!snapped) { note('palNote', 'No look-alike colors found. Use Merge two colors to merge any pair.'); return; }
    drawPalette(); note('palNote', `Merged look-alike colors: ${before} → ${s.palette.length} colors. Undo puts them back.`); };
  $('impUndo').onclick = () => { const h = st.impHist.pop(); if (!h) return; Object.assign(st.samp, { idx: h.idx, palette: h.palette, counts: h.counts }); st.role = h.role; st.bg = h.bg; st.selSw = -1; drawPalette(); note('palNote', 'Undone.'); };
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st.scale = +b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
  const startPlan = () => { const p = C.defaultPlan(); for (const L of 'ABCD') p[L][0].hex = toHex(picRGB(L)); return p; };
  $('startDesign').onclick = () => { if (!st.samp || st.role.some(r => !r)) return;
    if (st.d && st.hist.length && !confirm('Start a new design from this picture? Your current design will be replaced (save it as a piece in Combine first if you want to keep it).')) return;
    const s = st.scale, rows = [];
    st.samp.idx.forEach(r => { const line = []; r.forEach(v => { for (let k = 0; k < s; k++) line.push(roleOf(v)); }); for (let k = 0; k < s; k++) rows.push(line.slice()); });
    openDesign(rows, startPlan(), null, 'Started from your picture. Nothing has been changed: red squares are spots that can\'t be crocheted as drawn. Tap <b>Fix</b> when you want them worked out.'); };
  $('savePic').onclick = () => { if (!st.samp || st.role.some(r => !r)) return; window.MosaicCombine.save({ kind: 'picture', rows: st.samp.idx.map(r => r.map(v => roleOf(v)).join('')), plan: startPlan() }); flash('savePic'); };

  /* ================= Design ================= */
  /* rows: letter strings or arrays, top row first. groups: [[rowFromTop, col, bits]] */
  function openDesign(rows, colors, groups, msg) {
    const H = rows.length, W = rows[0].length, P = []; for (let i = H - 1; i >= 0; i--) P.push([...rows[i]]);
    const G = zeros(H, W); (groups || []).forEach(([t, c, b]) => { const i = H - 1 - t; if (i >= 0 && i < H && c >= 0 && c < W) G[i][c] = b; });
    st.d = { P, G, K: zeros(H, W), mine: zeros(H, W), auto: zeros(H, W), linked: {} }; st.hist = []; st.opts = []; $('optsBox').hidden = true; st.selRow = null;
    st.plan = toPlan(colors);
    const lost = cleanAll(); setView('design'); note('dNote', msg + (lost ? ` ${lost} leaning group${lost > 1 ? 's' : ''} didn't fit and came out.` : '')); $('dNote').dataset.keep = 1; render();
  }
  /* a stored color set: a plan, or one hex per letter (older pieces) */
  function toPlan(c) { if (c && Array.isArray(c.A)) return C.fullPlan(JSON.parse(JSON.stringify(c)));
    const p = C.defaultPlan(); if (c) for (const L of 'ABCD') if (c[L]) p[L][0].hex = c[L]; return p; }
  /* a strand Fix made to stand in for A or B keeps that yarn's colors, stripes included */
  function syncLinked() { const ln = (st.d && st.d.linked) || {};
    for (const L in ln) st.plan[L] = st.plan[ln[L]].map((e, i) => ({ row: i === 0 ? 1 : Math.max(1, e.row - 1), hex: e.hex })); }
  const strandRGB = (k, r) => C.hexToRgb(C.colorOf(st.plan, 'CD'[k - 1], r));
  /* everything worked out from the letters */
  function derive() { const d = st.d, H = d.P.length, W = d.P[0].length, F = zeros(H, W), Y = zeros(H, W);
    d.P.forEach((row, i) => row.forEach((L, c) => { if (L === 'B') F[i][c] = 1; else if (L === 'A') F[i][c] = 0; else { F[i][c] = M.color(i + 1); Y[i][c] = L === 'C' ? 1 : 2; } }));
    const X = M.check(F).X, pc = M.problemCells(F), bad = pc.bad; let n = pc.n, spots = pc.spots;
    // a C / D square is an sc in that strand: it can't also be the dc that a square below it needs
    for (let i = 1; i < H; i++) for (let c = 0; c < W; c++) if (Y[i][c] && X[i][c]) { spots++; for (const q of [i, i - 1]) if (!bad[q][c]) { bad[q][c] = 1; n++; } }
    const vis = (i, c) => { const s = i + 1 < H && X[i + 1][c] ? i + 1 : i; return Y[s][c] ? strandRGB(Y[s][c], s + 1) : rowRGB(s + 1); };
    // your rule: one carried strand per row. Rows with both C and D are flagged (they can still be crocheted)
    const two = []; Y.forEach((row, i) => { if (row.includes(1) && row.includes(2)) two.push(i); });
    return { H, W, F, Y, X, bad, n, spots, vis, two };
  }
  const rowRGB = r => C.hexToRgb(C.hexAt(st.plan, r));
  const extras = () => ({ at: (k, r) => ({ label: C.labelAt(st.plan, 'CD'[k - 1], r), hex: C.colorOf(st.plan, 'CD'[k - 1], r) }),
    list: [1, 2].flatMap(k => st.plan['CD'[k - 1]].map((e, i, a) => ({ k, label: a.length > 1 ? 'CD'[k - 1] + (i + 1) : 'CD'[k - 1], hex: e.hex, row: e.row }))) });
  const any = A => A.some(r => r.some(v => v));
  /* leaning groups must still be possible: straight stitch a dc, neighbors free, nobody in C / D */
  function cleanAll() { const d = st.d; if (!any(d.G)) return 0; const D = derive(); let lost = M.cleanGroups(D.X, d.G);
    d.G.forEach((row, i) => row.forEach((v, b) => { if (v && M.groupCols(d.G, i, b).some(c => D.Y[i][c])) { d.G[i][b] = 0; lost++; } })); return lost; }
  const snap = () => { const d = st.d; return { P: copy2(d.P), G: copy2(d.G), K: copy2(d.K), mine: copy2(d.mine), auto: copy2(d.auto) }; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function push() { st.hist.push(snap()); if (st.hist.length > 200) st.hist.shift(); }
  function changed(msg) { const lost = cleanAll(); if (lost) msg = (msg ? msg + ' ' : '') + `${lost} leaning group${lost > 1 ? 's' : ''} came out because the stitches under ${lost > 1 ? 'them' : 'it'} changed. Undo brings ${lost > 1 ? 'them' : 'it'} back.`;
    if (msg) { note('dNote', msg); $('dNote').dataset.keep = 1; } render(); }

  /* ---------- the editor canvas ---------- */
  function render() { if (!st.d) return; syncLinked(); const d = st.d, D = derive();
    const cell = Math.max(6, Math.min(24, Math.floor(Math.min(620, ($('dWrap').clientWidth || 620) - 4) / Math.max(D.W, 1))));
    const show = D.two.length ? D.bad.map((r, i) => r.map((v, c) => (v || (D.two.includes(i) && D.Y[i][c]) ? 1 : 0))) : D.bad;
    const cv = Rn.drawEdit(D.F, { cell, cellRGB: D.vis, bad: show, mine: d.K, auto: d.auto, groups: d.G });
    if (st.showX) { const g = cv.getContext('2d'), k = cell, p = Math.max(2, k * 0.25); g.lineWidth = Math.max(1, k / 10);
      D.X.forEach((row, i) => row.forEach((v, c) => { if (!v || d.G[i][c]) return; const x = c * k, y = (D.H - 1 - i) * k, rgb = D.vis(i, c);
        g.strokeStyle = (rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11) < 140 ? '#fff' : '#1a1a1a'; g.beginPath(); g.moveTo(x + p, y + p); g.lineTo(x + k - p, y + k - p); g.moveTo(x + k - p, y + p); g.lineTo(x + p, y + k - p); g.stroke(); })); }
    replace('dCv', cv); cv.classList.toggle('zoomed', st.zoom > 1); cv.style.width = st.zoom > 1 ? Math.round(cv.width * st.zoom) + 'px' : '';
    bindPaint(cv, D);
    $('dUndo').disabled = !st.hist.length; $('dFix').disabled = !D.n;
    $('dSize').textContent = `${D.W} × ${D.H} squares · chart ${D.W + 2} sts (with border stitches) × ${D.H} rows + chain`;
    if (!$('dNote').dataset.keep) note('dNote', (D.n
      ? `<b class="warn">✘ ${D.spots} trouble spot${D.spots > 1 ? 's' : ''}</b> (red): squares that can't be crocheted as drawn. Paint around them, or tap <b>Fix</b> to change the fewest squares. Your painted squares and Keep squares stay if at all possible.`
        + (D.bad[D.H - 1].some(v => v) && D.H % 2 === 0 ? ' <br>The top row is a B row (even number of rows), and the top row can only show its own color. Adding or removing one row at the top usually clears this.' : '')
      : '<b class="ok">✔ Workable.</b> Every square can be crocheted as shown.')
      );
    else $('dNote').querySelectorAll('.flag').forEach(e => e.remove());
    // your rule: one carried strand per row (shown even after another message)
    if (D.two.length) $('dNote').insertAdjacentHTML('beforeend', `<span class="flag"><br><b class="warn">⚑ Row${D.two.length > 1 ? 's' : ''} ${D.two.map(i => i + 1).join(', ')} carr${D.two.length > 1 ? 'y' : 'ies'} both C and D</b> (outlined). That's more than one carried strand in a row. Change some squares to one strand, or leave it if you meant to.</span>`);
    delete $('dNote').dataset.keep;
    ['A', 'B', 'C', 'D'].forEach(L => { const hx = st.plan[L][0].hex; $('col' + L).value = hx; document.querySelectorAll(`[data-tool="${L}"] .dot`).forEach(e => { e.style.background = hx; }); });
    renderOut(D);
  }
  /* tap / drag on the editor */
  function bindPaint(cv, D) { const d = st.d, H = D.H, k = cv.width / D.W; let down = false, last = '', before = null;
    const at = e => { const b = cv.getBoundingClientRect(); return [Math.floor((e.clientY - b.top) * cv.height / b.height / k), Math.floor((e.clientX - b.left) * cv.width / b.width / k)]; };
    const fill = (r, c, rgb) => { const g = cv.getContext('2d'); g.fillStyle = `rgb(${rgb})`; g.fillRect(c * k + 1, r * k + 1, k - 1, k - 1); };
    const hit = (e, first) => { const [r, c] = at(e), key = r + ',' + c; if (key === last || r < 0 || c < 0 || r >= H || c >= D.W) return; last = key; const i = H - 1 - r, t = st.tool;
      if ('ABCD'.includes(t)) { if (d.P[i][c] === t) return; d.P[i][c] = t; d.mine[i][c] = 1; d.auto[i][c] = 0;
        fill(r, c, t === 'C' || t === 'D' ? strandRGB(t === 'C' ? 1 : 2, i + 1) : C.hexToRgb(C.colorOf(st.plan, t, i + 1))); }
      else if (t === 'keep' || t === 'unkeep') { const v = t === 'keep' ? 1 : 0; if (d.K[i][c] === v) return; d.K[i][c] = v; }
      else if (first && t[0] === 'g') groupTap(D, i, c, +t[1]); };
    cv.onpointerdown = e => { e.preventDefault(); down = true; last = ''; cv.setPointerCapture(e.pointerId); before = snap(); hit(e, true); };
    cv.onpointermove = e => { if (down) hit(e, false); };
    cv.onpointerup = cv.onpointercancel = () => { if (!down) return; down = false; if (st.tool[0] === 'g') return;
      if (!same(before, snap())) { st.hist.push(before); changed(); } else render(); }; }

  /* leaning groups: tap the straight dc (its square or the square it covers) */
  function groupOf(i, c) { const G = st.d.G, W = G[0].length;
    for (let b = Math.max(0, c - 1); b <= Math.min(W - 1, c + 1); b++) if (G[i][b] && M.groupCols(G, i, b).includes(c)) return { i, b }; return null; }
  const WHY = { center: "That square isn't part of a dc. Turn on Show X's and tap an X (or the square right under it).",
    edge: s => `There's no stitch to its ${s} (edge of the design).`, dc: s => `The stitch to its ${s} is a dc going straight down, so it can't lean.`,
    above: s => `The stitch to its ${s} has a dc right above it, which would land on the leaning stitch.`, taken: s => `The stitch to its ${s} already leans into another group.`,
    strand: 'Leaning stitches are worked in the row\'s own yarn, so none of them can be a C / D square.' };
  function groupTap(D, i, c, bits) { const d = st.d, H = D.H, warn = t => { note('dNote', t); $('dNote').dataset.keep = 1; render(); };
    if (!bits) { const gp = groupOf(i, c) || (i + 1 < H && groupOf(i + 1, c)); if (!gp) return warn('No leaning group there.');
      push(); d.G[gp.i][gp.b] = 0; return changed(`Took out the leaning group on row ${gp.i + 1}.`); }
    const ci = D.X[i][c] ? i : i + 1 < H && D.X[i + 1][c] ? i + 1 : -1; if (ci < 0) return warn(WHY.center);
    const old = d.G[ci][c]; d.G[ci][c] = 0; const why = M.groupProblem(D.X, d.G, ci, c, bits); d.G[ci][c] = old;
    if (why) { const [k, side] = why.split(':'); return warn(`<b class="warn">Can't lean there.</b> ` + (side ? WHY[k](side) : WHY[k])); }
    const cols = [c].concat(bits & 1 ? [c - 1] : [], bits & 2 ? [c + 1] : []); if (cols.some(q => D.Y[ci][q])) return warn(`<b class="warn">Can't lean there.</b> ${WHY.strand}`);
    push(); d.G[ci][c] = bits;
    changed(`<b class="ok">✔ Added</b> ${{ 1: '\\|', 2: '|/', 3: '\\|/' }[bits]} on row ${ci + 1}: the written row says “${{ 1: '2 dc in next st then sk 1', 2: 'sk 1 then 2 dc in next st', 3: 'sk 1 then 3 dc in next st then sk 1' }[bits]}”.`); }

  /* tools */
  const HELP = { A: 'Tap or drag to paint A (background).', B: 'Tap or drag to paint B (contrast).', C: 'Tap or drag to paint C, a strand carried along the row and worked as an sc where it shows.', D: 'Tap or drag to paint D, a second carried strand.',
    keep: 'Tap or drag over squares that must stay exactly as they are when you tap Fix (teal dots).', unkeep: 'Tap or drag over teal dots to remove them.',
    g1: 'Tap a dc (an X, or the square right under it). The stitch to its left leans into the same stitch two rows down: \\|.', g2: 'Tap a dc. The stitch to its right leans in: |/.', g3: 'Tap a dc. The stitches on both sides lean in: \\|/.', g0: 'Tap a leaning group to take it out.' };
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { st.tool = b.dataset.tool; document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
    if (st.tool[0] === 'g' && st.tool !== 'g0' && !st.showX) { st.showX = true; $('showX').checked = true; }
    note('dNote', HELP[st.tool]); $('dNote').dataset.keep = 1; render(); });
  $('showX').onchange = () => { st.showX = $('showX').checked; render(); };
  $('dUndo').onclick = () => { const h = st.hist.pop(); if (!h) return; Object.assign(st.d, h); note('dNote', 'Undone.'); $('dNote').dataset.keep = 1; render(); };
  $('dIn').onclick = () => { st.zoom = Math.min(4, st.zoom * 1.5); render(); }; $('dOut').onclick = () => { st.zoom = Math.max(1, st.zoom / 1.5); render(); };
  /* Fix: fewest changes. Besides switching A and B it can (b) turn a square into a C / D color it touches, and,
     when Carry is on, (a) keep a square's look by working it in a carried strand of that color. One strand per row. */
  $('dFix').onclick = () => { const d = st.d, D = derive(), H = D.H, W = D.W, lock = d.mine.map((r, i) => r.map((v, c) => (v || d.K[i][c] ? 1 : 0)));
    const used = [1, 2].filter(k => D.Y.some(r => r.includes(k))), free = [1, 2].filter(k => !used.includes(k));
    // carrying: a B-colored strand on A rows and an A-colored strand on B rows, using letters the design doesn't use yet
    const carryOn = { 0: st.fixCarry ? free[0] : 0, 1: st.fixCarry ? free[1] : 0 };   // keyed by the row's own color
    const choices = (i, c) => { const out = [];
      if (st.fixNear) for (const [a, b] of [[i + 1, c], [i - 1, c], [i, c + 1], [i, c - 1]]) if (a >= 0 && a < H && b >= 0 && b < W && D.Y[a][b] && !out.some(o => o.k === D.Y[a][b])) out.push({ k: D.Y[a][b], cost: 2 });
      const own = M.color(i + 1), k = carryOn[own]; if (k && D.F[i][c] !== own) out.push({ k, cost: 1.5 });
      return out; };
    const res = M.fixColors(D.F, D.Y, { lock, choices }); if (!res) return note('dNote', 'No workable fix found. Try painting around the red squares.');
    push(); let carried = new Set();
    res.F.forEach((row, i) => row.forEach((v, c) => { const y = res.Y[i][c]; if (v === D.F[i][c] && y === D.Y[i][c]) return;
      d.P[i][c] = y ? 'CD'[y - 1] : v ? 'B' : 'A'; d.auto[i][c] = 1; d.mine[i][c] = 0; if (y && (y === carryOn[0] || y === carryOn[1]) && !used.includes(y)) carried.add(y); }));
    // a carried strand made by Fix takes the color of the yarn it stands in for: B's color on A rows, A's on B rows
    carried.forEach(k => { st.d.linked['CD'[k - 1]] = k === carryOn[0] ? 'B' : 'A'; }); syncLinked();
    const msg = `<b class="ok">✔ Fixed.</b> Changed ${res.changed} square${res.changed === 1 ? '' : 's'} (outlined orange)` + (res.strands ? `, ${res.strands} of them now in a carried strand` : '')
      + (res.lockedChanged ? `, including ${res.lockedChanged} you painted or kept, because they couldn't be worked as drawn.` : '; everything you painted or kept stayed.')
      + (carried.size ? ` Carried strand${carried.size > 1 ? 's' : ''} ${[...carried].map(k => 'CD'[k - 1]).join(' and ')} use${carried.size > 1 ? '' : 's'} the same yarn as ${[...carried].map(k => (k === carryOn[0] ? 'B (on A rows)' : 'A (on B rows)')).join(' and ')}.` : '')
      + (st.fixCarry && !free.length ? ' Carrying was on, but C and D are both used in this design, so there was no free strand to carry.' : '') + ' Undo puts it back.';
    changed(msg); };
  $('fixNear').onchange = () => { st.fixNear = $('fixNear').checked; }; $('fixCarry').onchange = () => { st.fixCarry = $('fixCarry').checked; };
  /* fix options that also try stretching rows (taller design, fewer changed squares) */
  $('dOpts').onclick = () => { const d = st.d, D = derive(), top = r => r.slice().reverse();
    const motif = top(D.F.map((row, i) => row.map((v, c) => (D.Y[i][c] ? 0 : v)))), extra = any(D.Y) ? top(D.Y) : null, lock = any(d.K) ? top(d.K) : null;
    note('optsNote', 'Working…'); $('optsBox').hidden = false;
    setTimeout(() => { st.opts = M.findFixes(motif, { stretch: true, keep: 3, lock, extra, exact: true }); const box = $('opts'); box.innerHTML = '';
      if (!st.opts.length) { note('optsNote', 'No options found.'); return; } note('optsNote', 'Each option is fixed and workable. Using one replaces the design (Undo brings it back). Options that change the size lose their leaning stitches.');
      st.opts.forEach((r, k) => { const card = document.createElement('div'); card.className = 'cand'; const cell = Math.max(2, Math.min(7, Math.floor(130 / r.width)));
        const X = M.check(r.F).X, lk = (i, c) => { const s2 = i + 1 < r.F.length && X[i + 1][c] ? i + 1 : i; return r.E && r.E[s2][c] ? strandRGB(r.E[s2][c], s2 + 1) : rowRGB(s2 + 1); };
        const p = document.createElement('p'); p.className = 'small'; const ink = r.T.flat().reduce((a, b) => a + b, 0) || 1;
        p.innerHTML = `<b>Option ${k + 1}</b> · ${r.width} × ${r.rows} squares · ${r.stretched ? 'rows stretched' : 'same rows'} · ${r.added + r.removed} square${r.added + r.removed === 1 ? '' : 's'} changed (${Math.round(100 * (r.added + r.removed) / ink)}%)`;
        const use = document.createElement('button'); use.textContent = 'Use this'; use.onclick = () => useOption(r);
        card.append(Rn.drawGrid(r.F, { cell, cellRGB: lk }), p, use); box.appendChild(card); }); }, 20); };
  $('optsClose').onclick = () => { $('optsBox').hidden = true; };
  function useOption(r) { const d = st.d, H = r.F.length, W = r.F[0].length, sameSize = H === d.P.length && W === d.P[0].length; push();
    d.P = r.F.map((row, i) => row.map((v, c) => (r.E && r.E[i][c] ? 'CD'[r.E[i][c] - 1] : v ? 'B' : 'A')));
    if (!sameSize) { d.G = zeros(H, W); d.K = zeros(H, W); d.mine = zeros(H, W); d.auto = zeros(H, W); }
    else d.auto = d.P.map((row, i) => row.map((L, c) => (L !== st.hist[st.hist.length - 1].P[i][c] ? 1 : 0)));
    $('optsBox').hidden = true; changed(`<b class="ok">✔ Using option.</b> ${sameSize ? '' : `The design is now ${W} × ${H}. `}Undo goes back.`); }

  /* ---------- rows and columns (bottom rows only in pairs, so row 1 stays an A row and nothing shifts) ---------- */
  const LAYERS = ['P', 'G', 'K', 'mine', 'auto'], blank = k => (k === 'P' ? 'A' : 0);
  const emptyRow = row => row.every(L => L === 'A');
  function margins() { const P = st.d.P, H = P.length, W = P[0].length, m = { top: 0, bottom: 0, left: 0, right: 0 }, col = c => P.map(r => r[c]);
    while (m.bottom < H && emptyRow(P[m.bottom])) m.bottom++; while (m.top < H - m.bottom && emptyRow(P[H - 1 - m.top])) m.top++;
    while (m.left < W && emptyRow(col(m.left))) m.left++; while (m.right < W - m.left && emptyRow(col(W - 1 - m.right))) m.right++; return m; }
  function rows(side, n) { const d = st.d; let lost = 0;
    for (let k = 0; k < Math.abs(n); k++) LAYERS.forEach(L => { const A = d[L], W = A[0].length;
      if (n > 0) { const r = new Array(W).fill(blank(L)); side === 'top' ? A.push(r) : A.unshift(r); }
      else { const r = side === 'top' ? A.pop() : A.shift(); if (L === 'P') lost += r.filter(x => x !== 'A').length; } });
    return lost; }
  function cols(side, n) { const d = st.d; let lost = 0;
    for (let k = 0; k < Math.abs(n); k++) LAYERS.forEach(L => d[L].forEach(r => { if (n > 0) side === 'left' ? r.unshift(blank(L)) : r.push(blank(L)); else { const x = side === 'left' ? r.shift() : r.pop(); if (L === 'P' && x !== 'A') lost++; } }));
    return lost; }
  function resize(fn, msg) { const d = st.d; push(); const lost = fn(); if (d.P.length < 2 || d.P[0].length < 2) { Object.assign(d, st.hist.pop()); return; }
    changed(msg + (lost ? ` That took away ${lost} colored square${lost > 1 ? 's' : ''}; Undo brings ${lost > 1 ? 'them' : 'it'} back.` : '')); }
  document.querySelectorAll('[data-rows]').forEach(b => b.onclick = () => { const [side, n] = b.dataset.rows.split(','); resize(() => rows(side, +n), `${+n > 0 ? 'Added' : 'Removed'} ${Math.abs(+n) === 2 ? '2 rows' : 'a row'} at the ${side}.`); });
  document.querySelectorAll('[data-cols]').forEach(b => b.onclick = () => { const [side, n] = b.dataset.cols.split(','); resize(() => cols(side, +n), `${+n > 0 ? 'Added' : 'Removed'} a column on the ${side}.`); });
  $('dCenter').onclick = () => { const m = margins(), H = st.d.P.length; if (m.bottom === H) return note('dNote', 'The design is empty.');
    let nb = Math.floor((m.top + m.bottom) / 2); if ((nb - m.bottom) % 2) nb += nb - m.bottom > 0 ? -1 : 1;   // bottom moves in pairs
    const dy = nb - m.bottom, nl = Math.floor((m.left + m.right) / 2), dx = nl - m.left;
    if (!dy && !dx) return note('dNote', `Already centered as closely as pairs of bottom rows allow (${m.top} empty above, ${m.bottom} below, ${m.left} left, ${m.right} right).`);
    resize(() => { if (dy > 0) { rows('bottom', dy); rows('top', -dy); } else if (dy < 0) { rows('bottom', dy); rows('top', -dy); }
      if (dx > 0) { cols('left', dx); cols('right', -dx); } else if (dx < 0) { cols('left', dx); cols('right', -dx); } return 0; },
    (() => { const a = m.top - dy, b = m.bottom + dy, l = m.left + dx, r = m.right - dx; return `Centered: ${a} empty row${a === 1 ? '' : 's'} above, ${b} below, ${l} empty column${l === 1 ? '' : 's'} left, ${r} right.`; })()); };
  $('dTrim').onclick = () => { const m = margins(), H = st.d.P.length; if (m.bottom === H) return;
    const b = m.bottom - (m.bottom % 2); if (!m.top && !b && !m.left && !m.right) return note('dNote', 'No empty edges to trim' + (m.bottom ? ' (the bottom keeps 1 row, since bottom rows come off in pairs).' : '.'));
    resize(() => { rows('top', -m.top); rows('bottom', -b); cols('left', -m.left); cols('right', -m.right); return 0; }, 'Trimmed the empty edges' + (m.bottom % 2 ? ' (kept 1 empty row at the bottom, since bottom rows come off in pairs).' : '.')); };
  $('dMirror').onclick = () => { const d = st.d; push(); ['P', 'K', 'mine', 'auto'].forEach(L => d[L].forEach(r => r.reverse()));
    d.G = d.G.map(r => r.slice().reverse().map(v => ((v & 1) << 1) | ((v & 2) >> 1))); changed('Mirrored left to right.'); };

  /* ---------- yarn colors ---------- */
  ['A', 'B'].forEach(L => { $('col' + L).oninput = () => { st.plan[L][0].hex = $('col' + L).value; render(); }; });
  ['C', 'D'].forEach(L => { $('col' + L).oninput = () => { delete st.d.linked[L]; st.plan[L][0].hex = $('col' + L).value; render(); }; });

  /* ================= Live outputs ================= */
  const hasY = D => any(D.Y), hasG = () => any(st.d.G);
  const stitchRGB = D => (hasY(D) ? (i, c) => (D.Y[i][c] ? strandRGB(D.Y[i][c], i + 1) : null) : null);
  const carryTag = D => (hasY(D) ? row => [...new Set(D.Y[row - 1].filter(v => v))].sort().map(k => '+' + 'CD'[k - 1]).join('') : null);
  const extraLegend = D => (hasY(D) ? extras().list.filter(e => D.Y.some(x => x.includes(e.k))).map(e => ({ hex: e.hex, rgb: C.hexToRgb(e.hex), text: `${e.hex.toUpperCase()}  ·  ${e.label} (carried strand${e.row > 1 ? `, from row ${e.row}` : ''})` })) : []);
  const dirOpts = D => Object.assign(hasY(D) ? { Y: D.Y, extras: extras() } : {}, hasG() ? { G: st.d.G } : {});
  const leanFn = () => (hasG() ? (i, c) => M.leanAt(st.d.G, i, c) : null);
  const chartOpts = (D, extra) => Object.assign({ cell: D.W > 60 ? 18 : 24, rowRGB, stitchRGB: stitchRGB(D), carry: carryTag(D), groups: hasG() ? st.d.G : null }, extra);
  function renderOut(D) {
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === st.tab)); ['chart', 'written', 'preview', 'fabric'].forEach(t => { $(t + 'Tab').hidden = t !== st.tab; });
    $('summary').textContent = `${D.W + 2} stitches (with border stitches) × ${D.H} rows + chain · ${D.X.flat().reduce((a, b) => a + b, 0)} dc's` + (hasG() ? ` · ${st.d.G.flat().filter(v => v).length} leaning group(s)` : '') + (D.n ? ' · not workable yet (red squares)' : '');
    if (st.tab === 'chart') { const cv = replace('chartCv', Rn.drawChart(D.F, D.X, chartOpts(D, { selRow: st.selRow })));
      cv.onclick = e => { const g = cv._geo, sc = cv.height / cv.clientHeight, y = e.offsetY * sc, k = Math.floor((y - g.top) / g.cell), row = g.H - k;
        if (row < 1 || row > g.H) return; st.selRow = row; note('colorNote', `Row ${row} selected (${C.yarnOf(row)} yarn, now ${C.hexAt(st.plan, row)}). Tap a color.`); render(); };
      drawBank(); }
    if (st.tab === 'written') $('written').textContent = W8().directions(D.X, st.plan, dirOpts(D));
    if (st.tab === 'preview') replace('prevCv', Rn.drawPreview(D.X, { rowRGB, stitchRGB: stitchRGB(D), lean: leanFn() }));
    if (st.tab === 'fabric') replace('fabCv', Rn.drawGrid(M.simulate(D.X), { cell: Math.max(4, Math.min(16, Math.floor(520 / D.W))), cellRGB: D.vis }));
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; render(); });
  function pick(hex) { if (st.selRow == null) return note('colorNote', 'Tap a row in the color strip at the left of the chart first.');
    const L = st.stripeFor === 'row' ? C.yarnOf(st.selRow) : st.stripeFor, res = C.addChange(st.plan, derive().X, st.selRow, hex, L); st.plan = res.plan; render();
    note('colorNote', res.note || `From row ${st.selRow} up, ${L === 'C' || L === 'D' ? 'carried strand ' + L : 'the ' + L + ' yarn'} is ${hex}.`); }
  document.querySelectorAll('[data-stripe]').forEach(b => b.onclick = () => { st.stripeFor = b.dataset.stripe; document.querySelectorAll('[data-stripe]').forEach(x => x.classList.toggle('on', x === b)); });
  function drawBank() { const box = $('bank'); box.innerHTML = '';
    st.bank.forEach(hex => { const d = document.createElement('div'); d.className = 'bank-sw'; d.style.background = hex; d.title = hex; d.onclick = () => pick(hex);
      d.oncontextmenu = e => { e.preventDefault(); st.bank = st.bank.filter(x => x !== hex); C.saveBank(st.bank); drawBank(); }; box.appendChild(d); });
    const add = document.createElement('div'); add.className = 'bank-sw add'; add.textContent = '+'; add.title = 'Add a color'; add.onclick = () => $('picker').click(); box.appendChild(add); }
  function addBank(hex) { hex = C.normHex(hex); if (!st.bank.includes(hex)) { st.bank.push(hex); C.saveBank(st.bank); } drawBank(); }
  $('picker').onchange = e => addBank(e.target.value);
  $('addHex').onclick = () => { const v = $('hex').value; if (C.validHex(v)) { addBank(v); $('hex').value = ''; } else note('colorNote', 'Hex should look like #c8102e.'); };
  $('resetStripes').onclick = () => { for (const L of 'ABCD') st.plan[L] = [st.plan[L][0]]; note('colorNote', 'Stripes removed: one color per letter.'); render(); };
  const dlCanvas = (cv, name) => { const a = document.createElement('a'); a.download = name; a.href = cv.toDataURL('image/png'); a.click(); };
  $('dlChart').onclick = () => { const D = derive(); dlCanvas(Rn.drawChart(D.F, D.X, chartOpts(D, { legend: C.legend(st.plan, D.H).concat(extraLegend(D)) })), 'mosaic_chart.png'); };
  $('dlPrev').onclick = () => { const D = derive(); dlCanvas(Rn.drawPreview(D.X, { rowRGB, stitchRGB: stitchRGB(D), lean: leanFn() }), 'mosaic_preview.png'); };
  $('copyTxt').onclick = async () => { const t = W8().directions(derive().X, st.plan, dirOpts(derive())); try { await navigator.clipboard.writeText(t); note('txtNote', 'Copied.'); }
    catch (e) { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($('written')); s.removeAllRanges(); s.addRange(rg); note('txtNote', 'Selected: press Ctrl/Cmd+C to copy.'); } };
  $('dlTxt').onclick = () => { const D = derive(), a = document.createElement('a'); a.download = 'mosaic_pattern.txt'; a.href = URL.createObjectURL(new Blob([W8().directions(D.X, st.plan, dirOpts(D))], { type: 'text/plain' })); a.click(); };

  /* ---------- pattern PDF ---------- */
  let logoURL = null;
  async function getLogo() { if (logoURL) return logoURL; const im = new Image(); im.src = 'logo.png'; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); return (logoURL = c.toDataURL('image/png')); }
  $('mkPdf').onclick = () => { if (!st.d) return; const D = derive();
    if (D.n) { note('dNote', `<b class="warn">Fix the ${D.spots} red trouble spot${D.spots > 1 ? 's' : ''} before making the PDF.</b> Tap Fix or paint around them.`); $('dNote').dataset.keep = 1; render(); $('dCv').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const box = $('pdfColors'); box.innerHTML = '';
    window.MosaicPDF.yarns(st.plan, D.H).forEach(e => { const d = document.createElement('div'); d.className = 'pcol';
      d.innerHTML = `<span class="sw" style="background:${e.hex}"></span><input type="text" data-key="${e.key}" placeholder="${e.label}" maxlength="30">`; box.appendChild(d); });
    note('pdfNote', ''); $('pdfDlg').showModal(); $('pdfTitle').focus(); };
  $('pdfProject').onchange = () => { $('pdfBorderWrap').hidden = $('pdfProject').value === 'chart'; };
  $('pdfCancel').onclick = () => $('pdfDlg').close();
  $('pdfForm').onsubmit = async ev => { ev.preventDefault(); const title = $('pdfTitle').value.trim(); if (!title) return note('pdfNote', 'Please type a title.');
    note('pdfNote', 'Making PDF…');
    try { const D = derive(), names = {}; document.querySelectorAll('#pdfColors input').forEach(i => names[i.dataset.key] = i.value);
      const pv = Rn.drawPreview(D.X, { rowRGB, stitchRGB: stitchRGB(D), lean: leanFn(), noLabel: true });
      const doc = window.MosaicPDF.build({ X: D.X, F: D.F, plan: st.plan, ...dirOpts(D), title, names, notes: $('pdfNotes').value, ideas: $('pdfIdeas').value, project: $('pdfProject').value, border: $('pdfBorder').value,
        logo: await getLogo(), preview: pv.toDataURL('image/png'), previewW: pv.width, previewH: pv.height });
      doc.save(window.MosaicPDF.fileName(title)); $('pdfDlg').close(); }
    catch (e) { console.error(e); note('pdfNote', 'Something went wrong: ' + e.message); } };

  /* ================= Pieces (Combine) ================= */
  function flash(id) { const b = $(id); if (!b.dataset.t) b.dataset.t = b.textContent; b.textContent = 'Saved ✔'; setTimeout(() => { b.textContent = b.dataset.t; }, 1500); }
  $('saveDesign').onclick = () => { if (!st.d) return; const d = st.d, H = d.P.length, groups = [];
    d.G.forEach((row, i) => row.forEach((v, c) => { if (v) groups.push([H - 1 - i, c, v]); }));
    window.MosaicCombine.save({ kind: 'chart', rows: d.P.slice().reverse().map(r => r.join('')), groups, plan: JSON.parse(JSON.stringify(st.plan)) }); flash('saveDesign'); };
  window.MosaicApp = {
    /* the board or a saved piece goes straight into the editor */
    openDesign: (rows, hex, groups, msg) => { if (st.d && st.hist.length && !confirm('Open this in Design? Your current design will be replaced (save it as a piece first if you want to keep it).')) return false;
      openDesign(rows, hex, groups, msg || 'Opened. Nothing has been changed.'); return true; }
  };
  window._mosaicState = st; window._mosaicDerive = () => (st.d ? derive() : null);
  setView('start');
})();
