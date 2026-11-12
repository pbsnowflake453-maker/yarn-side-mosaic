(function () {
  'use strict';
  const M = window.Mosaic, Rn = window.MosaicRender, $ = id => document.getElementById(id);
  const C = window.MosaicColors;
  const st = { extra: [], extraHex: ['#c8102e', '#2e8b57'], hexTouched: [false, false], stTool: 'ab', tool: 'paint', keep: null, trouble: null, mergeMode: false, mergeFrom: null, pixEdit: false, stEdit: false, paint: 0, pixHist: [], pixZoom: 1, stZoom: 1, plan: C.defaultPlan(), bank: C.loadBank(), selRow: null, img: null, det: null, samp: null, map: null, scale: 1, cands: [], sel: 0, bg: 0 };
  function replace(id, cv) { const old = $(id); cv.id = id; old.replaceWith(cv); }
  function imgData(im) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); }
  async function loadFile(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode();
    st.img = imgData(im); st.det = M.detectGrid(st.img); st.samp = st.det.sample();
    $('detect').textContent = `Detected ${st.samp.nx} × ${st.samp.ny} cells (${st.det.mode}), ${st.samp.palette.length} colors. Fix the counts below if they look wrong.`;
    $('nx').value = st.samp.nx; $('ny').value = st.samp.ny; $('sizeRow').classList.remove('hidden'); afterSample();
    $('palNote').textContent = st.samp.palette.length > 6 ? `${st.samp.palette.length} colors found. If some look alike, tap Merge look-alikes in step 2 for a cleaner split.` : '';
  }
  function afterSample() {
    const s = st.samp, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    st.bg = s.palette.reduce((b, c, i) => dist(c, st.det.bg) < dist(s.palette[b], st.det.bg) ? i : b, 0);
    st.pixHist = []; st.paint = st.bg; st.keep = s.idx.map(r => r.map(() => 0)); st.mergeMode = false; st.mergeFrom = null; $('mergePick').classList.remove('on');
    $('pixBox').classList.remove('hidden'); $('pixNote').textContent = ''; drawGridCheck();
    st.map = s.palette.length <= 2 ? s.palette.map((c, i) => i === st.bg ? 0 : 1) : M.autoSplit(s.idx, s.palette, st.bg); st.extra = s.palette.map(() => 0);
    $('palSec').classList.toggle('hidden', s.palette.length <= 2); $('convSec').classList.remove('hidden'); drawPalette();
  }
  function mono() { return st.samp.idx.map(r => r.map(v => (st.extra[v] ? 0 : st.map[v]))); }
  const extraMask = () => st.samp.idx.map(r => r.map(v => st.extra[v] || 0));
  const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const roleOf = i => (st.extra[i] ? ' CD'[st.extra[i]] : st.map[i] ? 'B' : 'A');
  function setRole(i, role) { st.map[i] = role === 'B' ? 1 : 0; st.extra[i] = role === 'C' ? 1 : role === 'D' ? 2 : 0;
    const k = st.extra[i] - 1; if (k >= 0 && !st.hexTouched[k]) st.extraHex[k] = toHex(st.samp.palette[i]); }   // C / D start as the picture's own color
  function drawPalette() {
    const box = $('swatches'); box.innerHTML = '';
    st.samp.palette.forEach((c, i) => { const role = roleOf(i), w = document.createElement('div'), d = document.createElement('div'); w.className = 'swWrap';
      d.className = 'swatch ' + role; d.style.background = `rgb(${c})`; d.title = `${st.samp.counts[i]} squares`;
      d.innerHTML = `<span class="badge">${role}</span>`;
      if (st.mergeMode && st.mergeFrom === i) d.classList.add('from');
      d.onclick = () => { if (st.mergeMode) mergeTap(i); };
      const rs = document.createElement('div'); rs.className = 'roles';
      for (const L of 'ABCD') { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = L; bt.className = L === role ? 'on' : '';
        bt.setAttribute('aria-label', `Make this color ${L}`); bt.onclick = () => { if (L !== role) { setRole(i, L); drawPalette(); } }; rs.appendChild(bt); }
      w.append(d, rs); box.appendChild(w); });
    const used = [1, 2].filter(k => st.extra.includes(k)).map(k => ' CD'[k]);
    $('extraNote').innerHTML = used.length ? `${used.join(' and ')} ${used.length > 1 ? 'are' : 'is a'} carried strand${used.length > 1 ? 's' : ''}: those squares become stitches worked in ${used.join(' / ')} on the A or B row they fall in. The converter keeps a dc from landing right under them, since that stitch can't be both.` : '';
    $('hexC').value = st.extraHex[0]; $('hexD').value = st.extraHex[1]; $('dotC').style.background = st.extraHex[0]; $('dotD').style.background = st.extraHex[1];
    drawPixPal(); const G = st.samp.idx.map(r => r.map(v => (st.extra[v] ? 1 + st.extra[v] : st.map[v]))),
      mc = Rn.drawTopDown(G, [[250, 250, 250], [25, 25, 25]].concat(st.extraHex.map(C.hexToRgb)), Math.max(4, Math.min(16, Math.floor(400 / Math.max(G.length, G[0].length)))));
    findTrouble(); if (st.trouble) Rn.markCells(mc, st.trouble, 'bad'); replace('monoCv', mc); drawOrig();
  }
  function convert() {
    if (st.cands.some(r => r.hist && r.hist.length) && !confirm('Converting again makes new charts and replaces your stitch edits. Continue?')) return;
    $('status').textContent = 'Working…'; $('pixNote').textContent = '';
    setTimeout(() => {
      const t0 = performance.now(), m = motifAndLock();
      st.cands = M.findFixes(m.motif, { stretch: $('stretch').checked, keep: 3, lock: m.lock, extra: m.extra });
      st.cands.forEach(r => { r.Y = r.F.map((x, i) => x.map((v, c) => (r.E ? r.E[i][c] : 0))); r.Y0 = r.Y.map(x => x.slice()); r.F0 = r.F.map(x => x.slice()); r.mine = r.L ? r.L.map(x => x.slice()) : r.F.map(x => x.map(() => 0)); r.auto = r.F.map(x => x.map(() => 0)); r.hist = []; });
      const box = $('cands'); box.innerHTML = '';
      if (!st.cands.length) { $('status').textContent = 'No workable fix found.'; return; }
      st.cands.forEach((r, k) => {
        const d = document.createElement('div'); d.className = 'cand' + (k === 0 ? ' sel' : ''); const cell = Math.max(2, Math.min(8, Math.floor(110 / r.width)));
        const hl = r.T.map((row, i) => row.map((v, c) => v !== r.F[i][c] ? 1 : 0)), im = document.createElement('div'); im.className = 'imgs';
        im.append(Rn.drawGrid(r.T, { cell }), Rn.drawGrid(r.F, { cell, hl }), Rn.drawGrid(M.simulate(r.X), { cell }));
        const black = r.T.flat().reduce((a, b) => a + b, 0);
        const p = document.createElement('p'); p.className = 'small';
        p.innerHTML = `<b>Option ${k + 1}${k === 0 ? ' (best)' : ''}</b> · ${r.width + 2} sts × ${r.rows} rows · ${r.stretched ? 'rows stretched' : 'no stretch'} · +${r.added} stitches (${Math.round(100 * r.added / black)}%)${r.removed ? `, −${r.removed}` : ''}${r.L ? (r.lockedChanged ? ` · <span class="warn">${r.lockedChanged} kept square${r.lockedChanged > 1 ? 's' : ''} changed</span>` : ' · kept squares unchanged') : ''} · ${r.simOK && r.valid ? '✔ simulation OK' : '✘ check failed'}`;
        d.append(im, p); d.onclick = () => { st.sel = k; [...box.children].forEach((e, j) => e.classList.toggle('sel', j === k)); show(true); }; box.appendChild(d);
      });
      $('status').textContent = `Done in ${Math.round(performance.now() - t0)} ms.`; st.sel = 0; show(true);
    }, 20);
  }
  const rowRGB = r => C.hexToRgb(C.hexAt(st.plan, r));
  const extras = () => st.extraHex.map((hex, k) => ({ label: 'CD'[k], hex }));
  const hasY = r => r.Y && r.Y.some(x => x.some(v => v));
  const stitchRGB = r => (hasY(r) ? (i, c) => (r.Y[i][c] ? C.hexToRgb(st.extraHex[r.Y[i][c] - 1]) : null) : null);
  /* color showing in square (i, c): the dc from the row above if there is one, else this row's stitch */
  const visRGB = r => (i, c) => { const s = i + 1 < r.F.length && r.X[i + 1][c] ? i + 1 : i; return r.Y && r.Y[s][c] ? C.hexToRgb(st.extraHex[r.Y[s][c] - 1]) : rowRGB(s + 1); };
  const carryTag = r => (hasY(r) ? row => [...new Set(r.Y[row - 1].filter(v => v))].sort().map(k => '+' + 'CD'[k - 1]).join('') : null);
  const extraLegend = r => (hasY(r) ? [1, 2].filter(k => r.Y.some(x => x.includes(k))).map(k => ({ hex: st.extraHex[k - 1], rgb: C.hexToRgb(st.extraHex[k - 1]), text: `${st.extraHex[k - 1].toUpperCase()}  ·  ${'CD'[k - 1]} (carried strand, shaded squares)` })) : []);
  const dirOpts = r => (hasY(r) ? { Y: r.Y, extras: extras() } : {});
  function chartOpts(r, extra) { return Object.assign({ cell: r.width > 60 ? 18 : 24, rowRGB, stitchRGB: stitchRGB(r), carry: carryTag(r) }, extra); }
  function show(resetPlan) {
    const r = st.cands[st.sel]; $('outSec').classList.remove('hidden');
    if (resetPlan) { st.plan = C.defaultPlan(); st.selRow = null; $('colorNote').textContent = ''; }
    const cv = Rn.drawChart(r.F, r.X, chartOpts(r, { selRow: st.selRow })); replace('chartCv', cv);
    cv.onclick = e => { const g = cv._geo, sc = cv.height / cv.clientHeight, y = e.offsetY * sc, k = Math.floor((y - g.top) / g.cell), row = g.H - k;
      if (row < 1 || row > g.H) return; st.selRow = row; $('colorNote').textContent = `Row ${row} selected (${C.yarnOf(row)} yarn, now ${C.hexAt(st.plan, row)}). Tap a color.`; show(); };
    const fab = M.simulate(r.X), H = fab.length;
    replace('fabCv', Rn.drawGrid(fab, { cell: Math.max(4, Math.min(16, Math.floor(500 / r.width))), cellRGB: visRGB(r) }));
    replace('prevCv', Rn.drawPreview(r.X, { rowRGB, stitchRGB: stitchRGB(r) }));
    drawSt(); drawBank(); $('written').textContent = window.MosaicWritten.directions(r.X, st.plan, dirOpts(r));
    $('summary').textContent = `${r.width + 2} stitches (incl. BS) × ${r.rows} rows + chain. ${r.X.flat().reduce((a, b) => a + b, 0)} X's.`;
  }
  const dl = (id, name) => { const a = document.createElement('a'); a.download = name; a.href = $(id).toDataURL('image/png'); a.click(); };
  $('file').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  $('resample').onclick = () => { if (st.pixHist.length && !confirm('Re-reading the grid replaces your pixel edits. Continue?')) return; st.samp = st.det.sample(+$('nx').value, +$('ny').value); afterSample(); };
  function drawGridCheck() { $('gridBox').classList.remove('hidden'); const w = Math.min(600, $('gridBox').clientWidth || 600);
    replace('gridCv', Rn.drawGridCheck(st.img, st.samp.xs, st.samp.ys, w)); }
  $('autoBtn').onclick = () => { st.map = M.autoSplit(st.samp.idx, st.samp.palette, st.bg); st.extra = st.samp.palette.map(() => 0); drawPalette(); };
  $('thrBtn').onclick = () => { st.map = M.thresholdMap(st.samp.palette); st.map[st.bg] = 0; st.extra = st.samp.palette.map(() => 0); drawPalette(); };
  /* Up to four colors: A = background, then B, C, D by how many squares use them; any other color joins the closest of those four. */
  $('auto4Btn').onclick = () => { const s = st.samp, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const order = s.palette.map((c, i) => i).filter(i => i !== st.bg).sort((a, b) => s.counts[b] - s.counts[a]);
    const lead = [st.bg].concat(order.filter(i => s.counts[i] > 0).slice(0, 3)), roles = ['A', 'B', 'C', 'D'];
    s.palette.forEach((c, i) => { let k = lead.indexOf(i); if (k < 0) k = lead.reduce((b, j, q) => (d(c, s.palette[j]) < d(c, s.palette[lead[b]]) ? q : b), 0); setRole(i, roles[k]); });
    drawPalette(); $('palNote').textContent = lead.length < 3 ? 'Only two colors here, so there is nothing for C or D.' : `Split into ${lead.length} colors. Tap a letter under any color to change it.`; };
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st.scale = +b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); if (st.samp) drawPalette(); });
  $('go').onclick = convert; $('dlChart').onclick = () => { const r = st.cands[st.sel], cv = Rn.drawChart(r.F, r.X, chartOpts(r, { legend: C.legend(st.plan, r.F.length).concat(extraLegend(r)) }));
    const a = document.createElement('a'); a.download = 'mosaic_chart.png'; a.href = cv.toDataURL('image/png'); a.click(); };
  function pick(hex) {
    if (st.selRow == null) { $('colorNote').textContent = 'Tap a row in the color strip at the left of the chart first.'; return; }
    const r = st.cands[st.sel], res = C.addChange(st.plan, r.X, st.selRow, hex); st.plan = res.plan; show();
    $('colorNote').textContent = res.note || `Row ${st.selRow} and up now use ${hex} for the ${C.yarnOf(st.selRow)} yarn.`; }
  function drawBank() { const box = $('bank'); box.innerHTML = '';
    st.bank.forEach(hex => { const d = document.createElement('div'); d.className = 'bank-sw'; d.style.background = hex; d.title = hex; d.onclick = () => pick(hex);
      d.oncontextmenu = e => { e.preventDefault(); st.bank = st.bank.filter(x => x !== hex); C.saveBank(st.bank); drawBank(); }; box.appendChild(d); });
    const add = document.createElement('div'); add.className = 'bank-sw add'; add.textContent = '+'; add.title = 'Add a color'; add.onclick = () => $('picker').click(); box.appendChild(add); }
  function addBank(hex) { hex = C.normHex(hex); if (!st.bank.includes(hex)) { st.bank.push(hex); C.saveBank(st.bank); } drawBank(); }
  $('picker').onchange = e => addBank(e.target.value);
  $('addHex').onclick = () => { const v = $('hex').value; if (C.validHex(v)) { addBank(v); $('hex').value = ''; } else $('colorNote').textContent = 'Hex should look like #c8102e.'; };
  $('resetColors').onclick = () => { st.plan = C.defaultPlan(); $('colorNote').textContent = 'Colors reset to white (A) / black (B).'; show(); }; $('dlPrev').onclick = () => dl('prevCv', 'mosaic_preview.png');
  $('copyTxt').onclick = async () => { const t = $('written').textContent; try { await navigator.clipboard.writeText(t); $('txtNote').textContent = 'Copied.'; }
    catch (e) { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($('written')); s.removeAllRanges(); s.addRange(rg); $('txtNote').textContent = 'Selected: press Ctrl/Cmd+C to copy.'; } };
  $('dlTxt').onclick = () => { const a = document.createElement('a'); a.download = 'mosaic_pattern.txt'; a.href = URL.createObjectURL(new Blob([$('written').textContent], { type: 'text/plain' })); a.click(); };
  // ---- Pattern PDF ----
  let logoURL = null;
  async function getLogo() { if (logoURL) return logoURL; const im = new Image(); im.src = 'logo.png'; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); return (logoURL = c.toDataURL('image/png')); }
  $('mkPdf').onclick = () => { const r = st.cands[st.sel]; if (!r) return;
    const pr = M.problemCells(r.F); if (pr.n) { $('stNote').innerHTML = `<b class="warn">Fix the ${pr.n} red square${pr.n > 1 ? 's' : ''} before making the PDF.</b> Tap “Fix around my edits” or edit them by hand.`; $('stBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } const box = $('pdfColors'); box.innerHTML = '';
    window.MosaicPDF.yarns(st.plan, r.X.length).forEach(e => { const d = document.createElement('div'); d.className = 'pcol';
      d.innerHTML = `<span class="sw" style="background:${e.hex}"></span><input type="text" data-key="${e.key}" placeholder="${e.label}" maxlength="30">`; box.appendChild(d); });
    $('pdfNote').textContent = ''; $('pdfDlg').showModal(); $('pdfTitle').focus(); };
  $('pdfProject').onchange = () => { $('pdfBorderWrap').hidden = $('pdfProject').value === 'chart'; };
  $('pdfCancel').onclick = () => $('pdfDlg').close();
  $('pdfForm').onsubmit = async ev => { ev.preventDefault(); const title = $('pdfTitle').value.trim(); if (!title) { $('pdfNote').textContent = 'Please type a title.'; return; }
    $('pdfNote').textContent = 'Making PDF…';
    try { const r = st.cands[st.sel], names = {}; document.querySelectorAll('#pdfColors input').forEach(i => names[i.dataset.key] = i.value);
      const pv = Rn.drawPreview(r.X, { rowRGB, stitchRGB: stitchRGB(r), noLabel: true });
      const doc = window.MosaicPDF.build({ X: r.X, F: r.F, plan: st.plan, ...dirOpts(r), title, names, notes: $('pdfNotes').value, ideas: $('pdfIdeas').value, project: $('pdfProject').value, border: $('pdfBorder').value,
        logo: await getLogo(), preview: pv.toDataURL('image/png'), previewW: pv.width, previewH: pv.height });
      doc.save(window.MosaicPDF.fileName(title)); $('pdfDlg').close(); }
    catch (e) { console.error(e); $('pdfNote').textContent = 'Something went wrong: ' + e.message; } };
  // ---- Pixel / stitch editing ----
  const ZOOMS = [1, 1.5, 2, 3, 4];
  function applyZoom(cv, z) { cv.classList.toggle('zoomed', z > 1); cv.style.width = z > 1 ? Math.round(cv.width * z * Math.min(1, cv.parentElement.clientWidth / cv.width)) + 'px' : ''; }
  function zoom(key, dir, redraw) { const k = ZOOMS.indexOf(st[key]); st[key] = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, k + dir))]; redraw(); }
  /* Tap/drag painting on a canvas. onCell(row from top, col, isFirst) returns false to ignore. */
  function paintable(cv, onStart, onCell, onEnd) {
    cv.classList.add('painting'); let down = false, last = '';
    const at = e => { const b = cv.getBoundingClientRect(), cell = cv._cell;
      return [Math.floor((e.clientY - b.top) * cv.height / b.height / cell), Math.floor((e.clientX - b.left) * cv.width / b.width / cell)]; };
    const hit = (e, first) => { const [r, c] = at(e), key = r + ',' + c; if (key === last || r < 0 || c < 0 || r * cv._cell >= cv.height || c * cv._cell >= cv.width) return; last = key; onCell(r, c, first); };
    cv.onpointerdown = e => { e.preventDefault(); down = true; last = ''; cv.setPointerCapture(e.pointerId); onStart(); hit(e, true); };
    cv.onpointermove = e => { if (down) hit(e, false); };
    cv.onpointerup = cv.onpointercancel = () => { if (!down) return; down = false; onEnd(); };
  }
  function fillCell(cv, r, c, rgb) { const g = cv.getContext('2d'), k = cv._cell; g.fillStyle = `rgb(${rgb})`; g.fillRect(c * k + 1, r * k + 1, k - 1, k - 1); }

  // Before converting: edit the pixel art itself
  function drawOrig() { const s = st.samp, cv = Rn.drawTopDown(s.idx, s.palette, Math.max(4, Math.min(24, Math.floor(600 / Math.max(s.nx, s.ny)))), st.pixEdit);
    if (st.trouble) Rn.markCells(cv, st.trouble, 'bad'); Rn.markCells(cv, st.keep, 'keep');
    replace('origCv', cv); applyZoom(cv, st.pixZoom);
    if (st.pixEdit) paintable(cv, () => st.pixHist.push(pixSnap()),
      (r, c) => { if (st.tool === 'paint') { if (s.idx[r][c] === st.paint) return; s.idx[r][c] = st.paint; fillCell(cv, r, c, s.palette[st.paint]); }
        else { const v = st.tool === 'keep' ? 1 : 0; if (st.keep[r][c] === v) return; st.keep[r][c] = v; fillCell(cv, r, c, s.palette[s.idx[r][c]]); if (v) Rn.markCells(cv, st.keep.map((x, i) => x.map((y, j) => (i === r && j === c ? 1 : 0))), 'keep'); } },
      pixChanged);
    $('pixUndo').disabled = $('pixReset').disabled = !st.pixHist.length; }
  const pixSnap = () => { const s = st.samp; return { idx: s.idx.map(r => r.slice()), keep: st.keep.map(r => r.slice()), palette: s.palette.map(c => c.slice()), counts: s.counts.slice(), map: st.map.slice(), extra: st.extra.slice(), bg: st.bg, paint: st.paint }; };
  function pixRestore(h) { const s = st.samp; s.ny = h.idx.length; s.nx = h.idx[0].length; s.idx = h.idx; s.palette = h.palette; s.counts = h.counts; st.keep = h.keep; st.map = h.map; st.extra = h.extra; st.bg = h.bg; st.paint = h.paint; }
  function pixChanged() {
    const s = st.samp, h = st.pixHist[st.pixHist.length - 1];
    if (h && JSON.stringify([h.idx, h.keep, h.palette]) === JSON.stringify([s.idx, st.keep, s.palette])) st.pixHist.pop();   // tap that changed nothing
    s.counts = s.palette.map(() => 0); s.idx.forEach(r => r.forEach(v => s.counts[v]++));
    drawPalette();
    if (st.cands.length && st.pixHist.length) $('pixNote').textContent = 'Picture edited. Press Convert (step 3) to update the chart.'; }
  /* Cropped (and scaled) two-color motif plus the matching keep-exactly mask, exactly as Convert uses them. */
  function motifAndLock() {
    // The chart uses the pixel graph exactly as shown, empty edges included (Trim empty edges removes them).
    const G = mono(), y0 = 0, y1 = G.length - 1, x0 = 0, x1 = G[0].length - 1;
    const cut = A => A.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1)), sc = A => (st.scale > 1 ? M.scale(A, st.scale) : A);
    const lock = sc(cut(st.keep)), extra = sc(cut(extraMask()));
    return { motif: sc(cut(G)), lock: lock.some(r => r.some(v => v)) ? lock : null, extra: extra.some(r => r.some(v => v)) ? extra : null, y0, x0 };
  }
  /* Squares that can't be crocheted exactly as drawn (same rules as the converter), mapped back onto the picture. */
  function findTrouble() {
    const { motif, extra, y0, x0 } = motifAndLock(), h = motif.length, s = st.scale, ones = new Array(h).fill(1);
    if (!motif.some(r => r.some(v => v)) && !extra) { st.trouble = null; $('troubleNote').textContent = ''; return; }
    let best = null;
    for (const b of [0, 1]) { const T = M.stretchRows(motif, ones, b), E = extra ? M.stretchRows(extra, ones, b) : null;
      if (E) E.forEach((row, i) => row.forEach((v, c) => { if (v) T[i][c] = M.color(i + 1); }));   // C / D squares sit in their own row
      const pc = M.problemCells(T);
      if (E) E.forEach((row, i) => row.forEach((v, c) => { if (v && i > 0 && !E[i - 1][c] && T[i - 1][c] !== M.color(i) && !pc.bad[i - 1][c]) { pc.bad[i - 1][c] = 1; pc.n++; pc.spots++; } }));   // needs a dc under a C / D square
      if (!best || pc.n < best.pc.n) best = { b, pc }; }
    const mark = st.samp.idx.map(r => r.map(() => 0)); let n = 0;
    best.pc.bad.forEach((row, i) => row.forEach((v, c) => { const k = h - 1 - (i - best.b), mc = c - 1;
      if (!v || k < 0 || k >= h || mc < 0 || mc >= motif[0].length) return; const y = y0 + Math.floor(k / s), x = x0 + Math.floor(mc / s); if (!mark[y][x]) { mark[y][x] = 1; n++; } }));
    st.trouble = n ? mark : null; const k = best.pc.spots;
    $('troubleNote').innerHTML = n ? `<b class="warn">⚠ ${k} trouble spot${k > 1 ? 's' : ''}${st.scale > 1 ? ` at ${st.scale}× scale` : ''}</b>, outlined red. In each, one of the red squares can't be crocheted as drawn, so the converter will change about ${k} square${k > 1 ? 's' : ''} near them. To choose what changes, edit them yourself, or mark important parts with Keep exactly.`
      : `<b class="ok">✔ No trouble spots${st.scale > 1 ? ` at ${st.scale}× scale` : ''}.</b> This picture can be crocheted exactly as drawn (before any row stretching).`;
  }
  // Merging colors (keeps pixel edits)
  function mergeTap(i) {
    if (st.mergeFrom == null) { st.mergeFrom = i; $('palNote').textContent = 'Now tap the color to merge into it.'; drawPalette(); return; }
    if (i === st.mergeFrom) { st.mergeFrom = null; $('palNote').textContent = 'Tap the color to keep, then the color to merge into it.'; drawPalette(); return; }
    st.pixHist.push(pixSnap()); const keepI = st.mergeFrom, n = st.samp.counts[i];
    remapMerge(keepI, i); st.mergeFrom = null; pixChanged();
    $('palNote').textContent = `Merged ${n} square${n === 1 ? '' : 's'}. Tap two more colors to merge again, or tap Merge two colors to stop.`; }
  function remapMerge(keepI, dropI) { const s = st.samp, fix = v => { v = v === dropI ? keepI : v; return v > dropI ? v - 1 : v; };
    s.idx = s.idx.map(r => r.map(fix)); s.palette.splice(dropI, 1); st.map.splice(dropI, 1); st.extra.splice(dropI, 1); st.bg = fix(st.bg); st.paint = fix(st.paint); }
  $('mergePick').onclick = () => { st.mergeMode = !st.mergeMode; st.mergeFrom = null; $('mergePick').classList.toggle('on', st.mergeMode);
    $('palNote').textContent = st.mergeMode ? 'Tap the color to keep, then the color to merge into it.' : ''; drawPalette(); };
  $('mergeAuto').onclick = () => { const s = st.samp, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), before = s.palette.length; let snapped = false;
    while (s.palette.length > 2) { let best = null;
      for (let i = 0; i < s.palette.length; i++) for (let j = i + 1; j < s.palette.length; j++) { const q = d(s.palette[i], s.palette[j]); if (q < 70 && (!best || q < best.q)) best = { i, j, q }; }
      if (!best) break; if (!snapped) { st.pixHist.push(pixSnap()); snapped = true; }
      const [keepI, dropI] = s.counts[best.i] >= s.counts[best.j] ? [best.i, best.j] : [best.j, best.i];
      s.counts[keepI] += s.counts[dropI]; s.counts.splice(dropI, 1); remapMerge(keepI, dropI); }
    if (!snapped) { $('palNote').textContent = 'No look-alike colors found. Use Merge two colors to merge any pair.'; return; }
    pixChanged(); $('palNote').textContent = `Merged ${before - s.palette.length} look-alike color${before - s.palette.length > 1 ? 's' : ''}: ${before} → ${s.palette.length} colors. Undo is in step 1.`; };
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { st.tool = b.dataset.tool; document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
    $('pixPal').classList.toggle('hidden', st.tool !== 'paint');
    $('toolHelp').textContent = { paint: 'Pick a color, then tap or drag on the picture. A / B shows which yarn that color becomes.',
      keep: 'Tap or drag over details that must stay exactly as drawn, like eyes or letters (teal dots). The converter changes stitches around them instead.',
      unkeep: 'Tap or drag over teal dots to remove them.' }[st.tool]; });
  function drawPixPal() { const box = $('pixPal'); box.innerHTML = '';
    st.samp.palette.forEach((c, i) => { const d = document.createElement('div'); d.className = 'psw' + (i === st.paint ? ' sel' : ''); d.style.background = `rgb(${c})`;
      d.textContent = st.map && st.map[i] ? 'B' : 'A'; d.title = 'Paint with this color'; d.onclick = () => { st.paint = i; drawPixPal(); }; box.appendChild(d); }); }
  $('pixEdit').onclick = () => { st.pixEdit = !st.pixEdit; $('pixEdit').classList.toggle('on', st.pixEdit); $('pixTools').classList.toggle('hidden', !st.pixEdit); drawOrig(); };
  $('pixUndo').onclick = () => { if (!st.pixHist.length) return; pixRestore(st.pixHist.pop()); pixChanged(); };
  $('pixReset').onclick = () => { if (!st.pixHist.length) return; pixRestore(st.pixHist[0]); st.pixHist = []; pixChanged(); $('pixNote').textContent = 'Pixel edits, keeps and merges undone.'; };
  // Add / remove empty rows and columns, center, trim
  const emptyRow = r => r.every(v => !st.map[v] && !st.extra[v]);
  function resize(fn, note) { const s = st.samp; st.pixHist.push(pixSnap()); const res = fn(s.idx, st.keep);
    if (!res) { st.pixHist.pop(); return; } s.idx = res.idx; st.keep = res.keep; s.ny = s.idx.length; s.nx = s.idx[0].length;
    pixChanged(); $('sizeNote').textContent = (typeof note === 'function' ? note(res) : note) + ` Now ${s.nx} × ${s.ny}.`; }
  const T = A => A[0].map((_, j) => A.map(r => r[j]));   // swap rows/columns so one routine handles both
  function pad(idx, keep, side, n) {
    const cols = side === 'left' || side === 'right', end = side === 'bottom' || side === 'right';
    let I = cols ? T(idx) : idx.map(r => r.slice()), K = cols ? T(keep) : keep.map(r => r.slice()), lost = 0;
    for (let k = 0; k < Math.abs(n); k++) {
      if (n > 0) { const ri = I[0].map(() => st.bg), rk = I[0].map(() => 0); if (end) { I.push(ri); K.push(rk); } else { I.unshift(ri); K.unshift(rk); } }
      else { if (I.length <= 2) return null; const gone = end ? I.pop() : I.shift(); end ? K.pop() : K.shift(); lost += gone.filter(v => st.map[v]).length; }
    }
    return { idx: cols ? T(I) : I, keep: cols ? T(K) : K, lost };
  }
  function margins(idx) { const m = { top: 0, bottom: 0, left: 0, right: 0 }, R = idx, C = T(idx);
    while (m.top < R.length && emptyRow(R[m.top])) m.top++; while (m.bottom < R.length - m.top && emptyRow(R[R.length - 1 - m.bottom])) m.bottom++;
    while (m.left < C.length && emptyRow(C[m.left])) m.left++; while (m.right < C.length - m.left && emptyRow(C[C.length - 1 - m.right])) m.right++; return m; }
  document.querySelectorAll('[data-pad]').forEach(b => b.onclick = () => { const [side, n] = b.dataset.pad.split(','), k = +n;
    resize((idx, keep) => pad(idx, keep, side, k), res => k > 0 ? `Added an empty ${side === 'left' || side === 'right' ? 'column' : 'row'} on the ${side}.`
      : `Removed the ${side} ${side === 'left' || side === 'right' ? 'column' : 'row'}` + (res.lost ? ` (it had ${res.lost} colored square${res.lost > 1 ? 's' : ''}; Undo brings it back).` : '.')); });
  $('padCenter').onclick = () => { const m = margins(st.samp.idx); if (m.top === st.samp.idx.length) { $('sizeNote').textContent = 'The picture is empty.'; return; }
    const dy = Math.floor((m.top + m.bottom) / 2) - m.top, dx = Math.floor((m.left + m.right) / 2) - m.left;
    if (!dy && !dx) { $('sizeNote').textContent = `Already centered (${m.top} empty above, ${m.bottom} below, ${m.left} left, ${m.right} right).`; return; }
    resize((idx, keep) => { let r = { idx, keep };
      if (dy) { const a = pad(r.idx, r.keep, 'top', dy); r = pad(a.idx, a.keep, 'bottom', -dy); }
      if (dx) { const a = pad(r.idx, r.keep, 'left', dx); r = pad(a.idx, a.keep, 'right', -dx); }
      return r; }, () => { const n = margins(st.samp.idx); return `Centered: ${n.top} empty row${n.top === 1 ? '' : 's'} above, ${n.bottom} below; ${n.left} empty column${n.left === 1 ? '' : 's'} left, ${n.right} right.`; }); };
  $('padTrim').onclick = () => { const m = margins(st.samp.idx); if (m.top === st.samp.idx.length) return;
    if (!m.top && !m.bottom && !m.left && !m.right) { $('sizeNote').textContent = 'No empty edges to trim.'; return; }
    resize((idx, keep) => { let r = { idx, keep }; for (const sd of ['top', 'bottom', 'left', 'right']) if (m[sd]) r = pad(r.idx, r.keep, sd, -m[sd]); return r; }, 'Trimmed the empty edges.'); };
  $('pixIn').onclick = () => zoom('pixZoom', 1, drawOrig); $('pixOut').onclick = () => zoom('pixZoom', -1, drawOrig);

  // After converting: edit the finished look; X's are recalculated from it
  const cur = () => st.cands[st.sel];
  const snap = r => ({ F: r.F.map(x => x.slice()), mine: r.mine.map(x => x.slice()), auto: r.auto.map(x => x.slice()), Y: r.Y.map(x => x.slice()) });
  const stRGB = r => (i, c, v) => rowRGB(v === M.color(i + 1) ? i + 1 : i + 2);
  function drawSt() {
    const r = cur(), H = r.F.length, pr = M.problemCells(r.F), get = stRGB(r);
    const vis = visRGB(r), cv = Rn.drawEdit(r.F, { cell: Math.max(6, Math.min(22, Math.floor(560 / Math.max(r.width, H)))), cellRGB: (i, c) => vis(i, c), bad: pr.bad, mine: r.mine, auto: r.auto });
    replace('stCv', cv); applyZoom(cv, st.stZoom);
    if (st.stEdit && st.stTool !== 'ab') { const want = st.stTool; let hitDc = false;   // paint stitches with C / D (or back to the row's yarn)
      paintable(cv, () => r.hist.push(snap(r)),
        (k, c) => { const i = H - 1 - k, s = i + 1 < H && r.X[i + 1][c] ? i + 1 : i; if (r.Y[s][c] === want) return; r.Y[s][c] = want;
          const rows = r.X[s][c] ? [s, s - 1] : [s]; if (r.X[s][c]) hitDc = true;
          rows.forEach(q => { if (q >= 0) fillCell(cv, H - 1 - q, c, vis(q, c)); }); },
        () => { const h = r.hist[r.hist.length - 1]; if (h && JSON.stringify(h.Y) === JSON.stringify(r.Y)) r.hist.pop();
          stChanged(hitDc ? `Part of what you painted is a dc, so <b>both squares it shows in</b> changed: the dc and the square it covers below. That keeps every switch a real stitch.` : null); });
    }
    if (st.stEdit && st.stTool === 'ab') { let val = null;
      paintable(cv, () => { r.hist.push(snap(r)); val = null; },
        (k, c, first) => { const i = H - 1 - k; if (first) val = 1 - r.F[i][c]; if (r.F[i][c] === val) return;
          r.F[i][c] = val; r.mine[i][c] = 1; r.auto[i][c] = 0; fillCell(cv, k, c, get(i, c, val)); },
        () => { const h = r.hist[r.hist.length - 1]; if (h && JSON.stringify(h.F) === JSON.stringify(r.F)) r.hist.pop(); stChanged(); }); }
    const edits = r.mine.flat().reduce((a, b) => a + b, 0);
    $('stUndo').disabled = !r.hist.length; $('stReset').disabled = !r.hist.length; $('stFix').disabled = !pr.n;
    if (!$('stNote').dataset.keep) $('stNote').innerHTML = pr.n
      ? `<b class="warn">✘ ${pr.n} red square${pr.n > 1 ? 's' : ''} can't be worked.</b> In each column, a square that shows the other row's color can't sit right above another one, or in the top row. Tap “Fix around my edits” to adjust the stitches next to them, or keep editing.`
      : (edits ? `<b class="ok">✔ Workable.</b> ${edits} square${edits > 1 ? 's' : ''} edited by hand.` : (st.stEdit ? (st.stTool === 'ab' ? 'Tap or drag on a square to switch it between A and B.'
        : st.stTool ? `Tap or drag to work stitches in ${'CD'[st.stTool - 1]}. A dc shows in two squares (its own and the one it covers), so both change together.` : 'Tap or drag over C / D squares to work them in the row\'s own yarn again.') : ''));
    delete $('stNote').dataset.keep;
  }
  function stChanged(note) { const r = cur(); r.X = M.check(r.F).X; if (note) { $('stNote').innerHTML = note; $('stNote').dataset.keep = 1; } show(); }
  $('stEdit').onclick = () => { st.stEdit = !st.stEdit; $('stEdit').classList.toggle('on', st.stEdit); drawSt(); };
  $('stUndo').onclick = () => { const r = cur(), h = r.hist.pop(); if (!h) return; Object.assign(r, h); stChanged(); };
  $('stReset').onclick = () => { const r = cur(); if (!r.hist.length) return; r.hist.push(snap(r)); r.F = r.F0.map(x => x.slice()); r.Y = r.Y0.map(x => x.slice());
    r.mine = r.F.map(x => x.map(() => 0)); r.auto = r.F.map(x => x.map(() => 0)); stChanged('Back to the original chart. Tap Undo to bring your edits back.'); };
  $('stFix').onclick = () => { const r = cur(), res = M.refix(r.F, r.mine); if (!res) return;
    r.hist.push(snap(r)); r.auto = r.F.map((row, i) => row.map((v, c) => (v !== res.F[i][c] ? 1 : r.auto[i][c]))); res.F.forEach((row, i) => row.forEach((v, c) => { if (v !== r.F[i][c]) r.mine[i][c] = 0; }));
    r.F = res.F;
    stChanged(`<b class="ok">✔ Workable.</b> Adjusted ${res.changed} square${res.changed === 1 ? '' : 's'} (outlined orange)` + (res.lockedChanged ? `, including ${res.lockedChanged} of your own edits that couldn't be worked as drawn.` : '; all your edits were kept.') + ' Tap Undo if you don\'t like it.'); };
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const v = b.dataset.st; st.stTool = v === 'ab' ? 'ab' : +v;
    document.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b)); if (!st.stEdit) $('stEdit').click(); else drawSt(); });
  ['hexC', 'hexD'].forEach((id, k) => { $(id).oninput = () => { st.extraHex[k] = $(id).value; st.hexTouched[k] = true; if (st.cands.length) show(); drawPalette(); }; });
  $('stIn').onclick = () => zoom('stZoom', 1, drawSt); $('stOut').onclick = () => zoom('stZoom', -1, drawSt);

  window._mosaicState = st;
})();
