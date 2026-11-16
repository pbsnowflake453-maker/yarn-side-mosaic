# Pixel art → overlay mosaic crochet chart (static web app)
Open index.html (or deploy the folder to GitHub Pages / Netlify as-is). No server code, no build step.
Files: engine.js (rules, fixer, simulation, grid detection, auto-split), render.js (chart, compare, preview), app.js (UI), style.css.
tests/: test_regressions.js and test_pdf_export.js (plain Node), test_browser.js (Playwright, phone width).
