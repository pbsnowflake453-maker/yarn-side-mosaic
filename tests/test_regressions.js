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

test('5x, 6x and 9x enlarge every source pixel in Design and saved Combine pieces', () => {
  for (const scale of [5, 6, 9]) {
    const a = app(), input = [[0, 1], [2, 3]], ref = { src: 'data:image/png;base64,AQID', label: 'Original image' };
    a.st.samp = { idx: input, palette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]], counts: [1, 1, 1, 1] };
    a.st.role = ['A', 'B', 'C', 'D']; a.st.sourceReference = ref;
    a.selectors['[data-s]'].find(b => +b.dataset.s === scale).onclick();
    a.click('startDesign'); a.click('savePic');
    const design = plain(a.st.d.P).reverse(), piece = a.window.MosaicCombine._st.lib.at(-1);
    assert.equal(design.length, 2 * scale); assert.equal(design[0].length, 2 * scale);
    assert.deepEqual(plain(piece.rows), design.map(r => r.join('')));
    for (let y = 0; y < 2 * scale; y++) for (let x = 0; x < 2 * scale; x++) assert.equal(design[y][x], 'ABCD'[input[Math.floor(y / scale)][Math.floor(x / scale)]]);
    assert.deepEqual(input, [[0, 1], [2, 3]]); assert.deepEqual(plain(piece.reference), ref);
  }
});

function tileApp({ kind = 'picture', rows = ['ABC', 'BCD'], w = 9, h = 6, yarn, crop, flip = false, remap } = {}) {
  const a = app(), combine = a.window.MosaicCombine, s = combine._st;
  s.lib.push({ id: 'tile', kind, name: 'Repeat', rows, plan: C.defaultPlan(), yarn, groups: kind === 'chart' ? [[0, 1, 1]] : [] });
  s.board = { w, h, items: [{ pid: 'tile', x: 0, y: 0, crop: crop || { t: 0, b: 0, l: 0, r: 0 }, flip, clear: false, remap }] };
  s.sel = 0; a.ids.get('keepRows').checked = true; combine.init(); return { a, combine, s };
}

test('auto-tile fills whole repeats, saves the board, skips occupied space and undoes exactly', () => {
  const { a, combine, s } = tileApp();
  s.lib.push({ id: 'other', name: 'Other', kind: 'picture', rows: ['DDD', 'DDD'], plan: C.defaultPlan() });
  s.board.items.push({ pid: 'other', x: 3, y: 2, crop: { t: 0, b: 0, l: 0, r: 0 }, clear: false });
  s.board.choices = { existing: 'choice' }; const before = plain(s.board), beforeG = plain(combine.compose().G);
  a.click('pTile'); assert.equal(s.board.items.length, 9); assert.match(a.ids.get('tileNote').textContent, /Added 7 copies/);
  assert.equal(a.ids.get('pUndoTile').disabled, false);
  const output = plain(combine.compose().G);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 9; x++) assert.equal(output[y][x], y >= 2 && y < 4 && x >= 3 && x < 6 ? 'D' : ['ABC', 'BCD'][y % 2][x % 3]);
  assert.deepEqual(JSON.parse(a.storage.get('yarnside.board.v1')), plain(s.board));
  a.click('pTile'); assert.equal(s.board.items.length, 9, 'running it twice adds no duplicates');
  a.click('pUndoTile'); assert.deepEqual(plain(s.board), before); assert.deepEqual(plain(combine.compose().G), beforeG);
  assert.deepEqual(JSON.parse(a.storage.get('yarnside.board.v1')), before); assert.equal(a.ids.get('pUndoTile').disabled, true);
});

