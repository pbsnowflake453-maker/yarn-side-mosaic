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
  function drawTopDown(G, palette, cell) { // original top-down index grid with palette
    const H = G.length, W = G[0].length, cv = mk(W * cell, H * cell), g = cv.getContext('2d');
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) { g.fillStyle = css(palette[G[i][c]]); g.fillRect(c * cell, i * cell, cell, cell); }
    return cv;
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
      const r = i + 1, y = top + (H - 1 - i) * cell, rc = color(r), fill = rowRGB(r), ink = inkFor(fill);
      for (let k = 0; k < n; k++) {
        const x = L + k * cell; g.fillStyle = css(fill); g.fillRect(x, y, cell, cell);
        g.strokeStyle = '#999'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, cell, cell);
        if (k === 0 || k === n - 1) { g.fillStyle = ink; g.font = small; g.textAlign = 'center'; g.fillText('BS', x + cell / 2, y + cell / 2); }
        else if (X[i][k - 1]) { g.strokeStyle = ink; g.lineWidth = Math.max(1.5, cell / 12); const p = cell * 0.22;
          g.beginPath(); g.moveTo(x + p, y + p); g.lineTo(x + cell - p, y + cell - p); g.moveTo(x + cell - p, y + p); g.lineTo(x + p, y + cell - p); g.stroke(); }
      }
      label(r, y, rc ? 'B' : 'A');
    }
    const y0 = top + H * cell;
    for (let k = 0; k < n; k++) { const x = L + k * cell; g.strokeStyle = '#000'; g.lineWidth = Math.max(1.2, cell / 14);
      g.beginPath(); g.ellipse(x + cell / 2, y0 + cell / 2, cell * 0.36, cell * 0.2, 0, 0, 2 * Math.PI); g.stroke(); }
    label(0, y0, 'A');
    g.font = small; g.textAlign = 'center'; g.fillStyle = '#000';
    for (let k = 0; k < n; k++) { const num = String(n - k), x = L + k * cell + cell / 2; g.fillText(num, x, top - cell * 0.45); g.fillText(num, x, y0 + cell * 1.45); }
    g.textAlign = 'left'; g.fillText('Row 0 = foundation chain (A). Work bottom up, every row RIGHT to LEFT.', L, y0 + cell * 2.05);
    g.fillText('X = dc in front 2 rows down. BS = border stitch.', L, y0 + cell * 2.55);
    if (legend.length) { let y = y0 + cell * 3.2; g.font = bold; g.fillText('Color key', L, y); y += cell * 0.8; g.font = small;
      for (const e of legend) { g.fillStyle = css(e.rgb); g.fillRect(L, y - cell * 0.3, cell * 0.9, cell * 0.6); g.strokeStyle = '#666'; g.strokeRect(L + .5, y - cell * 0.3 + .5, cell * 0.9, cell * 0.6);
        g.fillStyle = '#000'; g.fillText(`${e.hex.toUpperCase()}  ·  ${e.yarn} rows ${e.from}–${e.to}`, L + cell * 1.2, y); y += cell * 0.8; } }
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
    for (let i = 0; i < H; i++) for (let k = 0; k < n; k++) { const col = k - 1, cov = col >= 0 && col < W && i + 1 < H && X[i + 1][col];
      g.fillStyle = sh(rowRGB(cov ? i + 2 : i + 1), .55); g.fillRect(X0(k), Y0(i), cw, rh); }
    for (let k = 0; k < n; k++) loop(X0(k) + 2, pad + H * rh + 4, cw - 4, rh - 8, rowRGB(1));
    for (let i = 0; i < H; i++) {
      const c = rowRGB(i + 1);
      for (let k = 0; k < n; k++) { const col = k - 1, x = X0(k), y = Y0(i);
        if (col >= 0 && col < W && X[i][col]) loop(x + .5, y, cw - 1, rh * 2, c); else loop(x + .5, y + .5, cw - 1, rh - 1, c); }
      g.strokeStyle = sh(c, .45); g.lineWidth = 1; g.beginPath(); g.moveTo(X0(0), Y0(i) + rh - 1); g.lineTo(X0(n), Y0(i) + rh - 1); g.stroke();
    }
    const grd = g.createRadialGradient(cv.width * .4, cv.height * .35, 10, cv.width * .5, cv.height * .5, Math.max(cv.width, cv.height) * .75);
    grd.addColorStop(0, 'rgba(255,255,255,0.06)'); grd.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
    if (!opts.noLabel) { g.fillStyle = 'rgba(80,74,66,.85)'; g.font = '13px sans-serif'; g.textAlign = 'right'; g.fillText('Design preview', cv.width - 10, cv.height - 10); }
    return cv;
  }
  root.MosaicRender = { drawGrid, drawTopDown, drawChart, drawPreview };
})(window);
