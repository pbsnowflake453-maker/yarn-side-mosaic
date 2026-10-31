# AGENTS.md — rules for any AI agent editing Yarn Side Mosaic

**Ask Samantha before publishing changes.** Never deploy or add store links without her OK. Batch changes and test locally first. She often discusses ideas before building — don't build until she approves.

## Brand: The Yarn Side
- Name is always **"The Yarn Side"**; logo `site/logo.png`. PDF accent color **#125765** (teal), text #222222, grey #666666; Helvetica in the PDF.
- PDF footer: "The Yarn Side · <title> Overlay Mosaic Pattern · For personal use…". Copyright & Terms page includes the store link.
- Store links: **Ravelry only** — https://www.ravelry.com/designers/the-yarn-side (terms page + site footer). **Etsy link is pending**: do not add placeholders; leave it out until Samantha gives the URL.

## Mosaic rules (engine.js)
- Overlay mosaic, worked flat, RS rows only; row 0 = foundation chain (A). Odd rows = color A (background), even rows = color B.
- A cell showing the opposite of its row color is a mismatch and needs an X (dc worked 2 rows down) directly above. Workable only if no two vertically adjacent mismatches in a column and none in the top row; the fixer edits the minimum pixels to comply.
- Written directions use sc / dc with repeats as (…) xN; they must round-trip through the parser (test_written.js).
- Defaults: worsted #4, H/5 mm hook, gauge 15 sts x 15 rows = 4".

## Finishing plan (approved; see plans/finishing-plan.md)
- Size comes from the chart (no size picker). Samantha picks the project type in the PDF dialog: **Blanket, Pillow, Wall hanging, Chart only** (bags later). W = sts across incl. border stitches, R = rows incl. chain; generic text with counts swapped in.
- **Envelope border**: knot tail pairs and trim ~1"; base round of loose surface sl st (~W top/bottom, R per side, 1 per row end); back flap in back loops (hdc, ch 2 corners; rnd 2 with (hdc, ch 2, hdc) corners); front flap in the other loops; join flaps with sc enclosing tails, 3 sc in corners. Adds ~1"/side: finished ≈ (W·4/15+2)" x (R·4/15+2)".
- **Border color** choice: Color A, Color B, or "your own color".
- **Pillow**: back panel ch W, rows to match R; join WS together with sc, 3 sc corners; insert form before closing.
- **Wall hanging**: rod pocket ~6 rows sc across the top, fold and sew; or evenly spaced tabs.
- Still pending: bags, per-color yarn estimate, Etsy link.
