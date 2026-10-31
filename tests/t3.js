const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1200,height:900}}); await p.goto('http://localhost:8765/');
 await p.setInputFiles('#file', '/workspace/mosaic/char.png'); await p.waitForFunction(() => document.getElementById('detect').textContent.includes('Detected'));
 console.log(await p.textContent('#detect'));
 for (const s of ['1','2']) { await p.click(`[data-s="${s}"]`); await p.click('#go'); await p.waitForFunction(() => document.getElementById('status').textContent.startsWith('Done'), null, {timeout: 600000});
 console.log(s+'x', await p.textContent('#status'), (await p.$$eval('.cand p', e => e.map(x => x.textContent))).join(' || ')); }
 await p.screenshot({ path: '/workspace/mosaic/webapp/test_charizard.png', fullPage: true }); await b.close(); })();
