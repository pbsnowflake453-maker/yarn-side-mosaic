/* Stateful usability regressions. No browser or external fixtures required. */
const assert = require('node:assert/strict'), app = require('./app_harness.js');
const plain = value => JSON.parse(JSON.stringify(value)), KEY = 'yarnside.workspace.v1';
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS', name); }
const event = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, preventDefault() {} });

test('autosave and resume preserve full design state and editing preferences', () => {
  const a = app(); a.open(['BAB', 'BAB', 'AAA']); a.click('dSuggestLeans'); a.click('sugAll');
  a.st.d.K[0][0] = 1; a.st.d.mine[0][1] = 1; a.st.d.auto[0][2] = 1; a.st.d.yarn[1] = 'A';
  a.st.d.reference = { src: 'data:image/png;base64,AQID', label: 'Original image' };
  a.st.plan.C.push({ row: 3, hex: '#123abc' });
  a.ids.get('projectName').value = 'My sloth'; a.ids.get('projectName').onchange();
  a.click('dIn'); a.click('panMode'); a.click('quickPreview');
  const expected = plain(a.st.d), plan = plain(a.st.plan), b = app({ initialStorage: [...a.storage] });
  assert.equal(b.st.d, null, 'offer resume instead of automatically replacing the Start screen');
  assert.equal(b.ids.get('resumeProject').hidden, false); b.click('resumeProject');
  assert.deepEqual(plain(b.st.d), expected); assert.deepEqual(plain(b.st.plan), plan);
  assert.equal(b.ids.get('projectName').value, 'My sloth'); assert.equal(b.st.zoom, 1.5);
  assert.equal(b.st.interaction, 'pan'); assert.equal(b.st.pane, 'preview');
  assert.match(b.ids.get('saveStatus').textContent, /Saved on this device/);
});

test('named projects and Save as new project remain independent', () => {
  const a = app(); a.open(['AAA', 'BBB', 'AAA']); a.ids.get('projectName').value = 'First'; a.ids.get('projectName').onchange();
  const firstId = JSON.parse(a.storage.get(KEY)).currentId;
  a.click('copyProject'); let db = JSON.parse(a.storage.get(KEY)); assert.equal(db.projects.length, 2);
  const copyId = db.currentId; assert.notEqual(copyId, firstId);
  a.st.d.P[0][0] = 'C'; a.click('dIn');
  a.ids.get('projectList').value = firstId; a.click('openProject'); assert.equal(a.st.d.P[0][0], 'A');
  a.ids.get('projectList').value = copyId; a.click('openProject'); assert.equal(a.st.d.P[0][0], 'C');
  a.open(['BB', 'AA', 'BB']); db = JSON.parse(a.storage.get(KEY)); assert.equal(db.projects.length, 3);
  assert.equal(db.projects.find(p => p.id === firstId).name, 'First');
});

test('autosave preserves projects from other tabs and forks conflicting edits', () => {
  const a = app(); a.open(['AAA', 'BBB', 'AAA']);
  const db = JSON.parse(a.storage.get(KEY)), originalId = db.currentId, remote = plain(db.projects[0]);
  remote.id = 'another-tab'; remote.name = 'Another tab'; db.projects.push(remote);
  a.storage.set(KEY, JSON.stringify(db)); a.click('dIn');
  let saved = JSON.parse(a.storage.get(KEY)); assert.equal(saved.projects.length, 2); assert.ok(saved.projects.some(p => p.id === 'another-tab'));
  saved.projects.find(p => p.id === originalId).snapshot.design.P[0][0] = 'D'; a.storage.set(KEY, JSON.stringify(saved));
  a.st.d.P[0][0] = 'C'; a.click('dIn'); saved = JSON.parse(a.storage.get(KEY));
  assert.equal(saved.projects.length, 3); assert.equal(saved.projects.find(p => p.id === originalId).snapshot.design.P[0][0], 'D');
  assert.equal(saved.projects.find(p => p.id === saved.currentId).snapshot.design.P[0][0], 'C');
});