test('auto-tile preserves crop, mirror, remapping, row schedules and lean groups', () => {
  const { a, combine, s } = tileApp({ kind: 'chart', rows: ['AAAAA', 'ABBCA', 'ABBBA', 'AAAAA'], w: 9, h: 9, crop: { t: 1, b: 0, l: 1, r: 1 }, flip: true, remap: { C: 'D' }, yarn: ['A', 'B', 'A', 'B'] });
  s.lib[0].groups = [[1, 2, 1]];
  const snapshot = plain(s.board.items[0]); a.click('pTile');
  assert.equal(s.board.items.length, 9);
  for (const it of s.board.items) { const { x, y, ...settings } = plain(it), { x: ox, y: oy, ...original } = snapshot; assert.deepEqual(settings, original); assert.ok(x + 3 <= 9 && y + 3 <= 9); }
  const B = combine.compose(); assert.equal(B.groups.length, 9); assert.ok(B.groups.every(g => g[2] === 2), 'mirrored lean direction retained');
  assert.deepEqual(plain(B.yarn), ['A', 'B', 'A', 'A', 'B', 'A', 'A', 'B', 'A']);
  assert.equal(s.board.items[0].remap.C, 'D');
  s.board.items[1].crop.l = 0; assert.equal(s.board.items[0].crop.l, 1, 'copies have independent crop objects');
});

test('auto-tile respects A/B rows for odd-height motifs and keeps partial edge repeats out', () => {
  const { a, s } = tileApp({ kind: 'chart', rows: ['BAB', 'BAB', 'AAA'], w: 10, h: 10 });
  s.board.items[0].y = 1; a.click('pTile'); assert.equal(s.board.items.length, 6);
  assert.ok(s.board.items.every(it => [1, 5].includes(it.y) && it.x + 3 <= 10));
  assert.match(a.ids.get('tileNote').textContent, /spacer row/);
  for (const it of s.board.items) assert.equal((10 - (it.y + 3)) % 2, 0);
  a.click('pUndoTile'); a.ids.get('keepRows').checked = false; a.click('pTile');
  assert.ok(s.board.items.some(it => it.y === 4), 'without row alignment, repeats can touch');
  // A later board edit must not be lost to an old tiling snapshot.
  a.click('pMirror'); assert.equal(a.ids.get('pUndoTile').disabled, true);
  const edited = plain(s.board); a.click('pUndoTile'); assert.deepEqual(plain(s.board), edited);
});

test('auto-tile refuses an off-row source or excessive copy count without changing the board', () => {
  const off = tileApp({ kind: 'chart', rows: ['BAB', 'BAB', 'AAA'], w: 10, h: 10 }), before = plain(off.s.board);
  off.a.click('pTile'); assert.deepEqual(plain(off.s.board), before); assert.match(off.a.ids.get('tileNote').textContent, /onto its row pattern/);
  const big = tileApp({ rows: ['B'], w: 400, h: 400 }), original = plain(big.s.board);
  big.a.click('pTile'); assert.deepEqual(plain(big.s.board), original); assert.match(big.a.ids.get('tileNote').textContent, /2,000/);
});

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
  assert.match(a.ids.get('written').textContent, /Row 0 \(Color A\): Ch 5\. Begin row 1 in the second chain/);
  assert.ok(pdfText.some(t => t.startsWith('Ch 5. Begin row 1 in the second chain')));
  a.selectors['[data-tab]'].find(e => e.dataset.tab === 'chart').onclick();
  assert.ok(a.ids.get('chartCv').ops.some(o => o[0] === 'fillText' && o[1] === 'B'));
  for (const tab of ['preview', 'fabric']) { a.selectors['[data-tab]'].find(e => e.dataset.tab === tab).onclick(); assert.equal(a.ids.get(tab + 'Tab').hidden, false); assert.equal(a.ids.get('chartTab').hidden, true); }
  a.click('dlPrev'); a.click('dlChart');
  const out = process.env.MOSAIC_TEST_OUTPUT;
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'override.pdf'), Buffer.from(doc.output('arraybuffer'))); }
});

test('foundation has one extra chain without changing the chart or worked stitch counts', () => {
  for (const w of [1, 26, 80]) {
    const a = app(); a.open([ 'A'.repeat(w), 'B'.repeat(w), 'A'.repeat(w) ]);
    const d = a.derive(), text = Written.directions(plain(d.X));
    assert.match(text, new RegExp(`Row 0 \\(Color A\\): Ch ${w + 3}\\.`));
    assert.match(text, /second chain from the hook; the extra chain does not count as a stitch/);
    for (const line of text.split('\n').filter(l => /^Row [1-9]/.test(l))) {
      const row = Written.parseRow(line); assert.equal(row.count, w + 2); assert.equal(row.width, w);
    }
    a.selectors['[data-tab]'].find(e => e.dataset.tab === 'chart').onclick();
    assert.ok(a.ids.get('chartCv').ops.some(o => o[0] === 'fillText' && String(o[1]).includes(`Row 0 = ch ${w + 3} in A.`)));
  }
});

