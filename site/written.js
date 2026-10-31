/* Written row-by-row directions from X grid. Repeats shown as (…) xN. Includes a parser for round-trip tests. */
(function (root) {
  'use strict';
  const C = () => root.MosaicColors;
  const NAME = { s: 'sc', d: 'dc' };
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
  const fmtRun = r => `${NAME[r.t]} ${r.n}`;
  const fmt = items => items.map(it => it.rep ? `(${it.rep.map(fmtRun).join(', ')}) x${it.k}` : fmtRun(it)).join(', ');
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
      `- Size: ${n} stitches (including BS) x ${H} rows plus chain.`, '', 'YARN');
    for (const y of ['A', 'B']) plan[y].forEach((e, i) => { const lbl = plan[y].length > 1 ? `${y}${i + 1}` : y; L.push(`- Color ${lbl}: ${e.hex} (from row ${e.row})`); });
    L.push('', 'DIRECTIONS', `Row 0 (Color ${colorFor(plan, 1).label}): Ch ${n}.`);
    for (let r = 1; r <= H; r++) { const c = colorFor(plan, r), body = fmt(compress(rowString(X, r)));
      L.push(`Row ${r} (Color ${c.label}${c.change ? ', change to new color' : ''}): BS, ${body}, BS. (${n} sts)`); }
    return L.join('\n');
  }
  // Parse "Row r (...): BS, ..., BS. (n sts)" back into a right-to-left 's'/'d' string (without BS)
  function parseRow(line) {
    const m = line.match(/^Row (\d+) \([^)]*\): BS, (.*), BS\. \((\d+) sts\)$/); if (!m) return null;
    let body = m[2], out = '';
    const re = /\(([^)]*)\) x(\d+)|(sc|dc) (\d+)/g; let t;
    const one = s => s.split(', ').map(p => { const [a, b] = p.split(' '); return (a === 'dc' ? 'd' : 's').repeat(+b); }).join('');
    while ((t = re.exec(body))) out += t[1] !== undefined ? one(t[1]).repeat(+t[2]) : one(`${t[3]} ${t[4]}`);
    return { row: +m[1], s: out, count: +m[3] };
  }
  root.MosaicWritten = { compress, fmt, directions, parseRow, rowString };
  if (typeof module !== 'undefined') module.exports = root.MosaicWritten;
})(typeof window !== 'undefined' ? window : globalThis);