test('corrupt or unavailable storage never masquerades as a successful save', () => {
  const bad = '{"version":9,"projects":[]}', a = app({ initialStorage: [[KEY, bad]] });
  a.open(['AAA', 'BBB']); assert.equal(a.storage.get(KEY), bad); assert.match(a.ids.get('saveStatus').textContent, /unavailable/);
  assert.equal(a.window.MosaicWorkspace.validSnapshot({ version: 1, design: { P: {} }, plan: {} }), false);
  const b = app(); b.open(['AAA', 'BBB']); const saved = b.storage.get(KEY);
  b.context.localStorage.setItem = () => { throw Error('Quota exceeded'); };
  b.st.d.P[0][0] = 'C'; b.click('dIn');
  assert.equal(b.storage.get(KEY), saved); assert.equal(b.st.d.P[0][0], 'C'); assert.match(b.ids.get('saveStatus').textContent, /Could not autosave/);
  const unsaved = plain(b.st.d); b.open(['BBB', 'AAA']); assert.deepEqual(plain(b.st.d), unsaved, 'do not replace unsaved work when storage failed');
});

test('resume reads newer edits saved while the Start screen was already open', () => {
  const a = app(); a.open(['AAA', 'BBB', 'AAA']); const b = app({ initialStorage: [...a.storage] });
  const latest = JSON.parse(b.storage.get(KEY)); latest.projects[0].name = 'Updated elsewhere'; latest.projects[0].snapshot.design.P[0][0] = 'D';
  b.storage.set(KEY, JSON.stringify(latest)); b.click('resumeProject');
  assert.equal(b.st.d.P[0][0], 'D'); assert.equal(b.ids.get('projectName').value, 'Updated elsewhere');
  assert.equal(JSON.parse(b.storage.get(KEY)).projects.length, 1);
});

test('paint, Undo, Redo and new edits maintain consistent history', () => {
  const a = app(); a.open(['AAA', 'AAA', 'AAA']); const original = plain(a.st.d.P);
  const cv = a.ids.get('dCv'); cv.onpointerdown(event(12, 12)); cv.onpointerup(); const painted = plain(a.st.d.P);
  assert.notDeepEqual(painted, original); a.click('dUndo'); assert.deepEqual(plain(a.st.d.P), original);
  assert.equal(a.ids.get('dRedo').disabled, false); a.click('dRedo'); assert.deepEqual(plain(a.st.d.P), painted);
  a.click('dUndo'); a.ids.get('colA').value = '#abcdef'; a.ids.get('colA').oninput();
  assert.equal(a.ids.get('dRedo').disabled, true); a.click('dUndo'); assert.equal(a.st.plan.A[0].hex, '#ffffff');
  a.click('dRedo'); assert.equal(a.st.plan.A[0].hex, '#abcdef');
});

test('Move view pans without painting; simulation switching preserves zoom and position', () => {
  const a = app(); a.open(['AAA', 'BBB', 'AAA']); const before = plain(a.st.d);
  a.click('dIn'); a.click('panMode'); const cv = a.ids.get('dCv');
  cv.onpointerdown(event(100, 100)); cv.onpointermove(event(70, 60)); cv.onpointerup();
  assert.deepEqual(plain(a.st.d), before); assert.equal(a.ids.get('dWrap').scrollLeft, 30); assert.equal(a.ids.get('dWrap').scrollTop, 40);
  const pan = plain(a.st.pan); a.click('quickPreview'); assert.equal(a.st.pane, 'preview'); assert.equal(a.st.zoom, 1.5); assert.deepEqual(plain(a.st.pan), pan);
  assert.equal(a.ids.get('livePreviewWrap').scrollLeft, 30); a.click('showEditor'); assert.equal(a.ids.get('dWrap').scrollTop, 40);
  a.click('dFit'); assert.equal(a.st.zoom, 1); assert.deepEqual(plain(a.st.pan), { x: 0, y: 0 });
  a.click('paintMode'); assert.equal(a.st.interaction, 'paint');
});

test('Fix review changes nothing until applied, and supports cancel, Undo and Redo', () => {
  const a = app(); a.open(['B', 'A']); const before = plain(a.st.d), saved = a.storage.get(KEY), n = a.derive().n;
  a.click('dFix'); assert.equal(a.ids.get('fixDlg').open, true); assert.deepEqual(plain(a.st.d), before);
  assert.equal(a.storage.get(KEY), saved); assert.equal(a.derive().n, n); assert.equal(a.st.hist.length, 0);
  assert.ok(a.ids.get('fixAfter').children.length); a.click('fixCancel'); assert.deepEqual(plain(a.st.d), before);
  a.click('dFix'); a.click('fixApply'); assert.equal(a.derive().n, 0); const fixed = plain(a.st.d);
  a.click('dUndo'); assert.deepEqual(plain(a.st.d), before); a.click('dRedo'); assert.deepEqual(plain(a.st.d), fixed);
});

