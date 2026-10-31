const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); let errs = 0;
  p.on('pageerror', e => { errs++; console.log('PAGE ERROR', e.message); });
  await p.goto('http://localhost:8765/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  for (const f of ['heart.gif', 'star.jpg', 'mushroom.jpg', 'mario.jpg']) {
    await p.evaluate(() => document.getElementById('detect').textContent = ''); await p.setInputFiles('#file', '/workspace/mosaic/' + f);
    await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
    await p.click('[data-s="2"]'); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
    const r = await p.evaluate(() => { const t = document.getElementById('written').textContent, W = window.MosaicWritten; const lines = t.split('\n').filter(l => /^Row [1-9]/.test(l)); return { n: lines.length, ok: lines.every(l => W.parseRow(l) !== null), first: lines.slice(0, 3).join('\n') }; });
    console.log(f, 'rows', r.n, 'parse ok', r.ok);
  }
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlTxt')]); await dl.saveAs('/workspace/mosaic/webapp/tests/mosaic_pattern.txt');
  await p.$eval('#written', e => e.scrollIntoView()); await p.screenshot({ path: '/workspace/mosaic/webapp/tests/written_panel.png' });
  console.log('errors', errs); await b.close();
})();