test('PDF lean endpoints match the site, including clipped repeat rows on chart pages', () => {
  const a = app(), events = [], H = 72, W = 10, X = zeros(H, W), G = zeros(H, W);
  // Render-only fixture exercises all three symbols on every possible page boundary.
  for (let i = 2; i < H; i++) { G[i][1] = 1; G[i][4] = 2; G[i][8] = 3; }
  const { jsPDF } = require('../site/vendor/jspdf.umd.min.js');
  a.window.jspdf = { jsPDF: function(opts) { const doc = new jsPDF(opts);
    for (const method of ['text', 'rect', 'line']) { const original = doc[method].bind(doc);
      doc[method] = (...args) => { events.push({ method, args, page: doc.internal.getCurrentPageInfo().pageNumber, color: doc.getDrawColor(), lw: doc.getLineWidth() }); return original(...args); }; }
    return doc; } };
  vm.runInContext(fs.readFileSync(path.join(site, 'pdf.js'), 'utf8'), a.context);
  const doc = a.window.MosaicPDF.build({ X, F: M.simulate(X), G, plan: C.defaultPlan(), title: 'Lean alignment regression', project: 'pillow' });
  const heads = events.filter(e => e.method === 'text' && /^Chart - Rows/.test(e.args[0])); assert.ok(heads.length > 1);
  let full = 0, clipped = 0;
  for (const head of heads) {
    const [, r0s, r1s] = head.args[0].match(/Rows (\d+) to (\d+)/), r0 = +r0s, r1 = +r1s;
    const cells = events.filter(e => e.page === head.page && e.method === 'rect' && e.args[2] === 12 && e.args[3] === 12 && e.args[4] === 'FD');
    assert.equal(cells.length, (r1 - r0 + 1) * (W + 2));
    const cs = 12, x0 = Math.min(...cells.map(e => e.args[0])), top = Math.min(...cells.map(e => e.args[1])), bottom = Math.max(...cells.map(e => e.args[1] + cs));
    const actual = events.filter(e => e.page === head.page && e.method === 'line' && ['#1a1a1a', '#191919'].includes(e.color) && Math.abs(e.lw - cs / 14) < 1e-8).map(e => e.args);
    const expected = [], screen = [], g = { beginPath() {}, moveTo(x, y) { this.start = [x, y]; }, lineTo(x, y) { if (this.strokeStyle === '#1a1a1a') screen.push([...this.start, x, y]); }, stroke() {} };
    a.window.MosaicRender.drawGroups(g, G, c => x0 + (c + 1.5) * cs, i => top + (r1 - 1 - i) * cs, cs);
    for (const [x1, y1, x2, y2] of screen) {
      if (y1 < top || y1 > bottom) continue;
      const t = y2 > bottom ? (bottom - y1) / (y2 - y1) : 1;
      expected.push([x1, y1, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      if (t < 1) clipped++; else full++;
    }
    assert.equal(actual.length, expected.length);
    actual.forEach((line, i) => line.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) < 1e-7, `page ${head.page}, segment ${i}, coordinate ${j}`)));
  }
  assert.ok(full > 0 && clipped > 0, 'check full anchors and page-edge clipping');
  const text = events.filter(e => e.method === 'text').map(e => String(e.args[0])).join(' ');
  assert.match(text, /ch 13 in Color A/); assert.match(text, /Back: with Color A, ch 13\./);
  if (process.env.MOSAIC_TEST_OUTPUT) { fs.mkdirSync(process.env.MOSAIC_TEST_OUTPUT, { recursive: true }); fs.writeFileSync(path.join(process.env.MOSAIC_TEST_OUTPUT, 'lean-alignment.pdf'), Buffer.from(doc.output('arraybuffer'))); }
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
