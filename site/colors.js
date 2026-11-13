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

  /* plan = { A, B, C, D: [{row, hex}] } sorted by row. A and B are the row yarns (first entries row 1 / row 2);
     C and D are carried strands (first entry row 1). Any letter can change color on any row of its own. */
  const defaultPlan = () => ({ A: [{ row: 1, hex: '#ffffff' }], B: [{ row: 2, hex: '#1a1a1a' }], C: [{ row: 1, hex: '#c8102e' }], D: [{ row: 1, hex: '#2e8b57' }] });
  const fullPlan = p => Object.assign(defaultPlan(), p || {});
  const yarnOf = r => (color(r) ? 'B' : 'A');
  /* color of letter L at row r: the last change at or below r */
  function colorOf(plan, L, r) { const list = fullPlan(plan)[L]; let h = list[0].hex; for (const e of list) if (e.row <= r) h = e.hex; return h; }
  const hexAt = (plan, r) => colorOf(plan, yarnOf(r), r);
  /* label used in patterns: A, or A1 / A2 / ... when A changes color */
  function labelAt(plan, L, r) { const list = fullPlan(plan)[L]; if (list.length < 2) return L; let k = 0; list.forEach((e, i) => { if (e.row <= r) k = i; }); return L + (k + 1); }
  /* from row r upward, letter L (default: row r's own yarn) becomes hex. A / B changes sit on rows of that yarn. */
  function addChange(plan, X, r, hex, L) {
    plan = fullPlan(plan); L = L || yarnOf(r);
    if ((L === 'A' || L === 'B') && yarnOf(r) !== L) r++;          // an A change goes on an A row, B on a B row
    const list = plan[L].map(e => ({ ...e })), first = list[0].row;
    if (r <= first) list[0].hex = hex; else { const i = list.findIndex(e => e.row === r); if (i >= 0) list[i].hex = hex; else list.push({ row: r, hex }); }
    list.sort((a, b) => a.row - b.row);
    const dedup = list.filter((e, i) => i === 0 || e.hex !== list[i - 1].hex);   // drop no-op changes
    return { plan: { ...plan, [L]: dedup }, note: '' };
  }
  /* a plan from per-row colors: rows = { A: {row: hex}, ... }; rows without an entry keep the color below them */
  function planFromRows(rows, H, fallback) { const plan = fullPlan(fallback);
    for (const L of ['A', 'B', 'C', 'D']) { const m = rows[L] || {}, keys = Object.keys(m).map(Number).sort((a, b) => a - b); if (!keys.length) continue;
      const first = L === 'B' ? 2 : 1, list = [{ row: first, hex: m[keys[0]] }];
      for (const k of keys) if (m[k] !== list[list.length - 1].hex) list.push({ row: Math.max(first, k), hex: m[k] });
      plan[L] = list; }
    return plan; }
  function legend(plan, H) {
    const out = []; plan = fullPlan(plan);
    for (const y of ['A', 'B']) plan[y].forEach((e, i) => { const nx = plan[y][i + 1]; let to = nx ? nx.row - 2 : H; if (yarnOf(to) !== y) to--; out.push({ yarn: y, hex: e.hex, rgb: hexToRgb(e.hex), from: e.row, to }); });
    return out;
  }
  root.MosaicColors = { STARTERS, loadBank, saveBank, validHex, normHex, hexToRgb, defaultPlan, fullPlan, colorOf, labelAt, hexAt, addChange, planFromRows, legend, yarnOf };
})(typeof window !== 'undefined' ? window : globalThis);
