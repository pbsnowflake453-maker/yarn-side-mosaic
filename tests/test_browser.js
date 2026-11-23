// Real-browser smoke test at phone width. Needs Playwright (`npm i playwright`) and a server:
//   cd site && python3 -m http.server 8765      then: node tests/test_browser.js
// Draws its own test picture, so no image files are needed. Screenshots go to MOSAIC_TEST_OUTPUT if set.
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP: Playwright is not installed (npm i playwright).'); process.exit(0); }
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const URL = process.env.MOSAIC_URL || 'http://localhost:8765/', OUT = process.env.MOSAIC_TEST_OUTPUT;
const shot = async (p, name) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }); } };

(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
  // a little heart with a yellow (D) square and a green (C) stripe
  const png = await p.evaluate(() => { const art = ['..........', '..RR..RR..', '.RRRRRRRR.', '.RRYRRRRR.', '.RRRRRRRR.', '..RRRRRR..', '...RRRR...', '....RR....', '..........', '..GGGGGG..'];
    const col = { '.': '#f0ebdc', R: '#c8102e', Y: '#f6c90e', G: '#2e8b57' }, s = 10, cv = document.createElement('canvas'); cv.width = cv.height = 100; const g = cv.getContext('2d');
    art.forEach((row, y) => [...row].forEach((ch, x) => { g.fillStyle = col[ch]; g.fillRect(x * s, y * s, s, s); })); return cv.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles('#file', { name: 'heart.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
  for (const scale of [5, 6, 9]) assert.ok(await p.isVisible(`[data-s="${scale}"]`));
  await p.click('#auto4Btn'); await p.click('#startDesign'); await p.waitForSelector('#designView:not([hidden])');
  await p.click('#dFix'); assert.ok(await p.isVisible('#fixDlg')); await p.click('#fixApply'); assert.match(await p.textContent('#dNote'), /Fixed/);

  // Named autosave restores the complete editable design after a reload.
  await p.fill('#projectName', 'Browser heart'); await p.click('#dFit');
  const savedDesign = await p.evaluate(() => JSON.stringify(window._mosaicState.d));
  await p.reload(); await p.click('#resumeProject');
  assert.equal(await p.inputValue('#projectName'), 'Browser heart');
  assert.equal(await p.evaluate(() => JSON.stringify(window._mosaicState.d)), savedDesign);
  await p.click('#showSimulation'); assert.ok(await p.isVisible('#livePreviewWrap')); assert.ok(!(await p.isVisible('#dWrap')));
  await p.click('#dIn'); const savedZoom = await p.evaluate(() => window._mosaicState.zoom);
  await p.click('#showEditor'); assert.equal(await p.evaluate(() => window._mosaicState.zoom), savedZoom);
  await p.click('#dFit'); await shot(p, 'workspace');

  // Suggest leans: shows spots, adds nothing until asked
  const G0 = await p.evaluate(() => JSON.stringify(window._mosaicState.d.G));
  await p.click('#advancedTools summary'); await p.click('#dSuggestLeans'); const nSug = await p.evaluate(() => window._mosaicState.sug.length);
  assert.ok(nSug > 0, 'some spots suggested'); assert.equal(await p.evaluate(() => JSON.stringify(window._mosaicState.d.G)), G0, 'nothing added yet');
  assert.ok(await p.isVisible('#sugBox')); await shot(p, 'suggest');
  // tap the first suggested spot on the editor
  const [si, sb] = await p.evaluate(() => window._mosaicState.sug[0]);
  await p.$eval('#dCv', c => c.scrollIntoView({ block: 'center' }));
  const eb = await (await p.$('#dCv')).boundingBox(), ec = await p.$eval('#dCv', c => ({ cell: c._cell, H: c._H, w: c.width }));
  const es = eb.width / ec.w; await p.mouse.click(eb.x + (sb + .5) * ec.cell * es, eb.y + (ec.H - 1 - si + .5) * ec.cell * es);
  assert.equal(await p.evaluate(([i, b]) => window._mosaicState.d.G[i][b] > 0, [si, sb]), true, 'tapped spot added');
  assert.equal(await p.evaluate(() => window._mosaicState.sug.length), nSug - 1);
  await p.click('#sugHide'); assert.ok(!(await p.isVisible('#sugBox')));
  await p.click('#dUndo'); assert.equal(await p.evaluate(() => JSON.stringify(window._mosaicState.d.G)), G0, 'undo takes it out');

  // Selected row panel: row tools wait for a row, then work on it
  await p.click('[data-tab="chart"]'); assert.ok(await p.isDisabled('#yarnA'));
  await p.$eval('#chartCv', c => c.scrollIntoView({ block: 'center' }));
  const g = await p.$eval('#chartCv', c => ({ ...c._geo, h: c.height })), cb = await (await p.$('#chartCv')).boundingBox(), s = cb.height / g.h;
  await p.mouse.click(cb.x + (g.stripX + g.stripW / 2) * s, cb.y + (g.top + (g.H - 4 + .5) * g.cell) * s);
  assert.match(await p.textContent('#selRowInfo'), /^Row 4 · worked in B/); assert.ok(!(await p.isDisabled('#yarnA')));
  await p.click('#yarnA'); assert.match(await p.textContent('#selRowInfo'), /worked in A \(changed\)/);
  await p.locator('.bank-sw').nth(6).click(); assert.match(await p.textContent('#colorNote'), /From row 4 up/);
  await shot(p, 'row_panel');
  await p.click('#yarnReset'); assert.match(await p.textContent('#selRowInfo'), /worked in B · /);

  // chart notes wrap instead of being squeezed: the canvas fits the phone and grows taller instead
  const cw = await p.$eval('#chartCv', c => c.width); assert.ok(cw < 700);

  // PDF
  if (!(await p.isDisabled('#dFix'))) { await p.click('#dFix'); await p.click('#fixApply'); }
  await p.click('#mkPdf'); await p.fill('#pdfTitle', 'Smoke Heart');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#pdfGo')]); assert.ok(dl);
  if (OUT) await dl.saveAs(path.join(OUT, 'smoke.pdf'));

  // Combine round trip
  await p.click('#saveDesign'); await p.click('[data-view="combine"]'); await p.click('#lib button:has-text("Add to board")');
  const boardBeforeTile = await p.evaluate(() => JSON.stringify(window.MosaicCombine._st.board));
  await p.click('#pTile'); assert.match(await p.textContent('#tileNote'), /Added \d+ cop/);
  assert.ok(await p.isEnabled('#pUndoTile')); await shot(p, 'auto_tile');
  await p.click('#pUndoTile'); assert.equal(await p.evaluate(() => JSON.stringify(window.MosaicCombine._st.board)), boardBeforeTile);
  await p.click('#bFit'); await p.click('#useBoard'); await p.waitForSelector('#designView:not([hidden])');

  assert.deepEqual(errs, [], 'no page errors'); console.log('PASS browser smoke test (phone width)'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
