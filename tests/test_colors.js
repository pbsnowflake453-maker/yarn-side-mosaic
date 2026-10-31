const { chromium } = require('playwright'); const fs = require('fs');
const OUT = '/workspace/mosaic/webapp/tests/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto('http://localhost:8765/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const clickRow = async row => { await p.$eval('#chartCv', c => c.scrollIntoView({block:'center'})); const box = await p.$('#chartCv'); const bb = await box.boundingBox();
    const g = await p.$eval('#chartCv', c => ({ ...c._geo, h: c.height, cw: c.width }));
    const s = bb.height / g.h; await p.mouse.click(bb.x + (g.stripX + g.stripW / 2) * s, bb.y + (g.top + (g.H - row + 0.5) * g.cell) * s); };
  const pickColor = async hex => p.click(`.bank-sw[title="${hex}"]`);
  for (const [n, f, steps] of [['heart', 'heart.gif', [[5, '#c8102e'], [8, '#1f5fbf']]], ['star', 'star.jpg', [[7, '#f6c90e'], [4, '#c8102e'], [12, '#2e8b57']]]]) {
    await p.evaluate(() => document.getElementById('detect').textContent = ''); await p.setInputFiles('#file', '/workspace/mosaic/' + f);
    await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
    await p.uncheck('#stretch'); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
    for (const [row, hex] of steps) { await clickRow(row); await pickColor(hex); console.log(n, 'row', row, hex, '->', await p.textContent('#colorNote')); }
    // verify: simulation still OK, and fabric pixel colors follow plan
    const res = await p.evaluate(() => { const card = document.querySelector('.cand.sel p').textContent; return card; });
    console.log(n, 'candidate:', res);
    const chk = await p.evaluate(() => { const fab = document.getElementById('fabCv'), g = fab.getContext('2d');
      const ch = document.getElementById('chartCv'), gg = ch.getContext('2d'), geo = ch._geo, rows = [];
      for (let r = 1; r <= geo.H; r++) { const y = geo.top + (geo.H - r + 0.5) * geo.cell, d = gg.getImageData(geo.stripX + geo.stripW / 2, y, 1, 1).data; rows.push(`${r}:${[d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`); }
      return rows.join(' '); });
    console.log(n, 'strip colors:', chk);
    await p.screenshot({ path: OUT + `colors_${n}.png`, fullPage: true });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dlChart')]); await dl.saveAs(OUT + `colors_${n}_chart_download.png`);
    fs.writeFileSync(OUT + `colors_${n}_preview.png`, Buffer.from((await p.$eval('#prevCv', c => c.toDataURL())).split(',')[1], 'base64'));
  }
  // bank: add hex, persists after reload
  await p.fill('#hex', '#8b4513'); await p.click('#addHex'); await p.reload(); await p.setInputFiles('#file', '/workspace/mosaic/heart.gif');
  await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected')); await p.click('#go');
  await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
  console.log('bank after reload:', await p.$$eval('.bank-sw', e => e.map(x => x.title).filter(Boolean).join(' ')));
  await b.close();
})();
