(function () {
  'use strict';
  const M = window.Mosaic, Rn = window.MosaicRender, $ = id => document.getElementById(id);
  const C = window.MosaicColors;
  const st = { pixEdit: false, stEdit: false, paint: 0, pixHist: [], pixZoom: 1, stZoom: 1, plan: C.defaultPlan(), bank: C.loadBank(), selRow: null, img: null, det: null, samp: null, map: null, scale: 1, cands: [], sel: 0, bg: 0 };
  function replace(id, cv) { const old = $(id); cv.id = id; old.replaceWith(cv); }
  function imgData(im) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); }
  async function loadFile(file) {
    const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode();
    st.img = imgData(im); st.det = M.detectGrid(st.img); st.samp = st.det.sample();
    $('detect').textContent = `Detected ${st.samp.nx} × ${st.samp.ny} cells (${st.det.mode}), ${st.samp.palette.length} colors. Fix the counts below if they look wrong.`;
    $('nx').value = st.samp.nx; $('ny').value = st.samp.ny; $('sizeRow').classList.remove('hidden'); afterSample();
  }
  function afterSample() {
    const s = st.samp, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    st.bg = s.palette.reduce((b, c, i) => dist(c, st.det.bg) < dist(s.palette[b], st.det.bg) ? i : b, 0);
    st.pixHist = []; st.paint = st.bg; $('pixBox').classList.remove('hidden'); $('pixNote').textContent = ''; drawOrig();
    st.map = s.palette.length <= 2 ? s.palette.map((c, i) => i === st.bg ? 0 : 1) : M.autoSplit(s.idx, s.palette, st.bg);
    $('palSec').classList.toggle('hidden', s.palette.length <= 2); $('convSec').classList.remove('hidden'); drawPalette();
  }
  function mono() { return st.samp.idx.map(r => r.map(v => st.map[v])); }
  function drawPalette() {
    const box = $('swatches'); box.innerHTML = '';
    st.samp.palette.forEach((c, i) => { const d = document.createElement('div'); d.className = 'swatch ' + (st.map[i] ? 'B' : 'A');
      d.style.background = `rgb(${c})`; d.textContent = st.map[i] ? 'B' : 'A'; d.title = `${st.samp.counts[i]} cells`;
      d.onclick = () => { st.map[i] = 1 - st.map[i]; drawPalette(); }; box.appendChild(d); });
    drawPixPal(); const G = mono(); replace('monoCv', Rn.drawTopDown(G, [[250, 250, 250], [25, 25, 25]], Math.max(4, Math.min(16, Math.floor(400 / Math.max(G.length, G[0].length))))));
  }
  function convert() {
    if (st.cands.some(r => r.hist && r.hist.length) && !confirm('Converting again makes new charts and replaces your stitch edits. Continue?')) return;
    $('status').textContent = 'Working…'; $('pixNote').textContent = '';
    setTimeout(() => {
      const t0 = performance.now(); let motif = M.crop(mono()); if (st.scale > 1) motif = M.scale(motif, st.scale);
      st.cands = M.findFixes(motif, { stretch: $('stretch').checked, keep: 3 });
      st.cands.forEach(r => { r.F0 = r.F.map(x => x.slice()); r.mine = r.F.map(x => x.map(() => 0)); r.auto = r.F.map(x => x.map(() => 0)); r.hist = []; });
      const box = $('cands'); box.innerHTML = '';
      if (!st.cands.length) { $('status').textContent = 'No workable fix found.'; return; }
      st.cands.forEach((r, k) => {
        const d = document.createElement('div'); d.className = 'cand' + (k === 0 ? ' sel' : ''); const cell = Math.max(2, Math.min(8, Math.floor(110 / r.width)));
        const hl = r.T.map((row, i) => row.map((v, c) => v !== r.F[i][c] ? 1 : 0)), im = document.createElement('div'); im.className = 'imgs';
        im.append(Rn.drawGrid(r.T, { cell }), Rn.drawGrid(r.F, { cell, hl }), Rn.drawGrid(M.simulate(r.X), { cell }));
        const black = r.T.flat().reduce((a, b) => a + b, 0);
        const p = document.createElement('p'); p.className = 'small';
        p.innerHTML = `<b>Option ${k + 1}${k === 0 ? ' (best)' : ''}</b> · ${r.width + 2} sts × ${r.rows} rows · ${r.stretched ? 'rows stretched' : 'no stretch'} · +${r.added} stitches (${Math.round(100 * r.added / black)}%)${r.removed ? `, −${r.removed}` : ''} · ${r.simOK && r.valid ? '✔ simulation OK' : '✘ check failed'}`;
        d.append(im, p); d.onclick = () => { st.sel = k; [...box.children].forEach((e, j) => e.classList.toggle('sel', j === k)); show(true); }; box.appendChild(d);
      });
      $('status').textContent = `Done in ${Math.round(performance.now() - t0)} ms.`; st.sel = 0; show(true);
    }, 20);
  }
  const rowRGB = r => C.hexToRgb(C.hexAt(st.plan, r));
  function chartOpts(r, extra) { return Object.assign({ cell: r.width > 60 ? 18 : 24, rowRGB }, extra); }
  function show(resetPlan) {
    const r = st.cands[st.sel]; $('outSec').classList.remove('hidden');
    if (resetPlan) { st.plan = C.defaultPlan(); st.selRow = null; $('colorNote').textContent = ''; }
    const cv = Rn.drawChart(r.F, r.X, chartOpts(r, { selRow: st.selRow })); replace('chartCv', cv);
    cv.onclick = e => { const g = cv._geo, sc = cv.height / cv.clientHeight, y = e.offsetY * sc, k = Math.floor((y - g.top) / g.cell), row = g.H - k;
      if (row < 1 || row > g.H) return; st.selRow = row; $('colorNote').textContent = `Row ${row} selected (${C.yarnOf(row)} yarn, now ${C.hexAt(st.plan, row)}). Tap a color.`; show(); };
    const fab = M.simulate(r.X), H = fab.length;
    replace('fabCv', Rn.drawGrid(fab, { cell: Math.max(4, Math.min(16, Math.floor(500 / r.width))), cellRGB: (i, c) => rowRGB(i + 1 < H && r.X[i + 1][c] ? i + 2 : i + 1) }));
    replace('prevCv', Rn.drawPreview(r.X, { rowRGB }));
    drawSt(); drawBank(); $('written').textContent = window.MosaicWritten.directions(r.X, st.plan);
    $('summary').textContent = `${r.width + 2} stitches (incl. BS) × ${r.rows} rows + chain. ${r.X.flat().reduce((a, b) => a + b, 0)} X's.`;
  }
  const dl = (id, name) => { const a = document.createElement('a'); a.download = name; a.href = $(id).toDataURL('image/png'); a.click(); };
  $('file').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  $('resample').onclick = () => { if (st.pixHist.length && !confirm('Re-reading the grid replaces your pixel edits. Continue?')) return; st.samp = st.det.sample(+$('nx').value, +$('ny').value); afterSample(); };
  $('autoBtn').onclick = () => { st.map = M.autoSplit(st.samp.idx, st.samp.palette, st.bg); drawPalette(); };
  $('thrBtn').onclick = () => { st.map = M.thresholdMap(st.samp.palette); st.map[st.bg] = 0; drawPalette(); };
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st.scale = +b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
  $('go').onclick = convert; $('dlChart').onclick = () => { const r = st.cands[st.sel], cv = Rn.drawChart(r.F, r.X, chartOpts(r, { legend: C.legend(st.plan, r.F.length) }));
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
      const pv = Rn.drawPreview(r.X, { rowRGB, noLabel: true });
      const doc = window.MosaicPDF.build({ X: r.X, F: r.F, plan: st.plan, title, names, notes: $('pdfNotes').value, ideas: $('pdfIdeas').value, project: $('pdfProject').value, border: $('pdfBorder').value,
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
    replace('origCv', cv); applyZoom(cv, st.pixZoom);
    if (st.pixEdit) paintable(cv, () => st.pixHist.push(s.idx.map(r => r.slice())),
      (r, c) => { if (s.idx[r][c] === st.paint) return; s.idx[r][c] = st.paint; fillCell(cv, r, c, s.palette[st.paint]); },
      pixChanged);
    $('pixUndo').disabled = $('pixReset').disabled = !st.pixHist.length; }
  function pixChanged() {
    const s = st.samp; if (st.pixHist.length && JSON.stringify(st.pixHist[st.pixHist.length - 1]) === JSON.stringify(s.idx)) st.pixHist.pop();   // tap that changed nothing
    s.counts = s.palette.map(() => 0); s.idx.forEach(r => r.forEach(v => s.counts[v]++));
    drawOrig(); drawPalette();
    if (st.cands.length && st.pixHist.length) $('pixNote').textContent = 'Picture edited. Press Convert (step 3) to update the chart.'; }
  function drawPixPal() { const box = $('pixPal'); box.innerHTML = '';
    st.samp.palette.forEach((c, i) => { const d = document.createElement('div'); d.className = 'psw' + (i === st.paint ? ' sel' : ''); d.style.background = `rgb(${c})`;
      d.textContent = st.map && st.map[i] ? 'B' : 'A'; d.title = 'Paint with this color'; d.onclick = () => { st.paint = i; drawPixPal(); }; box.appendChild(d); }); }
  $('pixEdit').onclick = () => { st.pixEdit = !st.pixEdit; $('pixEdit').classList.toggle('on', st.pixEdit); $('pixTools').classList.toggle('hidden', !st.pixEdit); drawOrig(); };
  $('pixUndo').onclick = () => { if (!st.pixHist.length) return; st.samp.idx = st.pixHist.pop(); pixChanged(); };
  $('pixReset').onclick = () => { if (!st.pixHist.length) return; st.samp.idx = st.pixHist[0]; st.pixHist = []; pixChanged(); $('pixNote').textContent = 'Pixel edits undone.'; };
  $('pixIn').onclick = () => zoom('pixZoom', 1, drawOrig); $('pixOut').onclick = () => zoom('pixZoom', -1, drawOrig);

  // After converting: edit the finished look; X's are recalculated from it
  const cur = () => st.cands[st.sel];
  const snap = r => ({ F: r.F.map(x => x.slice()), mine: r.mine.map(x => x.slice()), auto: r.auto.map(x => x.slice()) });
  const stRGB = r => (i, c, v) => rowRGB(v === M.color(i + 1) ? i + 1 : i + 2);
  function drawSt() {
    const r = cur(), H = r.F.length, pr = M.problemCells(r.F), get = stRGB(r);
    const cv = Rn.drawEdit(r.F, { cell: Math.max(6, Math.min(22, Math.floor(560 / Math.max(r.width, H)))), cellRGB: get, bad: pr.bad, mine: r.mine, auto: r.auto });
    replace('stCv', cv); applyZoom(cv, st.stZoom);
    if (st.stEdit) { let val = null;
      paintable(cv, () => { r.hist.push(snap(r)); val = null; },
        (k, c, first) => { const i = H - 1 - k; if (first) val = 1 - r.F[i][c]; if (r.F[i][c] === val) return;
          r.F[i][c] = val; r.mine[i][c] = 1; r.auto[i][c] = 0; fillCell(cv, k, c, get(i, c, val)); },
        () => { const h = r.hist[r.hist.length - 1]; if (h && JSON.stringify(h.F) === JSON.stringify(r.F)) r.hist.pop(); stChanged(); }); }
    const edits = r.mine.flat().reduce((a, b) => a + b, 0);
    $('stUndo').disabled = !r.hist.length; $('stReset').disabled = !r.hist.length; $('stFix').disabled = !pr.n;
    if (!$('stNote').dataset.keep) $('stNote').innerHTML = pr.n
      ? `<b class="warn">✘ ${pr.n} red square${pr.n > 1 ? 's' : ''} can't be worked.</b> In each column, a square that shows the other row's color can't sit right above another one, or in the top row. Tap “Fix around my edits” to adjust the stitches next to them, or keep editing.`
      : (edits ? `<b class="ok">✔ Workable.</b> ${edits} square${edits > 1 ? 's' : ''} edited by hand.` : (st.stEdit ? 'Tap or drag on a square to switch it between A and B.' : ''));
    delete $('stNote').dataset.keep;
  }
  function stChanged(note) { const r = cur(); r.X = M.check(r.F).X; if (note) { $('stNote').innerHTML = note; $('stNote').dataset.keep = 1; } show(); }
  $('stEdit').onclick = () => { st.stEdit = !st.stEdit; $('stEdit').classList.toggle('on', st.stEdit); drawSt(); };
  $('stUndo').onclick = () => { const r = cur(), h = r.hist.pop(); if (!h) return; Object.assign(r, h); stChanged(); };
  $('stReset').onclick = () => { const r = cur(); if (!r.hist.length) return; r.hist.push(snap(r)); r.F = r.F0.map(x => x.slice());
    r.mine = r.F.map(x => x.map(() => 0)); r.auto = r.F.map(x => x.map(() => 0)); stChanged('Back to the original chart. Tap Undo to bring your edits back.'); };
  $('stFix').onclick = () => { const r = cur(), res = M.refix(r.F, r.mine); if (!res) return;
    r.hist.push(snap(r)); r.auto = r.F.map((row, i) => row.map((v, c) => (v !== res.F[i][c] ? 1 : r.auto[i][c]))); res.F.forEach((row, i) => row.forEach((v, c) => { if (v !== r.F[i][c]) r.mine[i][c] = 0; }));
    r.F = res.F;
    stChanged(`<b class="ok">✔ Workable.</b> Adjusted ${res.changed} square${res.changed === 1 ? '' : 's'} (outlined orange)` + (res.lockedChanged ? `, including ${res.lockedChanged} of your own edits that couldn't be worked as drawn.` : '; all your edits were kept.') + ' Tap Undo if you don\'t like it.'); };
  $('stIn').onclick = () => zoom('stZoom', 1, drawSt); $('stOut').onclick = () => zoom('stZoom', -1, drawSt);

  window._mosaicState = st;
})();
