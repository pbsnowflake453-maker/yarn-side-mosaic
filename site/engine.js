/* Overlay mosaic crochet engine (port of mosaic.py / fixer2.py / mono.py). Works in browser and Node.
   Grids are arrays of rows. "Top-down" grids come from images; mosaic grids T/F/X are BOTTOM-UP (index 0 = row 1).
   Rows alternate: odd rows A (0, background), even rows B (1). Row 0 = foundation chain (A).
   A cell showing the opposite of its row color is a "mismatch"; it needs an X (dc worked 2 rows down) directly above it.
   Workable iff no two vertically adjacent mismatches in a column and no mismatch in the top row. */
(function (root) {
  'use strict';
  const color = r => (r % 2 === 1 ? 0 : 1);
  const zeros = (h, w) => Array.from({ length: h }, () => new Array(w).fill(0));
  const clone = G => G.map(r => r.slice());

  function check(T) {
    const H = T.length, W = T[0].length, X = zeros(H, W), bad = [];
    for (let i = 0; i < H; i++) for (let c = W - 1; c >= 0; c--) {
      if (T[i][c] !== color(i + 1)) {
        if (i + 1 >= H) bad.push([i + 1, c, 'top row cannot be covered']); else X[i + 1][c] = 1;
      }
    }
    for (let i = 1; i < H; i++) for (let c = 0; c < W; c++) if (X[i][c] && X[i - 1][c]) bad.push([i + 1, c, 'X stacked on X']);
    return { X, bad };
  }
  function simulate(X) {
    const H = X.length, W = X[0].length, F = zeros(H, W);
    for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) F[i][c] = (i + 1 < H && X[i + 1][c]) ? color(i + 2) : color(i + 1);
    return F;
  }
  function stretchRows(motif, mults, bottom, side = 1) {
    const W = motif[0].length, rows = [];
    for (let k = motif.length - 1; k >= 0; k--) for (let m = 0; m < mults[k]; m++) rows.push(motif[k].slice());
    let T = [];
    for (let b = 0; b < bottom; b++) T.push(new Array(W).fill(0));
    T = T.concat(rows);
    if (T.length % 2 === 0) T.push(new Array(W).fill(0));
    return T.map(r => new Array(side).fill(0).concat(r, new Array(side).fill(0)));
  }
  function cellCost(T, i, c, v, P, lock) {
    if (T[i][c] === v) return 0;
    if (lock && lock[i][c]) return 40;   // a cell the designer edited by hand: change only as a last resort
    if (T[i][c] === 1) return P && P[i][c] ? 8 : 5;
    const H = T.length, W = T[0].length, at = (a, d) => (a >= 0 && a < H && d >= 0 && d < W) ? T[a][d] : 0;
    const nb = at(i + 1, c) + at(i - 1, c) + at(i, c + 1) + at(i, c - 1);
    if ((at(i, c - 1) && at(i, c + 1)) || (at(i - 1, c) && at(i + 1, c))) return 2.5; // merge cost
    return nb ? 1 : 3;
  }
  /* E = extra-strand mask (0 none, 1 = C, 2 = D): those cells are worked as an sc in the extra strand, so they must
     show their own row (no dc from above) and the cell under them must not need a dc (that dc would be the extra cell's stitch). */
  function columnDP(T, c, P, lock, E) {
    const H = T.length; let best = new Map([[false, { cost: 0, path: [] }]]);
    for (let i = 0; i < H; i++) {
      const r = i + 1, nxt = new Map();
      for (const [pm, st] of best) for (const v of [T[i][c], 1 - T[i][c]]) {
        const m = v !== color(r);
        if (m && pm) continue; if (m && i === H - 1) continue;
        if (E && E[i][c] && (m || pm)) continue;
        const k = st.cost + cellCost(T, i, c, v, P, lock);
        if (!nxt.has(m) || k < nxt.get(m).cost) nxt.set(m, { cost: k, path: st.path.concat([v]) });
      }
      best = nxt;
    }
    if (!best.size) return null;
    let out = null; for (const st of best.values()) if (!out || st.cost < out.cost) out = st;
    return out;
  }
  function components(G) {
    const H = G.length, W = G[0].length, seen = zeros(H, W); let n = 0;
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) if (G[i][j] && !seen[i][j]) {
      n++; const st = [[i, j]]; seen[i][j] = 1;
      while (st.length) { const [a, b] = st.pop();
        for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const x = a + da, y = b + db;
          if (x >= 0 && x < H && y >= 0 && y < W && G[x][y] && !seen[x][y]) { seen[x][y] = 1; st.push([x, y]); } } }
    }
    return n;
  }
  function solve(motif, mults, bottom, protect, lock, extra) {
    const T = stretchRows(motif, mults, bottom), P = stretchRows(protect || motif.map(r => r.map(() => 0)), mults, bottom);
    const L = lock ? stretchRows(lock, mults, bottom) : null;   // "keep exactly" squares, stretched like the motif
    const E = extra ? stretchRows(extra, mults, bottom) : null;
    if (E) E.forEach((row, i) => row.forEach((v, c) => { if (v) T[i][c] = color(i + 1); }));   // extra-strand squares sit in their own row
    const F = clone(T); let total = 0;
    for (let c = T[0].length - 1; c >= 0; c--) {
      const res = columnDP(T, c, P, L, E); if (!res) return null;
      total += res.cost; for (let i = 0; i < T.length; i++) F[i][c] = res.path[i];
    }
    total += 10 * Math.abs(components(F) - components(T));
    return { cost: total, T, F, L, E, mults, bottom };
  }
  function score(res, h) {
    const rows = res.mults.reduce((a, b) => a + b, 0), aspect = Math.abs(rows / h - 1);
    return res.cost + 0.25 * (rows - h) + 6 * aspect;
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  /* Candidates: no-stretch (bottom 0/1) + limited local search over row repeats (1..maxMult). */
  function findFixes(motif, opts = {}) {
    const h = motif.length, maxMult = opts.maxMult || 2, budget = opts.budget || (h > 60 ? 150 : 600), R = rng(opts.seed || 1);
    const maxAspect = opts.maxAspect == null ? 0.2 : opts.maxAspect, seen = new Map();
    const ev = (m, b) => { const key = m.join(',') + '|' + b; if (!seen.has(key)) { const r = solve(motif, m, b, null, opts.lock, opts.extra); if (r) r.score = score(r, h); seen.set(key, r); } return seen.get(key); };
    const ones = new Array(h).fill(1);
    for (const b of [0, 1]) ev(ones, b);
    if (opts.stretch !== false) for (const b of [0, 1]) {
      let cur = ones.slice(), cs = (ev(cur, b) || { score: 1e9 }).score;
      for (let t = 0; t < budget / 2; t++) {
        const cand = cur.slice(); cand[Math.floor(R() * h)] = 1 + Math.floor(R() * maxMult);
        if (R() < 0.3) cand[Math.floor(R() * h)] = 1 + Math.floor(R() * maxMult);
        const rows = cand.reduce((a, c) => a + c, 0); if (Math.abs(rows / h - 1) > maxAspect) continue;
        const r = ev(cand, b); if (r && r.score <= cs) { cur = cand; cs = r.score; }
      }
    }
    const all = [...seen.values()].filter(Boolean).sort((a, b) => a.score - b.score), out = [];
    for (const r of all) { if (out.some(o => o.F.length === r.F.length && JSON.stringify(o.F) === JSON.stringify(r.F))) continue; out.push(r); if (out.length >= (opts.keep || 3)) break; }
    for (const r of out) {
      const { X, bad } = check(r.F); r.X = X; r.valid = !bad.length;
      const S = simulate(X); r.simOK = JSON.stringify(S) === JSON.stringify(r.F);
      let add = 0, rem = 0; r.T.forEach((row, i) => row.forEach((v, c) => { if (v !== r.F[i][c]) v ? rem++ : add++; }));
      r.added = add; r.removed = rem; r.rows = r.F.length; r.width = r.F[0].length;
      r.stretched = r.mults.some(m => m > 1);
      r.lockedChanged = 0; if (r.L) r.L.forEach((row, i) => row.forEach((v, c) => { if (v && r.T[i][c] !== r.F[i][c]) r.lockedChanged++; }));
    }
    return out;
  }
  function crop(G) { // top-down 0/1 grid -> bbox of 1s
    let y0 = G.length, y1 = -1, x0 = G[0].length, x1 = -1;
    G.forEach((r, i) => r.forEach((v, j) => { if (v) { y0 = Math.min(y0, i); y1 = Math.max(y1, i); x0 = Math.min(x0, j); x1 = Math.max(x1, j); } }));
    if (y1 < 0) return G; return G.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1));
  }
  function scale(G, k) { const out = []; for (const r of G) { const row = []; for (const v of r) for (let j = 0; j < k; j++) row.push(v); for (let j = 0; j < k; j++) out.push(row.slice()); } return out; }

  /* ---------- palette / mono ---------- */
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  function autoSplit(idx, palette, bgIndex) {
    const n = palette.length, dark = palette.reduce((b, c, i) => lum(c) < lum(palette[b]) ? i : b, 0);
    const free = [...Array(n).keys()].filter(i => i !== bgIndex && i !== dark), pairs = [];
    const H = idx.length, W = idx[0].length; let cells = H * W;
    for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
      if (j + 1 < W && idx[i][j] !== idx[i][j + 1]) pairs.push([idx[i][j], idx[i][j + 1]]);
      if (i + 1 < H && idx[i][j] !== idx[i + 1][j]) pairs.push([idx[i][j], idx[i + 1][j]]);
    }
    const counts = new Array(n).fill(0); idx.forEach(r => r.forEach(v => counts[v]++));
    let best = null;
    for (let mask = 0; mask < (1 << free.length); mask++) {
      const m = new Array(n).fill(0); m[dark] = 1; m[bgIndex] = 0; free.forEach((f, k) => m[f] = (mask >> k) & 1);
      const kept = pairs.length ? pairs.filter(([a, b]) => m[a] !== m[b]).length / pairs.length : 0;
      const cov = counts.reduce((s, c, i) => s + c * m[i], 0) / cells, s = kept - 0.5 * Math.abs(cov - 0.45);
      if (!best || s > best.s) best = { s, m };
    }
    return best.m;
  }
  function thresholdMap(palette, t = 128) { return palette.map(c => lum(c) < t ? 1 : 0); }

  /* ---------- grid detection from RGBA ImageData-like {width,height,data} ---------- */
  function detectGrid(img) {
    const { width: W, height: H, data } = img, px = (x, y) => { const o = (y * W + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const isGray = c => { const mx = Math.max(...c), mn = Math.min(...c); return mx - mn < 25 && mx > 80 && mx < 235; };
    // background = most common border color (coarse bins)
    const bins = new Map(); for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) { const c = px(x, y), k = c.map(v => v >> 4).join(); bins.set(k, (bins.get(k) || 0) + 1); }
    for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) { const c = px(x, y), k = c.map(v => v >> 4).join(); bins.set(k, (bins.get(k) || 0) + 1); }
    const bgKey = [...bins.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(v => v * 16 + 8);
    // gridlines?
    const colFrac = new Array(W).fill(0), rowFrac = new Array(H).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isGray(px(x, y))) { colFrac[x]++; rowFrac[y]++; }
    const lines = (frac, len) => { const ls = []; let s = -1; frac.forEach((v, i) => { if (v / len > 0.4) { if (s < 0) s = i; } else if (s >= 0) { ls.push((s + i - 1) / 2); s = -1; } }); if (s >= 0) ls.push((s + frac.length - 1) / 2); return ls; };
    const lx = lines(colFrac, H), ly = lines(rowFrac, W);
    const median = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    let xs, ys, mode;
    const regular = ls => { if (ls.length < 5) return null; const d = ls.slice(1).map((v, i) => v - ls[i]), p = median(d);
      const ok = d.filter(v => Math.abs(v - p) < 0.25 * p).length / d.length; return ok > 0.8 ? p : null; };
    const pxg = regular(lx), pyg = regular(ly);
    // content bbox (non-background, non-gridline)
    let bx0 = W, bx1 = -1, by0 = H, by1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = px(x, y); if (dist(c, bgKey) > 70 && !isGray(c)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); } }
    if (pxg && pyg) {
      mode = 'gridlines';
      const cells = (ls, p) => { // fit a regular lattice (robust to lines hidden under filled cells)
        const d = ls.slice(1).map((v, i) => v - ls[i]).filter(v => Math.abs(v - p) < 0.25 * p), pp = d.reduce((a, b) => a + b, 0) / d.length;
        const off = median(ls.map(v => ((v % pp) + pp) % pp)), out = [];
        const pairs = []; for (let i = 0; i + 1 < ls.length; i++) if (Math.abs(ls[i + 1] - ls[i] - p) < 0.3 * p) pairs.push((ls[i] + ls[i + 1]) / 2);
        // span of regular cells (fill hidden lines inside it), plus one cell past the outermost line on each side:
        // art that runs to the edge of the image often has no grid line along that edge
        const lo = pairs[0] - pp / 2 - 1 - pp, hi = pairs[pairs.length - 1] + pp / 2 + 1 + pp;
        for (let x = off; x + pp <= hi; x += pp) if (x >= lo) out.push(x + pp / 2); return out; };
      xs = cells(lx, pxg).filter(x => x >= bx0 && x <= bx1); ys = cells(ly, pyg).filter(y => y >= by0 && y <= by1);
    } else {
      mode = 'no gridlines';
      const fit = (lo, hi, edgeAt) => { // edges = positions with strong color change
        const len = hi - lo + 1, e = []; const strength = [];
        for (let t = lo + 1; t <= hi; t++) strength.push([t, edgeAt(t)]);
        // a soft edge spans ~2px: keep the local maximum of each run
        for (let q = 0; q < strength.length; q++) { const l = q ? strength[q-1][1] : 0, r = q + 1 < strength.length ? strength[q+1][1] : 0; if (strength[q][1] < l || strength[q][1] < r) strength[q] = [strength[q][0], 0]; }
        const mx = Math.max(...strength.map(s => s[1])); strength.forEach(([t, s]) => { if (s > 0.15 * mx) e.push(t - lo - 1); });
        for (let n = 1; n <= 300; n++) { const p = len / n; if (p < 3) break;
          const err = e.reduce((s, v) => { const f = v / p; return s + Math.abs(f - Math.round(f)); }, 0) / Math.max(1, e.length);
          if (err < 0.08) return n; }
        return Math.round(len / 10);
      };
      const nx = fit(bx0, bx1, x => { let s = 0; for (let y = by0; y <= by1; y += 2) if (dist(px(x, y), px(Math.max(0, x - 2), y)) > 100) s++; return s; });
      const ny = fit(by0, by1, y => { let s = 0; for (let x = bx0; x <= bx1; x += 2) if (dist(px(x, y), px(x, Math.max(0, y - 2))) > 100) s++; return s; });
      xs = [...Array(nx).keys()].map(k => bx0 + (bx1 - bx0 + 1) * (k + 0.5) / nx); ys = [...Array(ny).keys()].map(k => by0 + (by1 - by0 + 1) * (k + 0.5) / ny);
    }
    return { mode, bbox: [bx0, by0, bx1, by1], xs, ys, bg: bgKey, sample: (nx, ny) => sampleGrid(img, bx0, by0, bx1, by1, nx, ny, xs, ys, nx == null) };
  }
  function sampleGrid(img, bx0, by0, bx1, by1, nx, ny, xs0, ys0, useDetected) {
    const { width: W, data } = img;
    const xs = useDetected ? xs0 : [...Array(nx).keys()].map(k => bx0 + (bx1 - bx0 + 1) * (k + 0.5) / nx);
    const ys = useDetected ? ys0 : [...Array(ny).keys()].map(k => by0 + (by1 - by0 + 1) * (k + 0.5) / ny);
    const cw = xs.length > 1 ? xs[1] - xs[0] : 10, ch = ys.length > 1 ? ys[1] - ys[0] : 10;
    const cols = ys.map(y => xs.map(x => { let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -0.15; dy <= 0.15; dy += 0.075) for (let dx = -0.15; dx <= 0.15; dx += 0.075) {
        const X = Math.min(W - 1, Math.max(0, Math.round(x + dx * cw))), Y = Math.min(img.height - 1, Math.max(0, Math.round(y + dy * ch))), o = (Y * W + X) * 4; r += data[o]; g += data[o + 1]; b += data[o + 2]; n++; }
      return [r / n, g / n, b / n]; }));
    // cluster colors
    const palette = [], counts = [], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const idx = cols.map(row => row.map(c => { let k = palette.findIndex(p => dist(p, c) < 32);
      if (k < 0) { palette.push(c.slice()); counts.push(0); k = palette.length - 1; } counts[k]++; return k; }));
    return { idx, palette: palette.map(p => p.map(Math.round)), counts, nx: xs.length, ny: ys.length, xs, ys };
  }

  /* Cells (bottom-up F) that can't be worked: a mismatch in the top row, or two mismatches stacked in a column. */
  function problemCells(F) {
    const H = F.length, W = F[0].length, bad = zeros(H, W); let n = 0, spots = 0;   // n = squares, spots = conflicts
    const mis = (i, c) => F[i][c] !== color(i + 1);
    for (let c = 0; c < W; c++) for (let i = 0; i < H; i++) if (mis(i, c)) {
      if (i === H - 1) { spots++; if (!bad[i][c]) n++; bad[i][c] = 1; }
      if (i > 0 && mis(i - 1, c)) { if (!(bad[i - 1][c] && i > 1 && mis(i - 2, c) && bad[i - 2][c])) spots++; if (!bad[i][c]) n++; if (!bad[i - 1][c]) n++; bad[i][c] = bad[i - 1][c] = 1; }
    }
    return { bad, n, spots };
  }
  /* Make a hand-edited chart workable with the fewest changes, keeping locked (hand-edited) cells if at all possible. */
  function refix(F, lock) {
    const out = clone(F);
    for (let c = 0; c < F[0].length; c++) { const res = columnDP(F, c, null, lock); if (!res) return null; for (let i = 0; i < F.length; i++) out[i][c] = res.path[i]; }
    const { X, bad } = check(out); let changed = 0, lockedChanged = 0;
    out.forEach((row, i) => row.forEach((v, c) => { if (v !== F[i][c]) { changed++; if (lock && lock[i][c]) lockedChanged++; } }));
    return { F: out, X, valid: !bad.length, changed, lockedChanged };
  }

  root.Mosaic = { problemCells, refix, color, check, simulate, stretchRows, solve, findFixes, components, crop, scale, autoSplit, thresholdMap, detectGrid, lum };
  if (typeof module !== 'undefined') module.exports = root.Mosaic;
})(typeof window !== 'undefined' ? window : globalThis);
