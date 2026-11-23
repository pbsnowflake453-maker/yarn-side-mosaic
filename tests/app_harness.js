const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const site = path.resolve(__dirname, '../site');
// Exercise app handlers and real rendering functions. DOM/canvas stubs record
// operations; browser layout is deliberately outside this test's scope.
function app({ canvasFactory, fetch: fetchImage, Image: ImageClass, logger = console } = {}) {
  const ids = new Map(), storage = new Map();
  function element(id = '') {
    const ops = [], draws = [], native = canvasFactory ? canvasFactory(200, 200) : null, ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }), createRadialGradient: () => ({ addColorStop() {} }) }, {
      get: (o, key) => key in o ? o[key] : (...args) => { ops.push([key, ...args]); draws.push({ method: key, args, stroke: o.strokeStyle, fill: o.fillStyle }); }, set: (o, key, value) => (o[key] = value, true)
    });
    return { id, dataset: {}, style: {}, children: [], ops, draws, native, classList: { toggle() {} }, parentElement: { clientWidth: 620 }, clientWidth: 620, width: 200, height: 200,
      get textContent() { return this._textContent ?? String(this.innerHTML || '').replace(/<[^>]*>/g, ''); }, set textContent(value) { this._textContent = String(value); },
      querySelectorAll: () => [], getContext() { if (!native) return ctx; if (native.width !== this.width) native.width = this.width; if (native.height !== this.height) native.height = this.height; return native.getContext('2d'); }, replaceWith(e) { e.id = this.id; ids.set(this.id, e); },
      append(...args) { this.children.push(...args); }, appendChild(e) { this.children.push(e); },
      setAttribute() {}, insertAdjacentHTML() {}, scrollIntoView() {}, setPointerCapture() {}, showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
      getBoundingClientRect() { return { top: 0, left: 0, width: this.width, height: this.height }; }, toDataURL: () => native ? native.toDataURL('image/png') : 'data:image/png;base64,AAAA', click() { this.onclick?.(); }
    };
  }
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  for (const m of html.matchAll(/id="([^"]+)"/g)) ids.set(m[1], element(m[1]));
  const selectors = {};
  for (const attr of ['view', 'tab', 'tool', 'stripe', 'from', 'swap', 'rows', 'cols', 's', 'mv', 'crop']) {
    selectors[`[data-${attr}]`] = [...html.matchAll(new RegExp(`data-${attr}="([^"]+)"`, 'g'))].map(m => { const e = element(); e.dataset[attr] = m[1]; return e; });
  }
  const window = { scrollTo() {}, addEventListener() {} };
  const context = vm.createContext({ window, document: { getElementById: id => ids.get(id), createElement: () => element(), querySelectorAll: s => selectors[s] || [] },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, console: logger, fetch: fetchImage, Image: ImageClass, btoa: s => Buffer.from(s, 'binary').toString('base64'), confirm: () => true, setTimeout: f => f(), URL, Blob, navigator: {} });
  for (const f of ['engine', 'colors', 'written', 'render', 'combine', 'app']) vm.runInContext(fs.readFileSync(path.join(site, f + '.js'), 'utf8'), context, { filename: f });
  return { window, context, ids, selectors, storage, st: window._mosaicState, derive: window._mosaicDerive,
    open: (rows, yarn) => window.MosaicApp.openDesign(rows.slice().reverse(), null, [], 'Test', yarn), click: id => ids.get(id).onclick() };
}

module.exports = app;
