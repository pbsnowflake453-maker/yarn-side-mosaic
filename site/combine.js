/* Combine charts: a library of saved pieces and a board to place, overlap, crop and mirror them on.
   A piece is a grid of letters (A, B, C, D; top row first). The board opens in the Design editor. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const LIB = 'yarnside.pieces.v1', BOARD = 'yarnside.board.v1';
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked: keep working in memory */ } };
  const st = { lib: load(LIB, []), board: load(BOARD, { w: 40, h: 30, items: [] }), sel: -1, zoom: 1, drag: null };
  const saveAll = () => { store(LIB, st.lib); store(BOARD, st.board); };
  const piece = id => st.lib.find(p => p.id === id);
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- piece geometry ---------- */
  const fullW = p => p.rows[0].length, fullH = p => p.rows.length;
  const dims = it => { const p = piece(it.pid); return { w: fullW(p) - it.crop.l - it.crop.r, h: fullH(p) - it.crop.t - it.crop.b }; };
  /* letter at (row, col) inside the item's cropped, possibly mirrored window */
  function cellOf(it, y, x) { const p = piece(it.pid), { w } = dims(it), xx = it.flip ? w - 1 - x : x;
    const row = p.rows[y + it.crop.t], col = it.flip ? xx + it.crop.r : xx + it.crop.l; return row[col]; }
  /* crop to the squares that aren't background */
  function trimmed(p) { const H = fullH(p), W = fullW(p); let t = 0, b = 0, l = 0, r = 0;
    const rowEmpty = y => !/[BCD]/.test(p.rows[y]), colEmpty = x => p.rows.every(row => row[x] === 'A');
    while (t < H - 1 && rowEmpty(t)) t++; while (b < H - 1 - t && rowEmpty(H - 1 - b)) b++;
    while (l < W - 1 && colEmpty(l)) l++; while (r < W - 1 - l && colEmpty(W - 1 - r)) r++;
    return { t, b, l, r }; }
  /* chart pieces keep their stitch pattern only if their bottom row lands on a row of the same kind (A row or B row) */
  function rowsOK(it) { const p = piece(it.pid); if (p.kind !== 'chart') return true;
    const { h } = dims(it), boardRow = st.board.h - (it.y + h) + 1, pieceRow = it.crop.b + 1; return (boardRow - pieceRow) % 2 === 0; }

  /* ---------- colors ---------- */
  const Cl = () => root.MosaicColors;
  /* a piece's colors as a plan (older pieces stored one hex per letter) */
  function pplan(p) { if (p.plan) return Cl().fullPlan(JSON.parse(JSON.stringify(p.plan)));
    const pl = Cl().defaultPlan(); if (p.hex) for (const L of 'ABCD') if (p.hex[L]) pl[L][0].hex = p.hex[L]; return pl; }
  const pcolor = (p, L, pr) => Cl().colorOf(pplan(p), L, pr);
  const letterOf = (it, L0) => (it.remap && it.remap[L0]) || L0;

  /* ---------- composing ---------- */
  /* Letters for the whole board; leaning groups of design pieces on their row pattern (a group is dropped when a
     piece above covers any of its squares); and the yarn colors. Every square asks its yarn for its piece's color:
     A / B squares ask the row yarn that shows there (a square in the other row's color is the dc from the row above),
     C / D squares ask their own row's strand. Different pieces asking one yarn for different colors on the same row
     is a question for you (board.choices); so is a row that would carry both C and D. */
  function compose() { const { w, h, items } = st.board, G = [...Array(h)].map(() => new Array(w).fill('A')), own = [...Array(h)].map(() => new Array(w).fill(-1)), col = [...Array(h)].map(() => new Array(w).fill(null)); let groups = [];
    const touches = (g, by, bx) => (by === g[0] || by === g[0] + 1) && bx >= g[1] - 1 && bx <= g[1] + 1;
    items.forEach((it, ii) => { const p = piece(it.pid); if (!p) return; const d = dims(it), Wf = fullW(p), Hf = fullH(p);
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const by = it.y + y, bx = it.x + x; if (by < 0 || bx < 0 || by >= h || bx >= w) continue;
        const L0 = cellOf(it, y, x); if (L0 === 'A' && it.clear) continue;
        G[by][bx] = letterOf(it, L0); own[by][bx] = ii; col[by][bx] = pcolor(p, L0, Hf - (y + it.crop.t)); if (groups.length) groups = groups.filter(g => !touches(g, by, bx)); }
      if (p.kind === 'chart' && p.groups && rowsOK(it)) p.groups.forEach(([t, c, bits]) => {
        const y = t - it.crop.t, x = it.flip ? Wf - 1 - c - it.crop.l : c - it.crop.l, b = it.flip ? ((bits & 1) << 1) | ((bits & 2) >> 1) : bits;
        if (y < 0 || y >= d.h || x < 0 || x >= d.w) return; const by = it.y + y, bx = it.x + x; if (by >= 0 && by < h && bx >= 0 && bx < w) groups.push([by, bx, b]); }); });
    // what each yarn is asked for, row by row (rows counted from the bottom)
    const ask = { A: {}, B: {}, C: {}, D: {} }, yarnOf = Cl().yarnOf;
    for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) { const ii = own[by][bx]; if (ii < 0) continue; const L = G[by][bx], R = h - by;
      const Q = L === 'C' || L === 'D' ? R : yarnOf(R) === L || R + 1 > h ? R : R + 1;
      const m = ask[L][Q] = ask[L][Q] || new Map(); if (!m.has(col[by][bx])) m.set(col[by][bx], new Set()); m.get(col[by][bx]).add(ii); }
    const rows = { A: {}, B: {}, C: {}, D: {} }, open = new Map(), ch = st.board.choices || {};
    for (const L of 'ABCD') for (const Q of Object.keys(ask[L]).map(Number).sort((a, b) => a - b)) { const m = ask[L][Q], hexes = [...m.keys()].sort();
      if (hexes.length === 1) { rows[L][Q] = hexes[0]; continue; }
      const key = L + ':' + hexes.join(','); if (hexes.includes(ch[key])) { rows[L][Q] = ch[key]; continue; }
      rows[L][Q] = hexes.find(x => [...m.get(x)].includes(Math.min(...[].concat(...[...m.values()].map(v => [...v]))))) || hexes[0];   // until you choose: the lowest piece's color
      if (!open.has(key)) open.set(key, { key, L, rows: [], opts: hexes.map(x => ({ hex: x, items: new Set() })) });
      const o = open.get(key); o.rows.push(Q); o.opts.forEach(op => m.get(op.hex).forEach(ii => op.items.add(ii))); }
    // one carried strand per row
    const strand = new Map();
    for (let by = 0; by < h; by++) { const cI = new Set(), dI = new Set(); for (let bx = 0; bx < w; bx++) { if (G[by][bx] === 'C' && own[by][bx] >= 0) cI.add(own[by][bx]); if (G[by][bx] === 'D' && own[by][bx] >= 0) dI.add(own[by][bx]); }
      if (cI.size && dI.size) { const key = [...cI].sort() + '|' + [...dI].sort(); if (!strand.has(key)) strand.set(key, { rows: [], c: [...cI], d: [...dI] }); strand.get(key).rows.push(h - by); } }
    const first = items.find(it => piece(it.pid)), plan = Cl().planFromRows(rows, h, first ? pplan(piece(first.pid)) : null);
    return { G, own, col, groups, plan, conflicts: [...open.values()], strand: [...strand.values()] };
  }
  const span = rs => { rs = rs.slice().sort((a, b) => a - b); const out = []; let a = rs[0], b = rs[0];
    for (const r of rs.slice(1)) { if (r <= b + 2) b = r; else { out.push(a === b ? `${a}` : `${a}–${b}`); a = b = r; } } out.push(a === b ? `${a}` : `${a}–${b}`); return 'row' + (rs.length > 1 ? 's ' : ' ') + out.join(', '); };

  /* ---------- drawing ---------- */
  const M = 20;   // ruler margin
  function cellSize() { const wrap = $('boardCv').parentElement, avail = Math.max(200, (wrap.clientWidth || 600) - M - 4);
    return Math.max(3, Math.min(26, Math.floor(avail / st.board.w))) * st.zoom; }
  function draw() {
    const { w, h, items } = st.board, k = Math.max(3, Math.round(cellSize())), cv = $('boardCv'), B = compose(), G = B.G;
    cv.width = M + w * k + 2; cv.height = M + h * k + 2; cv._k = k; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { g.fillStyle = B.col[y][x] || Cl().colorOf(B.plan, 'A', h - y); g.fillRect(M + x * k, M + y * k, k, k); }
    if (k >= 5) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1;
      for (let x = 0; x <= w; x++) { g.beginPath(); g.moveTo(M + x * k + .5, M); g.lineTo(M + x * k + .5, M + h * k); g.stroke(); }
      for (let y = 0; y <= h; y++) { g.beginPath(); g.moveTo(M, M + y * k + .5); g.lineTo(M + w * k, M + y * k + .5); g.stroke(); } }
    // rulers: columns from the right and rows from the bottom, the way charts count them
    g.fillStyle = '#6b625a'; g.font = '10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let x = 0; x < w; x++) { const n = w - x; if (n === 1 || n % 5 === 0) g.fillText(String(n), M + x * k + k / 2, M / 2); }
    g.textAlign = 'right'; for (let y = 0; y < h; y++) { const n = h - y; if (n === 1 || n % 5 === 0) g.fillText(String(n), M - 3, M + y * k + k / 2); }
    items.forEach((it, i) => { if (!piece(it.pid)) return; const d = dims(it), sel = i === st.sel, ok = rowsOK(it);
      g.setLineDash(sel ? [] : [4, 3]); g.lineWidth = sel ? 3 : 1.5; g.strokeStyle = sel ? '#125765' : ok ? 'rgba(18,87,101,.6)' : '#d06a00';
      g.strokeRect(M + it.x * k + 1, M + it.y * k + 1, d.w * k - 1, d.h * k - 1); g.setLineDash([]);
      if (!ok) { g.fillStyle = '#d06a00'; g.font = 'bold 12px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('⚠', M + it.x * k + 3, M + it.y * k + 9); } });
    const n = items.filter(it => piece(it.pid)).length, off = items.filter(it => piece(it.pid) && !rowsOK(it)).length;
    $('boardNote').innerHTML = !n ? 'Add pieces from My pieces above.' : off ? `<span class="warn">${off} design piece${off > 1 ? 's are' : ' is'} off its row pattern (orange).</span> It still works, but it may need Fix in a few more places.` : '';
    $('useBoard').disabled = !n; $('bw').value = w; $('bh').value = h;
    drawColors(B); drawSel();
  }
  /* questions about colors and strands */
  function drawColors(B) { const box = $('colorBox'); box.innerHTML = ''; const name = ii => (piece(st.board.items[ii].pid) || {}).name || 'piece';
    const mk = (t, cls, fn) => { const b = document.createElement('button'); b.className = cls || 'sec'; b.innerHTML = t; b.onclick = fn; return b; };
    const remapBtns = (ii, from) => { const it = st.board.items[ii], L0 = Object.keys(it.remap || {}).find(k => it.remap[k] === from) || from;
      return 'CD'.split('').filter(L => L !== from).map(L => mk(`Make ${name(ii)}'s ${from} a ${L}`, 'sec', () => { it.remap = Object.assign({}, it.remap, { [L0]: L }); saveAll(); draw(); })); };
    B.conflicts.forEach(c => { const d = document.createElement('div'); d.className = 'q';
      d.innerHTML = `<div class="small"><b>${c.L === 'C' || c.L === 'D' ? 'Strand ' + c.L : c.L + ' yarn'}, ${span(c.rows)}:</b> pieces want different colors. Pick one, or move a piece's color to a carried strand so both stay.</div>`;
      const r = document.createElement('div'); r.className = 'row';
      c.opts.forEach(o => r.append(mk(`<i class="mini" style="background:${o.hex}"></i> ${[...o.items].map(name).join(', ')}`, 'sec', () => { st.board.choices = Object.assign({}, st.board.choices, { [c.key]: o.hex }); saveAll(); draw(); })));
      if (c.L === 'A' || c.L === 'B') c.opts.forEach(o => [...o.items].forEach(ii => remapBtns(ii, c.L).forEach(b => r.append(b))));
      d.append(r); box.appendChild(d); });
    B.strand.forEach(s => { const d = document.createElement('div'); d.className = 'q';
      d.innerHTML = `<div class="small"><b>⚑ ${span(s.rows)}</b> would carry both C (${s.c.map(name).join(', ')}) and D (${s.d.map(name).join(', ')}). You carry one strand per row: switch one piece's strand, or leave it and it will be flagged in Design.</div>`;
      const r = document.createElement('div'); r.className = 'row'; s.d.forEach(ii => r.append(...remapBtns(ii, 'D').filter(b => b.textContent.endsWith('a C')))); s.c.forEach(ii => r.append(...remapBtns(ii, 'C').filter(b => b.textContent.endsWith('a D'))));
      d.append(r); box.appendChild(d); });
    box.hidden = !B.conflicts.length && !B.strand.length; }
  function drawSel() { const it = st.board.items[st.sel], box = $('selBox'); box.hidden = !it; if (!it) return;
    const p = piece(it.pid), d = dims(it); $('selName').textContent = p.name;
    // which letter each of the piece's colors uses on this board
    const lb = $('pLetters'); lb.innerHTML = '<span class="small lab">Letters</span>'; const pl = pplan(p);
    'ABCD'.split('').filter(L => p.rows.some(r => r.includes(L))).forEach(L0 => { const g = document.createElement('span'); g.className = 'small remap';
      g.innerHTML = `<i class="mini" style="background:${pl[L0][0].hex}"></i> ${L0} →`;
      'ABCD'.split('').forEach(L => { const b = document.createElement('button'); b.className = 'sec' + (letterOf(it, L0) === L ? ' on' : ''); b.textContent = L;
        b.onclick = () => { it.remap = Object.assign({}, it.remap, { [L0]: L }); if (L === L0) delete it.remap[L0]; saveAll(); draw(); }; g.appendChild(b); });
      lb.appendChild(g); });
    $('selInfo').textContent = `· ${d.w} × ${d.h} squares · ${p.kind === 'chart' ? 'design' : 'picture'}${it.flip ? ' · mirrored' : ''}`;
    $('pClear').textContent = it.clear ? 'Background: see-through' : 'Background: solid';
    $('selNote').innerHTML = p.kind !== 'chart' ? 'Pictures have no stitch pattern yet, so they can sit on any row.'
      : rowsOK(it) ? '<span class="ok">✔ On its row pattern:</span> the stitches stay as they were in the design, except where pieces overlap or touch.'
      : '<span class="warn">Off its row pattern by one row.</span> Move it up or down one row to put it back, or leave it and use Fix in Design afterward.'; }
  function drawLib() { const box = $('lib'); box.innerHTML = '';
    if (!st.lib.length) { $('libNote').textContent = 'No pieces yet. Use Save as piece in Start, or Save design as piece in Design.'; return; }
    $('libNote').textContent = '';
    st.lib.forEach(p => { const card = document.createElement('div'); card.className = 'piece';
      const cv = document.createElement('canvas'), W = fullW(p), H = fullH(p), k = Math.max(1, Math.floor(84 / Math.max(W, H))); cv.width = W * k; cv.height = H * k;
      const g = cv.getContext('2d'); p.rows.forEach((r, y) => [...r].forEach((L, x) => { g.fillStyle = pcolor(p, L, H - y); g.fillRect(x * k, y * k, k, k); }));
      const name = document.createElement('input'); name.type = 'text'; name.value = p.name; name.className = 'pname'; name.setAttribute('aria-label', 'Piece name');
      name.onchange = () => { p.name = name.value.trim() || p.name; saveAll(); draw(); };
      const info = document.createElement('div'); info.className = 'small'; info.textContent = `${W} × ${H} · ${p.kind === 'chart' ? 'design' : 'picture'}`;
      const add = document.createElement('button'); add.textContent = 'Add to board'; add.onclick = () => addItem(p);
      const open = document.createElement('button'); open.className = 'sec'; open.textContent = 'Open in Design';
      open.onclick = () => root.MosaicApp.openDesign(p.rows, pplan(p), p.groups || [], `Opened “${p.name}”. Nothing has been changed.`);
      const del = document.createElement('button'); del.className = 'sec'; del.textContent = 'Delete';
      del.onclick = () => { if (!confirm(`Delete "${p.name}"? It will also come off the board.`)) return; st.lib = st.lib.filter(q => q !== p);
        st.board.items = st.board.items.filter(it => it.pid !== p.id); st.sel = -1; saveAll(); drawLib(); draw(); };
      const btns = document.createElement('div'); btns.className = 'row'; btns.append(add, open, del);
      card.append(cv, name, info, btns); box.appendChild(card); }); }

  /* ---------- editing ---------- */
  function addItem(p) { const crop = trimmed(p), it = { pid: p.id, x: 0, y: 0, crop, flip: false, clear: true }, d = dims(it), b = st.board;
    const n = b.items.length; it.x = Math.min(n * 2, Math.max(0, b.w - d.w)); it.y = Math.min(n * 2, Math.max(0, b.h - d.h));
    if (d.w > b.w) b.w = d.w; if (d.h > b.h) b.h = d.h;
    if ($('keepRows').checked && !rowsOK(it)) it.y = it.y + 1 + d.h <= b.h ? it.y + 1 : Math.max(0, it.y - 1);
    if (!rowsOK(it) && it.y + d.h === b.h) b.h += 1;
    b.items.push(it); st.sel = b.items.length - 1; saveAll(); draw();
    $('boardCv').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  /* move by (dx, dy); chart pieces step 2 rows at a time while Keep row pattern is on */
  function move(it, dx, dy) { if ($('keepRows').checked && piece(it.pid).kind === 'chart' && dy && rowsOK(it)) dy *= 2;
    it.x += dx; it.y += dy; saveAll(); draw(); }
  function crop(it, side, n) { const p = piece(it.pid), c = it.crop, d = dims(it);
    if (n > 0 && ((side === 't' || side === 'b') ? d.h : d.w) <= 1) return;
    if (n < 0 && c[side] <= 0) return;
    c[side] += n; if (side === 't') it.y += n; if (side === 'l') it.x += n;   // the rest of the piece stays where it is
    saveAll(); draw(); }
  st.lib.forEach(p => { if (!p.id) p.id = uid(); });

  /* pointer: tap to pick the top piece under the finger, drag to move it */
  const cv = () => $('boardCv');
  function cellAt(e) { const c = cv(), b = c.getBoundingClientRect(), k = c._k, sx = c.width / b.width, sy = c.height / b.height;
    return [Math.floor(((e.clientX - b.left) * sx - M) / k), Math.floor(((e.clientY - b.top) * sy - M) / k)]; }
  function hit(x, y) { for (let i = st.board.items.length - 1; i >= 0; i--) { const it = st.board.items[i]; if (!piece(it.pid)) continue; const d = dims(it);
    if (x >= it.x && x < it.x + d.w && y >= it.y && y < it.y + d.h) return i; } return -1; }
  function bindPointer() { const c = cv();
    c.onpointerdown = e => { const [x, y] = cellAt(e), i = hit(x, y); st.sel = i; draw(); if (i < 0) return;
      e.preventDefault(); c.setPointerCapture(e.pointerId); const it = st.board.items[i]; st.drag = { i, ox: x - it.x, oy: y - it.y }; };
    c.onpointermove = e => { if (!st.drag) return; const [x, y] = cellAt(e), it = st.board.items[st.drag.i]; let nx = x - st.drag.ox, ny = y - st.drag.oy;
      if (nx === it.x && ny === it.y) return; const px = it.x, py = it.y; it.x = nx; it.y = ny;
      if ($('keepRows').checked && piece(it.pid).kind === 'chart' && !rowsOK(it)) it.y += ny > py ? 1 : ny < py ? -1 : 1;
      if (it.x !== px || it.y !== py) draw(); };
    c.onpointerup = c.onpointercancel = () => { if (st.drag) { st.drag = null; saveAll(); } }; }

  let bound = false;
  function init() {
    if (!$('boardCv')) return;
    if (bound) { drawLib(); draw(); return; } bound = true;
    bindPointer();
    document.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const it = st.board.items[st.sel]; if (!it) return; const [dx, dy] = b.dataset.mv.split(',').map(Number); move(it, dx, dy); });
    document.querySelectorAll('[data-crop]').forEach(b => b.onclick = () => { const it = st.board.items[st.sel]; if (!it) return; const [s, n] = b.dataset.crop.split(','); crop(it, s, +n); });
    $('pMirror').onclick = () => { const it = st.board.items[st.sel]; if (!it) return; it.flip = !it.flip; [it.crop.l, it.crop.r] = [it.crop.r, it.crop.l]; saveAll(); draw(); };
    $('pFront').onclick = () => { const b = st.board, it = b.items.splice(st.sel, 1)[0]; if (!it) return; b.items.push(it); st.sel = b.items.length - 1; saveAll(); draw(); };
    $('pBack').onclick = () => { const b = st.board, it = b.items.splice(st.sel, 1)[0]; if (!it) return; b.items.unshift(it); st.sel = 0; saveAll(); draw(); };
    $('pDup').onclick = () => { const b = st.board, it = b.items[st.sel]; if (!it) return; const d = dims(it), cp = JSON.parse(JSON.stringify(it));
      cp.x = Math.min(it.x + d.w, Math.max(0, b.w - d.w)); if (cp.x === it.x) cp.y = Math.min(it.y + 2, Math.max(0, b.h - d.h)); b.items.push(cp); st.sel = b.items.length - 1; saveAll(); draw(); };
    $('pClear').onclick = () => { const it = st.board.items[st.sel]; if (!it) return; it.clear = !it.clear; saveAll(); draw(); };
    $('pDel').onclick = () => { if (st.sel < 0) return; st.board.items.splice(st.sel, 1); st.sel = -1; saveAll(); draw(); };
    /* board size: rows are added or removed at the top so pieces keep their row from the bottom */
    $('bw').onchange = () => { st.board.w = Math.max(4, Math.min(400, +$('bw').value || st.board.w)); saveAll(); draw(); };
    $('bh').onchange = () => { const nh = Math.max(4, Math.min(400, +$('bh').value || st.board.h)), dh = nh - st.board.h;
      st.board.items.forEach(it => { it.y += dh; }); st.board.h = nh; saveAll(); draw(); };
    $('bFit').onclick = () => { const b = st.board, its = b.items.filter(it => piece(it.pid)); if (!its.length) return;
      const x0 = Math.min(...its.map(it => it.x)), y0 = Math.min(...its.map(it => it.y)), x1 = Math.max(...its.map(it => it.x + dims(it).w)), y1 = Math.max(...its.map(it => it.y + dims(it).h));
      const bottomGap = b.h - y1, keep = bottomGap % 2;   // keep row pattern: trim an even number of rows below
      its.forEach(it => { it.x -= x0; it.y -= y0; }); b.w = x1 - x0; b.h = y1 - y0 + keep; saveAll(); draw(); };
    $('bClear').onclick = () => { if (st.board.items.length && !confirm('Take every piece off the board? Your saved pieces stay in My pieces.')) return; st.board.items = []; st.sel = -1; saveAll(); draw(); };
    $('bIn').onclick = () => { st.zoom = Math.min(4, st.zoom * 1.5); draw(); }; $('bOut').onclick = () => { st.zoom = Math.max(.5, st.zoom / 1.5); draw(); };
    $('useBoard').onclick = () => { const B = compose(); if (!st.board.items.length) return;
      if (B.conflicts.length) { $('boardNote').innerHTML = `<span class="warn">Pick a color for ${B.conflicts.length} spot${B.conflicts.length > 1 ? 's' : ''} first</span> (below the board).`; $('colorBox').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      root.MosaicApp.openDesign(B.G.map(r => r.join('')), B.plan, B.groups, 'Opened the board. Nothing has been changed: red squares are spots where pieces meet or overlap that can\'t be crocheted as drawn. Tap <b>Fix</b> when you\'re ready.'); };
    window.addEventListener('resize', () => draw());
    drawLib(); draw();
  }
  function save(p) { if (!p) return; p.id = uid(); p.name = `${p.kind === 'chart' ? 'Design' : 'Picture'} ${st.lib.length + 1}`; st.lib.push(p); saveAll(); drawLib();
    $('libNote').textContent = `Saved "${p.name}" to My pieces. Tap its name to rename it.`; }

  root.MosaicCombine = { save, compose, init, _st: st };

})(typeof window !== 'undefined' ? window : globalThis);
