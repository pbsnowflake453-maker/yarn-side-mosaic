const { chromium } = require('/tmp/pw/node_modules/playwright'); const OUT = '/workspace/mosaic/webapp/tests/pdf2/'; require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 }, acceptDownloads: true }); let errs = 0;
  p.on('pageerror', e => { errs++; console.log('PAGE ERROR', e.message); }); p.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await p.goto('http://localhost:8765/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const clickRow = async row => { await p.$eval('#chartCv', c => c.scrollIntoView({block:'center'})); const bb = await (await p.$('#chartCv')).boundingBox();
    const g = await p.$eval('#chartCv', c => ({ ...c._geo, h: c.height })); const s = bb.height / g.h; await p.mouse.click(bb.x + (g.stripX + g.stripW / 2) * s, bb.y + (g.top + (g.H - row + 0.5) * g.cell) * s); };
  for (const [n, f, sc, steps, title, names] of [['heart', 'heart.gif', 1, [], 'Little Heart', ['Cream', 'Cherry Red']], ['star', 'star.jpg', 1, [[7, '#f6c90e'], [4, '#c8102e'], [12, '#2e8b57']], 'Lucky Shooting Star of the Midnight Sky', ['Snow', '', 'Ruby']],
    ['mushroom', 'mushroom.jpg', 2, [], 'Power Mushroom', []], ['mario', 'mario.jpg', 2, [], "Mario's Big Day", []]]) {
    await p.evaluate(() => document.getElementById('detect').textContent = ''); await p.setInputFiles('#file', '/workspace/mosaic/' + f);
    await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
    await p.click(`[data-s="${sc}"]`); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'), null, { timeout: 120000 });
    for (const [row, hex] of steps) { await clickRow(row); await p.click(`.bank-sw[title="${hex}"]`); console.log(n, 'change', row, hex, await p.textContent('#colorNote')); }
    await p.click('#mkPdf'); await p.fill('#pdfTitle', title); await p.selectOption('#pdfProject', {heart:'blanket',star:'pillow',mushroom:'wall',mario:'chart'}[n]); if(n==='star') await p.selectOption('#pdfBorder','C'); const ins = await p.$$('#pdfColors input'); for (let i = 0; i < names.length && i < ins.length; i++) await ins[i].fill(names[i]);
    if (n === 'heart') { await p.fill('#pdfNotes', 'Make a swatch first.'); }
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdfGo')]); console.log(n, 'file:', dl.suggestedFilename(), 'summary:', await p.textContent('#summary'));
    await dl.saveAs(OUT + n + '.pdf');
  }
  console.log('errors', errs); await b.close();
})();
