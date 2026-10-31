const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto('http://localhost:8765/');
  for (const [n, f] of [['heart', 'heart.gif'], ['star', 'star.jpg'], ['mushroom', 'mushroom.jpg']]) {
    await p.evaluate(() => document.getElementById('detect').textContent = ''); await p.setInputFiles('#file', '/workspace/mosaic/' + f);
    await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
    const det = await p.textContent('#detect');
    await p.uncheck('#stretch'); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
    const ns = await p.$$eval('.cand p', e => e.map(x => x.textContent));
    await p.check('#stretch'); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
    const ws = await p.$$eval('.cand p', e => e.map(x => x.textContent)); const t = await p.textContent('#status');
    console.log(n, '|', det, '\n  no-stretch:', ns.join(' || '), '\n  stretch:', ws.join(' || '), t);
    await p.screenshot({ path: `/workspace/mosaic/webapp/test_${n}.png`, fullPage: true });
    const png = await p.$eval('#chartCv', c => c.toDataURL()); require('fs').writeFileSync(`/workspace/mosaic/webapp/test_${n}_chart.png`, Buffer.from(png.split(',')[1], 'base64'));
  }
  const m = await b.newPage({ viewport: { width: 390, height: 844 } }); await m.goto('http://localhost:8765/');
  await m.setInputFiles('#file', '/workspace/mosaic/flower.png'); await m.waitForSelector('.swatch'); await m.click('#go');
  await m.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'));
  console.log('flower(phone):', await m.textContent('#detect'), (await m.$$eval('.cand p', e => e.map(x => x.textContent)))[0]);
  await m.screenshot({ path: '/workspace/mosaic/webapp/test_phone_flower.png', fullPage: true });
  await b.close();
})();