test('Fix review reports protected changes and rejects a stale proposal', () => {
  const a = app(); a.open(['B', 'A']); a.st.d.K[0][0] = a.st.d.K[1][0] = 1;
  a.click('dFix'); assert.match(a.ids.get('fixSummary').textContent, /protected squares must change/);
  a.ids.get('colA').value = '#123456'; a.ids.get('colA').oninput(); const edited = plain(a.st.d);
  assert.equal(a.ids.get('fixDlg').open, false); a.click('fixApply'); assert.deepEqual(plain(a.st.d), edited); assert.equal(a.st.plan.A[0].hex, '#123456');
});

function boardApp(kind = 'picture') {
  const a = app(), c = a.window.MosaicCombine, s = c._st;
  s.lib.push({ id: 'motif', name: 'Motif', kind, rows: kind === 'chart' ? ['BAB', 'BAB', 'AAA'] : ['BAB', 'ABA'], plan: a.window.MosaicColors.defaultPlan(), groups: [] });
  s.board = { w: 17, h: 11, choices: { retained: 'yes' }, items: [{ pid: 'motif', x: 0, y: 0, crop: { t: 0, b: 0, l: 0, r: 0 }, clear: false, flip: true, remap: {} }] };
  s.sel = 0; a.ids.get('keepRows').checked = true; a.ids.get('tileCenter').checked = true;
  a.ids.get('tileAcross').value = '3'; a.ids.get('tileDown').value = '2'; a.ids.get('tileGapX').value = '2'; a.ids.get('tileGapY').value = '1'; c.init();
  return { a, c, s };
}

test('repeat layout previews counts, spacing and centering, then applies and undoes exactly', () => {
  const { a, c, s } = boardApp(), before = plain(s.board), saved = a.storage.get('yarnside.board.v1');
  a.click('pPreviewLayout'); assert.deepEqual(plain(s.board), before); assert.equal(a.storage.get('yarnside.board.v1'), saved);
  assert.equal(s.layoutPreview.board.items.length, 6); assert.equal(a.ids.get('useBoard').disabled, true);
  assert.deepEqual(plain(s.layoutPreview.board.items.map(it => [it.x, it.y])), [[2,3],[7,3],[12,3],[2,6],[7,6],[12,6]]);
  a.click('pCancelLayout'); assert.deepEqual(plain(s.board), before); assert.equal(s.layoutPreview, null);
  a.click('pPreviewLayout'); a.click('pApplyLayout'); assert.equal(s.board.items.length, 6); assert.equal(s.board.choices.retained, 'yes');
  assert.equal(c.compose().G.length, 11); assert.ok(s.board.items.every(it => it.flip));
  a.click('pUndoTile'); assert.deepEqual(plain(s.board), before);
  a.click('pCenter'); assert.deepEqual(plain(s.board.items.map(it => [it.x, it.y])), [[7,4]]);
  a.click('pUndoTile'); assert.deepEqual(plain(s.board), before);
});

test('layout preview respects row alignment and refuses overlap, oversize or stale layouts', () => {
  const { a, s } = boardApp('chart'), before = plain(s.board);
  a.ids.get('tileGapX').value = '0'; a.ids.get('tileGapY').value = '0'; a.click('pPreviewLayout');
  const preview = s.layoutPreview.board; assert.ok(preview.items.every(it => (11 - (it.y + 3)) % 2 === 0));
  assert.equal(preview.items[3].y - preview.items[0].y, 4, 'odd-height rows receive an alignment gap');
  s.board.items[0].x = 1; a.click('pApplyLayout'); assert.equal(s.board.items.length, 1); assert.equal(s.board.items[0].x, 1);
  a.ids.get('tileAcross').value = '50'; a.click('pPreviewLayout'); assert.equal(s.layoutPreview, null); assert.match(a.ids.get('tileNote').textContent, /Enlarge the board/);
  a.ids.get('tileAcross').value = '3'; s.board.items.push({ ...plain(before.items[0]), x: 7, y: 4 }); const occupied = plain(s.board);
  a.click('pPreviewLayout'); assert.equal(s.layoutPreview, null); assert.deepEqual(plain(s.board), occupied); assert.match(a.ids.get('tileNote').textContent, /overlap/);
});

test('auto-tile uses spacing controls without duplicating or clipping repeats', () => {
  const { a, s } = boardApp(); a.click('pTile');
  assert.ok(s.board.items.length > 1); assert.ok(s.board.items.every(it => it.x % 5 === 0 && it.y % 3 === 0 && it.x + 3 <= 17 && it.y + 2 <= 11));
  const count = s.board.items.length; a.click('pTile'); assert.equal(s.board.items.length, count);
});

console.log(`${checks} usability regression groups passed.`);
