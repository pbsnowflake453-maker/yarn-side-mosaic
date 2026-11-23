# Yarn Side Mosaic — pixel art to overlay mosaic crochet patterns

A static, browser-only web app for **The Yarn Side** (Samantha Wallace's crochet pattern brand). Upload pixel art; the app detects the grid, converts it to an **overlay mosaic crochet** chart (two colors, A = background on odd rows, B on even rows), auto-fixes unworkable spots, shows chart / compare / preview views, writes row-by-row written directions, and exports a branded **PDF pattern** (cover, materials/yarn, chart, written rows, finishing, copyright & terms).

- Live (Netlify): site `frolicking-snickerdoodle-7fb9e0` — **publish directory: `site/`**
- No server, no build step. jsPDF is vendored in `site/vendor/`.

Start offers 1×, 2×, 3×, 5×, 6× and 9× pixel enlargement. The chosen size applies both to Design and to saved picture pieces. In Combine, select a piece and use **Auto-tile board** to fill free space with whole repeats; **Undo tiling** restores the prior board until another board or library edit. Copies retain crop, mirror, transparency and color remapping. With Keep row pattern enabled, default-schedule chart pieces with odd heights get a spacer row between repeats. Existing pieces are preserved, partial edge copies are omitted, and tiling is limited to 2,000 total board pieces.

Named projects autosave on the current device, including protected pixels, lean groups, row yarns, original reference, yarn colors and view preferences. Start offers resume and a project selector; Save as new project creates an independent copy. There is no cloud synchronization. Unreadable or full storage is reported without claiming a successful save, and concurrent edits in another tab are preserved as separate copies.

The editor has a compact sticky toolbar, Undo/Redo, Paint/Move view modes, Fit design, and contextual help. The shared simulation appears beside the editor on desktop, or through a one-tap switch on phones; zoom and view position are retained. Review fix shows before/after pixels and protection changes before Apply fix changes the design. Combine supports centering a selected piece and previewing an across/down repeat layout with column/row gaps; applying it replaces only the selected piece, preserves other items, and can be undone. It refuses overlaps and layouts that do not fit the board.

## Layout
```
site/            <- publish this folder as-is
  index.html, style.css, logo.png
  engine.js      mosaic rules, fixer, simulation, grid detection, auto-split (Node + browser)
  render.js      chart, compare and preview drawing
  written.js     written row directions ((…) xN repeats) + parser for round-trip tests
  colors.js      yarn color handling
  workspace.js   named projects, device-local autosave and validation
  pdf.js         Yarn Side PDF pattern template (finishing page, border color, Ravelry link)
  app.js         UI; passes project type + border color to MosaicPDF.build
  vendor/        jspdf
plans/finishing-plan.md   approved finishing plan + what is still pending
tests/           Node/Playwright test scripts
```

## Build / test

- Self-contained regression suite: `node tests/test_regressions.js` (no install or external image fixtures). Covers carried dc, custom row yarns, conservative lean-anchor/corner checks, Fix, Undo, saved pieces/Combine, stripes, PDF yarn labels, and generated-chart round trips. Set `MOSAIC_TEST_OUTPUT=/tmp/mosaic-tests` to keep the sample PDF for visual checks.
- Usability state checks: `node tests/test_usability.js`. Covers autosave/resume, independent named projects, storage failures and concurrent tabs, Undo/Redo, panning/view switching, review/apply/cancel/stale fixes, and repeat layout preview/apply/undo with spacing, centering and row alignment.
- PDF submission checks: `node tests/test_pdf_export.js` runs the actual Make PDF handler with real jsPDF output, including mobile image-decode failure, missing/damaged logos, retry/cache behavior, and visible pattern errors. Uses the bundled logo and jsPDF; no install needed. `MOSAIC_TEST_OUTPUT` saves the generated PDFs for inspection.
- Serve: `cd site && python3 -m http.server 8813` and open it.
- Browser smoke test (phone width): `npm i playwright`, serve the site on port 8765, then `node tests/test_browser.js`. Draws its own test picture; covers upload → Fix → Suggest leans (tap and Add all) → Selected row tools → PDF → Combine. `MOSAIC_TEST_OUTPUT` keeps screenshots and the PDF. Render the PDF with `pdftoppm` and check it visually.
- Deploy: zip the **contents** of `site/` and drop on Netlify. **Ask Samantha before publishing changes.**

See **AGENTS.md** for rules.
