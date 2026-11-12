/* Canvas rendering: Samantha's chart layout, compare grids, and a yarn-style design preview. */
(function (root) {
  'use strict';
  const { color, simulate } = root.Mosaic;
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function drawGrid(G, opts = {}) { // G bottom-up 0/1; hl = mask of added cells
    const cell = opts.cell || 8, H = G.length, W = G[0].length, cv = mk(W * cell, H * cell), g = cv.getContext('2d');
    const A = opts.a || [250, 250, 250], B = opts.b || [25, 25, 25];
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) {
      let col = opts.cellRGB ? opts.cellRGB(i, c, G[i][c]) : (G[i][c] ? B : A); if (opts.hl && opts.hl[i][c]) col = [235, 120, 0];
      g.fillStyle = css(col); g.fillRect(c * cell, (H - 1 - i) * cell, cell, cell);
    }
    if (cell >= 5) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
      for (let c = 0; c <= W; c++) { g.beginPath(); g.moveTo(c * cell + .5, 0); g.lineTo(c * cell + .5, H * cell); g.stroke(); }
      for (let i = 0; i <= H; i++) { g.beginPath(); g.moveTo(0, i * cell + .5); g.lineTo(W * cell, i * cell + .5); g.stroke(); } }
    return cv;
  }
  /* Leaning-stitch symbols like printed patterns: a straight line down the straight dc and a slanted line from each
     leaning stitch's top to the same base, two rows down. xc(c) = column center, top(i) = top edge of row i. */
  function drawGroups(g, G, xc, top, rh, opts = {}) {
    if (!G) return; const H = G.length, lw = opts.lw || Math.max(1.5, rh / 9);
    for (let i = 1; i < H; i++) for (let b = 0; b < G[i].length; b++) { const v = G[i][b]; if (!v) continue;
      const y0 = top(i) + rh * 0.12, y1 = top(i) + rh * 1.9, x = xc(b), legs = [[x, y0]];
      if (v & 1) legs.push([xc(b - 1), y0]); if (v & 2) legs.push([xc(b + 1), y0]);
      for (const [w, c] of [[lw + 2.5, opts.halo || 'rgba(255,255,255,.9)'], [lw, opts.ink || '#1a1a1a']]) {
        g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round';
        for (const [lx, ly] of legs) { g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y1); g.stroke(); } } }
  }
  function gridLines(g, W, H, cell, a) {
    g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 1;
    for (let c = 0; c <= W; c++) { g.beginPath(); g.moveTo(c * cell + .5, 0); g.lineTo(c * cell + .5, H * cell); g.stroke(); }
    for (let i = 0; i <= H; i++) { g.beginPath(); g.moveTo(0, i * cell + .5); g.lineTo(W * cell, i * cell + .5); g.stroke(); }
  }
  function drawTopDown(G, palette, cell, grid) { // original top-down index grid with palette
    const H = G.length, W = G[0].length, cv = mk(W * cell, H * cell), g = cv.getContext('2d');
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) { g.fillStyle = css(palette[G[i][c]]); g.fillRect(c * cell, i * cell, cell, cell); }
    if (grid && cell >= 5) gridLines(g, W, H, cell, 0.18);
    cv._cell = cell; return cv;
  }
  /* Editable view of the finished look F (bottom-up). bad = can't be worked (red), mine = hand-edited (teal dot), auto = changed by the fixer (orange). */
  function drawEdit(F, opts = {}) {
    const cell = opts.cell || 12, H = F.length, W = F[0].length, cv = mk(W * cell, H * cell), g = cv.getContext('2d');
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) { g.fillStyle = css(opts.cellRGB(i, c, F[i][c])); g.fillRect(c * cell, (H - 1 - i) * cell, cell, cell); }
    if (cell >= 5) gridLines(g, W, H, cell, 0.2);
    const lw = Math.max(2, Math.round(cell / 6));
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) {
      const x = c * cell, y = (H - 1 - i) * cell;
      if (opts.auto && opts.auto[i][c]) { g.strokeStyle = '#eb7800'; g.lineWidth = lw; g.strokeRect(x + lw / 2, y + lw / 2, cell - lw, cell - lw); }
      if (opts.bad && opts.bad[i][c]) { g.strokeStyle = '#e0001b'; g.lineWidth = lw; g.strokeRect(x + lw / 2, y + lw / 2, cell - lw, cell - lw); }
      if (opts.mine && opts.mine[i][c]) { g.fillStyle = '#125765'; g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, Math.max(1.5, cell * 0.16), 0, 2 * Math.PI); g.fill(); g.stroke(); }
    }
    drawGroups(g, opts.groups, c => c * cell + cell / 2, i => (H - 1 - i) * cell, cell);
    cv._cell = cell; cv._H = H; return cv;
  }

  function drawChart(F, X, opts = {}) {
    const cell = opts.cell || 22, H = F.length, W = F[0].length, n = W + 2, SW = Math.round(cell * 0.8), L = 2.6 * cell + SW, top = 1.4 * cell;
    const A = opts.a || [250, 250, 250], B = opts.b || [25, 25, 25], rowRGB = opts.rowRGB || (r => (color(r) ? B : A));
    const legend = opts.legend || [], legH = legend.length ? (legend.length + 1.5) * cell * 0.8 : 0;
    const cv = mk(Math.round(2 * L - SW + n * cell), Math.round(top + (H + 1) * cell + 2.6 * cell + legH)), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    const inkFor = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 140 ? '#fff' : '#000');
    cv._geo = { top, cell, H, stripX: 2, stripW: SW };
    for (let r = 0; r <= H; r++) { const y = top + (H - r) * cell; // yarn strip (row 0 = chain, A yarn of row 1)
      g.fillStyle = css(rowRGB(r === 0 ? 1 : r)); g.fillRect(2, y + 1, SW - 4, cell - 2); g.strokeStyle = '#888'; g.strokeRect(2.5, y + 1.5, SW - 5, cell - 3);
      if (opts.selRow === r) { g.strokeStyle = '#c8102e'; g.lineWidth = 3; g.strokeRect(1.5, y + .5, SW - 3, cell - 1); g.lineWidth = 1; } }
    const small = `${Math.round(cell * 0.42)}px sans-serif`, bold = `bold ${Math.round(cell * 0.55)}px sans-serif`;
    g.textBaseline = 'middle';
    const label = (r, y, ab) => {
      const Lr = L - SW;
      g.fillStyle = '#000'; g.font = small; g.textAlign = 'right'; g.fillText(String(r), SW + Lr * 0.45, y + cell / 2);
      g.font = bold; g.textAlign = 'center'; g.fillText(ab, SW + Lr * 0.75, y + cell / 2);
      const x = L + n * cell; g.fillText(ab, x + Lr * 0.25, y + cell / 2); g.font = small; g.textAlign = 'left'; g.fillText(String(r), x + Lr * 0.55, y + cell / 2);
    };
    for (let i = 0; i < H; i++) {
      const r = i + 1, y = top + (H - 1 - i) * cell, rc = color(r), rowFill = rowRGB(r);
      for (let k = 0; k < n; k++) {
        const fill = opts.stitchRGB && k > 0 && k < n - 1 ? opts.stitchRGB(i, k - 1) || rowFill : rowFill, ink = inkFor(fill);
        const x = L + k * cell; g.fillStyle = css(fill); g.fillRect(x, y, cell, cell);
        g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, cell, cell);
        if (k === 0 || k === n - 1) { g.fillStyle = ink; g.font = small; g.textAlign = 'center'; g.fillText('BS', x + cell / 2, y + cell / 2); }
        else if (X[i][k - 1] && !(opts.groups && opts.groups[i][k - 1])) { g.strokeStyle = ink; g.lineWidth = Math.max(1.5, cell / 12); const p = cell * 0.22;
          g.beginPath(); g.moveTo(x + p, y + p); g.lineTo(x + cell - p, y + cell - p); g.moveTo(x + cell - p, y + p); g.lineTo(x + p, y + cell - p); g.stroke(); }
      }
      label(r, y, (rc ? 'B' : 'A') + (opts.carry ? opts.carry(r) : ''));
    }
    drawGroups(g, opts.groups, c => L + (c + 1) * cell + cell / 2, i => top + (H - 1 - i) * cell, cell, { lw: Math.max(1.5, cell / 12) });
    const y0 = top + H * cell;
    for (let k = 0; k < n; k++) { const x = L + k * cell; g.strokeStyle = '#000'; g.lineWidth = Math.max(1.2, cell / 14);
      g.beginPath(); g.ellipse(x + cell / 2, y0 + cell / 2, cell * 0.36, cell * 0.2, 0, 0, 2 * Math.PI); g.stroke(); }
    label(0, y0, 'A');
    g.font = small; g.textAlign = 'center'; g.fillStyle = '#000';
    for (let k = 0; k < n; k++) { const num = String(n - k), x = L + k * cell + cell / 2; g.fillText(num, x, top - cell * 0.45); g.fillText(num, x, y0 + cell * 1.45); }
    g.textAlign = 'left'; g.fillText('Row 0 = foundation chain (A). Work bottom up, every row RIGHT to LEFT.', L, y0 + cell * 2.05);
    g.fillText('X = dc in front 2 rows down. BS = border stitch.' + (opts.stitchRGB ? ' A shaded square is worked in that carried strand (C / D).' : '')
      + (opts.groups && opts.groups.some(r => r.some(v => v)) ? ' Slanted line = a dc leaning into the straight one beside it (same stitch 2 rows down).' : ''), L, y0 + cell * 2.55);
    if (legend.length) { let y = y0 + cell * 3.2; g.font = bold; g.fillText('Color key', L, y); y += cell * 0.8; g.font = small;
      for (const e of legend) { g.fillStyle = css(e.rgb); g.fillRect(L, y - cell * 0.3, cell * 0.9, cell * 0.6); g.strokeStyle = '#666'; g.strokeRect(L + .5, y - cell * 0.3 + .5, cell * 0.9, cell * 0.6);
        g.fillStyle = '#000'; g.fillText(e.text || `${e.hex.toUpperCase()}  ·  ${e.yarn} rows ${e.from}–${e.to}`, L + cell * 1.2, y); y += cell * 0.8; } }
    return cv;
  }

  function drawPreview(X, opts = {}) {
    const H = X.length, W = X[0].length, n = W + 2, cw = opts.cw || 28, rh = opts.rh || 25, pad = 30;
    const Fab = simulate(X), cv = mk(n * cw + 2 * pad, (H + 1) * rh + 2 * pad), g = cv.getContext('2d');
    let s = 7; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const yarn = [opts.a || [238, 232, 220], opts.b || [34, 34, 38]], rowRGB = opts.rowRGB || (r => yarn[color(r)]), sh = (c, f) => css(c.map(v => Math.max(0, Math.min(255, v * f))));
    g.fillStyle = '#cdc4b6'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = sh(yarn[0], .8); g.beginPath(); g.roundRect(pad - 8, pad - 8, n * cw + 16, (H + 1) * rh + 16, 12); g.fill();
    const X0 = k => pad + k * cw, Y0 = i => pad + (H - 1 - i) * rh;
    const loop = (x, y, w, h, c) => {
      for (const side of [-1, 1]) for (const [k, f] of [[0, .6], [1, .85], [2, 1.08]]) {
        const ins = k * 1.5, j = () => (R() - .5) * 2;
        const ax = x + (side > 0 ? w / 2 : 0) + ins / 2 + j(), bx = x + (side > 0 ? w : w / 2) - ins / 2 + j();
        g.fillStyle = sh(c, f + (R() - .5) * .1); g.beginPath();
        g.ellipse((ax + bx) / 2, y + h / 2, Math.max(1, (bx - ax) / 2), Math.max(1, (h - 2 * ins) / 2), side * 0.12, 0, 2 * Math.PI); g.fill();
      }
      g.strokeStyle = sh(c, .5); g.lineWidth = 1; g.beginPath(); g.moveTo(x + w / 2, y + 2); g.lineTo(x + w / 2, y + h - 2); g.stroke();
    };
    const stitch = (i, col) => (opts.stitchRGB && col >= 0 && col < W && opts.stitchRGB(i, col)) || rowRGB(i + 1);
    for (let i = 0; i < H; i++) for (let k = 0; k < n; k++) { const col = k - 1, cov = col >= 0 && col < W && i + 1 < H && X[i + 1][col];
      g.fillStyle = sh(cov ? stitch(i + 1, col) : stitch(i, col), .55); g.fillRect(X0(k), Y0(i), cw, rh); }
    for (let k = 0; k < n; k++) loop(X0(k) + 2, pad + H * rh + 4, cw - 4, rh - 8, rowRGB(1));
    for (let i = 0; i < H; i++) {
      const c = rowRGB(i + 1);
      const lean = col => (opts.lean && col >= 0 && col < W ? opts.lean(i, col) : 0), leaning = [];
      for (let k = 0; k < n; k++) { const col = k - 1, x = X0(k), y = Y0(i), sc = stitch(i, col);
        if (lean(col)) { leaning.push(k); continue; }
        if (col >= 0 && col < W && X[i][col]) loop(x + .5, y, cw - 1, rh * 2, sc); else loop(x + .5, y + .5, cw - 1, rh - 1, sc); }
      // leaning dc: a long stitch slanting from its own top down to the next stitch's base, drawn on top
      for (const k of leaning) { const col = k - 1, y = Y0(i), sk = lean(col) * cw * 0.9 / (rh * 2);
        g.save(); g.transform(1, 0, sk, 1, -sk * y, 0); loop(X0(k) + .5, y, cw - 1, rh * 2, stitch(i, col)); g.restore(); }
      g.strokeStyle = sh(c, .45); g.lineWidth = 1; g.beginPath(); g.moveTo(X0(0), Y0(i) + rh - 1); g.lineTo(X0(n), Y0(i) + rh - 1); g.stroke();
    }
    const grd = g.createRadialGradient(cv.width * .4, cv.height * .35, 10, cv.width * .5, cv.height * .5, Math.max(cv.width, cv.height) * .75);
    grd.addColorStop(0, 'rgba(255,255,255,0.06)'); grd.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
    if (!opts.noLabel) { g.fillStyle = 'rgba(80,74,66,.85)'; g.font = '13px sans-serif'; g.textAlign = 'right'; g.fillText('Design preview', cv.width - 10, cv.height - 10); }
    return cv;
  }
  /* The uploaded image with the grid the app read: lines between cells, a dot where each cell's color was sampled. */
  function drawGridCheck(img, xs, ys, maxW) {
    const k = Math.min(maxW / img.width, 600 / img.height, 12), cv = mk(Math.round(img.width * k), Math.round(img.height * k)), g = cv.getContext('2d');
    const src = mk(img.width, img.height); src.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, cv.width, cv.height);
    const edges = cs => { const step = cs.length > 1 ? cs[1] - cs[0] : 10, out = [cs[0] - step / 2];
      for (let i = 0; i + 1 < cs.length; i++) out.push((cs[i] + cs[i + 1]) / 2); out.push(cs[cs.length - 1] + step / 2); return out; };
    const ex = edges(xs), ey = edges(ys), x0 = ex[0] * k, x1 = ex[ex.length - 1] * k, y0 = ey[0] * k, y1 = ey[ey.length - 1] * k;
    const line = (ax, ay, bx, by) => { for (const [w, c] of [[3, 'rgba(255,255,255,.85)'], [1, '#e0007a']]) { g.lineWidth = w; g.strokeStyle = c; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); } };
    ex.forEach(x => line(x * k, y0, x * k, y1)); ey.forEach(y => line(x0, y * k, x1, y * k));
    if (Math.min(cv.width / xs.length, cv.height / ys.length) >= 8) { g.fillStyle = '#e0007a';
      for (const y of ys) for (const x of xs) { g.beginPath(); g.arc(x * k, y * k, 1.6, 0, 2 * Math.PI); g.fill(); } }
    return cv;
  }
  /* Marks over a top-down picture canvas: red outlines (trouble), teal dots (keep exactly). */
  function markCells(cv, cells, kind) {
    const g = cv.getContext('2d'), k = cv._cell, lw = Math.max(2, Math.round(k / 6));
    cells.forEach((row, r) => row.forEach((v, c) => { if (!v) return; const x = c * k, y = r * k;
      if (kind === 'bad') { g.strokeStyle = '#fff'; g.lineWidth = lw + 2; g.strokeRect(x + lw / 2, y + lw / 2, k - lw, k - lw); g.strokeStyle = '#e0001b'; g.lineWidth = lw; g.strokeRect(x + lw / 2, y + lw / 2, k - lw, k - lw); }
      else { g.fillStyle = '#125765'; g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(x + k / 2, y + k / 2, Math.max(1.5, k * 0.18), 0, 2 * Math.PI); g.fill(); g.stroke(); } }));
  }
  root.MosaicRender = { drawGroups, drawGridCheck, markCells, drawGrid, drawTopDown, drawEdit, drawChart, drawPreview };
})(window);
