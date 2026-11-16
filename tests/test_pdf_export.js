/* Run the actual asynchronous Make PDF submit handler with real jsPDF output. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const app = require('./app_harness.js');
const { jsPDF } = require('../site/vendor/jspdf.umd.min.js');
const logo = fs.readFileSync(path.resolve(__dirname, '../site/logo.png'));
const preview = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMUCk9lYGBgYmBgYGBgAAAJfwDSXmT7LAAAAABJRU5ErkJggg==';
const response = (bytes, ok = true) => ({ ok, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
function setup(fetchImage) {
  let imageDecodes = 0;
  class BrokenMobileImage { async decode() { imageDecodes++; throw new Error('The source image cannot be decoded.'); } }
  const messages = [], saved = [], text = [];
  const a = app({ fetch: fetchImage, Image: BrokenMobileImage, logger: { warn: (...args) => messages.push(args), error: (...args) => messages.push(args), log() {} } });
  a.window.jspdf = { jsPDF: function(opts) { const doc = new jsPDF(opts), original = doc.text.bind(doc);
    doc.text = (s, ...args) => { text.push(String(s)); return original(s, ...args); };
    doc.save = name => { saved.push({ doc, name }); return doc; }; return doc; } };
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../site/pdf.js'), 'utf8'), a.context);
  a.window.MosaicRender.drawPreview = () => ({ width: 2, height: 2, toDataURL: () => preview });
  a.open(['AAA', 'BBB', 'AAA']);
  for (const [id, value] of Object.entries({ pdfTitle: 'Export check', pdfNotes: '', pdfIdeas: '', pdfProject: 'chart', pdfBorder: 'A' })) a.ids.get(id).value = value;
  a.click('mkPdf');
  return { ...a, saved, text, messages, decodes: () => imageDecodes, submit: () => a.ids.get('pdfForm').onsubmit({ preventDefault() {} }) };
}
function verifySaved(a, label = 'valid-logo') {
  assert.ok(a.saved.length, 'PDF should export even when browser Image.decode rejects');
  assert.equal(a.decodes(), 0, 'PDF export must not depend on browser image decoding');
  assert.equal(a.ids.get('pdfDlg').open, false);
  const data = Buffer.from(a.saved.at(-1).doc.output('arraybuffer')); assert.equal(data.subarray(0, 4).toString(), '%PDF');
  if (process.env.MOSAIC_TEST_OUTPUT) { fs.mkdirSync(process.env.MOSAIC_TEST_OUTPUT, { recursive: true }); fs.writeFileSync(path.join(process.env.MOSAIC_TEST_OUTPUT, `export-${label.replace(/[^a-z0-9]+/gi, '-')}.pdf`), data); }
}
(async () => {
  const a = setup(async () => response(logo)); await a.submit(); verifySaved(a);
  assert.ok(Object.values(a.saved[0].doc.internal.collections.addImage_images).some(im => im.width === 960 && im.height === 300), 'real brand logo remains embedded');
  assert.equal(a.text.includes('The Yarn Side'), false, 'valid logo does not use the text fallback');
  console.log('PASS real PDF export with a mobile Image.decode failure');
  for (const [name, fetchImage] of [
    ['network failure', async () => { throw new Error('Failed to fetch'); }],
    ['missing logo', async () => response([], false)],
    ['HTML instead of PNG', async () => response(Buffer.from('<html>not found</html>'))],
    ['damaged PNG', async () => response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))]
  ]) { const b = setup(fetchImage); await b.submit(); verifySaved(b, name); assert.ok(b.text.includes('The Yarn Side'), 'fallback keeps the brand name'); console.log('PASS export with', name); }
  let requests = 0;
  const retry = setup(async () => { requests++; if (requests === 1) throw new Error('temporary network failure'); return response(logo); });
  await retry.submit(); retry.click('mkPdf'); await retry.submit(); retry.click('mkPdf'); await retry.submit();
  verifySaved(retry, 'retry'); assert.equal(retry.saved.length, 3); assert.equal(requests, 2, 'retry failed load; cache the successful logo');
  console.log('PASS logo retry and cache');
  const failed = setup(async () => response(logo)), build = failed.window.MosaicPDF.build;
  failed.window.MosaicPDF.build = () => { throw new Error('Unexpected pattern error'); };
  await failed.submit(); assert.equal(failed.saved.length, 0); assert.equal(failed.ids.get('pdfDlg').open, true);
  assert.match(failed.ids.get('pdfNote').innerHTML, /Unexpected pattern error/);
  failed.window.MosaicPDF.build = build; await failed.submit(); verifySaved(failed, 'pattern-retry');
  assert.equal(failed.ids.get('pdfBorderWrap').hidden, true); assert.equal(failed.ids.get('pdfDlg').scrollTop, 0);
  console.log('PASS real pattern errors remain visible and the form can be retried');
})().catch(e => { console.error(e); process.exitCode = 1; });
