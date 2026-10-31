/* Color bank + per-row yarn changes. Stitch logic is untouched: these only change what color each row's yarn is. */
(function (root) {
  'use strict';
  const { color } = root.Mosaic;
  const hexToRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const STARTERS = ['#ffffff', '#1a1a1a', '#c8102e', '#f28c28', '#f6c90e', '#2e8b57', '#1f5fbf', '#7b3fa0'];
  const KEY = 'mosaicColorBank';
  const loadBank = () => { try { const b = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(b) && b.length) return b; } catch (e) {} return STARTERS.slice(); };
  const saveBank = b => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} };
  const validHex = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h.trim());
  const normHex = h => { h = h.trim().toLowerCase(); if (!h.startsWith('#')) h = '#' + h; if (h.length === 4) h = '#' + h.slice(1).split('').map(c => c + c).join(''); return h; };

  /* plan = { A: [{row, hex}], B: [{row, hex}] } sorted by row; first entry is row 1 (A) / row 2 (B). */
  const defaultPlan = () => ({ A: [{ row: 1, hex: '#ffffff' }], B: [{ row: 2, hex: '#1a1a1a' }] });
  const yarnOf = r => (color(r) ? 'B' : 'A');
  function hexAt(plan, r) { const list = plan[yarnOf(r)]; let h = list[0].hex; for (const e of list) if (e.row <= r) h = e.hex; return h; }
  const xCount = (X, r) => (r >= 1 && r <= X.length ? X[r - 1].reduce((a, b) => a + b, 0) : 0);
  /* Add a change: from row r upward the yarn of row r becomes hex. Snaps to a clean spot:
     - the new color (and the color before it) must each last >= 3 rows of that yarn (every other row = 6 chart rows)
     - prefer a row with no X's (its dc's would drop into the old shade 2 rows below), else the fewest X's nearby. */
  function addChange(plan, X, r, hex) {
    const H = X.length, y = yarnOf(r), list = plan[y].map(e => ({ ...e })), first = list[0].row;
    if (r <= first) { list[0].hex = hex; plan = { ...plan, [y]: list }; return { plan, note: '' }; }
    const others = list.filter(e => e.row !== r), prev = others.filter(e => e.row < r).pop(), next = others.find(e => e.row > r);
    const lo = (prev ? prev.row : first) + 6, hi = Math.min(next ? next.row - 6 : Infinity, H - 4);
    if (lo > hi) return { plan, note: `No room for a new ${y} color here: each color needs at least 3 rows of its own.` };
    let start = Math.min(Math.max(r, lo), hi); if ((start - r) % 2) start++;
    let best = null;   // first clean row (no X) within 3 rows of this yarn, else the fewest-X row within 2
    for (let q = start; q <= Math.min(hi, start + 6); q += 2) if (xCount(X, q) === 0) { best = { q, k: 0 }; break; }
    if (!best) for (let q = start; q <= Math.min(hi, start + 4); q += 2) { const k = xCount(X, q); if (!best || k < best.k) best = { q, k }; }
    let note = '';
    if (best.q !== r) note = `Moved to row ${best.q} (from ${r}): ` + (r < lo || r > hi ? 'each color needs at least 3 rows of its own' : (best.k ? `row ${best.q} has the fewest X's nearby (${best.k}) dropping into the old shade` : `row ${best.q} has no X's, so no dropped stitch reaches into the old shade`)) + '.';
    else if (best.k) note = `Row ${r} has ${best.k} X's dropping into the previous shade (no cleaner row nearby).`;
    const out = others.concat([{ row: best.q, hex }]).sort((a, b) => a.row - b.row);
    const dedup = out.filter((e, i) => i === 0 || e.hex !== out[i - 1].hex);   // drop no-op changes
    return { plan: { ...plan, [y]: dedup }, note };
  }
  function legend(plan, H) {
    const out = [];
    for (const y of ['A', 'B']) plan[y].forEach((e, i) => { const nx = plan[y][i + 1]; let to = nx ? nx.row - 2 : H; if (yarnOf(to) !== y) to--; out.push({ yarn: y, hex: e.hex, rgb: hexToRgb(e.hex), from: e.row, to }); });
    return out;
  }
  root.MosaicColors = { STARTERS, loadBank, saveBank, validHex, normHex, hexToRgb, defaultPlan, hexAt, addChange, legend, yarnOf };
})(typeof window !== 'undefined' ? window : globalThis);
