/* Run from any directory: node tests/test_regressions.js. No external fixtures or packages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const site = path.resolve(__dirname, '../site');
const M = require('../site/engine.js');
require('../site/colors.js');
const C = globalThis.MosaicColors, Written = require('../site/written.js');
const zeros = (h, w) => Array.from({ length: h }, () => Array(w).fill(0));
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }

const app = require('./app_harness.js');

test('carried dc never mutates the picture or covers a different letter', () => {
  const a = app(); a.open(['B', 'B', 'C']); const d = a.derive();
  assert.equal(d.n, 0); assert.deepEqual(plain(d.F), [[1], [1], [0]]);
  a.open(['B', 'C']); assert.ok(a.derive().n > 0); a.click('dFix'); assert.equal(a.derive().n, 0);
  a.open(['C', 'C', 'C']); assert.deepEqual(plain(a.derive().X), [[0], [1], [0]]);
  a.st.plan.C.push({ row: 2, hex: '#0000ff' }); assert.equal(a.derive().X[1][0], 0, 'a dc must not overwrite a different stripe color');
});

test('row overrides validate actual covering yarn, and Fix clears all trouble', () => {
  const a = app(); a.open(['B', 'A']); a.st.selRow = 2; a.click('yarnA'); assert.ok(a.derive().n > 0);
  assert.deepEqual(plain(a.derive().target(0, 0)), [26, 26, 26], 'editor retains the requested B');
  a.click('dFix'); assert.equal(a.derive().n, 0);
  a.open(['A', 'A', 'A']); a.st.selRow = 3; a.click('yarnB'); assert.ok(a.derive().n > 0);
  a.click('dFix'); assert.equal(a.derive().n, 0); a.click('dUndo'); assert.ok(a.derive().n > 0);
});

test('Suggest leans only shows spots; nothing changes until Add all, which is undoable', () => {
  const a = app(); a.open(['BAB', 'BAB', 'AAA', 'BBB']); a.click('dSuggestLeans');
  assert.ok(a.st.sug.length > 0, 'spots are suggested'); assert.ok(!a.st.d.G.flat().some(Boolean), 'design untouched');
  assert.equal(a.st.hist.length, 0); assert.equal(a.ids.get('sugBox').hidden, false);
  a.click('sugAll'); assert.ok(a.st.d.G.flat().some(Boolean)); assert.equal(a.st.sug.length, 0); assert.equal(a.ids.get('dUndo').disabled, false);
  a.click('dUndo'); assert.ok(!a.st.d.G.flat().some(Boolean));
  a.click('dSuggestLeans'); a.click('sugHide'); assert.equal(a.st.sug.length, 0); assert.ok(!a.st.d.G.flat().some(Boolean));
  a.open(['AAA', 'BBB', 'AAA']); a.click('dSuggestLeans'); assert.equal(a.st.sug.length, 0); assert.equal(a.st.hist.length, 0);
});

test('lean suggestions require a real corner and manual groups require a matching shared anchor', () => {
  const a = app();
  // A straight dc beside a free square, but only a stripe underneath: no curve.
  a.open(['AAA', 'BAB', 'AAA', 'BBB']); a.click('dSuggestLeans');
  assert.equal(a.st.sug.length, 0);
  // The straight dc is valid, but its shared anchor is a C-colored square.
  a.open(['ACA', 'BAB', 'AAA']); assert.equal(a.derive().n, 0);
  a.click('dSuggestLeans'); assert.equal(a.st.sug.length, 0);
  const D = a.derive(), context = { colorAt: (i, c) => D.target(i, c).join(','), yarnAt: () => '255,255,255' };
  assert.equal(M.groupProblem(plain(D.X), zeros(3, 3), 2, 1, 1, context), 'anchor');
  // Reopening an older piece must remove unsupported groups without altering pixels.
  const original = plain(a.st.d.P);
  a.window.MosaicApp.openDesign(['AAA', 'BAB', 'ACA'], null, [[0, 1, 1]], 'Saved chart');
  assert.deepEqual(plain(a.st.d.P), original); assert.ok(!a.st.d.G.flat().some(Boolean));
  // A genuine stepped A/B boundary still supports 2 dc in one base loop.
  a.open(['BAB', 'BAB', 'AAA']); a.click('dSuggestLeans');
  assert.deepEqual(plain(a.st.sug), [[2, 1, 1]]); assert.equal(a.st.d.G[2][1], 0);
  a.click('sugAll'); assert.equal(a.st.d.G[2][1], 1);
  const line = a.window.MosaicWritten.directions(a.derive().X, a.st.plan, { G: a.st.d.G }).split('\n').find(l => l.startsWith('Row 3'));
  assert.match(line, /2 dc in next st then sk 1/);
  assert.equal(Written.parseRow(line).width, 3);
  // The other direction and both wings share the same validated anchor.
  const x = plain(a.derive().X), empty = zeros(3, 3);
  assert.equal(M.groupProblem(x, empty, 2, 1, 2), '');
  assert.equal(M.groupProblem(x, empty, 2, 1, 3), '');
  assert.equal(M.groupProblem([[0, 0], [1, 0]], zeros(2, 2), 1, 0, 2), 'foundation');
});

test('saved pieces reopen with their working yarns and survive Combine', () => {
  const a = app(); a.open(['AA', 'AA'], [null, 'A']); const before = plain(a.derive().X);
  a.click('saveDesign'); const p = a.window.MosaicCombine._st.lib[0];
  assert.deepEqual(plain(p.yarn), [null, 'A']);
  a.window.MosaicApp.openDesign(p.rows, p.plan, p.groups, 'Reopen', p.yarn);
  assert.deepEqual(plain(a.st.d.yarn), [null, 'A']); assert.deepEqual(plain(a.derive().X), before);
  const b = a.window.MosaicCombine._st.board; b.w = 2; b.h = 2;
  b.items = [{ pid: p.id, x: 0, y: 0, crop: { t: 0, b: 0, l: 0, r: 0 }, clear: false }];
  const composed = a.window.MosaicCombine.compose(); assert.deepEqual(plain(composed.yarn), ['A', 'A']);
  a.window.MosaicApp.openDesign(composed.G, composed.plan, composed.groups, 'Board', composed.yarn);
  assert.equal(a.derive().n, 0); assert.deepEqual(plain(a.st.d.yarn), ['A', 'A']);
  const q = { ...plain(p), id: 'other', yarn: [null, 'B'] }; a.window.MosaicCombine._st.lib.push(q);
  b.w = 4; b.items.push({ pid: q.id, x: 2, y: 0, crop: { t: 0, b: 0, l: 0, r: 0 }, clear: false });
  assert.equal(a.window.MosaicCombine.compose().yarnConflicts.length, 1);
});

test('stripes start on the selected overridden row and leave other yarns intact', () => {
  const plan = C.defaultPlan(), next = C.addChange(plan, [], 4, '#abcdef', 'A').plan;
  assert.equal(C.colorOf(next, 'A', 4), '#abcdef'); assert.equal(C.colorOf(next, 'A', 3), '#ffffff');
  assert.equal(C.colorOf(next, 'B', 4), '#1a1a1a');
  const firstB = C.addChange(plan, [], 1, '#123456', 'B').plan;
  assert.equal(firstB.B[0].row, 1); assert.equal(C.colorOf(firstB, 'B', 1), '#123456');
});

test('more fix options retain and stretch the override schedule', () => {
  const a = app(); a.open(['AAA', 'AAA', 'AAA', 'AAA', 'AAA', 'AAA'], ['A', 'A', 'B', 'A', 'B', 'B']);
  a.click('dOpts'); assert.ok(a.st.opts.length);
  for (const option of a.st.opts) { const col = r => +(option.yarn[r - 1] === 'B');
    assert.equal(option.yarn.length, option.F.length); assert.equal(M.problemCells(option.F, col).n, 0);
    assert.deepEqual(M.simulate(plain(option.X), col), plain(option.F));
  }
  const use = a.ids.get('opts').children[0].children.at(-1); use.onclick(); assert.equal(a.derive().n, 0);
});

test('PDF, screen directions and chart use the same overridden yarn; chain stays A', () => {
  const a = app(); a.open(['BB', 'AA', 'BB'], ['B', 'A', 'B']); assert.equal(a.derive().n, 0);
  const d = a.derive(), own = r => a.st.d.yarn[r - 1], pdfText = [];
  const { jsPDF } = require('../site/vendor/jspdf.umd.min.js');
  a.window.jspdf = { jsPDF: function(opts) { const doc = new jsPDF(opts), text = doc.text.bind(doc);
    doc.text = (s, ...args) => { pdfText.push(String(s)); return text(s, ...args); }; return doc; } };
  vm.runInContext(fs.readFileSync(path.join(site, 'pdf.js'), 'utf8'), a.context);
  const doc = a.window.MosaicPDF.build({ X: d.X, F: d.F, plan: a.st.plan, yarnOf: own, title: 'Override regression', project: 'chart' });
  assert.ok(pdfText.includes('Row 0 (Color A):')); assert.ok(pdfText.includes('Row 1 (Color B):')); assert.ok(pdfText.includes('Row 2 (Color A):'));
  assert.ok(!pdfText.some(t => t.includes('Odd rows (A) use')));
  a.selectors['[data-tab]'].find(e => e.dataset.tab === 'written').onclick();
  assert.match(a.ids.get('written').textContent, /Row 2 \(Color A\)/);
  a.selectors['[data-tab]'].find(e => e.dataset.tab === 'chart').onclick();
  assert.ok(a.ids.get('chartCv').ops.some(o => o[0] === 'fillText' && o[1] === 'B'));
  for (const tab of ['preview', 'fabric']) { a.selectors['[data-tab]'].find(e => e.dataset.tab === tab).onclick(); assert.equal(a.ids.get(tab + 'Tab').hidden, false); assert.equal(a.ids.get('chartTab').hidden, true); }
  a.click('dlPrev'); a.click('dlChart');
  const out = process.env.MOSAIC_TEST_OUTPUT;
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'override.pdf'), Buffer.from(doc.output('arraybuffer'))); }
});

test('PDF chart row keys include every carried color and the current stripe on each page', () => {
  const a = app(), calls = [], plan = C.defaultPlan(), H = 72, width = 48;
  plan.A.push({ row: 41, hex: '#123abc' });
  const strands = [{ k: 1, label: 'C1', hex: '#c8102e', row: 1 }, { k: 1, label: 'C2', hex: '#f6c90e', row: 25 }, { k: 2, label: 'D', hex: '#2e8b57', row: 1 }];
  const extras = { list: strands, at: (k, r) => strands.filter(e => e.k === k && e.row <= r).at(-1) };
  const mask = zeros(H, width); for (const r of [3, 36, 37, 40, 41, 50]) { mask[r - 1][0] = 1; mask[r - 1][1] = 2; }
  const own = r => r === 40 ? 'A' : C.yarnOf(r);
  const { jsPDF } = require('../site/vendor/jspdf.umd.min.js');
  a.window.jspdf = { jsPDF: function(opts) { const doc = new jsPDF(opts), original = doc.text.bind(doc);
    doc.text = (s, x, y, ...args) => { calls.push({ text: String(s), x, y, page: doc.internal.getCurrentPageInfo().pageNumber, color: doc.getTextColor() }); return original(s, x, y, ...args); }; return doc; } };
  vm.runInContext(fs.readFileSync(path.join(site, 'pdf.js'), 'utf8'), a.context);
  const doc = a.window.MosaicPDF.build({ X: zeros(H, width), F: zeros(H, width), Y: mask, extras, plan, yarnOf: own, title: 'Row color regression', project: 'chart' });
  const chartPages = calls.filter(c => c.text.startsWith('Chart - Rows')).map(c => c.page); assert.ok(chartPages.length > 1);
  const checkedRows = new Map();
  for (const page of chartPages) {
    const events = calls.filter(c => c.page === page), nums = events.filter(c => /^\d+$/.test(c.text) && c.x > 396 && ['#222222', '#212121'].includes(c.color));
    const rightX = Math.max(...nums.map(c => c.x));
    for (const number of nums.filter(c => Math.abs(c.x - rightX) < .001)) {
      const r = +number.text, labels = events.filter(c => Math.abs(c.y - number.y) < .001 && c.x > rightX && /^[ABCD]\d*$/.test(c.text)).map(c => c.text);
      const wanted = [C.labelAt(plan, own(r), r), ...[...new Set(mask[r - 1].filter(Boolean))].sort().map(k => extras.at(k, r).label)];
      assert.deepEqual(labels, wanted, `row ${r}, page ${page}`); checkedRows.set(r, (checkedRows.get(r) || 0) + 1);
    }
  }
  assert.equal(checkedRows.size, H); assert.ok([...checkedRows.values()].some(n => n > 1), 'overlap rows are checked on both pages');
  if (process.env.MOSAIC_TEST_OUTPUT) fs.writeFileSync(path.join(process.env.MOSAIC_TEST_OUTPUT, 'row-colors.pdf'), Buffer.from(doc.output('arraybuffer')));
});

test('Design keeps its original reference through edits, new uploads, saves, and reopening', () => {
  const a = app(), original = { src: 'data:image/png;base64,AQID', label: 'Original image' };
  a.st.sourceReference = original;
  a.st.samp = { idx: [[0, 1], [1, 0]], palette: [[255, 255, 255], [0, 0, 0]], counts: [2, 2] }; a.st.role = ['A', 'B'];
  a.click('startDesign'); assert.equal(a.ids.get('designReference').hidden, false);
  assert.equal(a.ids.get('designReferenceImg').src, original.src);
  a.st.sourceReference = { src: 'data:image/png;base64,BAUG', label: 'Original image' };
  a.click('dFix'); a.click('dIn'); assert.equal(a.ids.get('designReferenceImg').src, original.src);
  a.click('saveDesign'); const p = a.window.MosaicCombine._st.lib[0]; assert.deepEqual(plain(p.reference), original);
  // Exercise the actual saved-piece Open in Design handler.
  const card = a.ids.get('lib').children.at(-1), button = card.children.at(-1).children.find(e => e.textContent === 'Open in Design');
  a.open(['AAA', 'BBB', 'AAA']); assert.equal(a.ids.get('designReferenceLabel').textContent, 'Starting design');
  button.onclick(); assert.equal(a.ids.get('designReferenceImg').src, original.src);
  // Legacy pieces get a clearly labeled snapshot, never another upload's image.
  a.window.MosaicApp.openDesign(['AAA', 'BBB', 'AAA'], null, [], 'Legacy piece');
  assert.equal(a.ids.get('designReferenceLabel').textContent, 'Starting design');
  assert.notEqual(a.st.d.reference.src, a.st.sourceReference.src);
});

test('multiple carried strands get row-edge advice, while only stitch errors get red cells', () => {
  const a = app(); a.open(['ACDA', 'BDBB', 'AAAA']);
  assert.equal(a.derive().n, 0); assert.equal(a.ids.get('dFix').disabled, true);
  const red = cv => cv.draws.filter(o => o.method === 'strokeRect' && o.stroke === '#e0001b');
  const badges = cv => cv.draws.filter(o => o.method === 'fillText' && o.args[0] === '2' && o.fill === '#426b9f');
  assert.equal(red(a.ids.get('dCv')).length, 0);
  assert.equal(badges(a.ids.get('dCv')).length, 1);
  assert.ok(badges(a.ids.get('dCv'))[0].args[1] > a.derive().W * a.ids.get('dCv')._cell);
  for (const tab of ['chart', 'preview', 'fabric']) {
    a.selectors['[data-tab]'].find(e => e.dataset.tab === tab).onclick();
    const cv = a.ids.get({ chart: 'chartCv', preview: 'prevCv', fabric: 'fabCv' }[tab]);
    assert.equal(red(cv).length, 0); assert.equal(badges(cv).length, 1);
  }
  // Preferences alone do not block PDF export.
  a.window.jspdf = require('../site/vendor/jspdf.umd.min.js');
  vm.runInContext(fs.readFileSync(path.join(site, 'pdf.js'), 'utf8'), a.context);
  a.click('mkPdf'); assert.equal(a.ids.get('pdfDlg').open, true); a.ids.get('pdfDlg').close();
  // A separate actual top-row error remains visible in every output.
  a.open(['ACDA', 'BDBB', 'BAAA']); assert.equal(a.derive().n, 1);
  assert.equal(red(a.ids.get('dCv')).length, 1); assert.equal(badges(a.ids.get('dCv')).length, 1);
  for (const tab of ['chart', 'preview', 'fabric']) {
    a.selectors['[data-tab]'].find(e => e.dataset.tab === tab).onclick();
    const cv = a.ids.get({ chart: 'chartCv', preview: 'prevCv', fabric: 'fabCv' }[tab]);
    assert.equal(red(cv).length, 1); assert.equal(badges(cv).length, 1);
  }
  a.click('mkPdf'); assert.equal(a.ids.get('pdfDlg').open, false);
  // The extra advice rail must not change painting coordinates or accept paint.
  a.open(['ACDA', 'BBBB', 'AAAA']); let cv = a.ids.get('dCv');
  const point = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, preventDefault() {} });
  cv.onpointerdown(point(84, 12)); cv.onpointerup(); assert.equal(a.st.d.P[2][3], 'B'); assert.equal(a.st.d.P[2][2], 'A');
  const before = plain(a.st.d.P); cv = a.ids.get('dCv'); cv.onpointerdown(point(102, 12)); cv.onpointerup();
  assert.deepEqual(plain(a.st.d.P), before);
  // Dense rows still have separate, non-overlapping advice badges.
  const tiny = a.window.MosaicRender.drawGrid([[0], [0]], { cell: 4, adviceRows: [0, 1] });
  const boxes = tiny.draws.filter(o => o.method === 'strokeRect' && o.stroke === '#426b9f');
  assert.equal(boxes.length, 2); assert.ok(boxes.every(o => o.args[3] < 4));
});

test('500 standard charts round-trip through stitches and written instructions', () => {
  let rows = 0;
  for (let t = 0; t < 500; t++) {
    let seed = t + 1; const rand = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
    const grid = Array.from({ length: 3 + t % 12 }, () => Array.from({ length: 2 + t % 9 }, () => +(rand() < .4)));
    const r = M.findFixes(grid, { stretch: false, exact: true, keep: 1 })[0]; assert.ok(r.valid && r.simOK);
    for (const line of Written.directions(r.X).split('\n').filter(l => /^Row [1-9]/.test(l))) {
      const p = Written.parseRow(line); assert.equal(p.s, Written.rowString(r.X, p.row)); assert.equal(p.width, r.width); rows++;
    }
  }
  console.log('  checked', rows, 'written rows');
});

test('1000 carried-color and override charts fix to physically matching colors', () => {
  let seed = 123; const rand = n => Math.floor(((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296) * n);
  for (let t = 0; t < 1000; t++) {
    const h = 2 + rand(14), w = 1 + rand(8), schedule = Array.from({ length: h }, () => rand(2)), col = r => schedule[r - 1];
    const Y = Array.from({ length: h }, () => Array.from({ length: w }, () => rand(5) === 0 ? 1 + rand(2) : 0));
    const F = Y.map((row, i) => row.map(y => y ? col(i + 1) : rand(2)));
    const result = M.fixColors(F, Y, { color: col, choices: t % 2 ? () => [{ k: 1, cost: .2 }, { k: 2, cost: .3 }] : null }); assert.ok(result);
    const d = M.analyzeDesign(result.F, result.Y, { color: col }); assert.equal(d.n, 0);
    for (let i = 0; i < h; i++) for (let c = 0; c < w; c++) {
      assert.ok(!d.X[i][c] || i === 0 || !d.X[i - 1][c]);
      const source = i + 1 < h && d.X[i + 1][c] ? i + 1 : i;
      const wanted = result.Y[i][c] ? 'CD'[result.Y[i][c] - 1] : 'AB'[result.F[i][c]];
      const actual = result.Y[source][c] ? 'CD'[result.Y[source][c] - 1] : 'AB'[col(source + 1)];
      assert.equal(actual, wanted);
    }
    // Fix is idempotent once the design is workable.
    const again = M.fixColors(result.F, result.Y, { color: col }); assert.equal(again.changed, 0);
  }
});
console.log(`${checks} regression groups passed.`);
