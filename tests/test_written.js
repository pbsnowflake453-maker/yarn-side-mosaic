globalThis.window = undefined;
require('../engine.js'); require('../colors.js'); const W = require('../written.js');
const M = globalThis.Mosaic, C = globalThis.MosaicColors, grids = require('./grids.json');
let fails = 0, rowsChecked = 0;
for (const [name, G0] of Object.entries(grids)) for (const sc of [1, 2]) {
  let G = M.crop(G0.map(r => r.map(v => v ? 1 : 0))); if (sc > 1) G = M.scale(G, sc);
  const res = M.findFixes(G, { stretch: false, keep: 1 })[0]; if (!res) { console.log(name, sc, 'no fix'); continue; }
  let plan = C.defaultPlan(); if (res.X.length > 12) { plan = C.addChange(plan, res.X, 7, '#c8102e').plan; plan = C.addChange(plan, res.X, 10, '#1f5fbf').plan; }
  const txt = W.directions(res.X, plan), lines = txt.split('\n').filter(l => /^Row [1-9]/.test(l));
  if (lines.length !== res.X.length) { fails++; console.log('row count mismatch', name); }
  for (const l of lines) { const p = W.parseRow(l), want = W.rowString(res.X, p.row);
    rowsChecked++; if (p.s !== want || p.count !== want.length + 2) { fails++; console.log('FAIL', name, sc, l, want); } }
  // also round trip vs chart X directly: dc positions right-to-left
  console.log(`${name} ${sc}x: ${res.width + 2} sts x ${res.X.length} rows OK`);
  if (name === 'star' && sc === 1) console.log(txt);
}
// random strings
for (let t = 0; t < 2000; t++) { const n = 5 + Math.floor(Math.random() * 120); let s = ''; for (let i = 0; i < n; i++) s += Math.random() < 0.3 ? 'd' : 's';
  if (Math.random() < .5) s = s.slice(0, 4).repeat(8) + s; const l = `Row 1 (A): BS, ${W.fmt(W.compress(s))}, BS. (${n + 2} sts)`;
  if (W.parseRow(l).s !== s) { fails++; console.log('rand FAIL', s, l); } }
console.log(`rows checked: ${rowsChecked}, random strings: 2000, failures: ${fails}`); process.exit(fails ? 1 : 0);
