# Yarn Side Mosaic — pixel art to overlay mosaic crochet patterns

A static, browser-only web app for **The Yarn Side** (Samantha Wallace's crochet pattern brand). Upload pixel art; the app detects the grid, converts it to an **overlay mosaic crochet** chart (two colors, A = background on odd rows, B on even rows), auto-fixes unworkable spots, shows chart / compare / preview views, writes row-by-row written directions, and exports a branded **PDF pattern** (cover, materials/yarn, chart, written rows, finishing, copyright & terms).

- Live (Netlify): site `frolicking-snickerdoodle-7fb9e0` — **publish directory: `site/`**
- No server, no build step. jsPDF is vendored in `site/vendor/`.

## Layout
```
site/            <- publish this folder as-is
  index.html, style.css, logo.png
  engine.js      mosaic rules, fixer, simulation, grid detection, auto-split (Node + browser)
  render.js      chart, compare and preview drawing
  written.js     written row directions ((…) xN repeats) + parser for round-trip tests
  colors.js      yarn color handling
  pdf.js         Yarn Side PDF pattern template (finishing page, border color, Ravelry link)
  app.js         UI; passes project type + border color to MosaicPDF.build
  vendor/        jspdf
plans/finishing-plan.md   approved finishing plan + what is still pending
tests/           Node/Playwright test scripts
```

## Build / test
- Serve: `cd site && python3 -m http.server 8813` and open it.
- Tests: `npm i playwright` then e.g. `node tests/test.js`, `node tests/test_written.js`, `node tests/test_pdf.js` (paths in the scripts may point at the original box; adjust). Render the PDF with `pdftoppm` and check it visually.
- Deploy: zip the **contents** of `site/` and drop on Netlify. **Ask Samantha before publishing changes.**

See **AGENTS.md** for rules.
