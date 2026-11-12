/* Written row-by-row directions from X grid. Repeats shown as (…) xN. Includes a parser for round-trip tests. */
(function (root) {
  'use strict';
  const C = () => root.MosaicColors;
  const NAME = { s: 'sc', d: 'dc' };
  // diagonal groups (one token each, read right to left): L = \|, R = |/, V = \|/
  const GROUP = { L: '2 dc in next st then sk 1', R: 'sk 1 then 2 dc in next st', V: 'sk 1 then 3 dc in next st then sk 1' };
  const WIDTH = { s: 1, d: 1, L: 2, R: 2, V: 3 };
  // Encode a string of 's'/'d' into tokens with the fewest printed items. Groups: {rep:[runs], k}
  function runs(s) { const out = []; for (const ch of s) { const l = out[out.length - 1]; if (l && l.t === ch) l.n++; else out.push({ t: ch, n: 1 }); } return out; }
  function compress(s) {
    const n = s.length, best = new Array(n + 1).fill(Infinity), how = new Array(n + 1); best[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = i + 1; j <= n && s[j - 1] === s[i]; j++) { if (j < n && s[j] === s[j - 1]) continue; const c = 1 + best[j]; if (c < best[i]) { best[i] = c; how[i] = { j, item: { t: s[i], n: j - i } }; } }
      for (let L = 2; i + 2 * L <= n; L++) {
        const u = s.substr(i, L), ru = runs(u); if (ru.length < 2 || u[0] === u[L - 1]) continue;
        let k = 1; while (i + (k + 1) * L <= n && s.substr(i + k * L, L) === u) {
          k++; const j = i + k * L; if (j < n && s[j] === s[j - 1]) continue; const c = ru.length + 1 + best[j] + 0.01 * L; // tiny bias: shorter units
          if (c < best[i] - 1e-9) { best[i] = c; how[i] = { j, item: { rep: ru, k } }; } }
      }
    }
    const out = []; for (let i = 0; i < n; i = how[i].j) out.push(how[i].item); return out;
  }
  const fmtRun = r => (GROUP[r.t] ? new Array(r.n).fill(GROUP[r.t]).join(', ') : `${NAME[r.t]} ${r.n}`);
  /* Row r as tokens, right to left, each with the yarn it is worked in (a group uses its straight stitch's yarn). */
  function rowTokens(X, r, G, Y) {
    const W = X[0].length, i = r - 1, out = [], y = c => (Y ? Y[i][c] : 0); let c = W - 1;
    while (c >= 0) {
      if (G && c - 1 >= 0 && G[i][c - 1] & 2) { const v = G[i][c - 1] & 1; out.push({ t: v ? 'V' : 'R', y: y(c - 1) }); c -= v ? 3 : 2; continue; }
      if (G && G[i][c] & 1) { out.push({ t: 'L', y: y(c) }); c -= 2; continue; }
      out.push({ t: X[i][c] ? 'd' : 's', y: y(c) }); c--; }
    return out;
  }
  const fmt = items => items.map(it => it.rep ? `(${it.rep.map(fmtRun).join(', ')}) x${it.k}` : fmtRun(it)).join(', ');
  /* Row body with extra strands: Y[r-1][c] = 0 (row's own yarn) or k (extras[k-1], e.g. C). Stitches in an extra strand
     are grouped as [C: …]; everything else uses the row's yarn. Read right to left like the row itself. */
  function rowBody(X, r, Y, extras, G) {
    const tk = rowTokens(X, r, G, Y), parts = []; let i = 0;
    while (i < tk.length) { const k = tk[i].y; let j = i; while (j < tk.length && tk[j].y === k) j++;
      const body = fmt(compress(tk.slice(i, j).map(t => t.t).join(''))); parts.push(k ? `[${extras[k - 1].label}: ${body}]` : body); i = j; }
    return parts.join(', ');
  }
  const carried = (Y, r) => Y ? [...new Set(Y[r - 1].filter(v => v))].sort() : [];
  function rowString(X, r) { const row = X[r - 1]; let s = ''; for (let c = row.length - 1; c >= 0; c--) s += row[c] ? 'd' : 's'; return s; } // right to left
  function colorNames(plan) { const m = {}; for (const y of ['A', 'B']) plan[y].forEach((e, i) => { m[y + e.row] = { label: plan[y].length > 1 ? `${y}${i + 1}` : y, hex: e.hex }; }); return m; }
  function colorFor(plan, r) { const y = r % 2 ? 'A' : 'B', list = plan[y]; let idx = 0; list.forEach((e, i) => { if (e.row <= r) idx = i; }); return { label: list.length > 1 ? `${y}${idx + 1}` : y, hex: list[idx].hex, change: idx > 0 && list[idx].row === r }; }
  function directions(X, plan, opts = {}) {
    plan = plan || C().defaultPlan(); const H = X.length, W = X[0].length, n = W + 2, L = [];
    L.push(opts.title || 'Overlay mosaic crochet pattern', '');
    L.push('NOTES', '- Worked flat, bottom up. Every row is worked right to left (RS facing). Cut yarn at the end of each row, leaving tails.',
      '- Odd rows use yarn A, even rows use yarn B. The foundation chain is row 0, in A.',
      '- BS = border stitch: sc through both loops at each end of the row.',
      '- sc = single crochet in back loop only.',
      '- dc = double crochet in front loop of the stitch two rows below, worked in front of the previous row (these are the X\'s on the chart).',
      '- (…) xN = repeat what is inside the parentheses N times.',
      ...(opts.G && opts.G.some(row => row.some(v => v)) ? ['- Leaning stitches (the slanted lines on the chart): "2 dc in next st then sk 1" (chart \\|) = work 2 dc into the front loop of the next stitch two rows below, then skip the next stitch\'s front loop. "sk 1 then 2 dc in next st" (chart |/) = skip one, then 2 dc into the next one. "sk 1 then 3 dc in next st then sk 1" (chart \\|/) = skip one, 3 dc into the next one, skip one. The stitch count stays the same.'] : []),
      ...(opts.Y && opts.Y.some(row => row.some(v => v)) ? ['- [C: …] = work these stitches with yarn C instead of the row\'s yarn: sc still goes in the back loop, dc still goes in the front loop two rows below. "Carry C" means hold C along the top of the row with the row\'s yarn and crochet over it, switching strands when the row says so.'] : []),
      `- Size: ${n} stitches (including BS) x ${H} rows plus chain.`, '', 'YARN');
    for (const y of ['A', 'B']) plan[y].forEach((e, i) => { const lbl = plan[y].length > 1 ? `${y}${i + 1}` : y; L.push(`- Color ${lbl}: ${e.hex} (from row ${e.row})`); });
    (opts.extras || []).forEach((e, k) => { if (opts.Y && opts.Y.some(row => row.includes(k + 1))) L.push(`- Color ${e.label}: ${e.hex} (carried strand)`); });
    L.push('', 'DIRECTIONS', `Row 0 (Color ${colorFor(plan, 1).label}): Ch ${n}.`);
    for (let r = 1; r <= H; r++) { const c = colorFor(plan, r), body = rowBody(X, r, opts.Y, opts.extras, opts.G), cr = carried(opts.Y, r).map(k => opts.extras[k - 1].label);
      L.push(`Row ${r} (Color ${c.label}${c.change ? ', change to new color' : ''}${cr.length ? ', carry ' + cr.join(' and ') : ''}): BS, ${body}, BS. (${n} sts)`); }
    return L.join('\n');
  }
  // Parse "Row r (...): BS, ..., BS. (n sts)" back into a right-to-left 's'/'d' string (without BS)
  function parseRow(line) {
    const m = line.match(/^Row (\d+) \([^)]*\): BS, (.*), BS\. \((\d+) sts\)$/); if (!m) return null;
    let body = m[2], out = '', yarn = '', cur = '-';
    const re = /\[([A-Z]): |\]|\(([^)]*)\) x(\d+)|(sk 1 then 3 dc in next st then sk 1|sk 1 then 2 dc in next st|2 dc in next st then sk 1)|(sc|dc) (\d+)/g; let t;
    const tok = p => { for (const k in GROUP) if (GROUP[k] === p) return k; const [a, b] = p.split(' '); return (a === 'dc' ? 'd' : 's').repeat(+b); };
    const one = s => s.split(', ').map(tok).join('');
    while ((t = re.exec(body))) { if (t[1]) { cur = t[1]; continue; } if (t[0] === ']') { cur = '-'; continue; }
      const add = t[2] !== undefined ? one(t[2]).repeat(+t[3]) : t[4] ? tok(t[4]) : one(`${t[5]} ${t[6]}`);
      out += add; yarn += [...add].map(ch => cur.repeat(WIDTH[ch])).join(''); }
    return { row: +m[1], s: out, count: +m[3], yarn, width: [...out].reduce((a, ch) => a + WIDTH[ch], 0) };
  }
  root.MosaicWritten = { compress, fmt, directions, parseRow, rowString, rowTokens };
  if (typeof module !== 'undefined') module.exports = root.MosaicWritten;
})(typeof window !== 'undefined' ? window : globalThis);
