/* ECG Lab — app: library dashboard (sort / size / drag-arrange), viewer (live scrolling ECG, monitor, 12-lead, stack) with rate/severity sliders, quiz, style settings */
(function () {
  'use strict';
  const E = window.ECGEngine, LB = window.ECGLib, LIB = LB.list, CATS = LB.CATS, QB = window.ECGQs;
  const FS = E.FS, N = E.N, LEADS = E.LEADS, IDX = E.IDX, clamp = E.clamp;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const THEMES = [
    { id: 'crimson', name: 'Crimson Noir', tag: 'Black & Red', dark: 1, sw: ['#070506', '#1b1214', '#ef2b3d', '#ff4256'] },
    { id: 'midnight', name: 'Midnight', dark: 1, sw: ['#0a0f1f', '#18234a', '#38bdf8', '#5eead4'] },
    { id: 'oled', name: 'OLED Black', dark: 1, sw: ['#000000', '#171719', '#f4f4f5', '#ffffff'] },
    { id: 'ocean', name: 'Ocean Deep', dark: 1, sw: ['#041219', '#0f2e3c', '#2dd4bf', '#7dd3fc'] },
    { id: 'violet', name: 'Violet Night', dark: 1, sw: ['#0f0a1e', '#221845', '#a78bfa', '#f0abfc'] },
    { id: 'forest', name: 'Forest Night', dark: 1, sw: ['#06120c', '#12301f', '#4ade80', '#bef264'] },
    { id: 'carbon', name: 'Carbon Amber', dark: 1, sw: ['#0f0f10', '#232326', '#fbbf24', '#fbbf24'] },
    { id: 'aurora', name: 'Aurora', sw: ['#f3f7fb', '#ffffff', '#0d9488', '#0f172a'] },
    { id: 'glacier', name: 'Glacier', sw: ['#edf4ff', '#ffffff', '#2563eb', '#0b1b3a'] },
    { id: 'sakura', name: 'Sakura', sw: ['#fff3f6', '#ffffff', '#d6336c', '#3a1626'] },
    { id: 'mint', name: 'Mint Fresh', sw: ['#effaf4', '#ffffff', '#059669', '#0d2a1d'] },
    { id: 'lavender', name: 'Lavender', sw: ['#f6f3ff', '#ffffff', '#7c3aed', '#1e1538'] },
    { id: 'comfort', name: 'Eye Comfort', tag: 'Low glare', sw: ['#f1e9d6', '#f8f2e2', '#b7791f', '#3b3222'] }
  ];
  const FONTS = [
    ['Poppins', '400;500;600;700'], ['Lato', '400;700'], ['Roboto', '400;500;700'], ['Outfit', '400;500;600;700'],
    ['Nunito', '400;600;700'], ['Montserrat', '400;500;600;700'], ['Manrope', '400;500;600;700'], ['DM Sans', '400;500;600;700'],
    ['Sora', '400;500;600;700'], ['Rubik', '400;500;600;700'], ['Space Grotesk', '400;500;600;700'], ['Fira Sans', '400;500;600;700'],
    ['Exo 2', '400;500;600;700'], ['Orbitron', '400;500;600;700'], ['JetBrains Mono', '400;500;600;700'],
    ['Quicksand', '400;500;600;700', 'Compact'], ['Josefin Sans', '400;500;600;700', 'Compact'], ['Comfortaa', '400;500;600;700', 'Compact'],
    ['Varela Round', '', 'Compact'], ['Barlow Semi Condensed', '400;500;600;700', 'Compact'], ['Saira Semi Condensed', '400;500;600;700', 'Compact']
  ];
  const CATCOL = { 'Normal': '#34d399', 'Rhythm': '#60a5fa', 'Arrest & VT': '#f87171', 'Conduction': '#fbbf24', 'Ischaemia': '#fb7185', 'Metabolic & Drugs': '#a78bfa', 'Other': '#2dd4bf' };
  const MINI = { torsades: { t0: 2.1, len: 4.8 }, vf: { t0: 2, len: 3.4 }, asystole: { t0: 2, len: 3.4 }, 'hyperk-sev': { t0: 1, len: 4.6 }, af: { len: 3.8 } };

  /* ---------- state ---------- */
  const KEY = 'ecglab.v1';
  const DEF = { theme: 'crimson', font: 'Poppins', sort: 'az', size: 'm', sizes: {}, order: [], fav: {}, noise: true, paper: 'theme', speed: 25, gain: 10, lw: 'n', view: 'live', lay: '3', mm: 3.2, qbest: 0, flags: {}, stats: {}, ospe: [], real: false, ladder: false };
  const S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const R = { tab: 'lib', cat: 'All', q: '', onlyFav: false, arrange: false };   // session-only
  E.setReal(!!S.real);
  if (!S.flags || typeof S.flags !== 'object') S.flags = {};
  if (!S.stats || typeof S.stats !== 'object') S.stats = {};
  if (!Array.isArray(S.ospe)) S.ospe = [];
  if (!S.liveMig) { S.view = 'live'; S.liveMig = 1; }
  if (!['live', 'monitor', 'grid', 'stack'].includes(S.view)) S.view = 'live';
  if (!['1', '3', '12'].includes(S.lay)) S.lay = '3';
  if (!THEMES.some(t => t.id === S.theme)) S.theme = DEF.theme;
  if (!FONTS.some(f => f[0] === S.font)) S.font = DEF.font;

  /* ---------- data cache ---------- */
  const cache = {};
  const data = id => cache[id] || (cache[id] = E.synth(LB.byId[id]));
  const NZ = () => E.noise();

  /* ---------- theme & font ---------- */
  let COL = {};
  const isDark = () => !!(THEMES.find(t => t.id === S.theme) || {}).dark;
  const FF = () => `'${S.font}', system-ui, sans-serif`;
  function readCol() {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    COL = { paper: g('--paper'), gmin: g('--gmin'), gmaj: g('--gmaj'), trace: g('--trace'), glow: g('--glow'), tx: g('--tx'), mut: g('--mut'), ac: g('--ac'), acInk: g('--acInk') || '#fff' };
    if (S.paper === 'classic') Object.assign(COL, { paper: '#fff6f5', gmin: '#fbd6d6', gmaj: '#f2a2a2', trace: '#101010', glow: 'transparent', tx: '#2a1010', mut: '#8a5a5a' });
  }
  function loadFont(name) {
    const f = FONTS.find(x => x[0] === name); if (!f) return;
    const id = 'font-' + name.toLowerCase().replace(/ /g, '-');
    if (document.getElementById(id)) return;
    const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + (f[1] ? ':wght@' + f[1] : '') + '&display=swap';
    document.head.appendChild(l);
  }
  function applyFont() {
    loadFont(S.font);
    document.documentElement.style.setProperty('--font', FF());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redrawAll());
  }
  function applyTheme() { document.documentElement.setAttribute('data-th', S.theme); readCol(); }

  /* ---------- icons ---------- */
  const I = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
    starO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    grip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
    arrange: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9 2 12l3 3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
    prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/></svg>',
    next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
  };

  /* ---------- canvas helpers ---------- */
  function setup(cv, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
  }
  function paper(ctx, w, h, mm, bg) {
    ctx.fillStyle = bg || COL.paper; ctx.fillRect(0, 0, w, h);
    if (mm >= 2) { ctx.strokeStyle = COL.gmin; ctx.lineWidth = .5; ctx.beginPath(); for (let x = 0; x <= w; x += mm) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); } for (let y = 0; y <= h; y += mm) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); } ctx.stroke(); }
    ctx.strokeStyle = COL.gmaj; ctx.lineWidth = mm >= 2 ? .8 : .6; ctx.beginPath();
    for (let x = 0; x <= w; x += mm * 5) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
    for (let y = 0; y <= h; y += mm * 5) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
    ctx.stroke();
  }
  const LW = () => ({ t: 1.15, n: 1.55, b: 2.2 }[S.lw] || 1.55);
  /* draw `cols` pixel columns of lead array `a`, starting at sample i0 with spp samples per px */
  function strip(ctx, a, nz, i0, spp, cols, x0, y0, ppm, wrap) {
    const n = a.length;
    const val = i => { if (wrap) i = ((i % n) + n) % n; else if (i < 0 || i >= n) return null; return a[i] + (nz ? nz[i] : 0); };
    ctx.beginPath(); let first = true;
    if (spp <= 1.5) {
      for (let c = 0; c <= cols; c++) { const v = val(Math.round(i0 + c * spp)); if (v == null) continue; const x = x0 + c, y = y0 - v * ppm; if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
    } else {
      for (let c = 0; c < cols; c++) {
        const s = Math.floor(i0 + c * spp), e = Math.floor(i0 + (c + 1) * spp);
        let mn = 1e9, mx = -1e9, vf = null, vl = null;
        for (let i = s; i <= e; i++) { const v = val(i); if (v == null) continue; if (vf == null) vf = v; vl = v; if (v < mn) mn = v; if (v > mx) mx = v; }
        if (vf == null) continue;
        const up = vl >= vf, x = x0 + c, y1 = y0 - (up ? mn : mx) * ppm, y2 = y0 - (up ? mx : mn) * ppm;
        if (first) { ctx.moveTo(x, y1); first = false; } else ctx.lineTo(x, y1);
        ctx.lineTo(x + .5, y2);
      }
    }
    ctx.stroke();
  }
  function ink(ctx, color, glow) {
    ctx.strokeStyle = color || COL.trace; ctx.lineWidth = LW(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (glow && COL.glow && COL.glow !== 'transparent') { ctx.shadowColor = COL.glow; ctx.shadowBlur = 5; } else ctx.shadowBlur = 0;
  }
  const nzFor = li => (S.noise || S.real) ? NZ()[li] : null;
  /* a lead segment: from time t0, for dur seconds, at pps px/s, baseline y0, ppm px/mV */
  function seg(ctx, d, li, t0, dur, x0, y0, pps, ppm, glow) {
    ink(ctx, null, glow);
    strip(ctx, d.leads[li], nzFor(li), Math.round(t0 * FS), FS / pps, Math.round(dur * pps), x0, y0, ppm, false);
    ctx.shadowBlur = 0;
  }
  let LBL = null; const lname = i => (LBL && LBL[i]) || LEADS[i];
  function label(ctx, txt, x, y, size) { ctx.fillStyle = COL.mut; ctx.font = `600 ${size || 11}px ${FF()}`; ctx.fillText(txt, x, y); }

  /* ---------- mini strip on cards ---------- */
  function drawMini(cv, e) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const d = data(e.id), li = IDX[e.lead || 'II'], o = MINI[e.id] || {};
    const hr = d.hr || 75;
    const len = o.len || (hr < 50 ? 5 : hr > 150 ? 2.4 : hr > 110 ? 3 : 3.4);
    let t0 = o.t0; if (t0 == null) t0 = d.beats.length > 1 ? Math.max(0, d.beats[1].t - .5) : .4;
    t0 = clamp(t0, 0, 10 - len);
    const ctx = setup(cv, w, h), pps = w / len, sq = .2 * pps;
    paper(ctx, w, h, sq / 5);
    const a = d.leads[li], nz = nzFor(li), i0 = Math.round(t0 * FS), i1 = Math.round((t0 + len) * FS);
    let mn = 1e9, mx = -1e9; for (let i = i0; i < i1; i++) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const ppm = Math.min(.42 * h / Math.max(.25, (mx - mn) / 2), .45 * h), y0 = h / 2 + (mx + mn) / 2 * ppm;
    ink(ctx); strip(ctx, a, nz, i0, FS / pps, Math.round(w), 0, y0, ppm, false);
    label(ctx, e.lead || 'II', 9, 14, 10);
  }
  let miniQ = [], miniRAF = 0;
  function scheduleMinis() {
    miniQ = $$('#grid canvas.mini');
    if (!miniRAF) miniRAF = requestAnimationFrame(stepMinis);
  }
  function stepMinis() {
    miniRAF = 0; const t0 = performance.now();
    while (miniQ.length && performance.now() - t0 < 10) { const cv = miniQ.shift(), c = cv.closest('.card'); if (c) drawMini(cv, LB.byId[c.dataset.id]); }
    if (miniQ.length) miniRAF = requestAnimationFrame(stepMinis);
  }

  /* ---------- library ---------- */
  const main = $('#main');
  const szOf = id => S.sizes[id] || S.size;
  const rateTxt = e => { const h = e.meas.hr; return /^~?\d+$/.test(h) ? h + ' bpm' : (h === '–' ? '' : h); };
  function visible() {
    const q = R.q.trim().toLowerCase();
    let l = LIB.filter(e => (R.cat === 'All' || e.cat === R.cat) && (!R.onlyFav || S.fav[e.id]) && (!q || (e.name + ' ' + e.cat + ' ' + e.desc + ' ' + e.id).toLowerCase().includes(q)));
    if (S.sort === 'az') l = l.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (S.sort === 'cat') l = l.slice().sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || LIB.indexOf(a) - LIB.indexOf(b));
    else {
      const ord = S.order && S.order.length ? S.order : LIB.map(e => e.id);
      const pos = id => { const i = ord.indexOf(id); return i < 0 ? 1e4 + LIB.findIndex(e => e.id === id) : i; };
      l = l.slice().sort((a, b) => pos(a.id) - pos(b.id));
    }
    return l;
  }
  function cardHTML(e) {
    const sz = szOf(e.id), cc = CATCOL[e.cat] || '#999';
    const tag = e.tag ? `<span class="flag ${e.tag.k}">${e.tag.t}</span>` : '';
    return `<article class="card sz-${sz}" data-id="${e.id}" style="--cc:${cc}">
      <canvas class="mini"></canvas>
      <span class="grip" data-grip aria-label="Drag to reorder">${I.grip}</span>
      <button class="szb" data-act="size" aria-label="Change card size">${sz.toUpperCase()}</button>
      <div class="cb">
        <div class="ct"><h3>${e.name}</h3><button class="fav ${S.fav[e.id] ? 'on' : ''}" data-act="fav" aria-label="Star">${S.fav[e.id] ? I.star : I.starO}</button></div>
        <div class="cm"><span class="cat"><i></i>${e.cat}</span><span class="rate">${rateTxt(e)}</span></div>
        ${tag ? `<div>${tag}</div>` : ''}
        <p class="cd">${e.desc}</p>
      </div></article>`;
  }
  function renderGrid() {
    const g = $('#grid'); if (!g) return;
    const l = visible(); let html = '', lastCat = null;
    g.classList.toggle('arrange', R.arrange);
    if (!l.length) html = '<div class="empty">No patterns match. Clear the search or filter.</div>';
    l.forEach(e => {
      if (S.sort === 'cat' && e.cat !== lastCat) { lastCat = e.cat; html += `<div class="sec" style="--cc:${CATCOL[e.cat]}"><i></i>${e.cat}<span>${l.filter(x => x.cat === e.cat).length}</span></div>`; }
      html += cardHTML(e);
    });
    g.innerHTML = html;
    $('#vis').textContent = l.length;
    scheduleMinis();
  }
  function renderLib() {
    main.innerHTML = `
      <div class="tools">
        <label class="search">${I.search}<input id="q" type="search" placeholder="Search ECG patterns" autocomplete="off" value="${R.q.replace(/"/g, '&quot;')}"></label>
        <div class="chips" id="chips"></div>
        <div class="row">
          <div class="seg" id="sortseg" aria-label="Sort"><button data-sort="az">A–Z</button><button data-sort="cat">Category</button><button data-sort="custom">Mine</button></div>
          <div class="seg" id="sizeseg" aria-label="Card size"><button data-size="s">S</button><button data-size="m">M</button><button data-size="l">L</button></div>
          <span class="sp"></span>
          <button class="btn" id="arrbtn" aria-label="Arrange cards">${I.arrange}<span></span></button>
        </div>
        <div class="hint" id="arrhint" hidden>Drag the handle at a card's top-left to reorder. Tap the S / M / L badge to resize that card.</div>
      </div>
      <div class="grid" id="grid"></div>`;
    syncLib(); renderGrid();
  }
  function syncLib() {
    const ch = $('#chips'); if (!ch) return;
    ch.innerHTML = ['All', ...CATS].map(c => `<button class="chip ${R.cat === c && !R.onlyFav ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('') +
      `<button class="chip ${R.onlyFav ? 'on' : ''}" data-fav>★ Starred</button>`;
    $$('#sortseg button').forEach(b => b.classList.toggle('on', b.dataset.sort === S.sort));
    $$('#sizeseg button').forEach(b => b.classList.toggle('on', b.dataset.size === S.size));
    const ab = $('#arrbtn'); ab.classList.toggle('on', R.arrange); ab.querySelector('span').textContent = R.arrange ? 'Done' : '';
    $('#arrhint').hidden = !R.arrange;
    $('#count').innerHTML = `<b id="vis">${visible().length}</b> of ${LIB.length}`;
  }

  /* ---------- library events ---------- */
  document.addEventListener('input', ev => { if (ev.target.id === 'q') { R.q = ev.target.value; renderGrid(); syncCount(); } });
  const syncCount = () => { const v = $('#vis'); if (v) v.textContent = visible().length; };
  main.addEventListener('click', ev => {
    const t = ev.target;
    const cat = t.closest('[data-cat]'); if (cat) { R.cat = cat.dataset.cat; R.onlyFav = false; syncLib(); renderGrid(); return; }
    if (t.closest('[data-fav]')) { R.onlyFav = !R.onlyFav; syncLib(); renderGrid(); return; }
    const so = t.closest('[data-sort]'); if (so) { S.sort = so.dataset.sort; if (S.sort !== 'custom' && R.arrange) R.arrange = false; save(); syncLib(); renderGrid(); return; }
    const sz = t.closest('#sizeseg [data-size]'); if (sz) { S.size = sz.dataset.size; S.sizes = {}; save(); syncLib(); renderGrid(); return; }
    if (t.closest('#arrbtn')) { toggleArrange(); return; }
    const act = t.closest('[data-act]');
    if (act) {
      const id = act.closest('.card').dataset.id;
      if (act.dataset.act === 'fav') { S.fav[id] = !S.fav[id]; if (!S.fav[id]) delete S.fav[id]; save(); if (R.onlyFav) renderGrid(); else { act.classList.toggle('on', !!S.fav[id]); act.innerHTML = S.fav[id] ? I.star : I.starO; } }
      else if (act.dataset.act === 'size') { const o = ['s', 'm', 'l'], cur = szOf(id); S.sizes[id] = o[(o.indexOf(cur) + 1) % 3]; save(); const c = act.closest('.card'); c.className = c.className.replace(/sz-\w/, 'sz-' + S.sizes[id]); act.textContent = S.sizes[id].toUpperCase(); scheduleMinis(); }
      return;
    }
    const card = t.closest('.card'); if (card && !R.arrange) openViewer(card.dataset.id, visible().map(e => e.id));
  });
  function toggleArrange() {
    R.arrange = !R.arrange;
    if (R.arrange) {
      R.cat = 'All'; R.q = ''; R.onlyFav = false;
      if (S.sort !== 'custom' || !S.order || !S.order.length) S.order = visible().map(e => e.id);
      S.sort = 'custom'; save(); renderLib();
    } else { save(); syncLib(); renderGrid(); }
  }
  /* drag to reorder */
  let drag = null;
  main.addEventListener('pointerdown', ev => {
    const gr = ev.target.closest('[data-grip]'); if (!gr || !R.arrange) return;
    ev.preventDefault();
    const card = gr.closest('.card'); drag = { card, pid: ev.pointerId };
    card.classList.add('dragging'); try { gr.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  });
  main.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.pid) return;
    const g = $('#grid'), x = ev.clientX, y = ev.clientY;
    const over = document.elementsFromPoint(x, y).find(el => el.classList && el.classList.contains('card') && el !== drag.card);
    if (over) {
      const r = over.getBoundingClientRect(), full = r.width > g.clientWidth * .7;
      const before = full ? y < r.top + r.height / 2 : (y < r.top + r.height * .35 || (y < r.bottom && x < r.left + r.width / 2));
      g.insertBefore(drag.card, before ? over : over.nextSibling);
    }
    if (y < 120) window.scrollBy(0, -14); else if (y > window.innerHeight - 130) window.scrollBy(0, 14);
  });
  const endDrag = ev => {
    if (!drag || (ev && ev.pointerId !== drag.pid)) return;
    drag.card.classList.remove('dragging'); drag = null;
    S.order = $$('#grid .card').map(c => c.dataset.id); save();
  };
  main.addEventListener('pointerup', endDrag); main.addEventListener('pointercancel', endDrag);

  /* ---------- live strip-chart (scrolling ECG) ---------- */
  const LIVE = { raf: 0, o: null };
  function stopLive() { if (LIVE.raf) cancelAnimationFrame(LIVE.raf); LIVE.raf = 0; LIVE.o = null; }
  /* o: { W, leads:[idx], rowMM, T, get():data, playing():bool, beep():bool }  right edge = "now", paper moves left */
  function startLive(cv, o) {
    stopLive();
    const W = o.W, padL = 34, mm = (W - padL - 8) / 125, winSec = 125 / S.speed, rh = o.rowMM * mm;
    const exH = o.extra ? o.extra().length * (o.exMM || 15) * mm : 0, ldH = o.ladder ? 22 * mm : 0;
    const h = Math.round(o.leads.length * rh + 6 * mm + exH + ldH), ctx = setup(cv, W, h);
    const per = 5 * mm, pw = Math.ceil(W + per) + 1, pg = document.createElement('canvas'), pc = setup(pg, pw, h);
    paper(pc, pw, h, mm);
    const pps = S.speed * mm, ppm = S.gain * mm * (o.gm || 1), cols = Math.round(winSec * pps), glow = o.leads.length <= 3;
    o.T = o.T == null ? winSec : o.T; o.dirty = true; o.redraw = () => { o.dirty = true; };
    const draw = () => {
      const d = o.get(), i0 = Math.round((o.T - winSec) * FS);
      ctx.drawImage(pg, -((o.T * pps) % per), 0, pw, h);
      const rows = [];
      o.leads.forEach((li, k) => {
        const y = 3 * mm + rh * (k + .5);
        ink(ctx, null, glow); strip(ctx, d.leads[li], nzFor(li), i0, FS / pps, cols, padL, y, ppm, true); ctx.shadowBlur = 0;
        label(ctx, lname(li), 6, y - rh * .22, 11);
        rows.push({ li, y, rh: rh * .92, x0: padL, tS: i0 / FS, tE: i0 / FS + winSec, pps });
      });
      if (o.extra) drawExtra(ctx, o, i0, pps, cols, padL, o.leads.length * rh + 3 * mm, mm, W);
      if (o.ladder) drawLadder(ctx, d, o.ladder(), padL, i0 / FS, i0 / FS + winSec, pps, o.leads.length * rh + 3 * mm + exH + 1 * mm, 20 * mm, W);
      if (o.overlay) o.overlay(ctx, rows, d);
      o.dirty = false;
    };
    let last = performance.now(), prev = o.T;
    const frame = now => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (o.playing()) {
        o.T += dt;
        if (o.beep && o.beep()) {
          const d = o.get(), dur = d.n / FS, a = prev % dur, b = o.T % dur;
          if (d.beats.some(x => !x.nohr && (a <= b ? (x.t > a && x.t <= b) : (x.t > a || x.t <= b)))) beep();
        }
        prev = o.T; draw();
      } else if (o.dirty) draw();
      LIVE.raf = requestAnimationFrame(frame);
    };
    LIVE.o = o; draw(); LIVE.raf = requestAnimationFrame(frame);
    return o;
  }



  /* ---------- ladder diagram (A / AV / V) ---------- */
  const LAD_V = ['vt', 'aivr', 'vent-escape', 'pea', 'paced-v'], LAD_AF = ['af', 'af-wpw', 'tachy-brady'], LAD_FL = ['flutter-2to1', 'flutter-4to1'];
  function drawLadder(ctx, d, e, x0, tS, tE, pps, top, H, W) {
    const dur = d.n / FS, X = t => x0 + (t - tS) * pps, th = H / 3, yA = top, yN = top + th, yV = top + 2 * th, yB = top + H;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0 - 2, top, W - x0 - 4, H);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath();
    [yA, yN, yV, yB].forEach(y => { ctx.moveTo(x0 - 2, y + .5); ctx.lineTo(W - 6, y + .5); }); ctx.stroke();
    ctx.fillStyle = COL.mut; ctx.font = `700 10px ${FF()}`; ctx.textBaseline = 'middle';
    ctx.fillText('A', 8, yA + th / 2); ctx.fillText('AV', 6, yN + th / 2); ctx.fillText('V', 8, yV + th / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 2, top, W - x0 - 4, H); ctx.clip();
    const col = COL.trace, col2 = COL.ac;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    const line = (t1, y1, t2, y2) => { ctx.beginPath(); ctx.moveTo(X(t1), y1); ctx.lineTo(X(t2), y2); ctx.stroke(); };
    const dot = (t, y) => { ctx.beginPath(); ctx.arc(X(t), y, 3, 0, Math.PI * 2); ctx.fill(); };
    const block = (t, y) => { ctx.beginPath(); ctx.moveTo(X(t) - 5, y); ctx.lineTo(X(t) + 5, y); ctx.stroke(); };
    const ks = [Math.floor(tS / dur) - 1, Math.floor(tE / dur) + 1];
    const each = (arr, f) => { for (let k = ks[0]; k <= ks[1]; k++) arr.forEach(x => { const t = (x.t != null ? x.t : x) + k * dur; if (t > tS - 1 && t < tE + 1) f(x, t); }); };
    if (LAD_AF.includes(e.id) || LAD_FL.includes(e.id)) {
      ctx.save(); ctx.lineWidth = 1.1; ctx.globalAlpha = .7;
      if (LAD_FL.includes(e.id)) { for (let t = Math.floor(tS * 5) / 5; t < tE; t += .2) line(t, yA + 3, t + .07, yN - 3); }
      else { const r = mulb(7); for (let t = tS - (tS % .07); t < tE; t += .07) { const o = r() * .05; line(t + o, yA + 3 + r() * 6, t + o + .03, yN - 3 - r() * 6); } }
      ctx.restore();
    }
    each(d.ps || [], (p, t) => { line(t, yA + 2, t, yN); line(t, yN, t + .07, yN + th * .55); block(t + .07, yN + th * .55); });
    each(d.beats, (b, t) => {
      const vm = (b.m && b.m !== 'main' && b.m !== 'j') || LAD_V.includes(e.id), q = t - .04;
      if (b.pr != null) { const pc = t - .04 - b.pr + .045; line(pc, yA + 2, pc, yN); line(pc, yN, q, yV); line(q, yV, q, yB - 2); }
      else if (b.retro != null) { const o = q - .01; dot(o, yN + th / 2); line(o, yN + th / 2, q, yV); line(q, yV, q, yB - 2); line(o, yN + th / 2, t + b.retro, yN); line(t + b.retro, yN, t + b.retro, yA + 2); }
      else if (e.id === 'svt') { const o = q - .02; dot(o, yN + th / 2); line(o, yN + th / 2, q, yV); line(q, yV, q, yB - 2); line(o, yN + th / 2, q, yN); line(q, yN, q, yA + 2); }
      else if (vm) { ctx.strokeStyle = col2; ctx.fillStyle = col2; dot(q, yB - 5); line(q, yB - 5, q + .03, yV + 2); ctx.strokeStyle = col; ctx.fillStyle = col; }
      else if (LAD_AF.includes(e.id) || LAD_FL.includes(e.id)) { line(q - .1, yN, q, yV); line(q, yV, q, yB - 2); }
      else { line(q - .06, yN + th * .4, q, yV); line(q, yV, q, yB - 2); dot(q - .06, yN + th * .4); }
    });
    ctx.restore();
    ctx.fillStyle = COL.mut; ctx.font = `500 9px ${FF()}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
    ctx.fillText('Ladder · ● origin of impulse   ⊥ blocked', W - 10, yA - 4);
    ctx.restore();
  }
  function mulb(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- "Show me" annotations ---------- */
  const ANN = window.ECGAnn || {};
  function morphsOf(e, ctl) { return typeof e.morphs === 'function' ? e.morphs(Object.assign(E.defaults(e), ctl || {})) : e.morphs; }
  function bGeom(b, prevT, nextT, m, e) {
    const d = m.qrsD, tc = b.t, t0 = tc - .42 * d, hasRp = m.rp.some(v => Math.abs(v) > .05), J = tc + (hasRp ? .95 : .68) * d;
    const rr = clamp(prevT != null ? tc - prevT : (nextT != null ? nextT - tc : 1), .3, 1.8);
    const qt = b.qt || m.qt || (e.qtc || .4) * Math.sqrt(rr), sr = .1 * Math.min(qt, .4) * (m.tw || 1), sl = sr * (m.tsym ? 1 : 1.5), Tc = t0 + qt - 2.4 * sr;
    const pc = b.pr != null ? t0 - b.pr + m.pd / 2 : null;
    return { d, tc, t0, J, qt, sr, sl, Tc, pc, pd: m.pd };
  }
  function annDraw(ctx, rows, data, e0, ctl0) {
    const e = e0 || LB.byId[V.id], ctl = ctl0 || V.ctl, list = ANN[e.id]; if (!list || !rows.length) return [];
    const ms = morphsOf(e, ctl), dur = data.n / FS, used = {}, badges = [], out = [];
    const expand = (arr, tS, tE) => { const r = []; for (let k = Math.floor((tS - 2) / dur); k <= Math.floor((tE + 2) / dur); k++) arr.forEach(x => r.push(typeof x === 'number' ? x + k * dur : Object.assign({}, x, { t: x.t + k * dur }))); return r.sort((p, q) => (p.t != null ? p.t : p) - (q.t != null ? q.t : q)); };
    list.forEach((an, i) => {
      const [kind, leadStr, txt] = an, pref = leadStr.split(',');
      const cands = []; pref.forEach(l => rows.forEach(r => { if (lname(r.li) === l) cands.push(r); }));
      out.push({ n: i + 1, txt, lead: cands.length ? lname(cands[0].li) : null, want: pref[0] });
      if (!cands.length) return;
      let row = null, rg = null;
      for (const rw of cands) { rg = calc(rw); if (rg) { row = rw; break; } }
      if (!rg) { out[i].lead = null; out[i].none = true; return; }
      out[i].lead = lname(row.li);
      function calc(row) {
      const B = expand(data.beats, row.tS, row.tE), P = expand(data.ps || [], row.tS, row.tE), c = (row.tS + row.tE) / 2;
      const inWin = t => t > row.tS + .2 && t < row.tE - .45;
      const idx = B.map((b, j) => j).filter(j => inWin(B[j].t));
      const near = arr => arr.slice().sort((p, q) => Math.abs(B[p].t - c) - Math.abs(B[q].t - c));
      const pick = (f, skip) => { let cand = idx.filter(j => f(B[j])); const mains = cand.filter(j => (B[j].m || 'main') === 'main'); if (mains.length && !['ect', 'ectT', 'pauseE'].includes(kind)) cand = mains; const s = near(cand); return s[skip || 0]; };
      const G = j => bGeom(B[j], j > 0 ? B[j - 1].t : null, j < B.length - 1 ? B[j + 1].t : null, ms[B[j].m || 'main'] || ms.main, e);
      let rg = null, j;
      const any = () => true, notMain = b => (b.m || 'main') !== 'main';
      switch (kind) {
        case 'P': j = pick(b => b.pr != null); if (j != null) { const g = G(j); rg = [g.pc - .6 * g.pd, g.pc + .6 * g.pd]; } break;
        case 'P2': j = pick(b => b.pr != null, 1); if (j != null) { const g = G(j); rg = [g.pc - .6 * g.pd, g.pc + .6 * g.pd]; } break;
        case 'PR': j = pick(b => b.pr != null); if (j != null) { const g = G(j); rg = [g.pc + .5 * g.pd, g.t0]; } break;
        case 'Px': j = pick(b => !!b.pamp); if (j != null) { const g = G(j); rg = [g.pc - .6 * g.pd, g.pc + .6 * g.pd]; } break;
        case 'QRSx': j = pick(b => !!b.pamp); if (j != null) { const g = G(j); rg = [g.t0 - .012, g.J + .005]; } break;
        case 'QRS': case 'Q': case 'S': case 'rp': case 'delta': case 'ST': case 'J': case 'T': case 'U': case 'QT': case 'scoop': case 'spike': {
          j = pick(any); if (j == null) break; const g = G(j);
          rg = { QRS: [g.t0 - .012, g.J + .005], Q: [g.t0 - .012, g.tc - .05 * g.d], S: [g.tc + .15 * g.d, g.J], rp: [g.tc + .35 * g.d, g.J + .01], delta: [g.t0 - .025, g.tc - .05 * g.d], ST: [g.J - .01, Math.max(g.J + .1, g.Tc - 2 * g.sl)], J: [g.J - .015, g.J + .06], T: [g.Tc - 2.6 * g.sl, g.Tc + 2.6 * g.sr], U: [g.t0 + g.qt + .04, g.t0 + g.qt + .15], QT: [g.t0, g.Tc + 2.6 * g.sr], scoop: [g.J, g.Tc + g.sr], spike: [g.t0 - .035, g.t0 + .01] }[kind];
          break;
        }
        case 'ect': j = pick(notMain); if (j != null) { const g = G(j); rg = [g.t0 - .015, g.J + .01]; } break;
        case 'ectT': j = pick(notMain); if (j != null) { const g = G(j); rg = [g.Tc - 2.6 * g.sl, g.Tc + 2.6 * g.sr]; } break;
        case 'pauseE': j = pick(b => notMain(b)); if (j != null && B[j + 1]) rg = [B[j].t + .3, B[j + 1].t - .05]; break;
        case 'retro': j = pick(b => b.retro != null); if (j != null) { const t = B[j].t + B[j].retro; rg = [t - .05, t + .06]; } break;
        case 'RR': j = pick(b => true); if (j != null && B[j + 1]) rg = [B[j].t, B[j + 1].t]; break;
        case 'alt': j = pick(b => true); if (j != null && B[j + 1]) rg = [B[j].t - .07, B[j + 1].t + .09]; break;
        case 'base': { let best = null, bg = 0; idx.forEach(k => { if (B[k + 1]) { const gap = B[k + 1].t - B[k].t; if (gap > bg && B[k].t < row.tE - .8) { bg = gap; best = k; } } }); if (best != null) rg = [B[best].t + .32, Math.min(B[best + 1].t - .06, row.tE - .05)]; else rg = [row.tS + .1, row.tE - .1]; break; }
        case 'pause': case 'gap': { let best = null, bg = 0; for (let k = 0; k < B.length - 1; k++) { const g = B[k + 1].t - B[k].t; if (B[k].t > row.tS - .2 && B[k + 1].t < row.tE + 1 && g > bg) { bg = g; best = k; } } if (best != null) rg = [B[best].t + .3, B[best + 1].t - .05]; break; }
        case 'drop': case 'Pd': { const cand = P.filter(p => p > row.tS + .15 && p < row.tE - .15 && (kind === 'Pd' || !B.some(b => b.t > p && b.t < p + .45))).sort((p, q) => Math.abs(p - c) - Math.abs(q - c)); if (cand.length) rg = [cand[0] - .07, cand[0] + .07]; break; }
        case 'whole': rg = [row.tS + .05, row.tE - .05]; break;
      }
      return rg;
      }
      const X = t => row.x0 + (t - row.tS) * row.pps;
      let x1 = Math.max(row.x0, X(rg[0])), x2 = Math.min(row.x0 + (row.tE - row.tS) * row.pps, X(rg[1])); if (x2 - x1 < 12) { const m = (x1 + x2) / 2; x1 = m - 6; x2 = m + 6; }
      const y1 = row.y - row.rh / 2, hh = row.rh;
      ctx.save(); ctx.fillStyle = COL.ac; ctx.globalAlpha = .17; rr(ctx, x1, y1, x2 - x1, hh, 6); ctx.fill();
      ctx.globalAlpha = .9; ctx.strokeStyle = COL.ac; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); rr(ctx, x1, y1, x2 - x1, hh, 6); ctx.stroke(); ctx.setLineDash([]);
      let bx = (x1 + x2) / 2, by = Math.max(10, y1 + 1);
      while (badges.some(p => Math.abs(p[0] - bx) < 19 && Math.abs(p[1] - by) < 19)) bx += 19;
      badges.push([bx, by]);
      ctx.globalAlpha = 1; ctx.fillStyle = COL.ac; ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.acInk; ctx.font = `700 11px ${FF()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + .5);
      ctx.restore();
    });
    V.annOut = out; return out;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function annLegend() {
    const el = $('#annl'); if (!el) return;
    if (!V.ann || !V.annOut) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<span class="lbl">What to look at</span><ol>${V.annOut.map(o => `<li class="${o.lead ? '' : 'off'}"><b>${o.n}</b><span>${o.txt}${o.lead ? ` <em>${o.lead}</em>` : o.none ? ' <em>not in this window</em>' : /R$|^V[789]$/.test(o.want) ? ` <em>turn on the extra leads to see ${o.want}</em>` : LBL ? ` <em>turn off the extra leads to see ${o.want}</em>` : ` <em>switch to 12 leads to see ${o.want}</em>`}</span></li>`).join('')}</ol>`;
  }


  /* ---------- Flag (mark an ECG or question as wrong) ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const flagBtn = (key, name, cls) => `<button class="${cls || 'chip'} flagb ${S.flags[key] ? 'on' : ''}" data-flag="${key}" data-fname="${esc(name)}" aria-label="Flag a problem">⚑${cls ? '' : ' ' + (S.flags[key] ? 'Flagged' : 'Flag')}</button>`;
  function flagText() {
    const ks = Object.keys(S.flags); if (!ks.length) return '';
    return 'ECG Lab – flagged items\n\n' + ks.map((k, i) => { const f = S.flags[k]; return `${i + 1}. [${k.startsWith('q:') ? 'Question ' + k.slice(2) : 'ECG ' + k.slice(4)}] ${f.name}${f.note ? '\n   Note: ' + f.note : ''}`; }).join('\n');
  }
  document.addEventListener('click', ev => {
    const t = ev.target, fb = t.closest('[data-flag]');
    if (fb) {
      const key = fb.dataset.flag, host = fb.closest('.row, .vbar, .qtop') || fb.parentElement;
      const old = document.querySelector('.flagbox'); if (old) { const same = old.dataset.fkey === key; old.remove(); if (same) return; }
      const box = document.createElement('div'); box.className = 'flagbox panel'; box.dataset.fkey = key; box.dataset.fname = fb.dataset.fname;
      const f = S.flags[key];
      box.innerHTML = `<span class="lbl">Flag: ${fb.dataset.fname}</span><textarea rows="3" placeholder="What looks wrong? (optional)">${f ? esc(f.note) : ''}</textarea><div class="row"><button class="btn pri" data-fsave>Save flag</button>${f ? '<button class="btn" data-fdel>Remove flag</button>' : ''}<button class="btn" data-fcancel>Cancel</button></div>`;
      host.after(box); $('textarea', box).focus(); return;
    }
    const box = t.closest('.flagbox'); if (!box) return;
    const key = box.dataset.fkey;
    if (t.closest('[data-fsave]')) { S.flags[key] = { name: box.dataset.fname, note: $('textarea', box).value.trim(), t: Date.now() }; save(); }
    else if (t.closest('[data-fdel]')) { delete S.flags[key]; save(); }
    else if (!t.closest('[data-fcancel]')) return;
    box.remove();
    $$(`[data-flag="${key}"]`).forEach(b => { const on = !!S.flags[key]; b.classList.toggle('on', on); if (b.classList.contains('chip')) b.textContent = '⚑ ' + (on ? 'Flagged' : 'Flag'); });
  });

  /* ---------- viewer ---------- */
  const V = { alt: false, ann: false, annOut: null, cal: { on: false, ta: null, tb: null }, pps: 1, x0: 0, id: null, ids: [], view: S.view, lead: 'II', mm: S.mm || 3.2, win: 0, raf: 0, beep: false, audio: null, d: null, ctl: {}, ver: 0, playing: true, live: null, st: 0 };
  const viewer = $('#viewer');
  const VIEWS = [['live', 'Live'], ['monitor', 'Monitor'], ['grid', '12-Lead'], ['stack', 'Stack']];
  const DUR_LIVE = 20;
  function loadEntry(id) {
    const e = LB.byId[id]; V.id = id; V.lead = e.lead || 'II'; V.win = 0; V.live = null;
    V.ctl = E.defaults(e); V.alt = false; V.cal.ta = V.cal.tb = null; V.annOut = null; resynth(true);
  }
  function resynth(quiet) {
    const e = LB.byId[V.id], ee = V.alt && e.alt ? Object.assign({}, e, { morphs: e.alt.morphs }) : e; V.d = E.synth(ee, { dur: DUR_LIVE, ctl: V.ctl }); V.ver++;
    if (!quiet) afterData();
  }
  function openViewer(id, ids, ctl) {
    if (V.cal.box === '#obox') V.cal.on = false; V.cal.box = '#vbox';
    V.ids = ids && ids.length ? ids : LIB.map(e => e.id); V.playing = true;
    loadEntry(id);
    if (ctl) { V.ctl = Object.assign({}, V.ctl, ctl); resynth(true); }
    viewer.classList.add('open'); viewer.setAttribute('aria-hidden', 'false'); viewer.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    renderViewer();
  }
  function closeViewer() {
    stopMonitor(); stopLive(); clearTimeout(V.st); LBL = null; viewer.classList.remove('open'); viewer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    if (R.tab === 'quiz') quizLive();
    if (R.tab === 'lib') { const g = $('#grid'); if (g) $$('#grid .card').forEach(c => { const f = $('.fav', c); if (f) { f.classList.toggle('on', !!S.fav[c.dataset.id]); f.innerHTML = S.fav[c.dataset.id] ? I.star : I.starO; } }); }
  }
  function setReal(on) {
    S.real = !!on; save(); E.setReal(S.real);
    [cache, dcache, dCache, pCache, kCache, LCACHE].forEach(o => Object.keys(o).forEach(k => delete o[k]));
    if (V.id) resynth(true);
  }
  const flagHTML = e => e.tag ? `<span class="flag ${e.tag.k}">${e.tag.t}</span>` : '';

  /* simulator controls */
  const SIMK = e => [['rate', e.rate], ['atr', e.atr], ['sev', e.sev]].filter(x => x[1]);
  function fmtCtl(k, sp, v) {
    if (k === 'sev') { if (sp.unit === 'mmol/L') return v.toFixed(1) + ' mmol/L'; if (sp.unit === 'mV') return v.toFixed(2) + ' mV'; return Math.round(v * 100) + ' %'; }
    return Math.round(v) + ' /min';
  }
  function simHTML(e) {
    const list = SIMK(e); if (!list.length) return '';
    return `<div class="panel sim" id="sim"><div class="row"><span class="lbl">Simulator controls</span><span class="sp"></span><button class="btn" data-sim="reset">Reset</button></div>
      ${list.map(([k, sp]) => `<div class="slr"><div class="slh"><span>${sp.label || 'Heart rate'}</span><output id="o-${k}">${fmtCtl(k, sp, V.ctl[k])}</output></div><input type="range" data-ctl="${k}" min="${sp.min}" max="${sp.max}" step="${sp.step || 1}" value="${V.ctl[k]}" aria-label="${sp.label || 'Heart rate'}"></div>`).join('')}
      <p class="hint" style="padding:6px 0 0">Move a slider and the trace changes at once.</p></div>`;
  }
  function rateLive(e, d, c) {
    if (e.id === 'chb') return `V ${c.rate} / A ${c.atr}`;
    if (e.id.startsWith('flutter')) return `${d.hr} (A ${c.atr})`;
    if (e.id === 'mobitz1' || e.id === 'mobitz2' || e.id === 'av2to1') return `${d.hr} (P ${c.rate})`;
    if (e.id === 'aivr' || e.id === 'paced-v') return `${d.hr} (P 62)`;
    if (d.hr == null) return (e.rate && c.rate) ? '~' + c.rate : e.meas.hr;
    return String(d.hr);
  }
  function changed(e) { const df = E.defaults(e); return (e.sev && V.ctl.sev !== df.sev) || (e.atr && V.ctl.atr !== df.atr); }
  function measHTML(e) {
    const lv = e.live ? e.live(V.ctl) : null, m = Object.assign({}, e.meas, lv || {}), stale = !lv && changed(e);
    return [['Rate', rateLive(e, V.d, V.ctl), 'mRate'], ['PR', m.pr], ['QRS', m.qrs], ['QTc', m.qtc], ['Axis', m.axis]].map(x => `<div class="${stale && x[0] !== 'Rate' ? 'stale' : ''}"><small>${x[0]}</small><b ${x[2] ? `id="${x[2]}"` : ''}>${x[0] === 'Rate' && /^\d+$/.test(x[1]) ? x[1] + ' bpm' : x[1]}</b></div>`).join('') + (stale ? '<p class="hint stalep">PR, QRS, QTc and axis are shown for the default setting.</p>' : '');
  }
  function afterData() {
    const e = LB.byId[V.id], d = V.d;
    const h = $('#lhr'); if (h) { const v = d.hr == null ? '--' : d.hr; if (h.classList.contains('hrp')) { const b = $('b', h); if (b) b.textContent = v; } else h.innerHTML = `<b>${v}</b><span>BPM</span>`; }
    const ms = $('#meas'); if (ms) ms.innerHTML = measHTML(e);
    if (V.live) { V.live.redraw(); setTimeout(annLegend, 60); }
    if (V.view === 'grid' || V.view === 'stack') drawViewerStage(true);
  }

  function renderViewer() {
    stopMonitor(); stopLive();
    const e = LB.byId[V.id], pos = V.ids.indexOf(V.id);
    viewer.innerHTML = `<div class="vwrap">
      <div class="vbar"><button class="ib" data-v="close" aria-label="Back">${I.back}</button>
        <div class="vt"><b>${e.name}</b><small>${e.cat}</small></div>
        ${flagBtn('ecg:' + e.id, e.name, 'ib')}<button class="ib ${S.fav[e.id] ? 'on' : ''}" data-v="fav" aria-label="Star">${S.fav[e.id] ? I.star : I.starO}</button></div>
      <div class="vtools"><div class="seg" id="vseg" style="align-self:flex-start">${VIEWS.map(v => `<button data-view="${v[0]}" class="${V.view === v[0] ? 'on' : ''}">${v[1]}</button>`).join('')}</div>
        <div class="row" id="vctl"></div>${e.alt ? `<button class="chip altl ${V.alt ? 'on' : ''}" data-alt>＋ ${e.alt.name}</button>` : ''}</div>
      <div id="vstage"></div>
      <div class="panel annl" id="annl" hidden></div>
      ${simHTML(e)}
      <div class="meas" id="meas">${measHTML(e)}</div>
      ${e.tag ? `<div class="tagrow">${flagHTML(e)}</div>` : ''}
      <div class="blk"><h4>What you see</h4><p style="margin-bottom:8px">${e.desc}</p><ul>${e.find.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="blk"><h4>Clinical pearls</h4><ul>${e.pearls.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="blk"><h4>Look-alikes</h4><ul>${e.ddx.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="blk"><h4>At the bedside</h4><p>${e.act}</p></div>
      <div class="vnav"><button class="btn" data-v="prev" ${pos <= 0 ? 'disabled style="opacity:.4"' : ''}>${I.prev} Previous</button><button class="btn" data-v="next" ${pos >= V.ids.length - 1 ? 'disabled style="opacity:.4"' : ''}>Next ${I.next}</button></div>
      <p class="note">Synthetic teaching traces generated for education. They are idealised and are not for diagnosis or patient care decisions.</p>
    </div>`;
    drawViewerStage();
  }
  const annBtn = () => `<button class="chip showme ${V.ann ? 'on' : ''}" data-ann>✦ Show me</button>`;
  const calBtn = () => `<button class="chip ${V.cal.on ? 'on' : ''}" data-cal><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 3v18M19 3v18M5 12h14M9 9l-4 3 4 3M15 9l4 3-4 3"/></svg> Caliper</button>`;
  /* ---------- caliper: visible markers, draggable handles, nudge buttons ---------- */
  function calBox() { return $(V.cal.box || '#vbox'); }
  function calX(t) { return V.x0 + t * V.pps; }
  function calT(box, clientX) { const r = box.getBoundingClientRect(); return (clientX - r.left + box.scrollLeft - V.x0) / V.pps; }
  function calAttach(box) {
    if (box.dataset.calb) return; box.dataset.calb = '1';
    box.addEventListener('click', ev => {
      if (!V.cal.on || ev.target.closest('.calh, button')) return;
      if (Date.now() - (V.cal.dragEnd || 0) < 400) return;
      const t = calT(box, ev.clientX), c = V.cal;
      if (c.ta == null) { c.ta = t; c.sel = 'a'; }
      else if (c.tb == null) { c.tb = t; c.sel = 'b'; }
      else { const k = Math.abs(t - c.ta) <= Math.abs(t - c.tb) ? 'a' : 'b'; c['t' + k] = t; c.sel = k; }
      const r = box.getBoundingClientRect(); calRipple(box, ev.clientX - r.left + box.scrollLeft, ev.clientY - r.top);
      renderCal(); ev.stopPropagation();
    });
    box.addEventListener('pointerdown', ev => {
      const h = ev.target.closest('.calh'); if (!h || !V.cal.on) return;
      ev.preventDefault(); const k = h.dataset.h; V.cal.sel = k; V.cal.drag = k; try { h.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      const move = e2 => { V.cal['t' + k] = calT(box, e2.clientX); calUpdate(); };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); V.cal.drag = null; V.cal.dragEnd = Date.now(); calUpdate(); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      calUpdate();
    });
  }
  function calRipple(box, x, y) { const r = document.createElement('i'); r.className = 'calrip'; r.style.left = x + 'px'; r.style.top = y + 'px'; box.appendChild(r); setTimeout(() => r.remove(), 600); }
  function renderCal() {
    const box = calBox(); if (!box) return;
    let el = $('#cal', box), bar = $('#calbar');
    const allowed = V.cal.box === '#obox' || (V.view === 'live' || V.view === 'grid' || V.view === 'stack');
    if (!V.cal.on || !allowed) { if (el) el.remove(); if (bar) bar.remove(); return; }
    calAttach(box);
    if (!el) {
      el = document.createElement('div'); el.id = 'cal'; el.className = 'cal';
      el.innerHTML = `<b class="cband"></b><span class="cghosts"></span><i class="cl ca"></i><i class="cl cb"></i><button class="calh" data-h="a" aria-label="Drag marker A">A</button><button class="calh" data-h="b" aria-label="Drag marker B">B</button><div class="cval"></div><div class="calhint"></div>`;
      box.appendChild(el);
    }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'calbar'; bar.className = 'panel calbar';
      bar.innerHTML = `<div class="calread" id="calread"></div><div class="row"><div class="seg"><button data-cn="a-">◀</button><button class="cn-l" data-cs="a">A</button><button data-cn="a+">▶</button></div><div class="seg"><button data-cn="b-">◀</button><button class="cn-l" data-cs="b">B</button><button data-cn="b+">▶</button></div><button class="btn" data-cclear>Clear</button></div><p class="hint" style="padding:6px 0 0">Tap the ECG to drop A, then B. Drag the yellow A / B handles, or use ◀ ▶ for fine steps (4 ms). Dotted lines repeat the interval to check regularity.</p>`;
      box.after(bar);
      bar.addEventListener('click', ev => {
        const n = ev.target.closest('[data-cn]'), s = ev.target.closest('[data-cs]'), c = V.cal;
        if (n) { const k = n.dataset.cn[0], d = n.dataset.cn[1] === '+' ? .004 : -.004; if (c['t' + k] == null) { const W = (box.clientWidth || 300); c['t' + k] = calT(box, box.getBoundingClientRect().left + W * (k === 'a' ? .35 : .6)); } else c['t' + k] += d; c.sel = k; calUpdate(); }
        else if (s) { c.sel = s.dataset.cs; calUpdate(); }
        else if (ev.target.closest('[data-cclear]')) { c.ta = c.tb = null; calUpdate(); }
        ev.stopPropagation();
      });
    }
    calUpdate();
  }
  function calUpdate() {
    const box = calBox(), el = box && $('#cal', box); if (!el) return;
    const cv = $('canvas', box), H = cv ? cv.clientHeight : box.clientHeight, CW = cv ? cv.clientWidth : box.clientWidth, c = V.cal;
    const show = (sel, on) => { const n = $(sel, el); n.style.display = on ? '' : 'none'; return n; };
    const A = c.ta != null, B = c.tb != null;
    [['a', A, c.ta], ['b', B, c.tb]].forEach(([k, on, t]) => {
      const x = on ? calX(t) : 0, ln = show('.c' + k, on), hd = show(`.calh[data-h="${k}"]`, on);
      ln.style.left = x + 'px'; ln.style.height = H + 'px'; hd.style.left = x + 'px'; hd.style.top = (H - 22) + 'px';
      ln.classList.toggle('sel', c.sel === k); hd.classList.toggle('sel', c.sel === k);
    });
    const band = show('.cband', A && B), val = show('.cval', A && B), gh = $('.cghosts', el), hint = show('.calhint', !(A && B));
    hint.textContent = !A ? 'Tap the ECG to drop marker A' : 'Now tap to drop marker B';
    let read = 'No measurement yet';
    gh.innerHTML = '';
    if (A && B) {
      const xa = calX(c.ta), xb = calX(c.tb), l = Math.min(xa, xb), r = Math.max(xa, xb), ms = Math.abs(c.tb - c.ta) * 1000, sq = ms / 40;
      band.style.left = l + 'px'; band.style.width = (r - l) + 'px'; band.style.height = H + 'px';
      const rate = ms > 150 ? Math.round(60000 / ms) + '/min' : '';
      val.innerHTML = `<b>${Math.round(ms)} ms</b><span>${sq.toFixed(1)} small sq${rate ? ' · ' + rate : ''}</span>`;
      val.style.left = Math.max(56, Math.min((l + r) / 2, (box.scrollWidth || CW) - 56)) + 'px';
      const step = r - l; if (step > 14) { let gx = ''; for (let k = 1; k <= 8; k++) { const x = r + step * k; if (x > (box.scrollWidth || CW)) break; gx += `<i class="cg" style="left:${x}px;height:${H}px"></i>`; } gh.innerHTML = gx; }
      read = `<b>${Math.round(ms)} ms</b> · ${sq.toFixed(1)} small squares${rate ? ' · <b>' + rate + '</b>' : ''}`;
    } else if (A) read = 'Marker A placed. Tap a second point.';
    const rd = $('#calread'); if (rd) rd.innerHTML = read;
    $$('#calbar [data-cs]').forEach(b => b.classList.toggle('on', b.dataset.cs === c.sel));
  }

  const playBtn = () => `<button class="btn pri" data-play>${V.playing ? I.pause + ' Pause' : I.play + ' Play'}</button>`;
  function ctlHTML() {
    if (V.view === 'live') {
      const lay = `<div class="seg" data-lay>${[['1', '1 lead'], ['3', '3 leads'], ['12', '12 leads']].map(x => `<button data-lay="${x[0]}" class="${S.lay === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>`;
      const chips = S.lay === '1' ? `<div class="chips" style="width:100%">${LEADS.map(l => `<button class="chip ${V.lead === l ? 'on' : ''}" data-lead="${l}">${l}</button>`).join('')}</div>` : '';
      return `${playBtn()}${annBtn()}${calBtn()}<button class="chip ${S.ladder ? 'on' : ''}" data-ladder>Ladder</button><button class="chip ${S.real ? 'on' : ''}" data-real>Real-world</button><span class="pill hrp" id="lhr"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.7 1.1 5.6 3.2C13.900 6.100 15.600 5 17.600 5 21 5 23.100 8.400 21.600 11.800 19.500 16.400 12 21 12 21z"/></svg><b>${V.d.hr == null ? '--' : V.d.hr}</b> bpm</span>${lay}<button class="chip ${V.beep ? 'on' : ''}" data-beep>♪ Beep</button><span class="pill">${S.speed} mm/s · ${+(S.gain * (liveLeads().gm || 1)).toFixed(1)} mm/mV</span>${chips}`;
    }
    if (V.view === 'grid') return `${annBtn()}${calBtn()}<div class="seg"><button data-z="-">−</button><button data-z="+">+</button><button data-z="fit">Fit width</button></div><span class="pill">25 mm/s · ${S.gain} mm/mV</span><span class="hint" style="padding:0;width:100%">Swipe the trace sideways to see all four columns, or rotate your phone.</span>`;
    if (V.view === 'stack') {
      const winSec = 125 / S.speed, nWin = Math.round(10 / winSec);
      return `${annBtn()}${calBtn()}<div class="seg"><button data-w="-" ${V.win <= 0 ? 'style="opacity:.4"' : ''}>${I.prev}</button><button class="on" style="min-width:104px;cursor:default">${(V.win * winSec).toFixed(1)}–${((V.win + 1) * winSec).toFixed(1)} s</button><button data-w="+" ${V.win >= nWin - 1 ? 'style="opacity:.4"' : ''}>${I.next}</button></div><span class="pill">${S.speed} mm/s · ${S.gain} mm/mV</span>`;
    }
    const chips = LEADS.map(l => `<button class="chip ${V.lead === l ? 'on' : ''}" data-lead="${l}">${l}</button>`).join('');
    return `${playBtn()}<div class="chips" style="width:100%">${chips}<button class="chip ${V.beep ? 'on' : ''}" data-beep>♪ Beep</button></div>`;
  }
  function liveLeads() {
    const e = LB.byId[V.id];
    if (S.lay === '12') return { leads: LEADS.map((_, i) => i), row: 19, gm: .6 };
    if (S.lay === '1') return { leads: [IDX[V.lead]], row: 62, gm: 1.5 };
    const pick = []; [e.lead || 'II', 'II', 'V1', 'V5'].forEach(l => { if (!pick.includes(l) && pick.length < 3) pick.push(l); });
    return { leads: pick.map(l => IDX[l]).sort((a, b) => a - b), row: 32 };
  }
  function drawViewerStage(onlyCanvas) {
    { const e0 = LB.byId[V.id]; LBL = V.alt && e0 && e0.alt ? e0.alt.labels : null; }
    if (V.ann && V.view === 'live') V.playing = false;
    if (!onlyCanvas) $('#vctl').innerHTML = ctlHTML();
    const st = $('#vstage'), d = V.d, e = LB.byId[V.id];
    if (V.view === 'live' || V.view === 'monitor') { if (onlyCanvas) return; }
    const keepT = V.live ? V.live.T : null;
    stopMonitor(); stopLive(); V.live = null;
    if (V.view === 'monitor') {
      st.innerHTML = `<div class="mon"><canvas id="vc"></canvas></div><p class="hint cvpn" id="cvpnote"></p>`;
      startMonitor(); V.annOut = null; annLegend(); return;
    }
    if (V.view === 'live') {
      st.innerHTML = `<div class="vcanvas live" id="vbox"><canvas id="vc"></canvas></div>`;
      const box = $('#vbox'), W = Math.max(280, box.clientWidth || 340), ly = liveLeads();
      V.live = startLive($('#vc'), { W, leads: ly.leads, rowMM: ly.row, gm: ly.gm, T: keepT, get: () => V.d, playing: () => V.playing, beep: () => V.beep, overlay: (ctx, rows, d) => { if (V.ann) annDraw(ctx, rows, d); }, ladder: S.ladder ? () => LB.byId[V.id] : null });
      V.pps = S.speed * (W - 42) / 125; V.x0 = 34; renderCal(); annLegend();
      return;
    }
    st.innerHTML = '<div class="vcanvas" id="vbox"><canvas id="vc"></canvas></div>';
    const box = $('#vbox'), cv = $('#vc'), W = Math.max(280, box.clientWidth || 340);
    if (V.view === 'grid') drawGrid12(cv, d, W);
    else { drawStack(cv, d, LEADS.map((_, i) => i), W, V.win); V.pps = S.speed * (W - 42) / 125; V.x0 = 34; }
    renderCal(); annLegend();
  }
  function drawGrid12(cv, d, W) {
    const mm = V.mm, w = Math.max(W, Math.round(262 * mm)), h = Math.round(130 * mm), ctx = setup(cv, w, h);
    paper(ctx, w, h, mm);
    const x0 = Math.round((w - 250 * mm) / 2 + 2 * mm), pps = 25 * mm, ppm = S.gain * mm;
    V.pps = pps; V.x0 = x0;
    const order = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']], rows = [], rhy = [];
    for (let r = 0; r < 4; r++) {
      const y = (14 + 30 * r) * mm;
      calPulse(ctx, x0 - 4.5 * mm, y, mm);
      if (r < 3) for (let c = 0; c < 4; c++) {
        const ln = order[r][c], xs = x0 + c * 62.5 * mm;
        seg(ctx, d, IDX[ln], c * 2.5, 2.5, xs, y, pps, ppm, true); rows.push({ li: IDX[ln], y, rh: 26 * mm, x0: xs, tS: c * 2.5, tE: c * 2.5 + 2.5, pps });
        label(ctx, lname(IDX[ln]), xs + 4, y - 9 * mm, Math.max(10, mm * 3.4));
        if (c > 0) { ctx.strokeStyle = COL.mut; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xs, y - 3 * mm); ctx.lineTo(xs, y + 3 * mm); ctx.stroke(); }
      } else { seg(ctx, d, IDX.II, 0, 10, x0, y, pps, ppm, true); rhy.push({ li: IDX.II, y, rh: 26 * mm, x0, tS: 0, tE: 10, pps }); label(ctx, 'II', x0 + 4, y - 9 * mm, Math.max(10, mm * 3.4)); }
    }
    ctx.fillStyle = COL.mut; ctx.font = `500 ${Math.max(9, mm * 3)}px ${FF()}`; ctx.fillText(`25 mm/s   ${S.gain} mm/mV`, x0, h - 2 * mm);
    if (V.ann) annDraw(ctx, rows.concat(rhy), d);
    return rows.concat(rhy);
  }
  function calPulse(ctx, x, y, mm) {
    ink(ctx, COL.mut, false); ctx.lineWidth = 1.3; const hgt = S.gain * mm;
    ctx.beginPath(); ctx.moveTo(x - 1.5 * mm, y); ctx.lineTo(x, y); ctx.lineTo(x, y - hgt); ctx.lineTo(x + 3 * mm, y - hgt); ctx.lineTo(x + 3 * mm, y); ctx.lineTo(x + 4.5 * mm, y); ctx.stroke();
  }
  function drawStack(cv, d, leadIdx, W, win, rowMM, noAnn, span) {
    const winSec = (span || 125) / S.speed, padL = 34, mm = (W - padL - 8) / (span || 125), rh = (rowMM || 22) * mm;
    const h = Math.round(leadIdx.length * rh + 6 * mm), ctx = setup(cv, W, h);
    paper(ctx, W, h, mm);
    const pps = S.speed * mm, ppm = S.gain * mm, t0 = Math.min(win * winSec, 10 - winSec), rows = [];
    leadIdx.forEach((li, k) => {
      const y = 3 * mm + rh * (k + .5);
      seg(ctx, d, li, t0, winSec, padL, y, pps, ppm, true);
      label(ctx, lname(li), 6, y - rh * .22, 11);
      rows.push({ li, y, rh: rh * .92, x0: padL, tS: t0, tE: t0 + winSec, pps });
    });
    if (V.ann && !noAnn) annDraw(ctx, rows, d);
    return rows;
  }

  /* ---------- haemodynamics: arterial line + SpO2 pleth derived from the beats ---------- */
  const PERF = {
    'sinus-brady': [102, 58], 'sinus-tachy': [108, 66, 97], svt: [96, 70], vt: [76, 50, 95], torsades: 0, vf: 0, asystole: 0, pea: 0,
    af: [112, 74], 'af-wpw': [96, 64], 'flutter-2to1': [104, 70], chb: [84, 40], mobitz2: [96, 54], av2to1: [98, 54], 'high-grade': [82, 42],
    'vent-escape': [72, 38, 94], aivr: [104, 62], effusion: [90, 68, 96, 1], pe: [94, 62, 88], 'cerebral-t': [184, 96], hypothermia: [92, 56, 94],
    'stemi-ant': [104, 70, 96], 'stemi-inf': [92, 58, 96], mat: [116, 70, 89], tca: [92, 54, 95], 'pace-capture': [86, 48], 'hyperk-sev': [74, 40, 95],
    'lbbb-mi': [100, 66, 95], hyperacute: [118, 76], 'de-winter': [116, 74], 'artefact-tremor': [126, 74], 'artefact-lead': [124, 72]
  };
  function perfCfg(e, ctl) {
    let p = PERF[e.id];
    if (e.id.startsWith('hyperk') && ctl && ctl.sev >= 9) p = [70, 38, 95];
    if (p === 0) return { pf: 0 };
    p = p || [122, 72, 98];
    return { pf: 1, sys: p[0], dia: p[1], spo2: p[2] || 98, pp: !!p[3], id: e.id };
  }
  const TPL = (() => {
    const n = Math.round(1.4 * FS), A = new Float32Array(n), Pl = new Float32Array(n); let ma = 0, mp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / FS;
      A[i] = (1 - Math.exp(-x / .035)) * Math.exp(-x / .32) - .1 * Math.exp(-.5 * ((x - .3) / .018) ** 2) + .08 * Math.exp(-.5 * ((x - .34) / .035) ** 2);
      Pl[i] = (1 - Math.exp(-x / .085)) * Math.exp(-x / .4) + .04 * Math.exp(-.5 * ((x - .42) / .05) ** 2);
      ma = Math.max(ma, A[i]); mp = Math.max(mp, Pl[i]);
    }
    for (let i = 0; i < n; i++) { A[i] /= ma; Pl[i] /= mp; }
    return { A, Pl, n };
  })();
  const HCACHE = new WeakMap();
  const WEAK = { pvc: .4 };
  function hemo(d, cfg) {
    const key = JSON.stringify(cfg), c = HCACHE.get(d); if (c && c.key === key) return c.h;
    const n = d.n, dur = n / FS, art = new Float32Array(n), pl = new Float32Array(n);
    let h;
    if (!cfg.pf) {
      const cv = new Float32Array(n);
      for (let i = 0; i < n; i++) { art[i] = 6 + .6 * Math.sin(i / 37); pl[i] = .02 * Math.sin(i / 23); cv[i] = 10 + .4 * Math.sin(i / 41); }
      h = { art, pl, sys: null, dia: null, map: null, spo2: null, cvp: cv, cvpMean: null, cvpNote: 'No circulation: CVP flat' };
    } else {
      const bs = d.beats.slice().sort((x, y) => x.t - y.t), all = [];
      bs.forEach(b => all.push(Object.assign({}, b, { t: b.t - dur })));
      bs.forEach(b => all.push(b));
      const amps = [];
      for (let k = 0; k < all.length; k++) {
        const b = all[k], rr = k ? b.t - all[k - 1].t : .8;
        let sv = clamp((rr - .22) / .58, .15, 1.15) * (WEAK[b.m] || 1) * (1 + .03 * Math.sin(2 * Math.PI * b.t / 4.5));
        if (cfg.pp) sv *= 1 - .24 * (.5 + .5 * Math.sin(2 * Math.PI * b.t / 4));
        amps.push(sv);
        const sA = Math.round((b.t + .12) * FS), sP = Math.round((b.t + .26) * FS);
        for (let i = 0; i < TPL.n; i++) { const ia = sA + i, ip = sP + i; if (ia >= 0 && ia < n) art[ia] += sv * TPL.A[i]; if (ip >= 0 && ip < n) pl[ip] += sv * TPL.Pl[i]; }
      }
      const sorted = Float32Array.from(art).sort(), lo = sorted[Math.floor(n * .03)];
      const pks = all.filter(b => b.t > 0).map(b => { let m = -1e9; for (let i = Math.round((b.t + .1) * FS); i < Math.min(n, Math.round((b.t + .45) * FS)); i++) m = Math.max(m, art[i]); return m; }).filter(v => v > -1e8).sort((x, y) => x - y);
      const pk = pks.length ? pks[Math.floor(pks.length * .7)] : 1;
      const spl = Float32Array.from(pl).sort(), plo = spl[Math.floor(n * .03)];
      const k1 = (cfg.sys - cfg.dia) / Math.max(.05, pk - lo);
      let mapS = 0;
      for (let i = 0; i < n; i++) { art[i] = cfg.dia + (art[i] - lo) * k1; pl[i] = (pl[i] - plo) / Math.max(.05, pk - plo); mapS += art[i]; }
      h = { art, pl, sys: cfg.sys, dia: cfg.dia, map: Math.round(mapS / n), spo2: cfg.spo2 };
      Object.assign(h, cvpWave(d, bs, cfg));
    }
    HCACHE.set(d, { key, h }); return h;
  }

  /* CVP: a wave after each P, c wave at QRS, v wave at end of T; cannon a when the atrium contracts against a closed tricuspid valve */
  const CVPMAP = { effusion: [18, .45, 'Raised CVP with small, blunted waves and a lost y descent: tamponade physiology'], pe: [15, 1.2, 'Raised CVP: acute right ventricular strain'], 'stemi-rv': [16, 1.2, 'Raised CVP with clear lungs: RV infarction'], copd: [12, 1, ''], rvh: [14, 1.2, 'Raised CVP with a prominent a wave: stiff hypertrophied RV'], 'cerebral-t': [9, 1, ''], hypothermia: [7, 1, ''] };
  function cvpWave(d, bs, cfg) {
    const n = d.n, dur = n / FS, c = new Float32Array(n), m = CVPMAP[cfg.id] || [8, 1, ''];
    const G = (t, w, amp) => { const i0 = Math.max(0, Math.floor((t - 4 * w) * FS)), i1 = Math.min(n, Math.ceil((t + 4 * w) * FS)); for (let i = i0; i < i1; i++) { const x = (i / FS - t) / w; c[i] += amp * Math.exp(-.5 * x * x); } };
    const Ps = [];
    bs.forEach(b => { if (b.pr != null) Ps.push(b.t - .04 - b.pr + .045); if (b.retro != null) Ps.push(b.t + b.retro); });
    (d.ps || []).forEach(t => Ps.push(t));
    let cannon = 0;
    const sys = t => bs.some(b => { for (let k = -1; k <= 1; k++) { const bt = b.t + k * dur; if (t > bt - .02 && t < bt + .3) return true; } return false; });
    Ps.forEach(pc => { const t = pc + .09, big = sys(t); if (big) cannon++; for (let k = -1; k <= 1; k++) G(t + k * dur, .045, (big ? 11 : 4) * m[1]); });
    bs.forEach(b => { for (let k = -1; k <= 1; k++) { const t = b.t + k * dur; G(t + .06, .025, 1.6 * m[1]); G(t + .37, .07, 3.6 * m[1]); } });
    let mean = 0; for (let i = 0; i < n; i++) mean += c[i]; mean /= n;
    for (let i = 0; i < n; i++) { c[i] = m[0] + (c[i] - mean) + .4 * Math.sin(2 * Math.PI * i / FS / 4.2); }
    let note = m[2];
    if (!note) {
      if (!Ps.length) note = 'No a wave: no organised atrial contraction';
      else if (cannon >= 2 && cannon >= Ps.length * .5) note = 'Regular cannon a waves: every atrial beat lands on a closed tricuspid valve (retrograde P: junctional or re-entry)';
      else if (cannon >= 2) note = 'Intermittent cannon a waves: atria and ventricles beat independently (AV dissociation, e.g. complete heart block or VT)';
      else note = 'Normal pattern: a wave (atrial contraction), c wave, x descent, v wave, y descent';
    }
    return { cvp: c, cvpMean: m[0], cvpNote: note };
  }
  const CPRH = {};
  function cprHemo(n) {
    if (CPRH[n]) return CPRH[n];
    const art = new Float32Array(n), pl = new Float32Array(n), per = 60 / 110;
    for (let i = 0; i < n; i++) {
      const t = i / FS, ph = (t % per) / per;
      art[i] = 14 + (ph < .48 ? 52 * Math.sin(Math.PI * ph / .48) : 0) + 2 * Math.sin(t * 3);
      pl[i] = .25 * (ph < .5 ? Math.sin(Math.PI * ph / .5) : 0) + .06 * Math.sin(t * 11.3);
    }
    return CPRH[n] = { art, pl, sys: 66, dia: 14, map: 30, spo2: null, cvp: art.map(v => 8 + v * .35), cvpMean: null, cvpNote: 'CPR' };
  }
  const ART_C = '#ff4d5e', PL_C = '#38c8ff', CVP_C = '#ffd24a';
  /* extra waveform bands for live strips (drills) */
  function drawExtra(ctx, o, i0, pps, cols, padL, top, mm, W) {
    const ch = o.extra(), bh = (o.exMM || 15) * mm;
    ch.forEach((c, k) => {
      const y1 = top + k * bh, bottom = y1 + bh - 3, ppm = (bh - 8) / (c.hi - c.lo);
      ctx.save(); ctx.strokeStyle = c.color; ctx.lineWidth = Math.max(1.4, LW()); ctx.lineJoin = 'round';
      strip(ctx, c.a, null, i0, FS / pps, cols, padL, bottom + c.lo * ppm, ppm, true);
      ctx.fillStyle = c.color; ctx.font = `700 10.5px ${FF()}`; ctx.fillText(c.label, 4, y1 + 12);
      ctx.textAlign = 'right'; ctx.font = `700 13px ${FF()}`; ctx.fillText(c.val, W - 10, y1 + 13);
      ctx.restore();
    });
  }

  /* monitor (sweeping traces on black: ECG, arterial line, SpO2) */
  function stopMonitor() { if (V.raf) cancelAnimationFrame(V.raf); V.raf = 0; }
  function startMonitor() {
    const cv = $('#vc'), box = cv.parentElement, li = IDX[V.lead], nz = nzFor(li);
    const W = Math.max(280, box.clientWidth), H = clamp(Math.round(W * 1.25), 420, 560), ctx = setup(cv, W, H);
    const col = isDark() && S.paper !== 'classic' ? COL.trace : '#27e08e', ecgC = '#27e08e';
    box.style.setProperty('--mc', col);
    const NW = 86, TW = W - NW, win = 6, spp = win * FS / TW, gap = 18;
    const eTop = 6, eBot = H * .36, aTop = H * .39, aBot = H * .57, pTop = H * .6, pBot = H * .76, cTop = H * .8, cBot = H * .97, y0 = (eTop + eBot) / 2 + 8;
    let ver = -1, ppm = 1, a = null, hm = null, aHi = 160, prevT = 0, tacc = 0, last = performance.now();
    const band = (arr, i0, cols, x0, yb, pp) => strip(ctx, arr, null, i0, spp, cols, x0, yb, pp, true);
    const frame = now => {
      const dt = Math.min(.1, (now - last) / 1000); last = now; if (V.playing) tacc += dt;
      const d = V.d, e = LB.byId[V.id];
      if (ver !== V.ver) { ver = V.ver; a = d.leads[li]; let mx = .6; for (let i = 0; i < a.length; i += 5) mx = Math.max(mx, Math.abs(a[i])); ppm = Math.min((eBot - eTop) * .45 / mx, (eBot - eTop) * .42); hm = hemo(d, perfCfg(e, V.ctl)); aHi = Math.max(160, (hm.sys || 0) + 30); const cn = $('#cvpnote'); if (cn) cn.textContent = 'CVP: ' + hm.cvpNote; }
      const t = tacc, k = Math.floor(t / win), xc = ((t % win) / win) * TW, cB = Math.round(xc + gap);
      ctx.fillStyle = '#040506'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= TW; x += TW / 24) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); } ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); [aBot - (aBot - aTop) * 120 / aHi, aBot - (aBot - aTop) * 60 / aHi].forEach(y => { for (let x = 0; x < TW; x += 10) { ctx.moveTo(x, y); ctx.lineTo(x + 5, y); } }); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `500 9px ${FF()}`; ctx.fillText('120', 2, aBot - (aBot - aTop) * 120 / aHi - 2); ctx.fillText('60', 2, aBot - (aBot - aTop) * 60 / aHi - 2);
      const draw = (arr, yb, pp, color, glow, nzA) => {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.6, LW()); ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = glow;
        strip(ctx, arr, nzA, k * win * FS, spp, Math.round(xc), 0, yb, pp, true);
        if (cB < TW) strip(ctx, arr, nzA, (k - 1) * win * FS + cB * spp, spp, TW - cB, cB, yb, pp, true);
        ctx.shadowBlur = 0;
      };
      draw(a, y0, ppm, col, 8, nz);
      draw(hm.art, aBot, (aBot - aTop) / aHi, ART_C, 5, null);
      draw(hm.pl, pBot, (pBot - pTop) / 1.35, PL_C, 5, null);
      draw(hm.cvp, cBot, (cBot - cTop) / 30, CVP_C, 4, null);
      ctx.font = `700 11px ${FF()}`; ctx.fillStyle = col; ctx.fillText(V.lead, 6, eTop + 12); ctx.fillStyle = ART_C; ctx.fillText('ART', 6, aTop + 10); ctx.fillStyle = PL_C; ctx.fillText('SpO₂', 6, pTop + 10); ctx.fillStyle = CVP_C; ctx.fillText('CVP', 6, cTop + 10);
      /* numerics */
      ctx.fillStyle = '#0b0d10'; ctx.fillRect(TW, 0, NW, H); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(TW + .5, 0); ctx.lineTo(TW + .5, H); ctx.stroke();
      const num = (lbl, v, sub, color, y, big) => { ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = `600 10px ${FF()}`; ctx.fillText(lbl, TW + 8, y); ctx.font = `700 ${big}px ${FF()}`; ctx.fillText(v, TW + 8, y + big + 2); if (sub) { ctx.font = `600 12px ${FF()}`; ctx.fillText(sub, TW + 8, y + big + 18); } };
      const hrv = hm.sys == null && (e.id === 'vf' || e.id === 'asystole') ? (e.id === 'asystole' ? '0' : '--') : (d.hr == null ? '--' : String(d.hr));
      num('HR', hrv, null, col, eTop + 14, 34);
      num('ABP', hm.sys == null ? '--/--' : `${hm.sys}/${hm.dia}`, hm.map == null ? '' : `(${hm.map})`, ART_C, aTop + 8, 19);
      num('SpO₂', hm.spo2 == null ? '--' : String(hm.spo2), hm.spo2 == null ? 'no pulse' : '%', PL_C, pTop + 4, 24);
      num('CVP', hm.cvpMean == null ? '--' : String(hm.cvpMean), 'mmHg', CVP_C, cTop + 4, 22);
      if (V.beep && V.playing) { const dur = d.n / FS, tl = t % dur; const hit = d.beats.some(b => !b.nohr && (prevT <= tl ? (b.t > prevT && b.t <= tl) : (b.t > prevT || b.t <= tl))); if (hit) beep(); prevT = tl; }
      V.raf = requestAnimationFrame(frame);
    };
    V.raf = requestAnimationFrame(frame);
  }
  function beep() {
    try { const ac = V.audio; if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = .08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .06); } catch (e) { /* ignore */ }
  }

  viewer.addEventListener('input', ev => {
    const r = ev.target.closest('input[data-ctl]'); if (!r) return;
    const k = r.dataset.ctl, e = LB.byId[V.id], sp = e[k]; V.ctl[k] = Number(r.value);
    const o = $('#o-' + k); if (o) o.textContent = fmtCtl(k, sp, V.ctl[k]);
    if (!V.st) V.st = setTimeout(() => { V.st = 0; resynth(); }, 45);
  });
  viewer.addEventListener('click', ev => {
    const t = ev.target, v = t.closest('[data-v]');
    if (t.closest('[data-alt]')) { V.alt = !V.alt; t.closest('[data-alt]').classList.toggle('on', V.alt); resynth(true); V.annOut = null; drawViewerStage(); return; }
    if (t.closest('[data-real]')) { setReal(!S.real); drawViewerStage(); return; }
    if (t.closest('[data-ladder]')) { S.ladder = !S.ladder; save(); drawViewerStage(); return; }
    if (t.closest('[data-ann]')) {
      V.ann = !V.ann; V.annOut = null;
      if (V.ann && V.view === 'monitor') { V.view = 'live'; S.view = 'live'; save(); $$('#vseg button').forEach(b => b.classList.toggle('on', b.dataset.view === 'live')); }
      if (V.ann && V.view === 'live') V.playing = false;
      drawViewerStage(); return;
    }
    if (t.closest('[data-cal]')) {
      V.cal.on = !V.cal.on; V.cal.ta = V.cal.tb = null; V.cal.box = '#vbox';
      if (V.cal.on && V.view === 'live' && V.playing) V.playing = false;
      if (V.cal.on && V.view === 'monitor') { V.view = 'live'; S.view = 'live'; save(); $$('#vseg button').forEach(b => b.classList.toggle('on', b.dataset.view === 'live')); drawViewerStage(); return; }
      $('#vctl').innerHTML = ctlHTML(); renderCal(); return;
    }
    if (v) {
      const a = v.dataset.v, pos = V.ids.indexOf(V.id);
      if (a === 'close') closeViewer();
      else if (a === 'fav') { S.fav[V.id] = !S.fav[V.id]; if (!S.fav[V.id]) delete S.fav[V.id]; save(); v.classList.toggle('on', !!S.fav[V.id]); v.innerHTML = S.fav[V.id] ? I.star : I.starO; }
      else if (a === 'prev' && pos > 0) { loadEntry(V.ids[pos - 1]); renderViewer(); viewer.scrollTop = 0; }
      else if (a === 'next' && pos < V.ids.length - 1) { loadEntry(V.ids[pos + 1]); renderViewer(); viewer.scrollTop = 0; }
      return;
    }
    const vw = t.closest('[data-view]'); if (vw) { V.cal.ta = V.cal.tb = null; V.view = vw.dataset.view; S.view = V.view; save(); $$('#vseg button').forEach(b => b.classList.toggle('on', b.dataset.view === V.view)); drawViewerStage(); return; }
    const ld = t.closest('[data-lead]'); if (ld) { V.lead = ld.dataset.lead; drawViewerStage(); return; }
    const ly = t.closest('button[data-lay]'); if (ly) { S.lay = ly.dataset.lay; save(); drawViewerStage(); return; }
    if (t.closest('[data-play]')) { V.playing = !V.playing; if (V.playing && V.ann) { V.ann = false; V.annOut = null; annLegend(); } if (V.playing) { V.cal.ta = V.cal.tb = null; renderCal(); } $('#vctl').innerHTML = ctlHTML(); return; }
    if (t.closest('[data-sim]')) {
      const e = LB.byId[V.id]; V.ctl = E.defaults(e); resynth();
      SIMK(e).forEach(([k, sp]) => { const r = $(`input[data-ctl="${k}"]`); if (r) r.value = V.ctl[k]; const o = $('#o-' + k); if (o) o.textContent = fmtCtl(k, sp, V.ctl[k]); });
      return;
    }
    if (t.closest('[data-beep]')) { V.beep = !V.beep; if (V.beep && !V.audio) { try { V.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { V.beep = false; } } $('#vctl').innerHTML = ctlHTML(); return; }
    const z = t.closest('[data-z]');
    if (z) { const k = z.dataset.z; V.mm = k === '+' ? Math.min(7, V.mm + .6) : k === '-' ? Math.max(1.6, V.mm - .6) : Math.max(1.6, ($('#vbox').clientWidth - 8) / 262); S.mm = V.mm; save(); drawViewerStage(); return; }
    const w = t.closest('[data-w]'); if (w) { const winSec = 125 / S.speed, nWin = Math.round(10 / winSec); V.win = clamp(V.win + (w.dataset.w === '+' ? 1 : -1), 0, nWin - 1); drawViewerStage(); }
  });

  /* ---------- quiz ---------- */
  const Q = { score: 0, total: 0, streak: 0, cat: 'All', id: null, opts: [], picked: null, full: false, hint: false, bag: [], mode: 'ecg', mcat: 'ECG strips', mid: null, mopts: [], mp: null, mbag: [] };
  const dcache = {}, dataC = q => { const k = q.ecg + '|' + JSON.stringify(q.ctl || {}); if (dcache[k]) return dcache[k]; let e = LB.byId[q.ecg]; if (q.ctl && q.ctl.alt && e.alt) e = Object.assign({}, e, { morphs: e.alt.morphs }); return dcache[k] = E.synth(e, { dur: 20, ctl: q.ctl || {} }); };
  const QBY = {}; QB.list.forEach(q => { QBY[q.id] = q; });
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function nextQ() {
    let pool = LIB.filter(e => Q.cat === 'All' || (Q.cat === 'Mistakes' ? isMiss('e:' + e.id) : e.cat === Q.cat));
    if (!pool.length) { Q.cat = 'All'; pool = LIB.slice(); }
    if (Q.bag.length === 0) Q.bag = shuffle(pool.map(e => e.id));
    let id = Q.bag.pop(); if (id === Q.id && Q.bag.length) id = Q.bag.pop();
    const e = LB.byId[id];
    const same = shuffle(LIB.filter(x => x.cat === e.cat && x.id !== id)).slice(0, 2);
    const other = shuffle(LIB.filter(x => x.id !== id && !same.includes(x) && x.cat !== 'Normal')).slice(0, 3 - same.length);
    Q.id = id; Q.opts = shuffle([e, ...same, ...other]).map(x => x.id); Q.picked = null; Q.full = false; Q.hint = false;
  }
  function nextM() {
    let pool = QB.list.filter(q => Q.mcat === 'All' || (Q.mcat === 'Mistakes' ? isMiss('q:' + q.id) : Q.mcat === 'ECG strips' ? !!q.ecg : q.cat === Q.mcat));
    if (!pool.length) { Q.mcat = 'ECG strips'; pool = QB.list.filter(q => !!q.ecg); }
    if (Q.mbag.length === 0) Q.mbag = shuffle(pool.map(q => q.id));
    let id = Q.mbag.pop(); if (id === Q.mid && Q.mbag.length) id = Q.mbag.pop();
    const q = QBY[id]; Q.mid = id; Q.mopts = shuffle([q.ans, ...q.wrong]); Q.mp = null;
  }
  const modeSeg = () => `<div class="chips qmodes">${[['ecg', 'Name the ECG'], ['mcq', 'MCQ bank'], ['ospe', 'OSPE'], ['cmp', 'Compare'], ['prog', 'Progress']].map(m => `<button class="chip ${Q.mode === m[0] ? 'on' : ''}" data-qmode="${m[0]}">${m[1]}</button>`).join('')}</div>`;
  function renderMCQ() {
    if (!Q.mid) nextM();
    const q = QBY[Q.mid], done = Q.mp != null, e = q.ecg ? LB.byId[q.ecg] : null;
    const cnt = c => c === 'All' ? QB.list.length : c === 'Mistakes' ? QB.list.filter(x => isMiss('q:' + x.id)).length : c === 'ECG strips' ? QB.list.filter(x => x.ecg).length : QB.list.filter(x => x.cat === c).length;
    main.innerHTML = `
      <div class="qtop">${modeSeg()}<span class="pill">Score <b>${Q.score}/${Q.total}</b></span><span class="pill">Streak <b>${Q.streak}</b></span><span class="pill">Best <b>${S.qbest}</b></span></div>
      <div class="chips" id="qchips" style="margin-bottom:12px">${['ECG strips', 'Mistakes', 'All', ...QB.CATS].map(c => `<button class="chip ${Q.mcat === c ? 'on' : ''}" data-mcat="${c}">${c} · ${cnt(c)}</button>`).join('')}</div>
      <div class="panel">
        <div class="row" style="margin-bottom:10px"><span class="lbl">${q.cat}</span>${e ? '<span class="ltag on">LIVE</span>' : ''}<span class="sp"></span>${flagBtn('q:' + q.id, q.q.length > 80 ? q.q.slice(0, 78) + '…' : q.q)}${e ? `<button class="btn" data-q="full">${Q.full ? '3 leads' : '12 leads'}</button>` : ''}</div>
        ${e ? '<div class="vcanvas" id="qbox" style="margin-bottom:12px"><canvas id="qc"></canvas></div>' : ''}
        <p class="qtxt">${q.q}</p>
        <div class="opts">${Q.mopts.map((o, i) => { let c = ''; if (done) c = o === q.ans ? 'ok' : (i === Q.mp ? 'no' : ''); return `<button class="opt ${c}" data-mpick="${i}" ${done ? 'disabled' : ''}>${o}</button>`; }).join('')}</div>
        <div class="fb">${done ? `<h4>${Q.mopts[Q.mp] === q.ans ? 'Correct.' : 'Not quite. Answer: ' + q.ans}</h4><p>${q.ex}</p><div class="row" style="margin-top:10px"><button class="btn pri" data-mnext>Next question ${I.next}</button>${e ? '<button class="btn" data-q="open">See this ECG in detail</button>' : ''}</div>` : ''}</div>
      </div>`;
    if (e) quizLive(); else stopLive();
  }
  function renderQuiz() {
    if (LIVE.o) Q.T = LIVE.o.T;
    stopOspeTimer();
    if (Q.mode === 'mcq') { renderMCQ(); return; }
    if (Q.mode === 'ospe') { renderOSPE(); return; }
    if (Q.mode === 'cmp') { renderCmp(); return; }
    if (Q.mode === 'prog') { renderProg(); return; }
    if (!Q.id) nextQ();
    const e = LB.byId[Q.id], done = Q.picked != null;
    main.innerHTML = `
      <div class="qtop">${modeSeg()}<span class="pill">Score <b>${Q.score}/${Q.total}</b></span><span class="pill">Streak <b>${Q.streak}</b></span><span class="pill">Best <b>${S.qbest}</b></span></div>
      <div class="chips" id="qchips" style="margin-bottom:12px">${['All', 'Mistakes', ...CATS].map(c => `<button class="chip ${Q.cat === c ? 'on' : ''}" data-qcat="${c}">${c}${c === 'Mistakes' ? ' · ' + LIB.filter(e => isMiss('e:' + e.id)).length : ''}</button>`).join('')}</div>
      <div class="panel">
        <div class="row" style="margin-bottom:10px"><span class="lbl">Name this ECG</span><span class="ltag on">LIVE</span><span class="sp"></span>
          ${flagBtn('ecg:' + e.id, e.name)}<button class="btn" data-q="full">${Q.full ? 'Show 3 leads' : 'Show 12 leads'}</button><button class="btn" data-q="hint" ${done ? 'disabled style="opacity:.4"' : ''}>Hint</button></div>
        <div class="vcanvas" id="qbox"><canvas id="qc"></canvas></div>
        ${Q.hint && !done ? `<p class="hint" style="margin-top:10px">Category: <b>${e.cat}</b> · Rate: <b>${e.meas.hr}</b> · QRS: <b>${e.meas.qrs}</b></p>` : ''}
        <div class="opts">${Q.opts.map(id => { const o = LB.byId[id]; let c = ''; if (done) c = id === Q.id ? 'ok' : (id === Q.picked ? 'no' : ''); return `<button class="opt ${c}" data-pick="${id}" ${done ? 'disabled' : ''}>${o.name}</button>`; }).join('')}</div>
        <div class="fb">${done ? `<h4>${Q.picked === Q.id ? 'Correct.' : 'Not quite. This is ' + e.name + '.'}</h4><ul>${e.find.slice(0, 3).map(x => `<li>${x}</li>`).join('')}</ul>
          <div class="row"><button class="btn pri" data-q="next">Next ECG ${I.next}</button><button class="btn" data-q="open">Full details</button></div>` : ''}</div>
      </div>`;
    const box = $('#qbox'), W = Math.max(280, box.clientWidth || 340), cv = $('#qc');
    quizLive();
  }
  function quizLive() {
    const box = $('#qbox'), cv = $('#qc'); if (!box || !cv || R.tab !== 'quiz') return;
    const W = Math.max(280, box.clientWidth || 340);
    if (Q.mode === 'mcq') {
      const q = QBY[Q.mid], e = LB.byId[q.ecg], pick = [], alt = q.ctl && q.ctl.alt && e.alt; LBL = alt ? e.alt.labels : null;
      (alt ? ['II', 'V1', 'V4', 'V5'] : [e.lead || 'II', 'II', 'V1', 'V5']).forEach(l => { if (!pick.includes(l) && pick.length < 3) pick.push(l); });
      startLive(cv, { W, leads: Q.full ? LEADS.map((_, i) => i) : pick.map(l => IDX[l]).sort((x, y) => x - y), rowMM: Q.full ? 18 : 28, gm: Q.full ? .6 : 1, T: Q.T, get: () => dataC(q), playing: () => true }); return;
    }
    LBL = null;
    startLive(cv, { W, leads: Q.full ? LEADS.map((_, i) => i) : [IDX.II, IDX.V1, IDX.V5], rowMM: Q.full ? 18 : 30, T: Q.T, get: () => data(Q.id), playing: () => true });
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'quiz') return;
    const t = ev.target, c = t.closest('[data-qcat]');
    const md = t.closest('[data-qmode]'); if (md) { Q.mode = md.dataset.qmode; Q.T = null; renderQuiz(); return; }
    const mc = t.closest('[data-mcat]'); if (mc) { Q.mcat = mc.dataset.mcat; Q.mbag = []; Q.mid = null; renderQuiz(); return; }
    const mp = t.closest('[data-mpick]');
    if (mp && Q.mp == null) { Q.mp = Number(mp.dataset.mpick); Q.total++; rec('q:' + Q.mid, Q.mopts[Q.mp] === QBY[Q.mid].ans); if (Q.mopts[Q.mp] === QBY[Q.mid].ans) { Q.score++; Q.streak++; if (Q.streak > S.qbest) { S.qbest = Q.streak; save(); } } else Q.streak = 0; renderQuiz(); return; }
    if (t.closest('[data-mnext]')) { nextM(); Q.T = null; renderQuiz(); window.scrollTo(0, 0); return; }
    if (c) { Q.cat = c.dataset.qcat; Q.bag = []; Q.id = null; renderQuiz(); return; }
    const p = t.closest('[data-pick]');
    if (p && Q.picked == null) { Q.picked = p.dataset.pick; Q.total++; rec('e:' + Q.id, Q.picked === Q.id); if (Q.picked === Q.id) { Q.score++; Q.streak++; if (Q.streak > S.qbest) { S.qbest = Q.streak; save(); } } else Q.streak = 0; renderQuiz(); return; }
    const a = t.closest('[data-q]'); if (!a) return;
    if (a.dataset.q === 'next') { nextQ(); renderQuiz(); window.scrollTo(0, 0); }
    else if (a.dataset.q === 'full') { Q.full = !Q.full; renderQuiz(); }
    else if (a.dataset.q === 'hint') { Q.hint = true; renderQuiz(); }
    else if (a.dataset.q === 'open') openViewer(Q.mode === 'mcq' ? QBY[Q.mid].ecg : Q.id, LIB.map(e => e.id), Q.mode === 'mcq' ? QBY[Q.mid].ctl : null);
  });

  /* ---------- FCPS tools: stats, OSPE, compare, progress ---------- */
  function rec(key, ok) { const s = S.stats[key] || [0, 0, 1]; if (ok) s[0]++; else s[1]++; s[2] = ok ? 1 : 0; S.stats[key] = s; save(); }
  const isMiss = key => { const s = S.stats[key]; return !!s && s[2] === 0; };
  const OSPE_SKIP = ['vf', 'asystole', 'torsades', 'hyperk-sev', 'pea'];
  const RHY = ['Sinus rhythm', 'Sinus bradycardia', 'Sinus tachycardia', 'Sinus rhythm with ectopic beats', 'Sinus node dysfunction (pause / sick sinus)', 'Atrial fibrillation', 'Atrial flutter', 'Atrial tachycardia (focal or multifocal)', 'Re-entrant SVT (AVNRT / AVRT)', 'Junctional rhythm', 'Second- or third-degree AV block', 'Idioventricular / escape rhythm', 'Ventricular tachycardia', 'Paced rhythm'];
  const RMAP = { af: 5, 'af-wpw': 5, 'flutter-2to1': 6, 'flutter-4to1': 6, 'atrial-tach': 7, mat: 7, svt: 8, avrt: 8, junctional: 9, mobitz1: 10, mobitz2: 10, av2to1: 10, chb: 10, 'high-grade': 10, aivr: 11, 'vent-escape': 11, vt: 12, 'paced-v': 13, 'pace-capture': 13, 'pace-sense': 13, pac: 3, pvc: 3, 'pvc-bigeminy': 3, trigeminy: 3, nsvt: 3, 'sinus-pause': 4, 'tachy-brady': 4 };
  const AXO = ['Normal (−30° to +90°)', 'Left axis deviation', 'Right axis deviation', 'Extreme axis'];
  const PRO = ['Normal (120–200 ms)', 'Short (< 120 ms)', 'Long (> 200 ms)', 'Variable, dissociated or absent'];
  const QRO = ['Narrow (< 120 ms)', 'Wide (≥ 120 ms)'];
  const QTO = ['Normal', 'Long', 'Short'];
  const FND = ['ST elevation', 'ST depression', 'T wave inversion', 'Peaked or hyperacute T', 'Prominent U waves', 'Delta wave', 'Pathological Q waves', 'Low voltage', 'None of these'];
  const FMAP = {
    'stemi-ant': [0, 1, 3], 'stemi-inf': [0, 1], 'stemi-lat': [0, 1], 'stemi-post': [1], 'stemi-rv': [0, 1], 'wellens-b': [2], 'wellens-a': [2], 'diffuse-st': [0, 1], pericarditis: [0],
    'hyperk-mild': [3], 'hyperk-mod': [3], hypok: [1, 4], digoxin: [1], wpw: [5], brugada: [0, 2], pe: [2], lvh: [1, 2], lbbb: [0, 1, 2], rbbb: [2], 'lbbb-mi': [0, 1],
    'de-winter': [1, 3], hyperacute: [3], 'cerebral-t': [2, 4], effusion: [7], copd: [7], rvh: [1, 2], hcm: [2, 6], 'old-mi': [2, 6], 'lv-aneurysm': [0, 6], takotsubo: [0], 'early-repol': [0], tca: [], 'af-wpw': [5], hypothermia: []
  };
  const numIn = s => { const m = /(\d+)/.exec(String(s || '')); return m ? +m[1] : null; };
  function ospeKey(id, d) {
    const e = LB.byId[id], m = e.meas, k = {};
    k.rate = d.hr;
    k.rhy = RMAP[id] != null ? RMAP[id] : (d.hr < 60 ? 1 : d.hr > 100 ? 2 : 0);
    const ax = /([+–\-−]?)\s*(\d+)\s*°/.exec(m.axis || '');
    if (ax && !/mixed|variable/.test(m.axis)) { let v = +ax[2]; if (/[–\-−]/.test(ax[1])) v = -v; k.ax = v < -90 || v > 180 ? 3 : v < -30 ? 1 : v > 90 ? (v >= 180 ? 3 : 2) : 0; } else k.ax = null;
    const prS = String(m.pr || '');
    if (['mobitz1', 'mobitz2', 'av2to1', 'chb', 'high-grade', 'mat', 'af', 'af-wpw', 'flutter-2to1', 'flutter-4to1', 'junctional', 'avrt', 'svt', 'vt', 'aivr', 'vent-escape', 'tachy-brady'].includes(id) || /variable|dissoc|none|RP|^–|^-$/.test(prS)) k.pr = 3;
    else { const v = numIn(prS); k.pr = v == null ? null : v < 120 ? 1 : v > 200 ? 2 : 0; }
    const qS = String(m.qrs || ''), qv = /^run/.test(qS) ? 90 : /merged/.test(qS) ? 200 : numIn(qS); k.qrs = qv == null ? null : qv >= 120 ? 1 : 0;
    const qtv = numIn(m.qtc); k.qt = qtv == null || /–/.test(String(m.qtc).trim()[0]) ? null : qtv > 470 ? 1 : qtv < 360 ? 2 : 0;
    const f = FMAP[id]; k.f = f && f.length ? f.slice() : [8];
    if (k.qrs === 1 && [ 'rbbb', 'lbbb', 'lbbb-mi', 'bifascicular'].includes(id)) k.bbb = true;
    k.dx = id; return k;
  }
  const OS = { id: null, ans: null, left: 0, iv: 0, done: false, mins: 3 };
  function stopOspeTimer() { if (OS.iv) clearInterval(OS.iv); OS.iv = 0; }
  function newOspe() {
    const pool = LIB.filter(e => !OSPE_SKIP.includes(e.id));
    let id; do { id = pool[Math.floor(Math.random() * pool.length)].id; } while (id === OS.id && pool.length > 1);
    Object.assign(OS, { id, ans: { f: [] }, done: false, left: OS.mins * 60, res: null });
  }
  function renderOSPE() {
    stopLive(); stopOspeTimer();
    if (!OS.id) newOspe();
    const e = LB.byId[OS.id], d = data(OS.id), sel = (k, opts, v) => `<select data-os="${k}"><option value="">Choose…</option>${opts.map((o, i) => `<option value="${i}" ${String(v) === String(i) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    const groups = CATS.map(c => `<optgroup label="${c}">${LIB.filter(x => x.cat === c).sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}" ${OS.ans.dx === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</optgroup>`).join('');
    main.innerHTML = `<div class="qtop">${modeSeg()}</div>
      <div class="panel">
        <div class="row"><span class="lbl">OSPE station · report this ECG</span><span class="sp"></span><button class="chip ${V.cal.on && V.cal.box === '#obox' ? 'on' : ''}" data-ocal>Caliper</button><span class="pill otime" id="otime">${OS.mins ? '' : 'Untimed'}</span></div>
        <div class="row" style="margin:8px 0 10px"><span class="hint" style="padding:0">Time</span><div class="seg">${[2, 3, 5, 0].map(m => `<button data-omin="${m}" class="${OS.mins === m ? 'on' : ''}">${m ? m + ' min' : 'Off'}</button>`).join('')}</div></div>
        <div class="vcanvas" id="obox"><canvas id="oc"></canvas></div>
        <p class="hint" style="padding:6px 0 0">25 mm/s · ${S.gain} mm/mV · swipe sideways for all leads. One small square = 40 ms.</p>
      </div>
      <div class="panel oform">
        <label>Rate (/min)<input type="number" inputmode="numeric" data-os="rate" value="${OS.ans.rate != null ? OS.ans.rate : ''}" placeholder="e.g. 75"></label>
        <label>Rhythm${sel('rhy', RHY, OS.ans.rhy)}</label>
        <label>Axis${sel('ax', AXO, OS.ans.ax)}</label>
        <label>PR interval${sel('pr', PRO, OS.ans.pr)}</label>
        <label>QRS${sel('qrs', QRO, OS.ans.qrs)}</label>
        <label>QT / QTc${sel('qt', QTO, OS.ans.qt)}</label>
        <div class="olbl">ST / T and other findings</div>
        <div class="chips wrap">${FND.map((f, i) => `<button class="chip ${OS.ans.f.includes(i) ? 'on' : ''}" data-of="${i}">${f}</button>`).join('')}</div>
        <label>Diagnosis<select data-os="dx"><option value="">Choose…</option>${groups}</select></label>
        <label>Your written report (optional)<textarea data-os="txt" rows="3" placeholder="Sinus rhythm, rate…">${OS.ans.txt || ''}</textarea></label>
        ${OS.done ? '' : '<button class="btn pri big" data-osub>Submit report</button>'}
      </div>
      <div id="ores"></div>`;
    const box = $('#obox'), W = Math.max(280, box.clientWidth || 340), sv = V.ann; V.ann = false;
    OS.rows = drawGrid12($('#oc'), d, W); V.ann = sv;
    if (V.cal.box === '#obox' && V.cal.on) renderCal();
    if (OS.done) ospeResult(); else if (OS.mins) { OS.iv = setInterval(() => { OS.left--; const el = $('#otime'); if (!el) { stopOspeTimer(); return; } el.textContent = dfmt(OS.left); el.classList.toggle('warn', OS.left <= 30); if (OS.left <= 0) { stopOspeTimer(); ospeSubmit(true); } }, 1000); $('#otime').textContent = dfmt(OS.left); }
  }
  function ospeSubmit(timeout) {
    stopOspeTimer(); const a = OS.ans, d = data(OS.id), k = ospeKey(OS.id, d), items = [];
    const it = (name, max, ok, part, yours, key) => items.push({ name, max, got: ok == null ? null : (part != null ? part : ok ? max : 0), yours, key });
    const rv = a.rate == null || a.rate === '' ? null : +a.rate;
    it('Rate', 1, k.rate == null ? null : rv != null && Math.abs(rv - k.rate) <= Math.max(10, k.rate * .12), null, rv != null ? rv + '/min' : '—', k.rate != null ? k.rate + '/min' : '–');
    it('Rhythm', 2, a.rhy != null && +a.rhy === k.rhy, null, a.rhy != null ? RHY[a.rhy] : '—', RHY[k.rhy]);
    it('Axis', 1, k.ax == null ? null : a.ax != null && +a.ax === k.ax, null, a.ax != null ? AXO[a.ax] : '—', k.ax == null ? 'not scored' : AXO[k.ax]);
    it('PR', 1, k.pr == null ? null : a.pr != null && +a.pr === k.pr, null, a.pr != null ? PRO[a.pr] : '—', k.pr == null ? 'not scored' : PRO[k.pr]);
    it('QRS', 1, k.qrs == null ? null : a.qrs != null && +a.qrs === k.qrs, null, a.qrs != null ? QRO[a.qrs] : '—', k.qrs == null ? 'not scored' : QRO[k.qrs]);
    it('QT', 1, k.qt == null ? null : a.qt != null && +a.qt === k.qt, null, a.qt != null ? QTO[a.qt] : '—', k.qt == null ? 'not scored' : QTO[k.qt]);
    const A1 = new Set(a.f), B1 = new Set(k.f), inter = [...A1].filter(x => B1.has(x)).length, uni = new Set([...A1, ...B1]).size;
    it('ST / T findings', 2, true, uni ? Math.round(2 * inter / uni * 2) / 2 : 2, a.f.length ? a.f.map(i => FND[i]).join(', ') : '—', k.f.map(i => FND[i]).join(', '));
    it('Diagnosis', 3, a.dx === k.dx, null, a.dx ? LB.byId[a.dx].name : '—', LB.byId[k.dx].name);
    const max = items.reduce((s, x) => s + (x.got == null ? 0 : x.max), 0), got = items.reduce((s, x) => s + (x.got || 0), 0);
    OS.res = { items, got, max, timeout, k };
    S.ospe.push({ id: OS.id, got, max, t: Date.now() }); if (S.ospe.length > 60) S.ospe.shift(); rec('e:' + OS.id, a.dx === k.dx); save();
    OS.done = true; renderOSPE();
  }
  function ospeResult() {
    const r = OS.res, e = LB.byId[OS.id], k = r.k, d = data(OS.id), pct = Math.round(r.got / r.max * 100);
    const model = `${RHY[k.rhy]}${k.rate ? ', rate about ' + k.rate + '/min' : ''}. Axis ${e.meas.axis}. PR ${e.meas.pr}, QRS ${e.meas.qrs}, QTc ${e.meas.qtc}. ${k.f[0] === 8 ? 'No ST/T abnormality of note.' : 'Findings: ' + k.f.map(i => FND[i].toLowerCase()).join(', ') + '.'} Impression: ${e.name}.`;
    const cv = $('#oc'); const ctx = cv.getContext('2d'); annDraw(ctx, OS.rows, d, e, {});
    $('#ores').innerHTML = `<div class="panel dsum"><h2 class="sh" style="margin-top:0">${r.timeout ? 'Time up · ' : ''}Score ${r.got} / ${r.max} <small class="pct ${pct >= 70 ? 'ok' : pct >= 50 ? 'mid' : 'no'}">${pct}%</small></h2>
      <table class="otab"><tr><th></th><th>You</th><th>Key</th></tr>${r.items.map(x => `<tr class="${x.got == null ? 'na' : x.got >= x.max ? 'ok' : x.got > 0 ? 'mid' : 'no'}"><td>${x.name}<small>${x.got == null ? '' : x.got + '/' + x.max}</small></td><td>${x.yours}</td><td>${x.key}</td></tr>`).join('')}</table>
      <div class="blk"><h4>Model report</h4><p>${model}</p><ul>${e.find.map(x => `<li>${x}</li>`).join('')}</ul></div>
      ${OS.ans.txt ? `<div class="blk"><h4>Your report</h4><p>${esc(OS.ans.txt)}</p></div>` : ''}
      <div class="blk"><h4>What to look at (marked on the ECG)</h4><ol class="annmini">${(V.annOut || []).filter(o => o.lead).map(o => `<li><b>${o.n}</b> ${o.txt} <em>${o.lead}</em></li>`).join('')}</ol></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-onext>Next station ${I.next}</button><button class="btn" data-oopen>Open in library</button></div></div>`;
  }

  const CMP = [
    { t: 'ST elevation: MI or not?', ids: ['stemi-ant', 'pericarditis', 'early-repol'], leads: ['II', 'V3'], pts: ['STEMI: convex ST elevation in a coronary territory with reciprocal depression and evolving change', 'Pericarditis: diffuse concave ST elevation, PR depression, PR elevation in aVR, no reciprocal change', 'Early repolarisation: concave ST elevation with J-point notch, tall T waves, stable over time, young patient'] },
    { t: 'Tall T waves', ids: ['hyperk-mild', 'hyperacute', 'de-winter'], leads: ['II', 'V3'], pts: ['Hyperkalaemia: narrow, pointed, tented T with a narrow base; often all leads', 'Hyperacute T: broad-based bulky T in one coronary territory, earliest STEMI sign', 'De Winter: upsloping ST depression at the J point running into tall T waves: proximal LAD occlusion'] },
    { t: 'Deep T inversion', ids: ['wellens-b', 'cerebral-t', 'pe'], leads: ['II', 'V2', 'V3'], pts: ['Wellens: deep symmetric T inversion V2–V3 in a pain-free patient, normal QT: critical LAD', 'Cerebral T: giant wide inversion, very long QT, bradycardia, neuro history', 'PE: T inversion V1–V4 with sinus tachycardia, S1Q3T3, right axis'] },
    { t: 'Wide-complex tachycardia', ids: ['vt', 'af-wpw', 'torsades'], leads: ['II', 'V1'], pts: ['Monomorphic VT: regular, uniform wide QRS, AV dissociation', 'Pre-excited AF: irregularly irregular, very fast, QRS width changes beat to beat', 'Torsades: polymorphic, twisting amplitude around the baseline, long QT between runs'] },
    { t: 'Narrow regular tachycardia', ids: ['svt', 'avrt', 'flutter-2to1'], leads: ['II', 'V1'], pts: ['AVNRT: P hidden in the QRS (pseudo r′ in V1)', 'AVRT: retrograde P in the ST segment, RP > 70 ms', 'Flutter 2:1: rate fixed near 150, sawtooth waves in II, III, aVF'] },
    { t: 'Irregular narrow rhythms', ids: ['af', 'mat', 'pac'], leads: ['II', 'V1'], pts: ['AF: no P waves, fibrillatory baseline, irregularly irregular', 'MAT: three or more P-wave shapes, rate > 100', 'Sinus with PACs: regular sinus beats interrupted by early abnormal P waves'] },
    { t: 'Second-degree AV block', ids: ['mobitz1', 'mobitz2', 'av2to1'], leads: ['II'], pts: ['Mobitz I: PR lengthens until a beat drops; grouped beating; usually nodal', 'Mobitz II: constant PR with sudden dropped QRS; often wide QRS; needs pacing', '2:1 block: cannot classify from PR; wide QRS suggests infranodal'] },
    { t: 'High-grade vs complete block', ids: ['high-grade', 'chb'], leads: ['II'], pts: ['High-grade: two or more P waves blocked in a row, but conducted beats have a constant PR', 'Complete: P waves and QRS fully independent; PR varies randomly; regular escape'] },
    { t: 'Broad QRS at normal rate', ids: ['rbbb', 'lbbb', 'paced-v'], leads: ['V1', 'V6'], pts: ['RBBB: rSR′ in V1, wide slurred S in I and V6', 'LBBB: deep broad S in V1, broad notched R in V6, discordant ST-T', 'Paced: pacing spike before each LBBB-like QRS'] },
    { t: 'Brugada or RBBB?', ids: ['brugada', 'rbbb'], leads: ['V1', 'V2'], pts: ['Brugada type 1: coved ST elevation ≥ 2 mm with negative T in V1–V2; no wide S in lateral leads', 'RBBB: rSR′ in V1 with a wide S in I and V6; ST change is secondary'] },
    { t: 'Long QT: which cause?', ids: ['longqt', 'hypoca', 'hypok'], leads: ['II', 'V3'], pts: ['Drug / congenital long QT: broad, late T wave', 'Hypocalcaemia: long flat ST segment, normal T wave', 'Hypokalaemia: flat T with prominent U wave (QU prolongation)'] },
    { t: 'Artefact or arrhythmia?', ids: ['artefact-tremor', 'vt', 'vf'], leads: ['II', 'V2'], pts: ['Artefact: sinus QRS complexes march through the noise; chest leads cleaner; patient awake with a pulse', 'VT: organised regular wide complexes in every lead', 'VF: chaotic waves in every lead, no QRS, no pulse'] },
    { t: 'Dominant R wave in V1', ids: ['rvh', 'stemi-post', 'rbbb'], leads: ['V1', 'V2'], pts: ['RVH: right axis, R/S > 1 in V1, RV strain', 'Posterior MI: tall R with horizontal ST depression and upright T in V1–V3', 'RBBB: rSR′ with QRS ≥ 120 ms'] }
  ];
  const CM = { i: 0 };
  function renderCmp() {
    stopLive(); const c = CMP[CM.i];
    main.innerHTML = `<div class="qtop">${modeSeg()}</div>
      <div class="chips" style="margin-bottom:12px">${CMP.map((x, i) => `<button class="chip ${CM.i === i ? 'on' : ''}" data-cmp="${i}">${x.t}</button>`).join('')}</div>
      ${c.ids.map((id, k) => `<div class="panel cmpp"><div class="row"><span class="lbl">${String.fromCharCode(65 + k)} · ${LB.byId[id].name}</span><span class="sp"></span><button class="btn" data-copen="${id}">Open</button></div><div class="vcanvas" style="margin-top:8px"><canvas id="cc${k}"></canvas></div><ol class="annmini" id="cl${k}"></ol></div>`).join('')}
      <div class="panel"><span class="lbl">Key differences</span><ul class="cmpl">${c.pts.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    c.ids.forEach((id, k) => {
      const cv = $('#cc' + k), W = Math.max(280, cv.parentElement.clientWidth || 340), d = data(id), li = c.leads.map(l => IDX[l]);
      const rows = drawStack(cv, d, li, W, 0, c.leads.length > 2 ? 17 : 20, true, 75);
      const out = annDraw(cv.getContext('2d'), rows, d, LB.byId[id], {});
      $('#cl' + k).innerHTML = out.filter(o => o.lead).map(o => `<li><b>${o.n}</b> ${o.txt} <em>${o.lead}</em></li>`).join('');
    });
  }
  function renderProg() {
    stopLive();
    const bar = (lab, r, w) => { const n = r + w, p = n ? Math.round(r / n * 100) : 0; return `<div class="pbar"><div class="pl"><span>${lab}</span><b>${n ? p + '%' : '–'}</b><small>${n ? r + '/' + n : 'not tried'}</small></div><i><s style="width:${p}%" class="${p >= 70 ? 'ok' : p >= 50 ? 'mid' : 'no'}"></s></i></div>`; };
    const agg = (keys) => keys.reduce((a, k) => { const s = S.stats[k]; if (s) { a[0] += s[0]; a[1] += s[1]; } return a; }, [0, 0]);
    const mq = QB.CATS.map(c => [c, agg(QB.list.filter(q => q.cat === c).map(q => 'q:' + q.id))]);
    const me = CATS.map(c => [c, agg(LIB.filter(e => e.cat === c).map(e => 'e:' + e.id))]);
    const missQ = QB.list.filter(q => isMiss('q:' + q.id)).length, missE = LIB.filter(e => isMiss('e:' + e.id)).length;
    const os = S.ospe.slice(-12), osAvg = os.length ? Math.round(os.reduce((s, x) => s + x.got / x.max, 0) / os.length * 100) : null;
    const weak = [...mq, ...me].filter(x => x[1][0] + x[1][1] >= 3).sort((a, b) => a[1][0] / (a[1][0] + a[1][1]) - b[1][0] / (b[1][0] + b[1][1])).slice(0, 3);
    main.innerHTML = `<div class="qtop">${modeSeg()}</div>
      <div class="panel"><span class="lbl">Mistakes to review</span><div class="row" style="margin-top:8px"><button class="btn pri" data-review="mcq">MCQ mistakes · ${missQ}</button><button class="btn pri" data-review="ecg">ECG mistakes · ${missE}</button></div>
        ${weak.length ? `<p class="hint" style="padding:10px 0 0">Weakest areas: <b>${weak.map(w => w[0]).join(', ')}</b></p>` : ''}</div>
      <div class="panel"><span class="lbl">OSPE stations</span><p style="margin-top:6px">${os.length ? `${S.ospe.length} done · average of last ${os.length}: <b>${osAvg}%</b>` : 'No OSPE stations yet.'}</p>
        ${os.length ? `<div class="spark">${os.map(x => `<i title="${LB.byId[x.id] ? LB.byId[x.id].name : ''}" style="height:${Math.max(6, x.got / x.max * 100)}%" class="${x.got / x.max >= .7 ? 'ok' : x.got / x.max >= .5 ? 'mid' : 'no'}"></i>`).join('')}</div>` : ''}</div>
      <div class="panel"><span class="lbl">MCQ accuracy by category</span>${mq.map(x => bar(x[0], x[1][0], x[1][1])).join('')}</div>
      <div class="panel"><span class="lbl">Name the ECG by category</span>${me.map(x => bar(x[0], x[1][0], x[1][1])).join('')}</div>
      <div class="panel"><button class="btn" data-preset>Reset progress</button></div>`;
  }
  main.addEventListener('input', ev => {
    if (R.tab !== 'quiz' || Q.mode !== 'ospe') return;
    const f = ev.target.closest('[data-os]'); if (!f) return;
    const k = f.dataset.os; OS.ans[k] = f.value === '' ? null : (k === 'dx' || k === 'txt' ? f.value : Number(f.value));
  });
  main.addEventListener('change', ev => {
    if (R.tab !== 'quiz' || Q.mode !== 'ospe') return;
    const f = ev.target.closest('select[data-os]'); if (!f) return;
    const k = f.dataset.os; OS.ans[k] = f.value === '' ? null : (k === 'dx' ? f.value : Number(f.value));
  });
  main.addEventListener('click', ev => {
    if (R.tab !== 'quiz') return;
    const t = ev.target;
    if (t.closest('[data-ocal]')) { const on = !(V.cal.on && V.cal.box === '#obox'); V.cal = Object.assign(V.cal, { on, box: '#obox', ta: null, tb: null }); t.closest('[data-ocal]').classList.toggle('on', on); renderCal(); return; }
    const om = t.closest('[data-omin]'); if (om) { OS.mins = Number(om.dataset.omin); if (!OS.done) { OS.left = OS.mins * 60; renderOSPE(); } else $$('[data-omin]').forEach(b => b.classList.toggle('on', b === om)); return; }
    const of = t.closest('[data-of]'); if (of && !OS.done) { const i = Number(of.dataset.of), a = OS.ans.f; if (i === 8) OS.ans.f = a.includes(8) ? [] : [8]; else { OS.ans.f = a.filter(x => x !== 8); if (a.includes(i)) OS.ans.f = OS.ans.f.filter(x => x !== i); else OS.ans.f.push(i); } $$('[data-of]').forEach(b => b.classList.toggle('on', OS.ans.f.includes(Number(b.dataset.of)))); return; }
    if (t.closest('[data-osub]')) { ospeSubmit(false); window.scrollTo(0, $('#ores').offsetTop - 80); return; }
    if (t.closest('[data-onext]')) { V.cal.ta = V.cal.tb = null; newOspe(); renderOSPE(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-oopen]')) { openViewer(OS.id, LIB.map(e => e.id)); return; }
    const cp = t.closest('[data-cmp]'); if (cp) { CM.i = Number(cp.dataset.cmp); renderCmp(); return; }
    const co = t.closest('[data-copen]'); if (co) { openViewer(co.dataset.copen, CMP[CM.i].ids); return; }
    const rv = t.closest('[data-review]'); if (rv) { if (rv.dataset.review === 'mcq') { Q.mode = 'mcq'; Q.mcat = 'Mistakes'; Q.mbag = []; Q.mid = null; } else { Q.mode = 'ecg'; Q.cat = 'Mistakes'; Q.bag = []; Q.id = null; } renderQuiz(); return; }
    const pr = t.closest('[data-preset]'); if (pr) { if (pr.dataset.sure) { S.stats = {}; S.ospe = []; save(); renderProg(); } else { pr.dataset.sure = 1; pr.textContent = 'Tap again to reset'; } return; }
  });

  /* ---------- ACLS drill ---------- */
  const CAUSES = ['Hypoxia', 'Hypovolaemia', 'Hypo/hyperkalaemia, metabolic', 'Hypothermia', 'Tension pneumothorax', 'Tamponade', 'Toxins', 'Thrombosis (PE or coronary)'];
  const [C_HYP, C_VOL, C_MET, C_COLD, C_PTX, C_TAM, C_TOX, C_THR] = CAUSES;
  const SCEN = [
    { r: 'vf', title: 'Collapse on the cardiac ward', cause: C_THR, story: '58-year-old man with two hours of crushing chest pain. He suddenly becomes unresponsive on the monitored ward and is not breathing normally. Pads are on.' },
    { r: 'vt', title: 'Wide regular rhythm, no pulse', cause: C_MET, story: '64-year-old man on haemodialysis who missed his last session. He slumps in the chair; the monitor shows a fast wide regular rhythm and you cannot feel a carotid pulse.' },
    { r: 'vf', title: 'Overdose in the emergency department', cause: C_TOX, story: '26-year-old woman brought in after taking a large number of her mother\'s antidepressant tablets. QRS was wide on arrival, then she became unresponsive.' },
    { r: 'asystole', title: 'Post-operative bleed', cause: C_VOL, story: '70-year-old woman, day 1 after major abdominal surgery. Drain has filled with fresh blood, she is pale and cold, and has now arrested.' },
    { r: 'asystole', title: 'Found outside in winter', cause: C_COLD, story: '45-year-old man found unresponsive outdoors overnight. He is cold to touch, skin is pale and stiff, rectal temperature 27 °C.' },
    { r: 'pea', title: 'Ventilated trauma patient', cause: C_PTX, story: 'Road traffic crash with right rib fractures, ventilated. Airway pressures have risen steeply, there are no breath sounds on the right and the trachea is deviated to the left.' },
    { r: 'pea', title: 'Day 1 after cardiac surgery', cause: C_TAM, story: 'Chest drains have suddenly stopped draining, central venous pressure is rising, blood pressure fell over minutes and now there is no pulse.' },
    { r: 'pea', title: 'Sudden breathlessness on the ward', cause: C_THR, story: 'Bed-bound patient with a swollen left leg becomes acutely breathless and collapses. Bedside echo shows a dilated right ventricle.' },
    { r: 'pea', title: 'Missed two dialysis sessions', cause: C_MET, story: 'Patient with end-stage kidney disease, weakness for two days, ECG yesterday showed peaked T waves. Now a slow wide rhythm and no pulse.' },
    { r: 'pea', title: 'Displaced tracheostomy', cause: C_HYP, story: 'Patient with a tracheostomy, SpO₂ dropping to 40% after the tube came out during turning, cyanosed, bradycardic then pulseless.' }
  ];
  const RLAB = { vf: 'VF', vt: 'Pulseless VT', asystole: 'Asystole', pea: 'PEA', sinus: 'Organised rhythm (sinus)' };
  const D = { run: false, done: true, log: [], T: null }, dCache = {};
  const dfmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dShockable = () => !D.rosc && (D.rhythm === 'vf' || D.rhythm === 'vt');
  const dKey = () => D.rosc ? 'sinus' : D.rhythm;
  function dData() {
    const key = dKey(), ck = key + (D.cprOn ? '|c' : '');
    if (dCache[ck]) return dCache[ck];
    let base = dCache[key];
    if (!base) { const m = { vf: ['vf', { sev: 1 }], vt: ['vt', {}], asystole: ['asystole', {}], pea: ['pea', {}], sinus: ['sinus-tachy', { rate: 105 }] }[key]; base = dCache[key] = E.synth(LB.byId[m[0]], { dur: 20, ctl: m[1] }); }
    if (!D.cprOn) return base;
    const a = base.leads[1], b = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) { const w = 2 * Math.PI * 1.85 * (i / FS); b[i] = a[i] + 1.1 * Math.sin(w) + .3 * Math.sin(2 * w + .6); }
    const leads = base.leads.slice(); leads[1] = b;
    return dCache[ck] = { leads, n: base.n, beats: [], hr: null };
  }
  const dLog = (txt, k) => { D.log.unshift({ t: D.t, txt, k: k || 'info' }); };
  const dBad = (txt, pts) => { D.score = Math.max(0, D.score - pts); D.errs.push(txt); dLog(txt + ' (−' + pts + ')', 'bad'); };
  function dRefresh() { D.disp = dData(); if (LIVE.o) LIVE.o.redraw(); drawCtl(); updDrill(); }
  function stopDrillTimer() { stopXT(); if (D.iv) clearInterval(D.iv); D.iv = 0; }
  function drillHome() {
    stopDrillTimer(); stopPeriTimer(); stopKTimer(); stopXT(); stopLive(); X.run = false;
    const T = [['A', 'Cardiac arrest', 'CPR, rhythm checks, shocks, drugs and the reversible cause'], ['B', 'Bradycardia', 'Atropine, adrenaline, transcutaneous pacing'], ['T', 'Tachycardia', 'Vagal, adenosine, drugs, synchronised shock'], ['K', 'Hyperkalaemia', 'Protect, shift, remove; ECG responds'], ['epi', 'Pacing wires', 'Post-cardiac surgery box: mode, output, sensitivity'], ['td', 'Torsades', 'Magnesium, QT drugs, potassium, rate'], ['tx', 'Toxicology', 'TCA, digoxin, beta-blocker overdose'], ['rosc', 'Post-ROSC', 'Seven decisions after return of circulation'], ['ot', 'OT emergencies', 'LAST, MH, suxamethonium, oculocardiac, high spinal, air embolism']];
    main.innerHTML = `<div class="dtiles">${T.map(x => `<button class="panel dtile" data-start="${x[0]}"><b>${x[1]}</b><span>${x[2]}</span><i>${I.play}</i></button>`).join('')}</div>
      <p class="hint">Follows ERC/AHA principles; drug effects are time-compressed. A teaching simulation, not for patient care.</p>`;
  }
  function startDrill() {
    stopDrillTimer(); stopPeriTimer(); stopKTimer(); P.run = false; K.run = false;
    let sc; do { sc = SCEN[Math.floor(Math.random() * SCEN.length)]; } while (sc === D.sc && SCEN.length > 1);
    Object.assign(D, { run: true, done: false, sc, rhythm: sc.r, rosc: false, cprOn: false, cyc: 0, cycT: 0, t: 0, shocks: 0, adr: 0, amio: 0, lastAdr: -999, causeTreated: false, tried: [], log: [], errs: [], score: 100, identPending: true, energy: 200, handsOff: 0, firstShock: null, firstAdr: null, menu: false, due: false, ended: null, T: null });
    dLog('Scenario started. Pads attached. Unresponsive, not breathing normally.', 'info');
    renderDrill();
  }
  const chans = (h, aHi, abp, spo) => [{ a: h.art, lo: 0, hi: aHi, color: ART_C, label: 'ART', val: abp }, { a: h.pl, lo: 0, hi: 1.35, color: PL_C, label: 'SpO₂', val: spo }];
  function dExtra() {
    const d = D.disp;
    if (D.rosc && !D.cprOn) { const h = hemo(d, { pf: 1, sys: 98, dia: 58, spo2: 92 }); return chans(h, 150, '98/58', '92'); }
    if (D.cprOn) return chans(cprHemo(d.n), 150, 'CPR ~66/14', '--');
    return chans(hemo(d, { pf: 0 }), 150, '--/--', '--');
  }
  function pExtra() {
    const d = P.disp, m = /^(\d+)\/(\d+)$/.exec(P.bp || '');
    if (!m || P.r === 'vf' || P.r === 'asys') return chans(hemo(d, { pf: 0 }), 150, '--/--', '--');
    const h = hemo(d, { pf: 1, sys: +m[1], dia: +m[2], spo2: P.spo2 });
    return chans(h, 150, P.bp, String(P.spo2));
  }
  function renderDrill() {
    stopLive();
    const sc = D.sc;
    main.innerHTML = `<div class="stack">
      <div class="panel"><div class="row"><span class="lbl">${sc.title}</span><span class="sp"></span>${D.done ? '' : '<button class="btn" data-d="end">End</button>'}</div><p style="margin-top:6px">${sc.story}</p></div>
      <div class="vcanvas live dmon" id="dbox"><canvas id="dc"></canvas><div class="dclock" id="dclock"></div><div class="dstat" id="dstat"></div><div class="dflash" id="dflash"></div></div>
      <div id="dctl"></div></div>`;
    D.disp = dData();
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II], rowMM: 34, T: D.T, get: () => D.disp, playing: () => true, exMM: 14, extra: dExtra });
    drawCtl(); updDrill();
    stopDrillTimer(); if (!D.done) D.iv = setInterval(drillTick, 250);
  }
  function drillTick() {
    if (!D.run || D.done) return;
    if (!$('#dclock')) { stopDrillTimer(); return; }
    const dt = D.cprOn ? 2.5 : .25; D.t += dt;
    if (D.cprOn) { D.cycT += dt; if (D.cycT >= 120 && !D.due) { D.due = true; dLog('2 minutes of CPR: pause and check the rhythm', 'info'); drawCtl(); } } else D.handsOff += dt;
    updDrill();
  }
  function updDrill() {
    const c = $('#dclock'); if (!c) return;
    c.textContent = dfmt(D.t);
    const st = $('#dstat'); if (st) { st.textContent = D.done ? 'Finished' : D.cprOn ? 'CPR in progress' : 'Paused: rhythm visible'; st.className = 'dstat' + (D.cprOn ? ' cpr' : ''); }
    const bar = $('#cbar'); if (bar) { const p = D.cprOn ? Math.min(100, D.cycT / 120 * 100) : 0; $('i', bar).style.width = p + '%'; $('#cbt').textContent = D.cprOn ? `Cycle ${D.cyc}: ${dfmt(D.cycT)} / 2:00` : (D.cyc ? 'Compressions paused' : 'Start CPR or shock a shockable rhythm'); bar.classList.toggle('due', !!D.due && D.cprOn); }
  }
  function dFlash() { const f = $('#dflash'); if (!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  function identHTML() {
    return `<div class="panel ident"><span class="lbl">What rhythm is this?</span><div class="chips" style="margin-top:8px;flex-wrap:wrap">${Object.keys(RLAB).map(k => `<button class="chip" data-ident="${k}">${RLAB[k]}</button>`).join('')}</div></div>`;
  }
  function drawCtl() {
    const el = $('#dctl'); if (!el) return;
    if (D.done) { el.innerHTML = summaryHTML(); return; }
    const p = !D.cprOn, nA = D.amio === 0 ? 300 : 150;
    el.innerHTML = `
      <div class="cbar" id="cbar"><i></i><span id="cbt"></span></div>
      ${D.identPending && p ? identHTML() : ''}
      <button class="dbtn cpr ${D.cprOn ? 'on' : ''}" data-d="cpr">${D.cprOn ? I.pause + ' Pause CPR and check rhythm' : I.play + ' Start CPR'}</button>
      <div class="row" style="margin:10px 0 6px"><span class="lbl">Energy</span><div class="seg">${[120, 150, 200].map(j => `<button data-en="${j}" class="${D.energy === j ? 'on' : ''}">${j} J</button>`).join('')}</div></div>
      <div class="dgrid">
        <button class="dbtn shock" data-d="shock" ${p ? '' : 'disabled'}>⚡ Shock ${D.energy} J</button>
        <button class="dbtn" data-d="pulse" ${p ? '' : 'disabled'}>Check pulse</button>
        <button class="dbtn adr" data-d="adr">Adrenaline 1 mg</button>
        <button class="dbtn" data-d="amio" ${D.amio >= 2 ? 'disabled' : ''}>Amiodarone ${nA} mg</button>
      </div>
      <button class="dbtn cause ${D.menu ? 'on' : ''}" data-d="menu">Treat reversible cause ${D.causeTreated ? '✓' : ''}</button>
      ${D.menu ? `<div class="chips cm" style="flex-wrap:wrap">${CAUSES.map((c, i) => `<button class="chip ${D.tried.includes(c) ? (c === D.sc.cause ? 'ok' : 'no') : ''}" data-cause="${i}" ${D.tried.includes(c) ? 'disabled' : ''}>${c}</button>`).join('')}</div>` : ''}
      <div class="row dcount"><span class="pill">Shocks <b>${D.shocks}</b></span><span class="pill">Adrenaline <b>${D.adr}</b></span><span class="pill">Amiodarone <b>${D.amio}</b></span><span class="pill">Score <b>${D.score}</b></span></div>
      ${logHTML()}`;
    updDrill();
  }
  const logHTML = () => `<div class="panel dlog"><span class="lbl">Event log</span><ul>${D.log.slice(0, 14).map(l => `<li class="${l.k}"><time>${dfmt(l.t)}</time>${l.txt}</li>`).join('')}</ul></div>`;
  function dEnd(ok, why) {
    D.done = true; D.ended = { ok, why }; stopDrillTimer(); if (ok) dLog('Pulse confirmed: ROSC', 'ok');
    renderDrill();
  }
  function summaryHTML() {
    const e = D.ended, tc = D.causeTreated;
    return `<div class="panel dsum"><h2 class="sh" style="margin-top:0">${e.ok ? 'ROSC achieved' : 'Scenario ended'}</h2><p>${e.why}</p>
      <div class="meas dm"><div><small>Score</small><b>${D.score}/100</b></div><div><small>Clock</small><b>${dfmt(D.t)}</b></div><div><small>Shocks</small><b>${D.shocks}</b></div><div><small>Adr.</small><b>${D.adr}</b></div><div><small>Paused</small><b>${dfmt(D.handsOff)}</b></div></div>
      <div class="blk"><h4>Reversible cause</h4><p>${D.sc.cause}${tc ? ': treated.' : ': not treated.'}</p></div>
      <div class="blk"><h4>${D.errs.length ? 'Points lost' : 'Well done'}</h4>${D.errs.length ? '<ul>' + D.errs.map(x => `<li>${x}</li>`).join('') + '</ul>' : '<p>No errors recorded.</p>'}</div>
      ${e.ok ? '<div class="blk"><h4>After ROSC</h4><ul><li>12-lead ECG, and emergency angiography if STEMI</li><li>SpO₂ 94–98%, normal PaCO₂, avoid hyperoxia</li><li>MAP at least 65 mmHg</li><li>Treat the cause, prevent fever, check glucose</li></ul></div>' : ''}
      <div class="row" style="margin-top:12px"><button class="btn pri" data-d="start">Next scenario</button><button class="btn" data-d="home">Back</button></div></div>${logHTML()}`;
  }
  const ORD = { 3: '3rd', 5: '5th' };
  function drillAct(a) {
    if (a === 'home') { D.run = false; P.run = false; K.run = false; X.run = false; drillHome(); return; }
    if (D.done && a !== 'start') return;
    if (a === 'start') { startDrill(); return; }
    if (a === 'home') { D.run = false; P.run = false; drillHome(); return; }
    if (a === 'end') { dEnd(false, 'You ended the scenario.'); return; }
    if (a === 'menu') { D.menu = !D.menu; drawCtl(); return; }
    if (a === 'cpr') {
      if (!D.cprOn) {
        if (D.rosc) dBad('Compressions started on an organised rhythm: check for a pulse first', 5);
        D.cprOn = true; D.cyc++; D.cycT = 0; D.due = false; D.identPending = false; dLog('CPR started (cycle ' + D.cyc + ')', 'ok');
      } else {
        D.cprOn = false; D.identPending = true; dLog('CPR paused at ' + dfmt(D.cycT) + ': rhythm check' + (D.cycT < 90 ? ' (before 2 min)' : ''), 'info'); D.due = false;
        if (!D.rosc && (D.rhythm === 'asystole' || D.rhythm === 'pea') && D.adr >= 1 && D.causeTreated && D.cycT >= 90 && D.cyc >= 2) { D.rosc = true; dLog('The rhythm has changed to an organised one: check for a pulse', 'info'); }
        else if (!D.rosc && D.cyc >= 8) { dEnd(false, 'Eight cycles without ROSC: the team decides to stop resuscitation.'); return; }
      }
      dRefresh(); return;
    }
    if (a === 'shock') {
      if (D.cprOn) return;
      if (D.rosc) { dBad('Shock given to an organised rhythm: not indicated', 15); dFlash(); dRefresh(); return; }
      if (!dShockable()) { dBad('Shock given for a non-shockable rhythm (' + RLAB[D.rhythm] + ')', 15); dFlash(); dRefresh(); return; }
      D.shocks++; if (D.firstShock == null) D.firstShock = D.t; dFlash();
      dLog('Shock ' + D.shocks + ': ' + D.energy + ' J biphasic. Resume CPR now', 'ok');
      if (D.energy < 150) dLog('Use at least 150 J biphasic', 'info');
      const P = [.25, .35, .5, .6, .7, 1], p = P[Math.min(D.shocks - 1, 5)] + (D.causeTreated ? .15 : 0) + (D.energy >= 200 ? .05 : 0);
      if (D.shocks >= 5 || Math.random() < p) { D.rosc = true; dLog('The rhythm after the shock is organised', 'info'); }
      else if (Math.random() < .3) D.rhythm = D.rhythm === 'vf' ? 'vt' : 'vf';
      D.identPending = true; dRefresh(); return;
    }
    if (a === 'pulse') {
      if (D.cprOn) return;
      if (D.rosc) { dEnd(true, 'A pulse is present. Return of spontaneous circulation.'); return; }
      dLog(D.rhythm === 'pea' ? 'No pulse: this is PEA. Resume CPR' : 'No pulse. Pulse checks are only needed for an organised rhythm', 'info'); dRefresh(); return;
    }
    if (a === 'adr') {
      const sh = dShockable();
      if (D.rosc) { dBad('Adrenaline given to a patient with an organised rhythm', 10); dRefresh(); return; }
      if (sh && D.shocks < 2) dBad('Adrenaline before the 2nd shock: in VF or pulseless VT shocks come first', 5);
      if (D.t - D.lastAdr < 180) dBad('Adrenaline repeated too soon (every 3–5 minutes)', 5);
      if (!sh && D.adr === 0 && D.t > 240) dBad('First adrenaline delayed: give it as soon as possible in a non-shockable rhythm', 5);
      D.adr++; D.lastAdr = D.t; if (D.firstAdr == null) D.firstAdr = D.t; dLog('Adrenaline 1 mg IV (dose ' + D.adr + ')', 'ok'); dRefresh(); return;
    }
    if (a === 'amio') {
      if (!dShockable()) { dBad('Amiodarone is not indicated in this rhythm', 10); dRefresh(); return; }
      const need = D.amio === 0 ? 3 : 5;
      if (D.shocks < need) dBad('Amiodarone ' + (D.amio === 0 ? 300 : 150) + ' mg given before the ' + ORD[need] + ' shock', 5);
      D.amio++; dLog('Amiodarone ' + (D.amio === 1 ? 300 : 150) + ' mg IV', 'ok'); dRefresh(); return;
    }
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'drill') return;
    const t = ev.target, en = t.closest('[data-en]'); if (en) { D.energy = Number(en.dataset.en); drawCtl(); return; }
    const id = t.closest('[data-ident]');
    if (id) { const truth = dKey(), k = id.dataset.ident; D.identPending = false; if (k === truth) dLog('Rhythm identified: ' + RLAB[k], 'ok'); else dBad('Rhythm called ' + RLAB[k] + ' but it is ' + RLAB[truth], 5); drawCtl(); return; }
    const cs = t.closest('[data-cause]');
    if (cs) { const c = CAUSES[Number(cs.dataset.cause)]; if (D.tried.includes(c)) return; D.tried.push(c); if (c === D.sc.cause) { D.causeTreated = true; dLog('Reversible cause treated: ' + c, 'ok'); } else dBad(c + ' does not fit this patient', 3); drawCtl(); return; }
    const b = t.closest('[data-d]'); if (b) drillAct(b.dataset.d);
  });

  /* ---------- Peri-arrest drill: bradycardia & tachycardia ---------- */
  const PMAP = { sb: ['sinus-brady', { rate: 36 }], sb48: ['sinus-brady', { rate: 48 }], nsr: ['nsr', { rate: 78 }], st: ['sinus-tachy', { rate: 104 }], chb: ['chb', { rate: 30 }], chb38: ['chb', { rate: 38 }], m2: ['mobitz2', { rate: 64 }], svt: ['svt', { rate: 190 }], svt2: ['svt', { rate: 212 }], fl: ['flutter-2to1', {}], fl4: ['flutter-4to1', {}], vt: ['vt', { rate: 180 }], afwpw: ['af-wpw', {}], vf: ['vf', {}], asys: ['asystole', {}] };
  const PSC = [
    { k: 'B', title: 'Bradycardia after tracheal suction', r: 'sb', unstable: true, bp: '74/40', spo2: 93, cons: 'Drowsy, clammy', story: 'Ventilated patient on day 3 of ICU stay. During tracheal suction the heart rate falls and stays low.', fix: 'atropine', teach: 'Vagal sinus bradycardia responds to atropine. Stop the stimulus.' },
    { k: 'B', title: 'Complete heart block with syncope', r: 'chb', unstable: true, bp: '72/38', spo2: 95, cons: 'Confused after a syncopal episode', story: '78-year-old woman admitted after collapse at home. Pads are on.', fix: 'pace', teach: 'Wide-complex escape (infranodal block) rarely responds to atropine. Pace early.' },
    { k: 'B', title: 'Mobitz II after anterior MI', r: 'm2', unstable: true, bp: '84/48', spo2: 94, cons: 'Light-headed, chest discomfort', story: 'Day 1 after anterior STEMI, now with intermittent dropped beats and a falling blood pressure.', fix: 'pace', teach: 'Mobitz II is infranodal and can progress to complete heart block. Pacing is the answer.' },
    { k: 'B', title: 'Slow but stable', r: 'sb48', unstable: false, bp: '124/72', spo2: 98, cons: 'Alert, no symptoms', story: 'Post-operative patient on bisoprolol, sitting up and talking. The nurse is worried about a heart rate of 48.', fix: 'observe', teach: 'An asymptomatic bradycardia with no adverse features needs observation and a drug review only.' },
    { k: 'T', title: 'Stable narrow-complex tachycardia', r: 'svt', unstable: false, bp: '118/74', spo2: 98, cons: 'Alert, palpitations', story: '34-year-old woman with sudden-onset palpitations while at work. No chest pain.', fix: 'adenosine', teach: 'Vagal manoeuvre first, then adenosine 6 mg, 12 mg, then 12 mg (18 mg in some guidelines).' },
    { k: 'T', title: 'Narrow-complex tachycardia with shock', r: 'svt2', unstable: true, bp: '68/40', spo2: 91, cons: 'Confused, grey', story: '60-year-old man with a regular tachycardia, hypotensive and confused.', fix: 'sync', teach: 'Adverse features: synchronised cardioversion under sedation, up to three attempts.' },
    { k: 'T', title: 'Regular tachycardia at 150', r: 'fl', unstable: false, bp: '112/70', spo2: 97, cons: 'Alert, mild breathlessness', story: '70-year-old man with COPD, rate fixed at 150 for the past hour.', fix: 'rate', teach: 'A fixed rate of 150 is flutter until proven otherwise. Adenosine unmasks the flutter waves but does not cure it; control the rate.' },
    { k: 'T', title: 'VT with a pulse and chest pain', r: 'vt', unstable: true, bp: '70/35', spo2: 90, cons: 'Drowsy, chest pain', story: 'Known ischaemic cardiomyopathy. Wide regular tachycardia with a weak carotid pulse.', fix: 'sync', teach: 'Unstable VT with a pulse: synchronised cardioversion, then amiodarone 300 mg if three shocks fail.' },
    { k: 'T', title: 'Stable VT', r: 'vt', unstable: false, bp: '122/78', spo2: 97, cons: 'Alert, palpitations', story: 'Wide regular tachycardia in a man with a previous MI. He is comfortable and well perfused.', fix: 'amio', teach: 'Stable VT: amiodarone 300 mg IV over 10–20 minutes (or procainamide). Avoid verapamil. Have the defibrillator ready.' },
    { k: 'T', title: 'Fast irregular wide tachycardia', r: 'afwpw', unstable: false, bp: '104/66', spo2: 97, cons: 'Alert, anxious', story: '25-year-old man, known "abnormal ECG" as a teenager. Very fast irregular palpitations.', fix: 'proc', teach: 'Pre-excited AF: procainamide or synchronised cardioversion. AV-nodal blockers can cause VF.' }
  ];
  const P = { run: false, done: true, log: [], T: null, iv: 0 }, pCache = {};
  const ADV = 'Adverse features (shock, syncope, ischaemia, heart failure)';
  function pData() {
    let key = P.r, base;
    if (key === 'paced') { key = 'paced' + P.pace.rate; base = pCache[key] || (pCache[key] = E.synth(LB.byId['paced-v'], { dur: 20, ctl: { rate: P.pace.rate } })); }
    else { const m = PMAP[key]; base = pCache[key] || (pCache[key] = E.synth(LB.byId[m[0]], { dur: 20, ctl: m[1] })); }
    if (!P.pace.on) return base;
    const ck = key + '|tcp' + P.pace.rate; if (pCache[ck]) return pCache[ck];
    const a = base.leads[1], b = Float32Array.from(a), iv = 60 / P.pace.rate;
    const ts = P.r === 'paced' ? base.beats.map(x => x.t - .012) : []; if (P.r !== 'paced') for (let t = .3; t < base.n / FS; t += iv) ts.push(t);
    for (const t of ts) { const c = Math.round(t * FS); for (let i = -2; i <= 2; i++) if (b[c + i] != null) b[c + i] += (i === 0 ? 1.4 : i === -1 || i === 1 ? .7 : .15); for (let i = 3; i < 60; i++) if (b[c + i] != null) b[c + i] -= .35 * Math.exp(-i / 18); }
    const leads = base.leads.slice(); leads[1] = b;
    return pCache[ck] = { leads, n: base.n, beats: base.beats, hr: base.hr };
  }
  const pHR = () => { if (P.r === 'asys') return 0; if (P.r === 'vf') return '--'; if (P.r === 'paced') return P.pace.rate; return pData().hr; };
  const pLog = (txt, k) => P.log.unshift({ t: P.t, txt, k: k || 'info' });
  const pBad = (txt, pts) => { P.score = Math.max(0, P.score - pts); P.errs.push(txt); pLog(txt + ' (−' + pts + ')', 'bad'); };
  const later = (sec, fn) => P.q.push({ at: P.t + sec, fn });
  function setR(r, bp, cons) { P.r = r; if (bp) P.bp = bp; if (cons) P.cons = cons; P.disp = pData(); if (LIVE.o) LIVE.o.redraw(); pVitals(); }
  function startPeri(kind) {
    stopDrillTimer(); stopPeriTimer(); stopKTimer(); D.run = false; K.run = false;
    const pool = PSC.filter(s => s.k === kind); let sc; do { sc = pool[Math.floor(Math.random() * pool.length)]; } while (sc === P.sc && pool.length > 1);
    Object.assign(P, { run: true, done: false, kind, sc, r: sc.r, bp: sc.bp, spo2: sc.spo2, cons: sc.cons, t: 0, score: 100, errs: [], log: [], q: [], assessed: false, sedated: false, sync: false, energy: kind === 'T' ? 120 : 0, shocks: 0, aden: 0, atro: 0, adrInf: false, amio: 0, pace: { on: false, rate: 70, mA: 0, thr: 50 + Math.floor(Math.random() * 6) * 8, confirmed: false }, fixed: false, ended: null, T: null, lock: false });
    pLog('Scenario started. Monitor and pads attached, IV access in place.');
    renderPeri();
  }
  function stopPeriTimer() { if (P.iv) clearInterval(P.iv); P.iv = 0; }
  function renderPeri() {
    stopLive(); const sc = P.sc;
    main.innerHTML = `<div class="stack">
      <div class="panel"><div class="row"><span class="lbl">${P.kind === 'B' ? 'Bradycardia' : 'Tachycardia'} · ${sc.title}</span><span class="sp"></span>${P.done ? '' : '<button class="btn" data-p="end">End</button>'}</div><p style="margin-top:6px">${sc.story}</p></div>
      <div class="vits" id="vits"></div>
      <div class="vcanvas live dmon" id="dbox"><canvas id="dc"></canvas><div class="dclock" id="dclock"></div><div class="dstat" id="dstat"></div><div class="dflash" id="dflash"></div></div>
      <div id="pctl"></div></div>`;
    P.disp = pData();
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II], rowMM: 34, T: P.T, get: () => P.disp, playing: () => true, exMM: 14, extra: pExtra });
    pVitals(); pCtl();
    stopPeriTimer(); if (!P.done) P.iv = setInterval(periTick, 250);
  }
  function pVitals() {
    const v = $('#vits'); if (!v) return;
    const hr = pHR();
    v.innerHTML = `<div><small>HR</small><b>${hr == null ? '--' : hr}</b></div><div><small>BP</small><b>${P.bp}</b></div><div><small>SpO₂</small><b>${P.spo2}%</b></div><div class="wide"><small>Patient</small><b>${P.cons}</b></div>`;
    const c = $('#dclock'); if (c) c.textContent = dfmt(P.t);
    const st = $('#dstat'); if (st) { st.textContent = P.done ? 'Finished' : P.sync ? 'SYNC ON' : P.pace.on ? `Pacing ${P.pace.rate}/min · ${P.pace.mA} mA` : 'Monitoring'; st.className = 'dstat' + (P.sync || P.pace.on ? ' cpr' : ''); }
  }
  function periTick() {
    if (!P.run || P.done) return;
    if (!$('#dclock')) { stopPeriTimer(); return; }
    P.t += 1;
    const due = P.q.filter(x => x.at <= P.t); P.q = P.q.filter(x => x.at > P.t); due.forEach(x => x.fn());
    if (!P.done && P.sc.unstable && !P.fixed && P.t >= 300) {
      setR(P.kind === 'B' ? 'asys' : 'vf', '—', 'Unresponsive, no pulse');
      pEnd(false, 'Five minutes passed without effective treatment and the patient arrested. Start CPR (use the arrest drill).'); return;
    }
    pVitals();
  }
  const ok = (r, bp, cons, msg) => { P.fixed = true; setR(r, bp || '116/72', cons || 'Improving, better perfused'); pLog(msg, 'ok'); pCtl(); };
  function pEnd(good, why) { P.done = true; P.ended = { good, why }; stopPeriTimer(); renderPeri(); }
  function pSum() {
    const e = P.ended, sc = P.sc;
    return `<div class="panel dsum"><h2 class="sh" style="margin-top:0">${e.good ? 'Scenario complete' : 'Scenario ended'}</h2><p>${e.why}</p>
      <div class="meas dm"><div><small>Score</small><b>${P.score}/100</b></div><div><small>Clock</small><b>${dfmt(P.t)}</b></div><div><small>Shocks</small><b>${P.shocks}</b></div><div><small>Adenosine</small><b>${P.aden}</b></div><div><small>Atropine</small><b>${P.atro}</b></div></div>
      <div class="blk"><h4>Key point</h4><p>${sc.teach}</p></div>
      <div class="blk"><h4>${P.errs.length ? 'Points lost' : 'Well done'}</h4>${P.errs.length ? '<ul>' + P.errs.map(x => `<li>${x}</li>`).join('') + '</ul>' : '<p>No errors recorded.</p>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-p="again">Next ${P.kind === 'B' ? 'bradycardia' : 'tachycardia'} case</button><button class="btn" data-d="home">Back</button></div></div>${pLogHTML()}`;
  }
  const pLogHTML = () => `<div class="panel dlog"><span class="lbl">Event log</span><ul>${P.log.slice(0, 14).map(l => `<li class="${l.k}"><time>${dfmt(l.t)}</time>${l.txt}</li>`).join('')}</ul></div>`;
  function pCtl() {
    const el = $('#pctl'); if (!el) return;
    if (P.done) { el.innerHTML = pSum(); return; }
    const asq = P.assessed ? '' : `<div class="panel ident"><span class="lbl">First: is the patient stable?</span><div class="chips" style="margin-top:8px;flex-wrap:wrap"><button class="chip" data-assess="s">Stable, no adverse features</button><button class="chip" data-assess="u">${ADV}</button></div></div>`;
    let h = asq;
    if (P.kind === 'B') {
      h += `<div class="dgrid">
        <button class="dbtn adr" data-p="atro">Atropine 500 mcg</button>
        <button class="dbtn" data-p="adrinf" ${P.adrInf ? 'disabled' : ''}>Adrenaline infusion 2–10 mcg/min</button>
        <button class="dbtn" data-p="sed" ${P.sedated ? 'disabled' : ''}>Analgesia / sedation</button>
        <button class="dbtn" data-p="obs">Observe, review drugs</button></div>
        <div class="panel pace"><div class="row"><span class="lbl">Transcutaneous pacing</span><span class="sp"></span><button class="btn ${P.pace.on ? 'pri' : ''}" data-p="paceon">${P.pace.on ? 'Pacing ON' : 'Start pacing'}</button></div>
          <div class="row" style="margin-top:10px"><span class="lbl">Rate</span><div class="seg">${[60, 70, 80].map(r => `<button data-prate="${r}" class="${P.pace.rate === r ? 'on' : ''}">${r}</button>`).join('')}</div></div>
          <div class="row ma" style="margin-top:10px"><span class="lbl">Output</span><button class="btn" data-ma="-">−</button><b class="mav">${P.pace.mA} mA</b><button class="btn" data-ma="+">+</button></div>
          <button class="dbtn" style="margin-top:10px" data-p="confirm" ${P.pace.on ? '' : 'disabled'}>Feel femoral pulse (mechanical capture)</button></div>`;
    } else {
      h += `<div class="dgrid">
        <button class="dbtn" data-p="vagal">Vagal manoeuvre</button>
        <button class="dbtn adr" data-p="aden">Adenosine ${P.aden === 0 ? 6 : 12} mg rapid IV</button>
        <button class="dbtn" data-p="ccb">Verapamil / beta-blocker</button>
        <button class="dbtn" data-p="amio">Amiodarone 300 mg IV</button>
        <button class="dbtn" data-p="proc">Procainamide IV</button>
        <button class="dbtn" data-p="sed" ${P.sedated ? 'disabled' : ''}>Sedation / analgesia</button></div>
        <div class="row" style="margin:12px 0 6px"><button class="btn ${P.sync ? 'pri' : ''}" data-p="sync">SYNC ${P.sync ? 'ON' : 'OFF'}</button><div class="seg">${[70, 120, 150, 200].map(j => `<button data-pen="${j}" class="${P.energy === j ? 'on' : ''}">${j} J</button>`).join('')}</div></div>
        <button class="dbtn shock" data-p="shock">⚡ ${P.sync ? 'Synchronised shock' : 'Shock (unsynchronised)'} ${P.energy} J</button>`;
    }
    h += `<div class="row dcount"><span class="pill">Score <b>${P.score}</b></span></div>${pLogHTML()}`;
    el.innerHTML = h; pVitals();
  }
  function periAct(a) {
    if (P.done && a !== 'again') return;
    const sc = P.sc, r = P.r;
    if (a === 'again') { startPeri(P.kind); return; }
    if (a === 'end') { pEnd(false, 'You ended the scenario.'); return; }
    if (P.lock) { pLog('Wait for the current drug effect.'); pCtl(); return; }
    if (a === 'sed') { P.sedated = true; pLog(P.kind === 'B' ? 'Analgesia and sedation given for pacing' : 'Procedural sedation given', 'ok'); pCtl(); return; }
    /* ---- bradycardia ---- */
    if (a === 'obs') {
      if (!sc.unstable && P.kind === 'B') { P.fixed = true; pLog('Observed, bisoprolol dose reviewed', 'ok'); pEnd(true, 'Correct: no adverse features, so no emergency treatment was needed.'); return; }
      pBad('Observation chosen for an unstable patient', 15); pCtl(); return;
    }
    if (a === 'atro') {
      if (P.kind !== 'B') { pBad('Atropine is not a treatment for tachycardia', 10); pCtl(); return; }
      P.atro++;
      if (P.atro > 6) pBad('More than 3 mg atropine (maximum dose)', 5);
      if (!sc.unstable) pBad('Atropine given without adverse features', 5);
      pLog('Atropine 500 mcg IV (total ' + (P.atro * .5).toFixed(1) + ' mg)', 'ok');
      if (r === 'sb' || r === 'sb48') { P.lock = true; later(30, () => { P.lock = false; ok('nsr', '112/68', 'Alert, warm', 'Heart rate rising after atropine'); if (sc.fix === 'atropine') later(10, () => pEnd(true, 'Rate and blood pressure restored with atropine. Now stop the trigger (suction) and look for hypoxia.')); }); }
      else { P.lock = true; later(30, () => { P.lock = false; pLog('No useful response to atropine: the block is below the AV node'); pCtl(); }); }
      pCtl(); return;
    }
    if (a === 'adrinf') {
      if (P.kind !== 'B') return;
      P.adrInf = true; pLog('Adrenaline infusion started', 'ok');
      if (!sc.unstable) pBad('Chronotrope started without adverse features', 5);
      if (r === 'chb' || r === 'm2') later(30, () => { if (P.r === 'chb' || P.r === 'm2') { setR('chb38', '82/46'); pLog('Small rise in escape rate: still inadequate. Prepare pacing.'); pCtl(); } });
      else later(30, () => ok('nsr', '110/66', 'Alert, warm', 'Heart rate improving on adrenaline infusion'));
      pCtl(); return;
    }
    if (a === 'paceon') {
      if (!P.pace.on) { P.pace.on = true; if (!sc.unstable) pBad('Pacing started without adverse features', 10); pLog('Transcutaneous pacing started at ' + P.pace.rate + '/min, ' + P.pace.mA + ' mA'); }
      else { P.pace.on = false; P.pace.confirmed = false; if (P.r === 'paced') setR(sc.r === 'm2' ? 'm2' : 'chb', sc.bp); pLog('Pacing stopped'); }
      P.disp = pData(); if (LIVE.o) LIVE.o.redraw(); pCtl(); return;
    }
    if (a === 'confirm') {
      if (P.r === 'paced') {
        if (!P.sedated) pBad('Pacing a conscious patient without analgesia or sedation', 5);
        if (P.pace.mA < P.pace.thr + 5) pLog('Tip: set output about 5–10 mA above the capture threshold');
        P.pace.confirmed = true; P.fixed = true; pLog('Femoral pulse matches the paced rate: mechanical capture', 'ok');
        pEnd(true, 'Paced at ' + P.pace.rate + '/min with mechanical capture (threshold ' + P.pace.thr + ' mA). Next: transvenous pacing wire and look for the cause.'); return;
      }
      pLog(P.pace.on ? 'Pulse does not match the pacing rate: no capture yet, increase the mA' : 'Pacing is off'); pCtl(); return;
    }
    /* ---- tachycardia ---- */
    if (a === 'vagal') {
      if (P.kind !== 'T') return;
      if (sc.unstable) pBad('Vagal manoeuvre in an unstable patient delays cardioversion', 5);
      pLog('Modified Valsalva manoeuvre');
      if (r === 'svt' && Math.random() < .3) { ok('nsr', '120/76', 'Alert, relieved', 'Converted to sinus rhythm'); later(8, () => pEnd(true, 'Converted with a vagal manoeuvre.')); }
      else pLog('No change');
      pCtl(); return;
    }
    if (a === 'aden') {
      if (P.kind !== 'T') { pBad('Adenosine is not a bradycardia treatment', 10); pCtl(); return; }
      const dose = P.aden === 0 ? 6 : 12; P.aden++;
      if (P.aden > 3) pBad('More than three adenosine doses', 5);
      pLog('Adenosine ' + dose + ' mg rapid IV bolus with flush', 'ok');
      if (r === 'afwpw') { pBad('Adenosine in pre-excited AF can precipitate VF', 20); if (Math.random() < .6) { setR('vf', '—', 'Unresponsive, no pulse'); pEnd(false, 'The patient went into VF after an AV-nodal blocker. This is a cardiac arrest.'); return; } pCtl(); return; }
      if (r === 'vt') { pLog('No change: the tachycardia is not AV-node dependent'); pCtl(); return; }
      if (r === 'fl') { P.lock = true; setR('fl4'); pLog('Transient AV block reveals sawtooth flutter waves'); later(10, () => { P.lock = false; setR('fl'); pLog('Back to 2:1 flutter. Adenosine does not terminate flutter.'); pCtl(); }); pCtl(); return; }
      if (r === 'svt' || r === 'svt2') {
        if (sc.unstable) pBad('Adenosine delays cardioversion in an unstable patient', 5);
        P.lock = true; const prev = r, p = [.55, .7, .8][Math.min(P.aden - 1, 2)]; setR('asys'); pLog('Brief asystolic pause, flushing and chest tightness');
        later(5, () => { P.lock = false; if (Math.random() < p) { ok('nsr', sc.unstable ? '96/60' : '120/76', 'Alert, relieved', 'Converted to sinus rhythm'); later(8, () => pEnd(true, 'Converted with adenosine ' + dose + ' mg.')); } else { setR(prev); pLog('Tachycardia resumed'); pCtl(); } });
      }
      pCtl(); return;
    }
    if (a === 'ccb') {
      if (P.kind !== 'T') return;
      pLog('Verapamil / beta-blocker given');
      if (r === 'afwpw') { pBad('AV-nodal blocker in pre-excited AF', 20); setR('vf', '—', 'Unresponsive, no pulse'); pEnd(false, 'Blocking the AV node pushed conduction down the accessory pathway: VF arrest.'); return; }
      if (r === 'vt') { pBad('Verapamil or beta-blocker in VT causes collapse', 15); setR('vt', '64/30', 'Drowsy, grey'); pCtl(); return; }
      if (sc.unstable) pBad('Drug rate control in an unstable patient instead of cardioversion', 10);
      if (r === 'fl') { ok('fl4', '118/72', 'Alert, more comfortable', 'Ventricular rate controlled (4:1 conduction)'); later(8, () => pEnd(true, 'Rate controlled. Next: anticoagulation assessment and plan for cardioversion or ablation.')); }
      else if (r === 'svt' || r === 'svt2') { if (P.aden === 0) pBad('Rate-control drug before vagal manoeuvre and adenosine', 3); if (Math.random() < .6) { ok('nsr', '112/70', 'Alert', 'Converted to sinus rhythm'); later(8, () => pEnd(true, 'Converted with verapamil / beta-blocker.')); } else pLog('No conversion'); }
      pCtl(); return;
    }
    if (a === 'amio') {
      if (P.kind !== 'T') return;
      P.amio++; pLog('Amiodarone 300 mg IV over 10–20 minutes (time compressed)', 'ok');
      if (r === 'svt' || r === 'svt2' || r === 'fl') pBad('Amiodarone is not first line here', 3);
      if (r === 'afwpw') pBad('Amiodarone is not preferred in pre-excited AF (procainamide or cardioversion)', 5);
      if (r === 'vt' && sc.unstable && P.shocks < 3) pBad('Amiodarone before three synchronised shocks in unstable VT', 5);
      P.lock = true; later(40, () => { P.lock = false; if ((r === 'vt' || r === 'afwpw') && Math.random() < .55) { ok(r === 'vt' ? 'nsr' : 'nsr', '118/74', 'Alert', 'Converted to sinus rhythm'); later(8, () => pEnd(true, 'Converted with amiodarone.')); } else if (r === 'fl') ok('fl4', '116/72', 'Alert', 'Ventricular rate slower'); else { pLog(r === 'vt' ? 'No conversion yet: consider procainamide or synchronised cardioversion under sedation' : 'No conversion yet'); pCtl(); } });
      pCtl(); return;
    }
    if (a === 'proc') {
      if (P.kind !== 'T') return;
      pLog('Procainamide infusion', 'ok');
      if (r !== 'afwpw' && r !== 'vt') pBad('Procainamide is not indicated here', 3);
      P.lock = true; later(40, () => { P.lock = false; if ((r === 'afwpw' && Math.random() < .75) || (r === 'vt' && Math.random() < .55)) { ok('nsr', '120/76', 'Alert', 'Converted to sinus rhythm'); later(8, () => pEnd(true, 'Converted with procainamide.')); } else { pLog('No conversion yet'); pCtl(); } });
      pCtl(); return;
    }
    if (a === 'sync') { P.sync = !P.sync; pLog('Synchronisation ' + (P.sync ? 'ON: markers on each R wave' : 'OFF')); pCtl(); return; }
    if (a === 'shock') {
      if (P.kind !== 'T') return;
      dFlash(); P.shocks++;
      if (!P.sync) {
        pBad('Unsynchronised shock on a rhythm with a pulse (R-on-T risk)', 20);
        if (Math.random() < .5) { setR('vf', '—', 'Unresponsive, no pulse'); pEnd(false, 'The shock landed on the T wave and caused VF. Always switch SYNC on for a patient with a pulse.'); return; }
      }
      if (!P.sedated) pBad('Cardioversion without sedation in a patient who is not unconscious', 5);
      if (!sc.unstable && r !== 'afwpw') pBad('Electrical cardioversion is not first line in a stable patient', 5);
      const lowE = (r === 'vt' || r === 'afwpw') ? 120 : 70;
      if (P.energy < lowE) pLog('Energy is low for this rhythm: consider ' + (r === 'vt' || r === 'afwpw' ? '120–150' : '70–120') + ' J');
      pLog((P.sync ? 'Synchronised' : 'Unsynchronised') + ' shock ' + P.shocks + ': ' + P.energy + ' J', 'ok');
      const p = (P.energy >= lowE ? .65 : .35) + (P.shocks >= 3 ? .2 : 0);
      if (Math.random() < p) { ok('nsr', '108/66', 'Waking, better perfused', 'Sinus rhythm restored'); later(8, () => pEnd(true, 'Cardioverted after ' + P.shocks + ' shock' + (P.shocks > 1 ? 's' : '') + '.')); }
      else { pLog('Rhythm unchanged' + (P.shocks >= 3 ? ': give amiodarone 300 mg and repeat' : ': increase energy and repeat')); P.energy = Math.min(200, P.energy + (P.energy < 120 ? 50 : 30)); }
      pCtl(); return;
    }
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'drill') return;
    const t = ev.target;
    const st = t.closest('[data-start]'); if (st) { const k = st.dataset.start; if (k === 'A') startDrill(); else if (k === 'K') startK(); else if (k === 'epi') startEpi(); else if (k === 'td') startTd(); else if (k === 'tx') startTx(); else if (k === 'rosc') startRosc(); else if (k === 'ot') startOT(); else startPeri(k); return; }
    if (!P.run) return;
    const as = t.closest('[data-assess]');
    if (as && !P.assessed) { P.assessed = true; const u = as.dataset.assess === 'u'; if (u === P.sc.unstable) pLog('Assessment correct: ' + (u ? 'adverse features present' : 'stable'), 'ok'); else pBad('Assessment wrong: the patient is ' + (P.sc.unstable ? 'unstable' : 'stable'), 10); pCtl(); return; }
    const pr = t.closest('[data-prate]'); if (pr) { P.pace.rate = Number(pr.dataset.prate); if (P.r === 'paced') setR('paced'); P.disp = pData(); if (LIVE.o) LIVE.o.redraw(); pCtl(); return; }
    const ma = t.closest('[data-ma]');
    if (ma) {
      P.pace.mA = Math.max(0, Math.min(140, P.pace.mA + (ma.dataset.ma === '+' ? 10 : -10)));
      if (P.pace.on) { if (P.pace.mA >= P.pace.thr && P.r !== 'paced') { setR('paced', '104/62', 'More alert'); pLog('Electrical capture at ' + P.pace.mA + ' mA: wide paced QRS after each spike. Check a pulse.'); } else if (P.pace.mA < P.pace.thr && P.r === 'paced') { setR(P.sc.r === 'm2' ? 'm2' : 'chb', P.sc.bp, P.sc.cons); pLog('Capture lost'); } }
      pCtl(); return;
    }
    const pe = t.closest('[data-pen]'); if (pe) { P.energy = Number(pe.dataset.pen); pCtl(); return; }
    const b = t.closest('[data-p]'); if (b) periAct(b.dataset.p);
  });

  /* ---------- Hyperkalaemia drill (1 real second ≈ 1 simulated minute) ---------- */
  const KSC = [
    { title: 'Missed two dialysis sessions', K0: 7.8, rise: .004, anuric: true, ph: 7.24, glu: 6.5, hr: 58, bp: '128/74', src: null, story: '62-year-old on haemodialysis, missed two sessions, now weak with heavy legs. Anuric.', need: 'dial', teach: 'Protect (calcium), shift (insulin-glucose, salbutamol), remove (dialysis is the only real removal when anuric), and monitor glucose.' },
    { title: 'Crush injury with rhabdomyolysis', K0: 7.1, rise: .012, anuric: false, ph: 7.16, glu: 7.2, hr: 104, bp: '102/64', src: null, story: '35-year-old trapped under debris for six hours. Dark urine, CK very high, potassium still rising.', need: 'dial', teach: 'Potassium keeps rising from damaged muscle: shift early, give bicarbonate for acidosis, and plan early dialysis.' },
    { title: 'AKI on ACE inhibitor and spironolactone', K0: 8.3, rise: .003, anuric: false, ph: 7.3, glu: 8, hr: 46, bp: '96/58', src: 'Ramipril, spironolactone and potassium supplement', story: '78-year-old with heart failure and vomiting for three days. Slow pulse, wide complexes on the monitor.', need: 'any', teach: 'Stop every potassium source. With urine output, furosemide and a binder can remove potassium after calcium and shifting.' }
  ];
  const K = { run: false, done: true, log: [], T: null, iv: 0 }, kCache = {};
  const kLog = (txt, k) => K.log.unshift({ t: K.t, txt, k: k || 'info' });
  const kBad = (txt, pts) => { K.score = Math.max(0, K.score - pts); K.errs.push(txt); kLog(txt + ' (−' + pts + ')', 'bad'); };
  const ramp = (t0, dur) => t0 == null ? 0 : clamp((K.t - t0) / dur, 0, 1);
  function kTrue() {
    const s = K.sc; let k = s.K0 + s.rise * (s.src && K.stopped != null ? K.stopped : K.t) / 60;
    K.ins.forEach(t => k -= .9 * ramp(t, 1800) / Math.max(1, K.ins.length * .7));
    if (K.salb != null) k -= .7 * ramp(K.salb, 1800);
    if (K.bic != null) k -= (s.ph < 7.2 ? .4 : .1) * ramp(K.bic, 1200);
    if (K.bind != null) k -= .8 * ramp(K.bind, 4 * 3600);
    if (K.furo != null && !s.anuric) k -= .6 * ramp(K.furo, 2 * 3600);
    if (K.dial != null && K.t > K.dial + 1800) k -= (K.t - K.dial - 1800) / 3600 * 1.6;
    return Math.max(3.8, k);
  }
  const kCaOn = () => K.ca.some(t => K.t >= t + 120 && K.t <= t + 2700);
  function kGlu() {
    let g = K.sc.glu;
    K.ins.forEach(t => { g -= 4.2 * ramp(t, 3600); g += 3 * Math.exp(-Math.max(0, K.t - t) / 1500) * (K.t >= t ? 1 : 0); });
    if (K.gmon != null) g += 3 * ramp(K.gmon, 1800);
    return Math.max(1.8, g);
  }
  function kEff() { return Math.round((kTrue() - (kCaOn() ? 1.1 : 0)) * 10) / 10; }
  function kData() {
    const eK = kEff(), hr = eK >= 7.2 ? K.sc.hr : 78, key = eK.toFixed(1) + '|' + hr;
    return kCache[key] || (kCache[key] = E.synth(LB.byId['hyperk-mod'], { dur: 20, ctl: { sev: Math.max(5, eK), rate: hr } }));
  }
  function kRefresh() { const d = kData(); if (d !== K.disp) { K.disp = d; if (LIVE.o) LIVE.o.redraw(); } kVitals(); }
  function stopKTimer() { if (K.iv) clearInterval(K.iv); K.iv = 0; }
  function startK() {
    stopDrillTimer(); stopPeriTimer(); stopKTimer(); D.run = false; P.run = false;
    let sc; do { sc = KSC[Math.floor(Math.random() * KSC.length)]; } while (sc === K.sc && KSC.length > 1);
    Object.assign(K, { run: true, done: false, sc, t: 0, score: 100, errs: [], log: [], ca: [], ins: [], salb: null, bic: null, bind: null, furo: null, dial: null, gmon: null, stopped: null, hypo: false, lastK: { v: sc.K0, t: 0 }, lastG: { v: sc.glu, t: 0 }, abg: 0, caWarn: false, arrestT: 0, ended: null, T: null });
    kLog('Blood gas on arrival: K⁺ ' + sc.K0.toFixed(1) + ' mmol/L, pH ' + sc.ph.toFixed(2) + '. Monitor on.');
    renderK();
  }
  function renderK() {
    stopLive(); const sc = K.sc;
    main.innerHTML = `<div class="stack">
      <div class="panel"><div class="row"><span class="lbl">Hyperkalaemia · ${sc.title}</span><span class="sp"></span>${K.done ? '' : '<button class="btn" data-k="end">End</button>'}</div><p style="margin-top:6px">${sc.story}</p></div>
      <div class="vits" id="kvits"></div>
      <div class="vcanvas live dmon" id="dbox"><canvas id="dc"></canvas><div class="dclock" id="dclock"></div><div class="dstat" id="dstat"></div></div>
      <div id="kctl"></div></div>`;
    K.disp = kData();
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II, IDX.V3], rowMM: 26, T: K.T, get: () => K.disp, playing: () => true, exMM: 13, extra: () => { const m = /^(\d+)\/(\d+)$/.exec(K.bp || sc.bp); const h = hemo(K.disp, kEff() >= 9 ? { pf: 1, sys: 70, dia: 38, spo2: 95 } : { pf: 1, sys: +m[1], dia: +m[2], spo2: 97 }); return [chans(h, 150, K.bp || sc.bp, '')[0]]; } });
    kVitals(); kCtl();
    stopKTimer(); if (!K.done) K.iv = setInterval(() => kTick(15), 250);
  }
  function kVitals() {
    const v = $('#kvits'); if (!v) return;
    const d = K.disp, eK = kEff(), bp = eK >= 9 ? '70/38' : eK >= 8 ? '88/50' : K.sc.bp; K.bp = bp;
    v.innerHTML = `<div class="kk"><small>K⁺ (last gas)</small><b>${K.lastK.v.toFixed(1)}</b><i>${dfmt(K.lastK.t / 60)} h</i></div><div><small>Glucose</small><b>${K.lastG.v.toFixed(1)}</b><i>${dfmt(K.lastG.t / 60)} h</i></div><div><small>pH</small><b>${(K.sc.ph + (K.bic != null ? .08 * ramp(K.bic, 1200) : 0) + (K.dial != null ? .1 * ramp(K.dial + 1800, 7200) : 0)).toFixed(2)}</b></div>
      <div><small>HR</small><b>${d.hr == null ? '--' : d.hr}</b></div><div><small>BP</small><b>${bp}</b></div><div><small>Urine</small><b style="font-size:14px">${K.sc.anuric ? 'Anuric' : K.furo != null ? 'Improving' : 'Low'}</b></div>
      <div class="wide"><small>Active</small><b style="font-size:13px">${[kCaOn() ? 'Calcium (membrane protected)' : '', K.ins.length && K.t - K.ins[K.ins.length - 1] < 4 * 3600 ? 'Insulin' : '', K.salb != null ? 'Salbutamol' : '', K.gmon != null ? 'Glucose infusion' : '', K.dial != null ? (K.t > K.dial + 1800 ? 'Dialysis running' : 'Dialysis being set up') : ''].filter(Boolean).join(' · ') || 'Nothing yet'}</b></div>`;
    const c = $('#dclock'); if (c) c.textContent = dfmt(K.t / 60) + ' h';
    const st = $('#dstat'); if (st) st.textContent = K.done ? 'Finished' : '1 s ≈ 1 min';
  }
  function kTick(dt) {
    if (!K.run || K.done) return;
    if (!$('#dclock')) { stopKTimer(); return; }
    K.t += dt;
    const s = K.sc, tk = kTrue(), eK = kEff();
    if (!K.ca.length && !K.caWarn && K.t >= 300) { K.caWarn = true; kBad('No calcium within 5 minutes despite ECG changes', 15); }
    if (!K.hypo && kGlu() < 3.5) { K.hypo = true; kBad('Hypoglycaemia after insulin (glucose ' + kGlu().toFixed(1) + '): start a glucose infusion and check CBG hourly', K.gmon == null ? 10 : 3); }
    if (eK >= 9) { K.arrestT += dt; if (K.arrestT >= 120) { K.disp = E.synth(LB.byId.vf, { dur: 20 }); if (LIVE.o) LIVE.o.redraw(); kEnd(false, 'Sine wave progressed to VF: cardiac arrest. Give calcium and start CPR.'); return; } } else K.arrestT = 0;
    const removing = (K.dial != null && K.t > K.dial + 1800) || (s.need === 'any' && ((K.bind != null && K.t > K.bind + 3600) || (K.furo != null && !s.anuric && K.t > K.furo + 3600)));
    if (tk <= 5.8 && removing && K.lastK.v <= 6.2) {
      if (s.src && K.stopped == null) kBad('Potassium sources were never stopped', 5);
      kEnd(true, 'Potassium back to ' + K.lastK.v.toFixed(1) + ' mmol/L with a removal plan in place.'); return;
    }
    if (K.t >= 6 * 3600) { kEnd(false, 'Six hours passed without a safe potassium and a removal plan.'); return; }
    kRefresh();
    if (Math.round(K.t) % 60 === 0) kCtl();
  }
  function kEnd(good, why) { K.done = true; K.ended = { good, why }; stopKTimer(); renderK(); }
  function kSum() {
    const e = K.ended;
    return `<div class="panel dsum"><h2 class="sh" style="margin-top:0">${e.good ? 'Scenario complete' : 'Scenario ended'}</h2><p>${e.why}</p>
      <div class="meas dm"><div><small>Score</small><b>${K.score}/100</b></div><div><small>Time</small><b>${dfmt(K.t / 60)} h</b></div><div><small>Calcium</small><b>${K.ca.length}</b></div><div><small>Insulin</small><b>${K.ins.length}</b></div><div><small>Gases</small><b>${K.abg}</b></div></div>
      <div class="blk"><h4>Key point</h4><p>${K.sc.teach}</p></div>
      <div class="blk"><h4>${K.errs.length ? 'Points lost' : 'Well done'}</h4>${K.errs.length ? '<ul>' + K.errs.map(x => `<li>${x}</li>`).join('') + '</ul>' : '<p>No errors recorded.</p>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-k="again">Next hyperkalaemia case</button><button class="btn" data-d="home">Back</button></div></div>${kLogHTML()}`;
  }
  const kLogHTML = () => `<div class="panel dlog"><span class="lbl">Event log</span><ul>${K.log.slice(0, 14).map(l => `<li class="${l.k}"><time>${dfmt(l.t / 60)}</time>${l.txt}</li>`).join('')}</ul></div>`;
  function kCtl() {
    const el = $('#kctl'); if (!el) return;
    if (K.done) { el.innerHTML = kSum(); return; }
    const B = (k, t, cls, dis) => `<button class="dbtn ${cls || ''}" data-k="${k}" ${dis ? 'disabled' : ''}>${t}</button>`;
    el.innerHTML = `<p class="hint" style="padding:10px 2px 6px">Protect → Shift → Remove → Monitor</p>
      <div class="dgrid">
        ${B('ca', 'Calcium gluconate 10% 30 mL', 'adr')}
        ${B('ins', 'Insulin 10 U + glucose 25 g', 'adr')}
        ${B('salb', 'Salbutamol 10–20 mg neb', '', K.salb != null)}
        ${B('bic', 'Sodium bicarbonate 8.4%', '', K.bic != null)}
        ${B('gmon', 'Glucose 10% infusion + hourly CBG', '', K.gmon != null)}
        ${B('stop', 'Stop K⁺ sources, review drugs', '', K.stopped != null)}
        ${B('furo', 'Furosemide IV', '', K.furo != null)}
        ${B('bind', 'K⁺ binder (SZC / resonium)', '', K.bind != null)}
      </div>
      ${B('dial', 'Urgent haemodialysis / CRRT', 'cause', K.dial != null)}
      <div class="dgrid" style="margin-top:10px">${B('abg', 'Blood gas: K⁺, glucose, pH')}${B('wait', 'Wait 15 min ⏩')}</div>
      <div class="row dcount"><span class="pill">Score <b>${K.score}</b></span></div>${kLogHTML()}`;
  }
  function kAct(a) {
    if (a === 'again') { startK(); return; }
    if (K.done) return;
    const s = K.sc;
    if (a === 'end') { kEnd(false, 'You ended the scenario.'); return; }
    if (a === 'ca') { if (K.ca.length && kCaOn() && kEff() < 7) kLog('Calcium already working; repeat only if the ECG is still abnormal'); K.ca.push(K.t); kLog('Calcium gluconate 10% 30 mL IV over 5–10 min. Onset 1–3 min, lasts 30–60 min', 'ok'); }
    else if (a === 'ins') { if (K.ins.length && K.t - K.ins[K.ins.length - 1] < 3600) kBad('Insulin repeated within an hour', 3); K.ins.push(K.t); kLog('Insulin 10 U with glucose 25 g IV. K⁺ falls over 15–60 min', 'ok'); if (!K.ca.length) kBad('Shifting before protecting the heart (calcium first when the ECG is abnormal)', 3); }
    else if (a === 'salb') { K.salb = K.t; kLog('Salbutamol 10–20 mg nebulised', 'ok'); }
    else if (a === 'bic') { K.bic = K.t; if (s.ph >= 7.2) kBad('Bicarbonate adds little unless the patient is acidotic', 3); else kLog('Sodium bicarbonate for metabolic acidosis', 'ok'); }
    else if (a === 'gmon') { K.gmon = K.t; kLog('Glucose 10% infusion and hourly capillary glucose', 'ok'); }
    else if (a === 'stop') { K.stopped = K.t; kLog(s.src ? 'Stopped: ' + s.src : 'No potassium sources found; fluids checked', 'ok'); }
    else if (a === 'furo') { K.furo = K.t; if (s.anuric) kBad('Furosemide does nothing in an anuric patient', 5); else kLog('Furosemide IV with fluid balance review', 'ok'); }
    else if (a === 'bind') { K.bind = K.t; kLog('Potassium binder given: works over hours', 'ok'); }
    else if (a === 'dial') { K.dial = K.t; kLog('Urgent dialysis requested: about 30 min to start', 'ok'); }
    else if (a === 'abg') { K.abg++; K.lastK = { v: Math.round(kTrue() * 10) / 10, t: K.t }; K.lastG = { v: Math.round(kGlu() * 10) / 10, t: K.t }; kLog('Blood gas: K⁺ ' + K.lastK.v.toFixed(1) + ', glucose ' + K.lastG.v.toFixed(1)); }
    else if (a === 'wait') { for (let i = 0; i < 60 && !K.done; i++) kTick(15); if (K.done) return; kLog('15 minutes passed'); }
    kRefresh(); kCtl();
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'drill') return;
    const b = ev.target.closest('[data-k]'); if (b) kAct(b.dataset.k);
  });

  /* =================== ICU drills (v5): pacing wires, torsades, toxicology, post-ROSC =================== */
  const X = { run: false, kind: null, iv: 0, T: null, log: [], render: null };
  function stopXT() { if (X.iv) clearInterval(X.iv); X.iv = 0; }
  const xLog = (txt, k) => X.log.unshift({ t: X.t || 0, txt, k: k || 'info' });
  const xBad = (txt, pts) => { X.score = Math.max(0, X.score - pts); X.errs.push(txt); xLog(txt + ' (−' + pts + ')', 'bad'); };
  const xLogHTML = () => `<div class="panel dlog"><span class="lbl">Event log</span><ul>${X.log.slice(0, 14).map(l => `<li class="${l.k}"><time>${dfmt(l.t)}</time>${l.txt}</li>`).join('')}</ul></div>`;
  function xBegin(kind, render) { stopDrillTimer(); stopPeriTimer(); stopKTimer(); stopXT(); D.run = false; P.run = false; K.run = false; Object.assign(X, { run: true, kind, render, done: false, t: 0, score: 100, errs: [], log: [], T: null, ended: null }); }
  function xShell(title, story, extraTop) {
    return `<div class="stack"><div class="panel"><div class="row"><span class="lbl">${title}</span><span class="sp"></span>${X.done ? '' : '<button class="btn" data-x="end">End</button>'}</div><p style="margin-top:6px">${story}</p></div>
      ${extraTop || ''}<div class="vits" id="xvits"></div>
      <div class="vcanvas live dmon" id="dbox"><canvas id="dc"></canvas><div class="dclock" id="dclock"></div><div class="dstat" id="dstat"></div><div class="dflash" id="dflash"></div></div>
      <div id="xctl"></div></div>`;
  }
  function xSummary(teach, again) {
    const e = X.ended;
    return `<div class="panel dsum"><h2 class="sh" style="margin-top:0">${e.good ? 'Scenario complete' : 'Scenario ended'}</h2><p>${e.why}</p>
      <div class="meas dm"><div><small>Score</small><b>${X.score}/100</b></div><div><small>Time</small><b>${dfmt(X.t)}</b></div></div>
      <div class="blk"><h4>Key point</h4><p>${teach}</p></div>
      <div class="blk"><h4>${X.errs.length ? 'Points lost' : 'Well done'}</h4>${X.errs.length ? '<ul>' + X.errs.map(x => `<li>${x}</li>`).join('') + '</ul>' : '<p>No errors recorded.</p>'}</div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-x="${again}">Next case</button><button class="btn" data-d="home">Back</button></div></div>${xLogHTML()}`;
  }
  function xEnd(good, why) { X.done = true; X.ended = { good, why }; stopXT(); X.render(); }
  const xSpike = (leads, G, t, amp) => { const A2 = [.3, .5, .2, -.4, .05, .35, .3, .4, .45, .45, .4, .35]; for (let l = 0; l < 12; l++) G.addG(leads[l], t, .0012, .0012, A2[l] * (amp || 1.6)); };

  /* ---------- 1. Epicardial pacing wires after cardiac surgery ---------- */
  const EPI_SC = [
    { title: 'Loss of capture after valve surgery', under: 'chb', mode: 'VVI', rate: 80, mA: 3, sens: 2, thr: 7, R: 6, tA: 1, story: 'Day 1 after aortic valve replacement. Underlying complete heart block; ventricular wires connected. The monitor shows spikes without complexes and the BP is falling.', goal: 'capture', teach: 'Find the threshold, then set the output at least twice the threshold. Thresholds of epicardial wires rise over days.' },
    { title: 'Pauses on the monitor', under: 'chb', mode: 'VVI', rate: 80, mA: 10, sens: .8, thr: 3, R: 6, tA: 1.2, story: 'Day 2 after CABG with complete heart block. Intermittent pauses with no pacing spikes and the patient feels faint.', goal: 'over', teach: 'Pauses without spikes = oversensing (here the T wave). Make the box LESS sensitive by raising the mV number above the T-wave amplitude.' },
    { title: 'Spikes on the T wave', under: 'sinus', mode: 'VVI', rate: 70, mA: 10, sens: 8, thr: 2, R: 4, tA: 1, story: 'Day 3 after CABG. The patient is in sinus rhythm at about 86 but the box keeps firing, sometimes onto the T wave.', goal: 'under', teach: 'Spikes ignoring native beats = undersensing. Lower the mV number (more sensitive) and keep the backup rate below the native rate, or switch off if not needed.' },
    { title: 'Slow sinus, AV conduction intact', under: 'brady', mode: 'VVI', rate: 80, mA: 8, sens: 2, thr: 2, R: 5, tA: 1, story: 'Day 1 after mitral repair. Sinus bradycardia at 42 with normal AV conduction. Atrial and ventricular wires are in. On VVI 80 the BP is only 88/52.', goal: 'mode', teach: 'With intact AV conduction, atrial pacing (AAI or DDD) keeps the atrial kick and gives a better cardiac output than VVI.' }
  ];
  const EPI = {};
  const epiMorph = { main: E.baseMorph(), pace: E.ventMorph({ axis: -50, v1: 'neg', qrsD: .16, M: 1.25, tk: .35 }), esc: E.ventMorph({ axis: 90, v1: 'pos', qrsD: .15, M: 1, tk: .35 }) };
  function epiSim() {
    const st = EPI, U = st.sc.under, atr = U === 'chb' ? 80 : U === 'sinus' ? 86 : 42, conduct = U !== 'chb', esc = 32;
    const dur = 20, dt = .002, pInt = 60 / st.rate, aInt = 60 / atr, mode = st.mode;
    const ps = [], beats = [], spikes = [], aspikes = [];
    let lastV = -1, lastVt = 0, lastA = -1, nextP = .3, schedC = null, pendV = null, tSensed = -1, ront = 0, sync = 0, vcount = 0;
    const senseOK = st.sens <= st.sc.R, over = st.sens <= st.sc.tA;
    const vSensed = t => { if ((mode === 'VVI' || mode === 'DDD') && senseOK) { lastVt = t; pendV = null; } };
    for (let t = 0; t < dur; t += dt) {
      if ((mode === 'AAI' || mode === 'DDD') && t - lastA >= pInt && t >= .3) { aspikes.push(t); ps.push({ t: t + .05 }); lastA = t; nextP = t + aInt; if (conduct) schedC = t + .22; if (mode === 'DDD') pendV = t + .17; }
      if (t >= nextP) { ps.push({ t }); lastA = t; nextP += aInt; if (conduct && !(schedC && schedC > t)) schedC = t + .16; if (mode === 'DDD') pendV = t + .16; }
      if (schedC != null && t >= schedC) { if (t - lastV > .3) { beats.push({ t, m: 'main' }); lastV = t; vcount++; sync++; vSensed(t); } schedC = null; }
      if (U === 'chb' && t - lastV >= 60 / esc) { beats.push({ t, m: 'esc' }); lastV = t; vcount++; vSensed(t); }
      if (over && (mode === 'VVI' || mode === 'DDD') && lastV >= 0 && tSensed !== lastV && t >= lastV + .32) { tSensed = lastV; lastVt = t; pendV = null; }
      let pace = false;
      if (mode === 'VOO' && t - lastVt >= pInt) pace = true;
      if ((mode === 'VVI' || mode === 'DDD') && t - lastVt >= pInt && t > .2) pace = true;
      if (mode === 'DDD' && pendV != null && t >= pendV) pace = true;
      if (pace) {
        spikes.push(t); lastVt = t; pendV = null;
        if (st.mA >= st.sc.thr && t - lastV > .3) { beats.push({ t: t + .03, m: 'pace' }); lastV = t + .03; vcount++; if (lastA >= 0 && t - lastA < .3 && (mode === 'DDD')) sync++; schedC = null; }
        else if (t - lastV > .18 && t - lastV < .36) ront++;
      }
    }
    const e = { id: 'epi', name: 'epi', morphs: epiMorph, build: () => ({ beats, ps, custom: (leads, R, G) => { spikes.forEach(t => xSpike(leads, G, t)); aspikes.forEach(t => xSpike(leads, G, t, .9)); } }) };
    const d = E.synth(e, { dur: 20 });
    const vr = vcount * 3, syncF = vcount ? sync / vcount : 0;
    let sys = vr < 40 ? 72 : vr < 50 ? 82 : 92 + Math.min(20, (vr - 60) * .5); sys += syncF > .6 ? 14 : 0; if (ront > 2) sys -= 4;
    sys = Math.round(Math.max(60, Math.min(130, sys)));
    d.epi = { vr, ront, syncF, sys, dia: Math.round(sys * .58), capture: st.mA >= st.sc.thr };
    return d;
  }
  function startEpi() {
    xBegin('epi', renderEpi);
    let sc; do { sc = EPI_SC[Math.floor(Math.random() * EPI_SC.length)]; } while (sc === EPI.sc && EPI_SC.length > 1);
    Object.assign(EPI, { sc, mode: sc.mode, rate: sc.rate, mA: sc.mA, sens: sc.sens, thrChecked: false });
    EPI.d = epiSim(); xLog('Temporary pacing box: ' + sc.mode + ' ' + sc.rate + '/min, output ' + sc.mA + ' mA, sensitivity ' + sc.sens + ' mV');
    renderEpi();
  }
  const SENS = [.5, .8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  function renderEpi() {
    stopLive(); const sc = EPI.sc;
    main.innerHTML = xShell('Pacing wires · ' + sc.title, sc.story);
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II], rowMM: 34, T: X.T, get: () => EPI.d, playing: () => true, exMM: 14, extra: () => { const p = EPI.d.epi; return [chans(hemo(EPI.d, { pf: 1, sys: p.sys, dia: p.dia, spo2: 97 }), 150, p.sys + '/' + p.dia, '')[0]]; } });
    epiCtl(); stopXT(); if (!X.done) X.iv = setInterval(() => { X.t++; const c = $('#dclock'); if (!c) { stopXT(); return; } c.textContent = dfmt(X.t); }, 1000);
  }
  function epiVits() {
    const v = $('#xvits'); if (!v) return; const p = EPI.d.epi;
    v.innerHTML = `<div><small>V rate</small><b>${p.vr}</b></div><div><small>BP</small><b>${p.sys}/${p.dia}</b></div><div><small>Spikes on T</small><b class="${p.ront ? 'warnt' : ''}">${p.ront}</b></div><div class="wide"><small>Box</small><b style="font-size:14px">${EPI.mode} · ${EPI.rate}/min · ${EPI.mA} mA · ${EPI.sens} mV</b></div>`;
    const st = $('#dstat'); if (st) st.textContent = X.done ? 'Finished' : 'Temporary pacing';
  }
  function epiCtl() {
    const el = $('#xctl'); if (!el) return;
    if (X.done) { el.innerHTML = xSummary(EPI.sc.teach, 'epi'); epiVits(); return; }
    el.innerHTML = `<div class="panel pace"><div class="row"><span class="lbl">Mode</span><div class="seg">${['Off', 'AAI', 'VVI', 'DDD', 'VOO'].map(m => `<button data-em="${m}" class="${EPI.mode === m ? 'on' : ''}">${m}</button>`).join('')}</div></div>
      <div class="row" style="margin-top:10px"><span class="lbl">Rate</span><div class="seg">${[50, 60, 70, 80, 90].map(r => `<button data-er="${r}" class="${EPI.rate === r ? 'on' : ''}">${r}</button>`).join('')}</div></div>
      <div class="row ma" style="margin-top:10px"><span class="lbl">Output</span><button class="btn" data-ea="-">−</button><b class="mav">${EPI.mA} mA</b><button class="btn" data-ea="+">+</button></div>
      <div class="row ma" style="margin-top:10px"><span class="lbl">Sensitivity</span><button class="btn" data-es="-">−</button><b class="mav">${EPI.sens} mV</b><button class="btn" data-es="+">+</button></div>
      <p class="hint" style="padding:8px 0 0">Lower mV = more sensitive. Higher mV = less sensitive.</p></div>
      <div class="dgrid" style="margin-top:10px"><button class="dbtn" data-x="thr">Threshold test</button><button class="dbtn adr" data-x="hand">Settings correct: hand over</button></div>
      <div class="row dcount"><span class="pill">Score <b>${X.score}</b></span></div>${xLogHTML()}`;
    epiVits();
  }
  function epiUpdate() { EPI.d = epiSim(); if (LIVE.o) LIVE.o.redraw(); epiCtl(); }
  function epiHand() {
    const sc = EPI.sc, m = EPI.mode, pacesV = ['VVI', 'DDD', 'VOO'].includes(m), p = EPI.d.epi; let fail = null;
    if (sc.under === 'chb' && (m === 'AAI' || m === 'Off')) fail = (m === 'AAI' ? 'AAI cannot help complete heart block: the atria are paced but nothing conducts' : 'Pacing switched off in complete heart block');
    if (!fail && pacesV && sc.under !== 'sinus' && EPI.mA < sc.thr) fail = 'Still no ventricular capture';
    if (!fail && (m === 'AAI' || m === 'DDD') && sc.under === 'sinus' && false) fail = null;
    if (fail) { xBad(fail, 40); xEnd(false, fail + '.'); return; }
    if (pacesV && EPI.mA < 2 * sc.thr && sc.under !== 'sinus') xBad('Output below twice the threshold (no safety margin)', 10);
    if (sc.goal === 'capture' && !EPI.thrChecked) xBad('Threshold never tested', 5);
    if (m !== 'Off' && m !== 'VOO' && EPI.sens <= sc.tA) xBad('Still oversensing (sensitivity at or below T-wave amplitude)', 20);
    if (m !== 'Off' && m !== 'VOO' && EPI.sens > sc.R && sc.under !== 'chb') xBad('Still undersensing native beats', 20);
    if (m === 'VOO' && sc.under !== 'chb') xBad('Asynchronous pacing competes with the native rhythm', 15);
    if (sc.under === 'sinus' && m !== 'Off' && EPI.rate >= 86) xBad('Backup rate at or above the native rate', 10);
    if (sc.goal === 'mode' && m === 'VVI') xBad('VVI loses the atrial kick; AAI or DDD was better here', 15);
    if (sc.goal === 'mode' && (m === 'AAI' || m === 'DDD') && EPI.rate < 70) xBad('Atrial pacing rate too low to improve output', 5);
    xLog('Handed over: ' + m + ' ' + EPI.rate + '/min, ' + EPI.mA + ' mA, ' + EPI.sens + ' mV · BP ' + p.sys + '/' + p.dia, 'ok');
    xEnd(X.score >= 70, X.score >= 70 ? 'Safe settings handed over.' : 'Settings handed over, but important problems remain.');
  }

  /* ---------- 2. Torsades de pointes ---------- */
  const TD = {};
  function startTd() {
    xBegin('td', renderTd);
    Object.assign(TD, { K: 3.1, Mg: .58, drugs: true, mg: false, kc: false, rateUp: false, amio: false, qtc: 600, ep: 0, epT: 0, sust: false, sustT: 0, quiet: 0, hr: 52 });
    xLog('Monitor alarm: runs of polymorphic VT. QTc 600 ms on the last ECG.'); renderTd();
  }
  function tdData() {
    if (TD.ep) return data('torsades');
    const k = 'lqt' + TD.hr; return dCache[k] || (dCache[k] = E.synth(LB.byId.longqt, { dur: 20, ctl: { rate: TD.hr } }));
  }
  function renderTd() {
    stopLive();
    main.innerHTML = xShell('Torsades de pointes', '68-year-old ICU patient with delirium on haloperidol, ondansetron and erythromycin, on furosemide. Recurrent self-terminating runs of polymorphic VT with dizziness.');
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II], rowMM: 34, T: X.T, get: tdData, playing: () => true, exMM: 14, extra: () => { const pf = TD.ep ? 0 : 1; return [chans(hemo(tdData(), pf ? { pf: 1, sys: 104, dia: 62, spo2: 96 } : { pf: 0 }), 150, pf ? '104/62' : '--/--', '')[0]]; } });
    tdCtl(); stopXT(); if (!X.done) X.iv = setInterval(tdTick, 250);
  }
  function tdTick() {
    if (!$('#dclock')) { stopXT(); return; }
    X.t += .25;
    TD.qtc = Math.round(600 - (TD.mg ? 10 : 0) - (TD.kc ? 35 : 0) - (TD.drugs ? 0 : Math.min(60, (X.t - TD.dStop) * 1.2)) - (TD.rateUp ? 45 : 0) + (TD.amio ? 30 : 0));
    if (TD.ep) {
      TD.epT -= .25;
      if (TD.sust) { TD.sustT += .25; if (TD.sustT >= 15) { xBad('Pulseless torsades not defibrillated', 30); xEnd(false, 'Sustained torsades without a pulse for 15 s and no shock: cardiac arrest.'); return; } }
      else if (TD.epT <= 0) { TD.ep = 0; xLog('Run terminated spontaneously'); tdRefresh(); }
    } else {
      TD.quiet += .25;
      let risk = .055 * Math.max(0, (TD.qtc - 470) / 130) * (TD.hr < 60 ? 1.5 : 1) * (TD.mg ? .25 : 1) * (TD.amio ? 1.8 : 1);
      if (Math.random() < risk) {
        TD.ep = 1; TD.epT = 4 + Math.random() * 4; TD.quiet = 0; TD.sust = Math.random() < (TD.mg ? .1 : .3); TD.sustT = 0;
        xLog(TD.sust ? 'Torsades: sustained, NO PULSE' : 'Run of torsades (dizzy, pulse lost briefly)', TD.sust ? 'bad' : 'info'); tdRefresh();
      }
      if (TD.mg && TD.kc && !TD.drugs && TD.qtc < 500 && TD.quiet >= 40) { xEnd(true, 'QTc ' + TD.qtc + ' ms and no runs for 40 seconds.'); return; }
    }
    const c = $('#dclock'); if (c) c.textContent = dfmt(X.t); tdVits();
  }
  function tdRefresh() { if (LIVE.o) LIVE.o.redraw(); tdCtl(); }
  function tdVits() {
    const v = $('#xvits'); if (!v) return;
    v.innerHTML = `<div><small>HR</small><b>${TD.ep ? '--' : TD.hr}</b></div><div><small>BP</small><b>${TD.ep ? '--/--' : '104/62'}</b></div><div><small>QTc</small><b class="${TD.qtc >= 500 ? 'warnt' : ''}">${TD.qtc}</b></div>
      <div><small>K⁺</small><b>${TD.K.toFixed(1)}</b></div><div><small>Mg²⁺</small><b>${TD.Mg.toFixed(2)}</b></div><div><small>Status</small><b style="font-size:13px">${TD.ep ? (TD.sust ? 'PULSELESS' : 'Torsades run') : 'Long QT'}</b></div>`;
    const st = $('#dstat'); if (st) { st.textContent = TD.ep ? (TD.sust ? 'NO PULSE' : 'Torsades') : 'Monitoring'; st.className = 'dstat' + (TD.sust ? ' cpr' : ''); }
  }
  function tdCtl() {
    const el = $('#xctl'); if (!el) return;
    if (X.done) { el.innerHTML = xSummary('Magnesium first (even with a normal level), stop QT-prolonging drugs, keep K⁺ 4.5–5.0 and speed the heart up (isoprenaline or overdrive pacing). Pulseless torsades: unsynchronised shock. Avoid amiodarone.', 'td'); tdVits(); return; }
    el.innerHTML = `<div class="dgrid">
      <button class="dbtn adr" data-x="tmg" ${TD.mg ? 'disabled' : ''}>Magnesium sulphate 2 g IV</button>
      <button class="dbtn" data-x="tdrug" ${TD.drugs ? '' : 'disabled'}>Stop QT-prolonging drugs</button>
      <button class="dbtn" data-x="tk" ${TD.kc ? 'disabled' : ''}>Potassium to 4.5–5.0</button>
      <button class="dbtn" data-x="trate" ${TD.rateUp ? 'disabled' : ''}>Isoprenaline / overdrive pacing</button>
      <button class="dbtn" data-x="tamio">Amiodarone 300 mg</button>
      <button class="dbtn" data-x="tsync">Synchronised cardioversion</button></div>
      <button class="dbtn shock" style="margin-top:10px" data-x="tshock">⚡ Unsynchronised shock 200 J</button>
      <div class="row dcount"><span class="pill">Score <b>${X.score}</b></span></div>${xLogHTML()}`;
    tdVits();
  }

  /* ---------- 3. Toxicology ---------- */
  const TX_SC = [
    { k: 'tca', title: 'Tricyclic overdose', story: '24-year-old found with empty amitriptyline packets. Intubated after a seizure; wide QRS and hypotension.', teach: 'Sodium bicarbonate 1–2 mmol/kg boluses to narrow the QRS (target pH 7.45–7.55), hyperventilate, benzodiazepines for seizures, noradrenaline for BP. Avoid class Ia/Ic drugs, amiodarone and physostigmine.' },
    { k: 'dig', title: 'Digoxin toxicity', story: '82-year-old on digoxin with AKI, vomiting and yellow-tinged vision. Slow pulse, K⁺ 6.1.', teach: 'Digoxin-specific antibody (Fab) is the treatment for dangerous arrhythmia, K⁺ over 5 or end-organ effects. Atropine and pacing are bridges. Avoid DC cardioversion where possible.' },
    { k: 'bb', title: 'Beta-blocker overdose', story: '55-year-old took 40 propranolol tablets 2 hours ago. Bradycardic, hypotensive, drowsy.', teach: 'Atropine rarely enough. Use glucagon, high-dose insulin euglycaemic therapy (with glucose and K⁺ monitoring), calcium and catecholamine infusions; pacing if needed; lipid emulsion for lipophilic agents.' }
  ];
  const TX = {};
  function startTx() {
    xBegin('tx', renderTx);
    let sc; do { sc = TX_SC[Math.floor(Math.random() * TX_SC.length)]; } while (sc === TX.sc && TX_SC.length > 1);
    Object.assign(TX, { sc, sev: 1.45, ph: 7.28, bic: 0, hv: false, benzo: false, nor: false, lipid: false, fab: false, atro: 0, glu: false, hiet: false, gmon: false, ca: false, epi: false, pace: false, hypo: false, sz: false, hr: sc.k === 'tca' ? 124 : sc.k === 'dig' ? 38 : 36, sys: sc.k === 'tca' ? 82 : sc.k === 'dig' ? 84 : 70, K: sc.k === 'dig' ? 6.1 : 4.0, trans: 0 });
    xLog('Arrived: ' + sc.title); renderTx();
  }
  function txKey() {
    const s = TX.sc.k;
    if (s === 'tca') return TX.sev >= 1.75 ? ['vt', { rate: 170 }] : ['tca', { sev: Math.max(0, Math.round(TX.sev * 20) / 20), rate: Math.round(TX.hr / 2) * 2 }];
    if (s === 'dig') return TX.fab ? ['digoxin', { rate: 76 }] : ['junctional', { rate: Math.round(TX.hr) }];
    return ['av1', { rate: Math.round(TX.hr) }];
  }
  function txData() { const [id, ctl] = txKey(), k = 'tx' + id + JSON.stringify(ctl); return dCache[k] || (dCache[k] = E.synth(LB.byId[id], { dur: 20, ctl })); }
  function renderTx() {
    stopLive(); const sc = TX.sc;
    main.innerHTML = xShell('Toxicology · ' + sc.title, sc.story);
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: [IDX.II, IDX.aVR], rowMM: 26, T: X.T, get: txData, playing: () => true, exMM: 13, extra: () => [chans(hemo(txData(), { pf: 1, sys: Math.round(TX.sys), dia: Math.round(TX.sys * .58), spo2: 96 }), 150, Math.round(TX.sys) + '/' + Math.round(TX.sys * .58), '')[0]] });
    txCtl(); stopXT(); if (!X.done) X.iv = setInterval(txTick, 1000);
  }
  function txTick() {
    if (!$('#dclock')) { stopXT(); return; }
    X.t += 1; const s = TX.sc.k;
    if (s === 'tca') {
      if (!TX.bic) TX.sev = Math.min(1.9, TX.sev + .004);
      if (TX.sev > 1.2 && !TX.benzo && !TX.sz && Math.random() < .02) { TX.sz = true; xLog('Generalised seizure: acidosis worsens, QRS widens', 'bad'); TX.sev += .15; TX.ph -= .05; }
      if (TX.sev >= 1.75) { TX.sys = 60; if (!TX.vtT) { TX.vtT = X.t; xLog('Wide-complex tachycardia (sodium-channel block)', 'bad'); } if (X.t - TX.vtT > 40) { xEnd(false, 'Refractory wide-complex rhythm: cardiac arrest. Bicarbonate boluses were needed early.'); return; } } else TX.vtT = 0;
      if (TX.nor) TX.sys = Math.min(108, TX.sys + 1); else TX.sys = Math.max(66, Math.min(100, 98 - TX.sev * 12));
      if (TX.sev <= .45 && TX.sys >= 90 && TX.ph >= 7.45) { xEnd(true, 'QRS narrowed to about ' + Math.round(90 + 50 * TX.sev) + ' ms, pH ' + TX.ph.toFixed(2) + ', BP ' + Math.round(TX.sys) + ' systolic.'); return; }
    } else if (s === 'dig') {
      if (TX.trans && X.t > TX.trans) { TX.trans = 0; if (!TX.fab && !TX.pace) { TX.hr = 38; xLog('Atropine effect wearing off'); } }
      if (TX.fab && X.t >= TX.fabT + 20 && TX.hr < 70) { TX.hr = 76; TX.sys = 112; TX.K = 4.8; xLog('Fab binding digoxin: rhythm recovering, K⁺ falling', 'ok'); }
      if (TX.fab && TX.hr >= 70 && X.t >= TX.fabT + 30) { xEnd(true, 'Heart rate and potassium recovered after digoxin Fab.'); return; }
      if (!TX.fab && X.t > 240) { xEnd(false, 'Four minutes without Fab: progressive block and hyperkalaemia led to arrest.'); return; }
    } else {
      if (TX.trans && X.t > TX.trans) { TX.trans = 0; if (TX.hr < 50) { TX.hr = Math.max(36, TX.hr - 6); xLog('Atropine effect fading'); } }
      if (TX.hiet && X.t > TX.hietT + 30) TX.sys = Math.min(118, TX.sys + .6);
      if (TX.hiet && !TX.gmon && !TX.hypo && X.t > TX.hietT + 45) { TX.hypo = true; xBad('Hypoglycaemia on high-dose insulin: glucose and K⁺ monitoring missed', 10); }
      if (TX.sys >= 92 && TX.hr >= 50) { xEnd(true, 'BP ' + Math.round(TX.sys) + ' systolic and HR ' + Math.round(TX.hr) + ' achieved.'); return; }
      if (X.t > 300) { xEnd(false, 'Five minutes of shock without adequate support: cardiac arrest.'); return; }
    }
    if (LIVE.o) LIVE.o.redraw(); txVits();
  }
  function txVits() {
    const v = $('#xvits'); if (!v) return; const s = TX.sc.k;
    v.innerHTML = `<div><small>HR</small><b>${Math.round(TX.hr)}</b></div><div><small>BP</small><b>${Math.round(TX.sys)}/${Math.round(TX.sys * .58)}</b></div>` +
      (s === 'tca' ? `<div><small>QRS</small><b class="${TX.sev > 1 ? 'warnt' : ''}">${Math.round(90 + 50 * Math.min(TX.sev, 1.75))}</b></div><div><small>pH</small><b>${TX.ph.toFixed(2)}</b></div>` : `<div><small>K⁺</small><b>${TX.K.toFixed(1)}</b></div>`) +
      `<div class="wide"><small>Given</small><b style="font-size:13px">${Object.entries({ Bicarbonate: TX.bic, Hyperventilation: TX.hv, Benzodiazepine: TX.benzo, Noradrenaline: TX.nor, Lipid: TX.lipid, Fab: TX.fab, Glucagon: TX.glu, 'High-dose insulin': TX.hiet, Calcium: TX.ca, Adrenaline: TX.epi, Pacing: TX.pace }).filter(x => x[1]).map(x => x[0] + (x[0] === 'Bicarbonate' ? ' ×' + TX.bic : '')).join(' · ') || 'Nothing yet'}</b></div>`;
    const c = $('#dclock'); if (c) c.textContent = dfmt(X.t); const st = $('#dstat'); if (st) st.textContent = X.done ? 'Finished' : 'Toxicology';
  }
  const TXA = {
    tca: [['bic', 'Sodium bicarbonate 8.4% 100 mL'], ['hv', 'Hyperventilate (ventilated)'], ['benzo', 'Benzodiazepine'], ['nor', 'Noradrenaline infusion'], ['lipid', 'Lipid emulsion 20%'], ['amio', 'Amiodarone'], ['flec', 'Flecainide / procainamide'], ['physo', 'Physostigmine']],
    dig: [['fab', 'Digoxin Fab (antibody)'], ['atro', 'Atropine 500 mcg'], ['pace', 'Transcutaneous pacing'], ['ins', 'Insulin-glucose for K⁺'], ['ca', 'Calcium gluconate'], ['dc', 'DC cardioversion'], ['stop', 'Stop digoxin, check level']],
    bb: [['atro', 'Atropine 500 mcg'], ['glu', 'Glucagon 5–10 mg IV'], ['hiet', 'High-dose insulin + glucose'], ['gmon', 'Glucose + K⁺ monitoring'], ['ca', 'Calcium chloride 10%'], ['epi', 'Adrenaline infusion'], ['pace', 'Transcutaneous pacing'], ['lipid', 'Lipid emulsion 20%'], ['amio', 'Amiodarone']]
  };
  function txCtl() {
    const el = $('#xctl'); if (!el) return;
    if (X.done) { el.innerHTML = xSummary(TX.sc.teach, 'tx'); txVits(); return; }
    el.innerHTML = `<div class="dgrid">${TXA[TX.sc.k].map(([k, t]) => `<button class="dbtn ${['bic', 'fab', 'hiet'].includes(k) ? 'adr' : ''}" data-tx="${k}">${t}</button>`).join('')}</div>
      <div class="row dcount"><span class="pill">Score <b>${X.score}</b></span></div>${xLogHTML()}`;
    txVits();
  }
  function txAct(a) {
    if (X.done) return; const s = TX.sc.k;
    if (s === 'tca') {
      if (a === 'bic') { TX.bic++; TX.sev = Math.max(0, TX.sev - .35); TX.ph = Math.min(7.65, TX.ph + .07); xLog('Sodium bicarbonate 8.4% 100 mL: QRS narrowing', 'ok'); if (TX.ph > 7.58) xBad('pH above 7.55: stop bicarbonate boluses', 5); }
      else if (a === 'hv') { if (TX.hv) return; TX.hv = true; TX.sev = Math.max(0, TX.sev - .1); TX.ph += .04; xLog('Minute ventilation increased', 'ok'); }
      else if (a === 'benzo') { if (TX.benzo) return; TX.benzo = true; xLog('Benzodiazepine: seizures controlled', 'ok'); }
      else if (a === 'nor') { if (TX.nor) return; TX.nor = true; xLog('Noradrenaline started', 'ok'); }
      else if (a === 'lipid') { if (TX.lipid) return; TX.lipid = true; xLog('Lipid emulsion: rescue therapy for refractory cases'); if (TX.bic < 2) xBad('Lipid before adequate bicarbonate', 3); }
      else if (a === 'amio') { xBad('Amiodarone worsens sodium-channel and QT toxicity', 15); TX.sev += .2; }
      else if (a === 'flec') { xBad('Class Ia/Ic drugs block sodium channels further', 20); TX.sev += .3; }
      else if (a === 'physo') { xBad('Physostigmine can cause asystole in TCA overdose', 15); }
    } else if (s === 'dig') {
      if (a === 'fab') { if (TX.fab) return; TX.fab = true; TX.fabT = X.t; xLog('Digoxin Fab given: effect over 20–60 min (compressed)', 'ok'); }
      else if (a === 'atro') { TX.atro++; TX.hr = 48; TX.trans = X.t + 30; xLog('Atropine: transient rise in rate'); }
      else if (a === 'pace') { if (TX.pace) return; TX.pace = true; TX.hr = 70; TX.sys = 98; xLog('Pacing: capture achieved as a bridge (Fab still needed)', 'ok'); }
      else if (a === 'ins') { TX.K = Math.max(5, TX.K - .6); xLog('Insulin-glucose: K⁺ shifting'); }
      else if (a === 'ca') { if (TX.ca) return; TX.ca = true; xLog('Calcium given: no clear benefit in digoxin toxicity; Fab treats the hyperkalaemia'); }
      else if (a === 'dc') { xBad('DC cardioversion in digoxin toxicity can provoke VF', 20); }
      else if (a === 'stop') { xLog('Digoxin stopped, level sent', 'ok'); }
    } else {
      if (a === 'atro') { TX.atro++; TX.hr = Math.max(TX.hr, 44); TX.trans = X.t + 25; xLog('Atropine: small transient response'); }
      else if (a === 'glu') { if (TX.glu) return; TX.glu = true; TX.hr = Math.max(TX.hr, 52); TX.sys += 10; xLog('Glucagon: rate and contractility improving', 'ok'); }
      else if (a === 'hiet') { if (TX.hiet) return; TX.hiet = true; TX.hietT = X.t; xLog('High-dose insulin (1 U/kg bolus then infusion) with glucose', 'ok'); }
      else if (a === 'gmon') { if (TX.gmon) return; TX.gmon = true; xLog('Hourly glucose and K⁺ monitoring, glucose infusion', 'ok'); }
      else if (a === 'ca') { if (TX.ca) return; TX.ca = true; TX.sys += 5; xLog('Calcium: modest BP rise', 'ok'); }
      else if (a === 'epi') { if (TX.epi) return; TX.epi = true; TX.hr = Math.max(TX.hr, 58); TX.sys += 12; xLog('Adrenaline infusion', 'ok'); }
      else if (a === 'pace') { if (TX.pace) return; TX.pace = true; TX.hr = 70; xLog('Pacing captures, but BP stays low: the myocardium is depressed'); }
      else if (a === 'lipid') { if (TX.lipid) return; TX.lipid = true; TX.sys += 6; xLog('Lipid emulsion for lipophilic propranolol', 'ok'); }
      else if (a === 'amio') { xBad('Amiodarone worsens bradycardia and hypotension', 10); TX.hr -= 4; TX.sys -= 6; }
    }
    if (LIVE.o) LIVE.o.redraw(); txCtl();
  }

  /* ---------- 4. Post-ROSC ---------- */
  const RO = {};
  const ROSC_ECG = [['stemi-ant', true], ['stemi-inf', true], ['sinus-tachy', false]];
  function startRosc() {
    xBegin('rosc', renderRosc);
    const [id, st] = ROSC_ECG[Math.floor(Math.random() * ROSC_ECG.length)];
    Object.assign(RO, { id, stemi: st, step: 0, tries: 0, map: 56, spo2: 100, fio2: 100, etco2: 26, temp: 36.4, glu: 15.2, picked: null });
    xLog('ROSC after 14 minutes of VF arrest. Intubated, comatose.'); renderRosc();
  }
  function roSteps() {
    return [
      { q: 'Read the post-ROSC 12-lead. What is the next step for the coronaries?', a: RO.stemi ? 'Emergency coronary angiography (primary PCI)' : 'No STEMI: consider early angiography if a cardiac cause is likely; CT head and chest if unclear', w: RO.stemi ? ['Wait 72 hours for neurological prognosis first', 'Thrombolysis only after CT head', 'Repeat ECG tomorrow'] : ['Emergency PCI for every patient', 'No investigation needed', 'Thrombolysis'], ex: RO.stemi ? 'STEMI after ROSC: go to the cath lab without waiting for neuro-prognostication.' : 'Without STEMI, the decision is individual; look for non-cardiac causes too.', fx: () => {} },
      { q: 'SpO₂ 100% on FiO₂ 1.0. What do you do?', a: 'Titrate FiO₂ to SpO₂ 94–98%', w: ['Keep FiO₂ 1.0 for 24 hours', 'Aim for SpO₂ 88–92%', 'Increase PEEP to 15'], ex: 'Avoid both hypoxia and hyperoxia after ROSC.', fx: () => { RO.fio2 = 40; RO.spo2 = 96; } },
      { q: 'EtCO₂ 26 mmHg (PaCO₂ low). What do you do?', a: 'Reduce minute ventilation to normocapnia (PaCO₂ 35–45 mmHg)', w: ['Keep hyperventilating to protect the brain', 'Increase the rate further', 'Ignore it'], ex: 'Hypocapnia causes cerebral vasoconstriction.', fx: () => { RO.etco2 = 38; } },
      { q: 'MAP is 56 mmHg. What is the target and action?', a: 'Noradrenaline (and fluids if needed) to MAP ≥ 65 mmHg', w: ['Accept MAP 55', 'Aim for MAP > 110 with high-dose adrenaline', 'Give furosemide'], ex: 'Avoid hypotension; titrate vasopressors to MAP ≥ 65 and adequate urine output.', fx: () => { RO.map = 72; } },
      { q: 'Eight hours later the temperature is 38.1 °C. Patient still comatose.', a: 'Actively prevent fever: keep ≤ 37.5 °C for at least 72 h', w: ['Allow fever; it fights infection', 'Cool to 28 °C', 'Stop sedation and wait'], ex: 'Fever after cardiac arrest worsens neurological outcome.', fx: () => { RO.temp = 37.2; } },
      { q: 'Glucose is 15.2 mmol/L.', a: 'Insulin infusion to keep 7.8–10 mmol/L, avoid hypoglycaemia', w: ['Tight control 4–6 mmol/L', 'No treatment', 'Stop all feeds'], ex: 'Moderate glucose control; avoid hypoglycaemia.', fx: () => { RO.glu = 9.1; } },
      { q: 'Day 1: myoclonic jerks. The family asks about prognosis.', a: 'Get an EEG, treat seizures, and delay prognosis until at least 72 h with multimodal assessment', w: ['Tell them recovery is impossible', 'Withdraw care today', 'Ignore the jerks'], ex: 'Early myoclonus alone does not predict outcome; use multimodal prognostication after 72 h.', fx: () => {} }
    ];
  }
  function renderRosc() {
    stopLive();
    main.innerHTML = xShell('Post-ROSC care', '62-year-old man, out-of-hospital VF arrest, ROSC after 14 minutes. Now intubated in the ICU.');
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340);
    startLive($('#dc'), { W, leads: LEADS.map((_, i) => i), rowMM: 17, gm: .6, T: X.T, get: () => data(RO.id), playing: () => true });
    roCtl();
  }
  function roVits() {
    const v = $('#xvits'); if (!v) return;
    v.innerHTML = `<div><small>MAP</small><b class="${RO.map < 65 ? 'warnt' : ''}">${RO.map}</b></div><div><small>SpO₂ / FiO₂</small><b>${RO.spo2} / ${RO.fio2}%</b></div><div><small>EtCO₂</small><b class="${RO.etco2 < 35 ? 'warnt' : ''}">${RO.etco2}</b></div><div><small>Temp</small><b class="${RO.temp > 37.7 ? 'warnt' : ''}">${RO.temp.toFixed(1)}</b></div><div><small>Glucose</small><b class="${RO.glu > 10 ? 'warnt' : ''}">${RO.glu.toFixed(1)}</b></div><div><small>Step</small><b>${Math.min(RO.step + 1, 7)}/7</b></div>`;
    const st = $('#dstat'); if (st) st.textContent = 'Post-ROSC 12-lead';
  }
  function roCtl() {
    const el = $('#xctl'); if (!el) return; roVits();
    if (X.done) { el.innerHTML = xSummary('After ROSC: 12-lead and cath lab if STEMI, SpO₂ 94–98%, normocapnia, MAP ≥ 65, prevent fever for 72 h, glucose 7.8–10, EEG and delayed multimodal prognostication.', 'rosc'); return; }
    const s = roSteps()[RO.step]; if (!RO.opts) RO.opts = shuffle([s.a, ...s.w]);
    el.innerHTML = `<div class="panel"><span class="lbl">Decision ${RO.step + 1} of 7</span><p class="qtxt" style="margin-top:8px">${s.q}</p>
      <div class="opts">${RO.opts.map((o, i) => { let c = ''; if (RO.picked != null) c = o === s.a ? 'ok' : (i === RO.picked ? 'no' : ''); return `<button class="opt ${c}" data-ro="${i}" ${RO.picked != null && RO.opts[RO.picked] === s.a ? 'disabled' : ''}>${o}</button>`; }).join('')}</div>
      ${RO.picked != null ? `<div class="fb"><h4>${RO.opts[RO.picked] === s.a ? 'Correct.' : 'Not the best choice.'}</h4><p>${s.ex}</p>${RO.opts[RO.picked] === s.a ? `<div class="row" style="margin-top:8px"><button class="btn pri" data-x="rnext">${RO.step === 6 ? 'Finish' : 'Next decision'} ${I.next}</button></div>` : '<p class="hint" style="padding:6px 0 0">Try again.</p>'}</div>` : ''}</div>
      <div class="row dcount"><span class="pill">Score <b>${X.score}</b></span></div>${xLogHTML()}`;
  }

  /* ---------- shared click handling for the new drills ---------- */
  main.addEventListener('click', ev => {
    if (R.tab !== 'drill') return;
    const t = ev.target;
    const em = t.closest('[data-em]'); if (em) { EPI.mode = em.dataset.em; xLog('Mode ' + EPI.mode); epiUpdate(); return; }
    const er = t.closest('[data-er]'); if (er) { EPI.rate = Number(er.dataset.er); epiUpdate(); return; }
    const ea = t.closest('[data-ea]'); if (ea) { EPI.mA = Math.max(0, Math.min(25, EPI.mA + (ea.dataset.ea === '+' ? 1 : -1))); epiUpdate(); return; }
    const es = t.closest('[data-es]'); if (es) { const i = SENS.indexOf(EPI.sens); EPI.sens = SENS[Math.max(0, Math.min(SENS.length - 1, (i < 0 ? 4 : i) + (es.dataset.es === '+' ? 1 : -1)))]; epiUpdate(); return; }
    const tx = t.closest('[data-tx]'); if (tx) { txAct(tx.dataset.tx); return; }
    const ro = t.closest('[data-ro]');
    if (ro && !X.done) { const s = roSteps()[RO.step], i = Number(ro.dataset.ro); RO.picked = i; if (RO.opts[i] === s.a) { if (RO.tries === 0) xLog('Decision ' + (RO.step + 1) + ' correct', 'ok'); s.fx(); } else { RO.tries++; xBad('Decision ' + (RO.step + 1) + ': ' + RO.opts[i], RO.tries === 1 ? 8 : 4); } roCtl(); return; }
    const b = t.closest('[data-x]'); if (!b) return; const a = b.dataset.x;
    if (a === 'epi') { startEpi(); return; } if (a === 'td') { startTd(); return; } if (a === 'tx') { startTx(); return; } if (a === 'rosc') { startRosc(); return; }
    if (X.done) return;
    if (a === 'end') { xEnd(false, 'You ended the scenario.'); return; }
    if (X.kind === 'epi') {
      if (a === 'thr') { EPI.thrChecked = true; xLog('Threshold test: capture lost below ' + EPI.sc.thr + ' mA → set output ≥ ' + (2 * EPI.sc.thr) + ' mA', 'ok'); epiCtl(); }
      else if (a === 'hand') epiHand();
      return;
    }
    if (X.kind === 'td') {
      if (a === 'tmg') { TD.mg = true; TD.Mg = 1.1; xLog('Magnesium sulphate 2 g IV over 10 min', 'ok'); }
      else if (a === 'tdrug') { TD.drugs = false; TD.dStop = X.t; xLog('Haloperidol, ondansetron and erythromycin stopped', 'ok'); }
      else if (a === 'tk') { TD.kc = true; TD.K = 4.6; xLog('Potassium replaced to 4.6', 'ok'); }
      else if (a === 'trate') { TD.rateUp = true; TD.hr = 96; xLog('Heart rate increased to 96 (isoprenaline / overdrive pacing)', 'ok'); if (TD.ep && !TD.sust) TD.epT = 0; }
      else if (a === 'tamio') { if (!TD.amio) { TD.amio = true; xBad('Amiodarone prolongs QT and worsens torsades', 15); } }
      else if (a === 'tsync') { xBad('Torsades cannot be reliably synchronised: use an unsynchronised shock if pulseless', 10); }
      else if (a === 'tshock') { dFlash(); if (TD.ep && TD.sust) { TD.ep = 0; TD.sust = false; xLog('Unsynchronised shock: sinus rhythm restored', 'ok'); } else if (TD.ep) { xLog('Run was self-terminating; shock not needed while a pulse returns'); } else { xBad('Shock given with a pulse and organised rhythm', 15); } }
      tdRefresh(); return;
    }
    if (X.kind === 'rosc' && a === 'rnext') { RO.step++; RO.tries = 0; RO.picked = null; RO.opts = null; if (RO.step >= 7) { xEnd(X.score >= 70, 'All seven post-ROSC decisions completed.'); return; } roCtl(); return; }
  });

  /* =================== LEARN: action potential lab + electrode placement =================== */
  const LR = { mode: 'ap', K: 4.2, Ca: 2.4, drug: 'none', el: 'ok', base: 'nsr', quiz: false, qAns: null, qPick: null };
  const DRUGS = [['none', 'No drug'], ['Ia', 'Class Ia (procainamide)'], ['Ib', 'Class Ib (lidocaine)'], ['Ic', 'Class Ic (flecainide)'], ['II', 'Class II (beta-blocker)'], ['III', 'Class III (amiodarone)'], ['IV', 'Class IV (verapamil)'], ['dig', 'Digoxin']];
  const DRUGTXT = {
    none: '', Ia: 'Blocks fast Na⁺ (moderate) and K⁺ channels: slower phase 0 (wider QRS) and longer AP (long QT).',
    Ib: 'Blocks Na⁺ channels in depolarised/ischaemic tissue and shortens the AP slightly: little ECG change in normal hearts.',
    Ic: 'Strong Na⁺ block with slow dissociation: markedly slower phase 0 and wider QRS, little effect on AP duration.',
    II: 'Reduces sympathetic phase 4 slope in SA and AV nodes: slower rate and longer PR; ventricular AP almost unchanged.',
    III: 'Blocks K⁺ (IKr) channels: delayed phase 3, longer AP and QT (torsades risk).',
    IV: 'Blocks L-type Ca²⁺ channels in nodal tissue: slower nodal phase 0 and phase 4, slower rate and longer PR.',
    dig: 'Inhibits Na⁺/K⁺-ATPase: more intracellular Ca²⁺, shorter AP (short QT), scooped ST; vagal effect slows the SA and AV nodes.'
  };
  function apModel() {
    const K = LR.K, Ca = LR.Ca, dg = LR.drug;
    const Ek = 61.5 * Math.log10(K / 140);
    let rmp = Math.min(-60, Ek + 4) + (dg === 'dig' ? 3 : 0);
    let avail = clamp((-rmp - 58) / 32, .15, 1);
    const naF = { Ia: .72, Ib: .95, Ic: .5 }[dg] || 1, vmax = avail * naF;
    let apd = 280 * (1 + (2.4 - Ca) * .28) * (K < 4 ? 1 + (4 - K) * .1 : 1) * (K > 5 ? Math.max(.6, 1 - (K - 5) * .07) : 1) * ({ Ia: 1.15, Ib: .93, III: 1.32, dig: .84 }[dg] || 1);
    const steep = K > 5 ? 1 + (K - 5) * .4 : K < 4 ? Math.max(.55, 1 - (4 - K) * .25) : 1;
    const peak = -12 + 37 * Math.pow(vmax, .6), plat = 8 + (Ca - 2.4) * 6;
    const nodalF = ({ II: .72, IV: .74, dig: .8 }[dg] || 1) * (K > 7 ? .82 : 1);
    const hr = Math.round(72 * nodalF), pr = .16 * ({ II: 1.35, IV: 1.4, dig: 1.3 }[dg] || 1) * (K > 6.5 ? 1 + (K - 6.5) * .25 : 1);
    const qrs = Math.min(.2, .09 / Math.pow(vmax, .55) * (dg === 'Ia' ? 1.08 : 1));
    return { Ek, rmp, avail, vmax, apd, steep, peak, plat, hr, pr, qrs, nodalF };
  }
  function apV(p, t) {
    const t0 = 40, p0 = 1.5 / Math.max(.15, p.vmax), p3 = 90 / p.steep, platEnd = t0 + p.apd - p3;
    if (t < t0) return p.rmp;
    if (t < t0 + p0) return p.rmp + (p.peak - p.rmp) * (t - t0) / p0;
    if (t < t0 + p0 + 12) return p.peak + (p.plat - p.peak) * (t - t0 - p0) / 12;
    if (t < platEnd) return p.plat - 14 * (t - t0 - p0 - 12) / Math.max(1, platEnd - t0 - p0 - 12);
    const x = (t - platEnd) / p3, top = p.plat - 14;
    let v = top + (p.rmp - top) * (1 - Math.pow(1 - Math.min(1, x), 2.2));
    if (LR.K < 3.6 && x > 1) v = p.rmp + (top - p.rmp) * .08 * Math.exp(-(x - 1) * 2.5);
    return x >= 1 && LR.K >= 3.6 ? p.rmp : v;
  }
  function nodalV(p, t) {
    const mdp = -62, thr = -40, slope = .045 * p.nodalF, cyc = 60000 / p.hr, up = 40, rep = 120;
    const tt = t % cyc, rise = (thr - mdp) / slope;
    if (tt < rise) return mdp + slope * tt;
    if (tt < rise + up) return thr + (8 - thr) * (tt - rise) / up * (LR.drug === 'IV' ? .8 : 1);
    if (tt < rise + up + rep) return 8 + (mdp - 8) * (tt - rise - up) / rep;
    return mdp;
  }
  const LCACHE = {};
  function apECG() {
    const p = apModel(), K = LR.K, dg = LR.drug, key = [K.toFixed(1), LR.Ca.toFixed(1), dg, S.real ? 1 : 0].join('|');
    if (LCACHE[key]) return LCACHE[key];
    const m = E.baseMorph({ qrsD: p.qrs, pd: .09 + (K > 6.5 ? .02 : 0) });
    const pf = K > 6.5 ? clamp(1 - (K - 6.5) / 1.8, 0, 1) : 1;
    m.p = m.p.map(v => v * pf);
    m.qt = .4 * p.apd / 280;
    if (K > 5) { m.t = m.t.map(v => v * (1 + (K - 5) * .45)); m.tw = 1 / Math.pow(p.steep, .6); m.tsym = K > 5.5; }
    if (K < 4) { const f = Math.max(.25, 1 - (4 - K) * .4); m.t = m.t.map(v => v * f); const u = (4 - K) * .13; m.u = m.u.map((v, i) => [1, 7, 8, 9].includes(i) ? u : u * .4); m.st = m.st.map((v, i) => [1, 5, 8, 9, 10].includes(i) ? -.05 * (4 - K) : v); }
    if (dg === 'dig') { m.t = m.t.map(v => v * .4); m.sc = m.sc.map((v, i) => [0, 1, 5, 9, 10, 11].includes(i) ? -.3 : v); }
    const e = { id: 'aplab', morphs: { main: m }, build: () => { const b = []; for (let t = .4; t < 19.6; t += 60 / p.hr) b.push({ t, m: 'main', pr: p.pr }); return { beats: b }; } };
    return LCACHE[key] = E.synth(e, { dur: 20 });
  }
  function apDraw() {
    const cv = $('#apc'); if (!cv) return;
    const W = Math.max(280, cv.parentElement.clientWidth || 340), H = 230, ctx = setup(cv, W, H), p = apModel();
    const L = 40, R = 10, T = 14, B = 26, x = t => L + (t / 520) * (W - L - R), y = v => T + (40 - v) / 140 * (H - T - B);
    ctx.fillStyle = COL.card || '#111'; ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(128,128,128,.25)'; ctx.lineWidth = 1; ctx.font = `500 10px ${FF()}`; ctx.fillStyle = COL.mut;
    [-90, -60, -30, 0, 30].forEach(v => { ctx.beginPath(); ctx.moveTo(L, y(v) + .5); ctx.lineTo(W - R, y(v) + .5); ctx.stroke(); ctx.fillText(String(v), 6, y(v) + 3); });
    ctx.fillText('mV', 6, 10); ctx.fillText('0', x(0) - 3, H - 8); ctx.fillText('500 ms', x(470), H - 8);
    const curve = (pp, col, w, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let t = 0; t <= 520; t += 1) { const v = apV(pp, t); t ? ctx.lineTo(x(t), y(v)) : ctx.moveTo(x(t), y(v)); } ctx.stroke(); ctx.restore(); };
    const sv = { K: LR.K, Ca: LR.Ca, drug: LR.drug }; LR.K = 4.2; LR.Ca = 2.4; LR.drug = 'none'; const pn = apModel(); curve(pn, 'rgba(160,160,160,.7)', 1.5, [5, 4]); LR.K = sv.K; LR.Ca = sv.Ca; LR.drug = sv.drug;
    curve(p, COL.ac, 2.6);
    ctx.fillStyle = COL.tx; ctx.font = `700 11px ${FF()}`;
    const lab = (s, t, v, dx, dy) => ctx.fillText(s, x(t) + (dx || 0), y(v) + (dy || 0));
    lab('0', 42, (p.peak + p.rmp) / 2, -12, 0); lab('1', 52, p.peak, 4, 4); lab('2', 40 + p.apd * .45, p.plat - 4, 0, -8); lab('3', 40 + p.apd - 30, p.plat - 40, 8, 0); lab('4', 15, p.rmp, 0, -8);
    ctx.font = `500 10px ${FF()}`; ctx.fillStyle = COL.mut; ctx.fillText('dashed = normal', W - 100, T + 4);
    const cv2 = $('#apn'); if (cv2) {
      const W2 = W, H2 = 90, c2 = setup(cv2, W2, H2), x2 = t => L + t / 2500 * (W2 - L - R), y2 = v => 8 + (20 - v) / 90 * (H2 - 20);
      c2.strokeStyle = 'rgba(128,128,128,.25)'; c2.setLineDash([3, 3]); c2.beginPath(); c2.moveTo(L, y2(-40)); c2.lineTo(W2 - R, y2(-40)); c2.stroke(); c2.setLineDash([]);
      c2.fillStyle = COL.mut; c2.font = `500 10px ${FF()}`; c2.fillText('SA node', 4, 14); c2.fillText('threshold', W2 - 62, y2(-40) - 3);
      c2.strokeStyle = COL.ac; c2.lineWidth = 2; c2.beginPath(); for (let t = 0; t <= 2500; t += 4) { const v = nodalV(p, t); t ? c2.lineTo(x2(t), y2(v)) : c2.moveTo(x2(t), y2(v)); } c2.stroke();
    }
    const exp = $('#apx'); if (exp) {
      const lines = [];
      lines.push(`<li><b>Resting potential ${Math.round(p.rmp)} mV</b> (normal about −90). ${LR.K > 5.2 ? 'Less negative: fewer Na⁺ channels can open.' : LR.K < 3.6 ? 'More negative (hyperpolarised), but repolarisation is slower.' : 'Normal.'}</li>`);
      lines.push(`<li><b>Phase 0 speed ${Math.round(p.vmax * 100)}%</b> → QRS about <b>${Math.round(p.qrs * 1000)} ms</b>.</li>`);
      lines.push(`<li><b>AP duration ${Math.round(p.apd)} ms</b> → QT ${p.apd > 310 ? 'prolonged' : p.apd < 250 ? 'short' : 'normal'}.</li>`);
      if (LR.K > 5.2) lines.push('<li><b>Phase 3 faster</b> (more K⁺ conductance) → tall, narrow, peaked T.</li>');
      if (LR.K < 3.6) lines.push('<li><b>Phase 3 slower with a late tail</b> → flat T, ST depression and a prominent U wave.</li>');
      if (LR.K > 6.5) lines.push('<li>Atrial muscle is very K⁺-sensitive: <b>P wave flattens</b> and PR lengthens.</li>');
      if (LR.Ca < 2.1) lines.push('<li><b>Low Ca²⁺ lengthens phase 2</b> → long ST segment, long QT.</li>');
      if (LR.Ca > 2.7) lines.push('<li><b>High Ca²⁺ shortens phase 2</b> → short ST segment, short QT.</li>');
      if (LR.drug !== 'none') lines.push(`<li><b>${DRUGS.find(d => d[0] === LR.drug)[1]}:</b> ${DRUGTXT[LR.drug]}</li>`);
      lines.push(`<li>Heart rate ${p.hr}/min, PR about ${Math.round(p.pr * 1000)} ms.</li>`);
      exp.innerHTML = lines.join('');
    }
  }
  /* electrode placement */
  const ELX = [
    { k: 'ok', n: 'Correct placement', clue: ['Lead I upright P, QRS and T', 'aVR mostly negative', 'R wave grows from V1 to V4–V5'] },
    { k: 'lara', n: 'LA ↔ RA reversed', clue: ['Lead I completely inverted (P, QRS, T)', 'aVR upright', 'II and III swapped; aVL and aVR swapped', 'Chest leads normal (unlike dextrocardia)'] },
    { k: 'lall', n: 'LA ↔ LL reversed', clue: ['Hardest to spot: I and II swap, III inverts', 'aVL and aVF swapped', 'P wave in I taller than in II is a clue'] },
    { k: 'rall', n: 'RA ↔ LL reversed', clue: ['I, II, III and aVF inverted', 'aVR upright', 'Looks like an inferior MI with a strange axis'] },
    { k: 'rarl', n: 'RA ↔ RL (neutral) reversed', clue: ['Lead II is almost a flat line', 'Lead I is an inverted lead III', 'aVR and aVF look the same'] },
    { k: 'larl', n: 'LA ↔ RL (neutral) reversed', clue: ['Lead III is almost a flat line', 'Leads I and II look identical', 'aVL and aVF look the same'] },
    { k: 'v12hi', n: 'V1–V2 placed too high', clue: ['rSr′ in V1–V2 (pseudo-RBBB)', 'Negative P and T in V1–V2', 'Mimics septal changes or RBBB'] },
    { k: 'v13', n: 'V1 ↔ V3 swapped', clue: ['Broken R-wave progression: V1 bigger than V2, V3 tiny', 'Each chest lead should change smoothly into the next'] }
  ];
  function elMorph(k, base) {
    const m = JSON.parse(JSON.stringify(base)), ks = E.ARR.filter(n => Array.isArray(m[n]));
    const map = { lara: a => [-a[0], a[2], a[1], a[4], a[3], a[5]], lall: a => [a[1], a[0], -a[2], a[3], a[5], a[4]], rall: a => [-a[2], -a[1], -a[0], a[5], a[4], a[3]], rarl: a => [-a[2], 0, a[2], a[2] / 2, -a[2], a[2] / 2], larl: a => [a[1], a[1], 0, -a[1], a[1] / 2, a[1] / 2] }[k];
    if (map) ks.forEach(n => { const v = map(m[n]); for (let i = 0; i < 6; i++) m[n][i] = v[i]; });
    if (k === 'v12hi') { [6, 7].forEach(i => { m.r[i] *= .55; m.s[i] *= .8; m.rp[i] = .28; m.p[i] = -Math.abs(m.p[i]) - .03; m.t[i] = -.18; }); }
    if (k === 'v13') ks.forEach(n => { const t = m[n][6]; m[n][6] = m[n][8]; m[n][8] = t; });
    return m;
  }
  function elData() {
    const key = LR.el + '|' + LR.base + '|' + (S.real ? 1 : 0); if (LCACHE[key]) return LCACHE[key];
    const src = LB.byId[LR.base], base = typeof src.morphs === 'function' ? src.morphs(E.defaults(src)).main : src.morphs.main;
    const m = elMorph(LR.el, base), rate = 72;
    const e = { id: 'elec' + LR.base, morphs: { main: m }, build: () => { const b = []; for (let t = .4; t < 19.6; t += 60 / rate) b.push({ t, m: 'main', pr: .16 }); return { beats: b }; } };
    return LCACHE[key] = E.synth(e, { dur: 20 });
  }
  function torsoSVG(k, hide) {
    const P = { RA: [52, 62], LA: [248, 62], RL: [112, 286], LL: [188, 286], V1: [139, 132], V2: [161, 132], V3: [176, 149], V4: [190, 164], V5: [213, 164], V6: [236, 164] }, pos = JSON.parse(JSON.stringify(P));
    const sw = { lara: ['LA', 'RA'], lall: ['LA', 'LL'], rall: ['RA', 'LL'], rarl: ['RA', 'RL'], larl: ['LA', 'RL'], v13: ['V1', 'V3'] }[k];
    const moved = [];
    if (sw && !hide) { const [a, b] = sw; pos[a] = P[b]; pos[b] = P[a]; moved.push(a, b); }
    if (k === 'v12hi' && !hide) { pos.V1 = [139, 100]; pos.V2 = [161, 100]; moved.push('V1', 'V2'); }
    const C = { RA: '#e63946', LA: '#f4c430', LL: '#2a9d48', RL: '#222', V1: '#e63946', V2: '#f4c430', V3: '#2a9d48', V4: '#8b5a2b', V5: '#111', V6: '#8e44ad' };
    const el = n => { const [x, y] = pos[n], mv = moved.includes(n); return `<g><circle cx="${x}" cy="${y}" r="${n.length > 2 ? 9 : 11}" fill="${C[n]}" stroke="${mv ? '#ff3b3b' : '#fff'}" stroke-width="${mv ? 3 : 1.6}"/><text x="${x}" y="${y + (n.length > 2 ? 3 : 4)}" text-anchor="middle" font-size="${n.length > 2 ? 7.5 : 9}" font-weight="700" fill="${['LA', 'V2'].includes(n) ? '#111' : '#fff'}">${n}</text></g>`; };
    const arrows = sw && !hide ? `<path d="M${P[sw[0]][0]},${P[sw[0]][1]} Q150,${Math.min(P[sw[0]][1], P[sw[1]][1]) - 40} ${P[sw[1]][0]},${P[sw[1]][1]}" fill="none" stroke="#ff3b3b" stroke-width="2" stroke-dasharray="5 4"/>` : '';
    return `<svg viewBox="0 0 300 310" class="torso" role="img" aria-label="Electrode positions"><path d="M95 30 Q150 12 205 30 L262 52 Q280 60 278 90 L262 150 L240 140 L232 300 L68 300 L60 140 L38 150 L22 90 Q20 60 38 52 Z" fill="color-mix(in srgb, var(--tx) 7%, transparent)" stroke="color-mix(in srgb, var(--tx) 35%, transparent)" stroke-width="1.5"/>
      <path d="M150 40 L150 220" stroke="color-mix(in srgb, var(--tx) 18%, transparent)" stroke-width="10" stroke-linecap="round"/>
      ${[95, 112, 130, 148].map(yy => `<path d="M100 ${yy} Q150 ${yy + 10} 200 ${yy}" fill="none" stroke="color-mix(in srgb, var(--tx) 10%, transparent)" stroke-width="1.2"/>`).join('')}
      ${arrows}${hide ? '<text x="150" y="190" text-anchor="middle" font-size="40" font-weight="800" fill="var(--ac)">?</text>' : Object.keys(pos).map(el).join('')}</svg>`;
  }
  function renderLearn() {
    stopLive();
    const seg = `<div class="chips qmodes"><button class="chip ${LR.mode === 'ap' ? 'on' : ''}" data-lm="ap">Action potential</button><button class="chip ${LR.mode === 'el' ? 'on' : ''}" data-lm="el">Electrode placement</button></div>`;
    if (LR.mode === 'ap') {
      main.innerHTML = `${seg}
        <div class="panel"><span class="lbl">Ventricular action potential</span><div style="margin-top:8px"><canvas id="apc"></canvas></div><canvas id="apn" style="margin-top:6px"></canvas></div>
        <div class="panel sim" style="margin-top:12px">
          <div class="slr"><div class="slh"><span>Serum K⁺</span><output id="o-K">${LR.K.toFixed(1)} mmol/L</output></div><input type="range" data-lk="K" min="2" max="8.5" step=".1" value="${LR.K}"></div>
          <div class="slr"><div class="slh"><span>Serum calcium (total)</span><output id="o-Ca">${LR.Ca.toFixed(1)} mmol/L</output></div><input type="range" data-lk="Ca" min="1.5" max="3.5" step=".1" value="${LR.Ca}"></div>
          <div class="chips wrap">${DRUGS.map(d => `<button class="chip ${LR.drug === d[0] ? 'on' : ''}" data-ld="${d[0]}">${d[1]}</button>`).join('')}</div>
          <button class="btn" data-lreset style="align-self:flex-start">Reset to normal</button>
        </div>
        <div class="panel" style="margin-top:12px"><span class="lbl">Resulting ECG</span><div class="vcanvas live" id="lbox" style="margin-top:8px"><canvas id="lc"></canvas></div></div>
        <div class="panel" style="margin-top:12px"><span class="lbl">What is happening</span><ul class="cmpl" id="apx"></ul></div>`;
      apDraw();
      const box = $('#lbox'); startLive($('#lc'), { W: Math.max(280, box.clientWidth || 340), leads: [IDX.II, IDX.V3], rowMM: 26, get: apECG, playing: () => true });
    } else {
      const it = ELX.find(x => x.k === LR.el), q = LR.quiz;
      main.innerHTML = `${seg}
        <div class="row" style="margin:4px 0 10px"><div class="seg"><button data-lq="0" class="${q ? '' : 'on'}">Explore</button><button data-lq="1" class="${q ? 'on' : ''}">Spot the error</button></div><span class="sp"></span><div class="seg">${[['nsr', 'Normal'], ['stemi-inf', 'Inferior MI']].map(b => `<button data-lb="${b[0]}" class="${LR.base === b[0] ? 'on' : ''}">${b[1]}</button>`).join('')}</div></div>
        <div class="panel elp">${torsoSVG(LR.el, q && LR.qPick == null)}
          ${q ? `<span class="lbl">Which placement error is this?</span><div class="opts" style="margin-top:8px">${ELX.map(x => { let c = ''; if (LR.qPick != null) c = x.k === LR.el ? 'ok' : (x.k === LR.qPick ? 'no' : ''); return `<button class="opt ${c}" data-lp="${x.k}" ${LR.qPick != null ? 'disabled' : ''}>${x.n}</button>`; }).join('')}</div>${LR.qPick != null ? `<div class="fb"><h4>${LR.qPick === LR.el ? 'Correct.' : 'Not quite: ' + it.n}</h4><ul>${it.clue.map(c => `<li>${c}</li>`).join('')}</ul><button class="btn pri" data-lnext style="margin-top:8px">Next ECG ${I.next}</button></div>` : ''}`
          : `<div class="chips wrap">${ELX.map(x => `<button class="chip ${LR.el === x.k ? 'on' : ''}" data-le="${x.k}">${x.n}</button>`).join('')}</div><div class="blk" style="margin-top:10px"><h4>How to recognise it</h4><ul>${it.clue.map(c => `<li>${c}</li>`).join('')}</ul></div>`}
        </div>
        <div class="panel" style="margin-top:12px"><span class="lbl">Recorded 12-lead</span><div class="vcanvas" id="ebox" style="margin-top:8px"><canvas id="ec"></canvas></div><p class="hint" style="padding:6px 0 0">Swipe sideways to see all four columns.</p></div>`;
      const box = $('#ebox'), sv = V.ann; V.ann = false; drawGrid12($('#ec'), elData(), Math.max(280, box.clientWidth || 340)); V.ann = sv;
    }
  }
  main.addEventListener('input', ev => {
    if (R.tab !== 'learn') return; const r = ev.target.closest('[data-lk]'); if (!r) return;
    LR[r.dataset.lk] = Number(r.value); const o = $('#o-' + r.dataset.lk); if (o) o.textContent = LR[r.dataset.lk].toFixed(1) + ' mmol/L';
    apDraw(); if (LIVE.o) LIVE.o.redraw();
  });
  main.addEventListener('click', ev => {
    if (R.tab !== 'learn') return; const t = ev.target;
    const lm = t.closest('[data-lm]'); if (lm) { LR.mode = lm.dataset.lm; renderLearn(); return; }
    const ld = t.closest('[data-ld]'); if (ld) { LR.drug = ld.dataset.ld; $$('[data-ld]').forEach(b => b.classList.toggle('on', b === ld)); apDraw(); if (LIVE.o) LIVE.o.redraw(); return; }
    if (t.closest('[data-lreset]')) { LR.K = 4.2; LR.Ca = 2.4; LR.drug = 'none'; renderLearn(); return; }
    const le = t.closest('[data-le]'); if (le) { LR.el = le.dataset.le; renderLearn(); return; }
    const lb = t.closest('[data-lb]'); if (lb) { LR.base = lb.dataset.lb; renderLearn(); return; }
    const lq = t.closest('[data-lq]'); if (lq) { LR.quiz = lq.dataset.lq === '1'; if (LR.quiz) { const pool = ELX.filter(x => x.k !== 'ok'); LR.el = pool[Math.floor(Math.random() * pool.length)].k; LR.qPick = null; } else LR.el = 'ok'; renderLearn(); return; }
    const lp = t.closest('[data-lp]'); if (lp && LR.qPick == null) { LR.qPick = lp.dataset.lp; rec('el:' + LR.el, LR.qPick === LR.el); renderLearn(); return; }
    if (t.closest('[data-lnext]')) { const pool = ELX.filter(x => x.k !== 'ok' && x.k !== LR.el); LR.el = pool[Math.floor(Math.random() * pool.length)].k; LR.qPick = null; renderLearn(); window.scrollTo(0, 0); }
  });

  /* =================== OT / Anaesthesia emergencies =================== */
  const OT_SC = [
    {
      k: 'last', title: 'Local anaesthetic toxicity (LAST)', story: 'Interscalene block with 30 mL bupivacaine 0.5%. Two minutes later the patient becomes agitated, then has a generalised seizure; the QRS is widening.',
      init: () => ({ sev: .9, hr: 128, sys: 92, spo2: 92, seiz: true, lipid: 0, lipT: null, stop: false, air: false, arrest: false, arrT: 0, cpr: false, adr: 0 }),
      ecg: s => s.arrest ? ['vf', {}] : s.sev > 1.35 ? ['vent-escape', { rate: 34 }] : ['tca', { sev: Math.round(Math.max(0, s.sev) * 20) / 20, rate: Math.round(s.hr / 4) * 4 }],
      acts: [['stop', 'Stop injecting, call for help'], ['air', '100% O₂, secure the airway'], ['benzo', 'Benzodiazepine for seizure'], ['lipid', 'Lipid emulsion 20% 1.5 mL/kg bolus + infusion', 'adr'], ['adrlo', 'Adrenaline ≤ 1 mcg/kg'], ['adrhi', 'Adrenaline 1 mg'], ['cpr', 'Start CPR'], ['lido', 'Lidocaine for arrhythmia'], ['vaso', 'Vasopressin'], ['ecmo', 'Call for cardiopulmonary bypass / ECMO']],
      act: (s, a) => {
        if (a === 'stop') { if (s.stop) return; s.stop = true; xLog('Injection stopped, help called', 'ok'); }
        else if (a === 'air') { if (s.air) return; s.air = true; xLog('100% oxygen, airway secured, avoiding hypoxia and acidosis', 'ok'); }
        else if (a === 'benzo') { if (!s.seiz) return; s.seiz = false; xLog('Benzodiazepine: seizure stopped', 'ok'); }
        else if (a === 'lipid') { if (s.lipid >= 3) { xBad('More than three lipid boluses (maximum about 12 mL/kg total)', 5); return; } s.lipid++; s.lipT = X.t; s.sev = Math.max(0, s.sev - .35); if (s.arrest && s.cpr) { s.arrest = false; s.sev = 1.1; xLog('Lipid during CPR: organised rhythm returns', 'ok'); } xLog('Intralipid 20% 1.5 mL/kg bolus' + (s.lipid === 1 ? ', infusion 15 mL/kg/h started' : ' (repeat)'), 'ok'); }
        else if (a === 'adrlo') { s.adr++; if (s.arrest || s.sev > 1.35) { s.sys += 8; xLog('Small-dose adrenaline (≤ 1 mcg/kg)', 'ok'); } else xLog('Adrenaline not needed yet'); }
        else if (a === 'adrhi') xBad('Standard 1 mg adrenaline: use small doses (≤ 1 mcg/kg) in LAST', 10);
        else if (a === 'cpr') { if (!s.arrest) { xBad('CPR started with a pulse', 10); return; } s.cpr = true; xLog('CPR started: may need to continue for over an hour', 'ok'); }
        else if (a === 'lido') xBad('Lidocaine is another local anaesthetic: never use it in LAST', 15);
        else if (a === 'vaso') xBad('Vasopressin is not recommended in LAST', 5);
        else if (a === 'ecmo') xLog('Bypass / ECMO team alerted for refractory arrest', 'ok');
      },
      tick: s => {
        if (s.lipid) s.sev -= .006; else s.sev += .005;
        if (s.seiz && !s.air) s.spo2 = Math.max(70, s.spo2 - .4); else if (s.air) s.spo2 = Math.min(99, s.spo2 + .5);
        s.hr = s.sev > 1.35 ? 34 : 120 - Math.max(0, s.sev) * 10; s.sys = s.arrest ? 0 : s.sev > 1.35 ? 62 : 104 - s.sev * 12;
        if (!s.arrest && s.sev > 1.65) { s.arrest = true; s.arrT = X.t; xLog('VF arrest', 'bad'); }
        if (s.arrest && X.t - s.arrT > 40 && !(s.cpr && s.lipid)) return [false, 'Cardiac arrest without CPR and lipid emulsion.'];
        if (X.t === 30 && !s.stop) xBad('Injection not stopped / help not called early', 5);
        if (X.t === 60 && !s.air) xBad('Airway not secured within a minute: hypoxia and acidosis worsen toxicity', 10);
        if (X.t === 90 && !s.lipid) xBad('Lipid emulsion delayed beyond 90 seconds', 15);
        if (!s.arrest && s.sev < .35 && s.lipid && s.air && s.stop) return [true, 'QRS narrowed and circulation recovered. Continue the lipid infusion and monitor for at least 4–6 hours.'];
      },
      vit: s => [['HR', s.arrest ? '--' : Math.round(s.hr)], ['BP', s.arrest ? '--/--' : Math.round(s.sys) + '/' + Math.round(s.sys * .58)], ['SpO₂', Math.round(s.spo2)], ['QRS', s.arrest ? '--' : Math.round(90 + 50 * Math.min(1.6, Math.max(0, s.sev)))], ['Status', s.arrest ? 'ARREST' : s.seiz ? 'Seizure' : 'Toxic']],
      teach: 'Stop injecting, call for help, oxygenate and control seizures (benzodiazepine). Give lipid emulsion 20% 1.5 mL/kg then 15 mL/kg/h, up to two more boluses. In arrest use adrenaline ≤ 1 mcg/kg, avoid vasopressin, calcium-channel blockers, beta-blockers and lidocaine, and continue CPR for a long time (consider bypass).'
    },
    {
      k: 'mh', title: 'Malignant hyperthermia', story: 'Sevoflurane anaesthesia after suxamethonium for laparoscopy. Unexplained rising EtCO₂, tachycardia and masseter rigidity.',
      init: () => ({ et: 52, hr: 128, temp: 38.2, K: 5.4, vol: true, dan: 0, cool: false, hv: false, ca: false, ins: false, bic: false, vt: false, vtT: 0 }),
      ecg: s => s.vt ? ['vt', { rate: 190 }] : s.K > 6.3 ? ['hyperk-mild', { sev: Math.min(8, s.K), rate: Math.round(s.hr / 4) * 4 }] : ['sinus-tachy', { rate: Math.round(Math.min(170, s.hr) / 4) * 4 }],
      acts: [['vol', 'Stop volatile, call for help'], ['hv', 'Hyperventilate 100% O₂, high flow'], ['dan', 'Dantrolene 2.5 mg/kg IV', 'adr'], ['cool', 'Active cooling'], ['ca', 'Calcium for hyperkalaemia'], ['ins', 'Insulin + glucose'], ['bic', 'Sodium bicarbonate'], ['amio', 'Amiodarone for VT'], ['ccb', 'Verapamil / diltiazem'], ['tiva', 'Switch to TIVA, finish surgery quickly']],
      act: (s, a) => {
        if (a === 'vol') { if (!s.vol) return; s.vol = false; xLog('Volatile off, help called, MH kit requested', 'ok'); }
        else if (a === 'hv') { if (s.hv) return; s.hv = true; xLog('Fresh gas 15 L/min, 100% O₂, minute ventilation 2–3×', 'ok'); }
        else if (a === 'dan') { s.dan++; xLog('Dantrolene 2.5 mg/kg (dose ' + s.dan + ')', 'ok'); if (s.dan > 4) xBad('Dantrolene above 10 mg/kg without reassessment', 3); }
        else if (a === 'cool') { if (s.cool) return; s.cool = true; xLog('Active cooling (cold fluids, surface cooling)', 'ok'); }
        else if (a === 'ca') { if (s.ca) return; s.ca = true; s.K -= .6; xLog('Calcium for hyperkalaemia', 'ok'); }
        else if (a === 'ins') { if (s.ins) return; s.ins = true; s.K -= .8; xLog('Insulin-glucose: K⁺ shifting', 'ok'); }
        else if (a === 'bic') { if (s.bic) return; s.bic = true; xLog('Bicarbonate for metabolic acidosis', 'ok'); }
        else if (a === 'amio') { if (s.vt) { s.vt = false; xLog('Amiodarone: VT terminated', 'ok'); } else xLog('No VT at present'); }
        else if (a === 'ccb') xBad('Calcium-channel blockers with dantrolene can cause hyperkalaemia and cardiovascular collapse', 15);
        else if (a === 'tiva') xLog('TIVA started; surgery to finish as soon as possible', 'ok');
      },
      tick: s => {
        const drive = s.dan ? -1 : 1, damp = s.vol ? 1.3 : 1;
        s.et = clamp(s.et + (drive > 0 ? .35 * damp : -.5 - (s.hv ? .3 : 0)), 34, 110);
        s.hr = clamp(s.hr + (drive > 0 ? .25 * damp : -.6), 78, 175);
        s.temp = clamp(s.temp + (drive > 0 ? .012 : -.004) - (s.cool ? .01 : 0), 36.5, 42);
        if (drive > 0) s.K += .008; else s.K = Math.max(4.4, s.K - .01);
        if (!s.vt && s.K > 6.6 && !s.dan) { s.vt = true; s.vtT = X.t; xLog('Ventricular tachycardia', 'bad'); }
        if (s.vt && X.t - s.vtT > 60) return [false, 'Untreated hypermetabolism led to VT and cardiac arrest.'];
        if (X.t === 60 && s.vol) xBad('Volatile still running after one minute', 10);
        if (X.t === 120 && !s.dan) xBad('Dantrolene not given within two minutes', 15);
        if (s.dan && !s.vol && s.et < 50 && s.hr < 110 && !s.vt) return [true, 'Hypermetabolism controlled. Continue dantrolene 1 mg/kg every 4–6 h, ICU for 24 h, watch for rhabdomyolysis and recurrence; refer for MH testing.'];
      },
      vit: s => [['HR', Math.round(s.hr)], ['EtCO₂', Math.round(s.et)], ['Temp', s.temp.toFixed(1)], ['K⁺', s.K.toFixed(1)], ['Volatile', s.vol ? 'ON' : 'off']],
      teach: 'Stop volatile, call for help, hyperventilate with 100% O₂ at high flow, give dantrolene 2.5 mg/kg (repeat to 10 mg/kg), cool, treat hyperkalaemia and arrhythmias (avoid calcium-channel blockers), and plan ICU care.'
    },
    {
      k: 'sux', title: 'Suxamethonium hyperkalaemia', story: 'Rapid sequence induction for a man with 30% burns three weeks ago. One minute after suxamethonium the T waves rise and the QRS begins to widen.',
      init: () => ({ K: 6.2, ca: false, caT: 0, ins: false, salb: false, hv: false, bic: false, arrest: false, cpr: false, hi: 0 }),
      eff: s => s.K - (s.ca && X.t - s.caT >= 3 ? 1.6 : 0),
      ecg: s => s.arrest ? ['vf', {}] : ['hyperk-mod', { sev: Math.max(5, Math.min(9.5, Math.round(OT.sc.eff(s) * 10) / 10)), rate: 78 }],
      acts: [['ca', 'Calcium chloride 10% 10 mL', 'adr'], ['ins', 'Insulin 10 U + glucose 25 g'], ['salb', 'Salbutamol nebulised / IV'], ['hv', 'Hyperventilate'], ['bic', 'Sodium bicarbonate'], ['cpr', 'Start CPR'], ['more', 'Give more suxamethonium']],
      act: (s, a) => {
        if (a === 'ca') { s.ca = true; s.caT = X.t; xLog('Calcium chloride 10% 10 mL: membrane stabilised within minutes', 'ok'); if (s.arrest && s.cpr) { s.arrest = false; xLog('Rhythm returns after calcium during CPR', 'ok'); } }
        else if (a === 'ins') { if (s.ins) return; s.ins = true; xLog('Insulin 10 U with glucose 25 g', 'ok'); }
        else if (a === 'salb') { if (s.salb) return; s.salb = true; xLog('Salbutamol', 'ok'); }
        else if (a === 'hv') { if (s.hv) return; s.hv = true; xLog('Hyperventilation: alkalosis shifts K⁺ into cells', 'ok'); }
        else if (a === 'bic') { if (s.bic) return; s.bic = true; xLog('Bicarbonate', 'ok'); }
        else if (a === 'cpr') { if (!s.arrest) { xBad('CPR started with a pulse', 10); return; } s.cpr = true; xLog('CPR started', 'ok'); }
        else if (a === 'more') xBad('More suxamethonium worsens hyperkalaemia; it is contraindicated after burns (from day 2)', 20);
      },
      tick: s => {
        if (X.t < 60) s.K += .045; s.K -= (s.ins ? .012 : 0) + (s.salb ? .008 : 0) + (s.hv ? .004 : 0) + (s.bic ? .003 : 0);
        const e = OT.sc.eff(s);
        if (!s.arrest && e >= 9.3) { s.hi++; if (s.hi > 15) { s.arrest = true; s.arrT = X.t; xLog('Sine wave degenerates to VF', 'bad'); } } else s.hi = 0;
        if (s.arrest && X.t - s.arrT > 30 && !(s.cpr && s.ca)) return [false, 'Hyperkalaemic arrest without CPR and calcium.'];
        if (X.t === 30 && !s.ca) xBad('Calcium not given within 30 seconds of ECG change', 15);
        if (!s.arrest && X.t > 70 && e < 6.8 && s.ca && (s.ins || s.salb)) return [true, 'Heart protected and potassium shifting. Check K⁺ repeatedly; use rocuronium next time.'];
      },
      vit: s => [['K⁺ (gas)', s.K.toFixed(1)], ['BP', s.arrest ? '--/--' : '96/58'], ['Status', s.arrest ? 'ARREST' : OT.sc.eff(s) > 8 ? 'Wide QRS' : 'Peaked T']],
      teach: 'Suxamethonium is contraindicated after burns, crush, denervation or prolonged immobility (upregulated receptors). Treat with calcium immediately, then insulin-glucose, salbutamol and hyperventilation; CPR if arrest.'
    },
    {
      k: 'occ', title: 'Oculocardiac reflex', story: '6-year-old under general anaesthesia for squint surgery. The surgeon pulls on the medial rectus and the heart rate suddenly drops.',
      init: () => ({ trac: true, atro: false, deep: false, asys: false, asyT: 0, adr: false, cpr: false, hr: 46, resumed: false }),
      ecg: s => s.asys ? ['asystole', {}] : s.hr < 60 ? ['junctional', { rate: Math.max(35, Math.round(s.hr)) }] : ['sinus-tachy', { rate: Math.round(s.hr / 4) * 4 }],
      acts: [['stop', 'Ask surgeon to stop traction', 'adr'], ['atro', 'Atropine 20 mcg/kg / glycopyrrolate'], ['deep', 'Deepen anaesthesia, check oxygenation'], ['adr', 'Adrenaline 10 mcg/kg'], ['cpr', 'Start CPR'], ['resume', 'Allow surgery to resume']],
      act: (s, a) => {
        if (a === 'stop') { if (!s.trac) return; s.trac = false; xLog('Traction released', 'ok'); if (s.asys) { s.asys = false; s.hr = 70; xLog('Rhythm returns once traction stops', 'ok'); } }
        else if (a === 'atro') { if (s.atro) return; s.atro = true; xLog('Atropine 20 mcg/kg IV', 'ok'); if (s.trac) s.hr = Math.max(s.hr, 72); }
        else if (a === 'deep') { if (s.deep) return; s.deep = true; xLog('Anaesthesia deepened, SpO₂ and EtCO₂ checked', 'ok'); }
        else if (a === 'adr') { if (!s.asys) { xBad('Adrenaline without asystole or profound bradycardia', 5); return; } s.adr = true; xLog('Adrenaline 10 mcg/kg', 'ok'); }
        else if (a === 'cpr') { if (!s.asys) { xBad('CPR with a pulse', 10); return; } s.cpr = true; xLog('CPR', 'ok'); }
        else if (a === 'resume') { if (s.trac) { xLog('Traction is still on'); return; } s.resumed = true; if (!s.atro) { s.trac = true; s.hr = 40; xBad('Surgery resumed without atropine: bradycardia recurs', 10); } else { xLog('Surgery resumed: heart rate stable with atropine on board', 'ok'); } }
      },
      tick: s => {
        if (s.trac) { s.hr = Math.max(28, s.hr - (s.atro ? .3 : 1.1)); if (!s.asys && s.hr < 32) { s.asys = true; s.asyT = X.t; xLog('Asystole', 'bad'); } }
        else if (!s.asys) s.hr = Math.min(s.atro ? 128 : 96, s.hr + 3);
        if (s.asys && X.t - s.asyT > 25 && !(s.cpr && (s.adr || !s.trac))) return [false, 'Prolonged asystole: traction continued without CPR and adrenaline.'];
        if (X.t === 15 && s.trac) xBad('Traction still on after 15 seconds: ask the surgeon to stop first', 10);
        if (!s.trac && s.atro && s.resumed && s.hr >= 90) return [true, 'Reflex controlled. Release traction first, then atropine or glycopyrrolate before surgery resumes.'];
      },
      vit: s => [['HR', s.asys ? '0' : Math.round(s.hr)], ['Traction', s.trac ? 'ON' : 'off'], ['Status', s.asys ? 'ASYSTOLE' : s.hr < 60 ? 'Bradycardia' : 'Recovering']],
      teach: 'Trigeminal-vagal reflex: stop the stimulus first, then atropine 20 mcg/kg (or glycopyrrolate) and check depth and oxygenation. Asystole: CPR and adrenaline. The reflex fatigues with repetition.'
    },
    {
      k: 'spinal', title: 'High spinal in caesarean section', story: 'Spinal anaesthesia for caesarean section. Five minutes later the mother says her hands feel weak and she cannot breathe properly; BP and HR are falling.',
      init: () => ({ sys: 64, hr: 42, spo2: 94, lud: false, air: false, apnoea: false, apT: 0, fl: false, vp: 0, at: false }),
      ecg: s => s.hr < 55 ? ['sinus-brady', { rate: Math.max(30, Math.round(s.hr)) }] : ['nsr', { rate: Math.round(s.hr / 2) * 2 }],
      acts: [['lud', 'Left uterine displacement'], ['phen', 'Phenylephrine 100 mcg'], ['eph', 'Ephedrine 6 mg'], ['atro', 'Atropine 600 mcg / glycopyrrolate'], ['fl', 'Rapid IV fluid bolus'], ['bmv', 'Bag-mask ventilation, 100% O₂'], ['tube', 'Rapid sequence intubation', 'adr'], ['adr', 'Adrenaline 10–50 mcg'], ['reass', 'Reassure and observe']],
      act: (s, a) => {
        if (a === 'lud') { if (s.lud) return; s.lud = true; s.sys += 12; xLog('Left uterine displacement: aortocaval compression relieved', 'ok'); }
        else if (a === 'phen') { s.vp++; s.sys += 12; s.hr = Math.max(36, s.hr - 3); xLog('Phenylephrine 100 mcg', 'ok'); }
        else if (a === 'eph') { s.vp++; s.sys += 9; s.hr += 8; xLog('Ephedrine 6 mg', 'ok'); }
        else if (a === 'atro') { if (s.at) return; s.at = true; s.hr = Math.max(s.hr, 72); xLog('Atropine: heart rate up', 'ok'); }
        else if (a === 'fl') { if (s.fl) return; s.fl = true; s.sys += 6; xLog('Fluid bolus', 'ok'); }
        else if (a === 'bmv') { s.spo2 = Math.max(s.spo2, 92); xLog('Bag-mask ventilation: SpO₂ supported (aspiration risk remains)', 'ok'); s.bmv = X.t; }
        else if (a === 'tube') { if (s.air) return; s.air = true; xLog('RSI and tracheal intubation; ventilated', 'ok'); }
        else if (a === 'adr') { s.sys += 18; s.hr += 15; xLog('Adrenaline bolus', 'ok'); }
        else if (a === 'reass') xBad('Reassurance only while the block is rising', 15);
      },
      tick: s => {
        s.sys = clamp(s.sys - (s.lud ? .3 : .6), 40, 140); s.hr = clamp(s.hr - .15, 30, 130);
        if (!s.apnoea && X.t >= 25) { s.apnoea = true; s.apT = X.t; xLog('Apnoea: block has reached the cervical level', 'bad'); }
        if (s.apnoea && !s.air) s.spo2 = Math.max(55, s.spo2 - (s.bmv && X.t - s.bmv < 20 ? .1 : 1.2)); else if (s.air) s.spo2 = Math.min(99, s.spo2 + 1);
        if (s.spo2 < 65 || s.sys <= 42) return [false, s.spo2 < 65 ? 'Severe hypoxia: the airway was not secured after apnoea.' : 'Cardiovascular collapse from untreated hypotension and bradycardia.'];
        if (X.t === 20 && !s.lud) xBad('No left uterine displacement in a hypotensive term mother', 10);
        if (s.air && s.lud && s.sys >= 100 && s.hr >= 60) return [true, 'Mother ventilated and haemodynamics restored. Proceed with delivery under general anaesthesia; sedation until the block regresses.'];
      },
      vit: s => [['HR', Math.round(s.hr)], ['BP', Math.round(s.sys) + '/' + Math.round(s.sys * .55)], ['SpO₂', Math.round(s.spo2)], ['Breathing', s.air ? 'Ventilated' : s.apnoea ? 'APNOEA' : 'Weak']],
      teach: 'Left uterine displacement, vasopressors (phenylephrine, ephedrine, adrenaline if severe), atropine or glycopyrrolate for bradycardia, oxygenate and intubate when breathing fails. Deliver the baby; prepare for cardiac arrest management in pregnancy.'
    },
    {
      k: 'vae', title: 'Venous air embolism', story: 'Sitting-position posterior fossa craniotomy. During bone work the EtCO₂ suddenly falls, followed by hypotension and tachycardia.',
      init: () => ({ et: 18, sys: 70, hr: 124, spo2: 91, flood: false, n2o: false, low: false, asp: false, vp: false, arrest: false, arrT: 0, cpr: false }),
      ecg: s => s.arrest ? ['pea', {}] : s.et < 26 ? ['pe', { rate: Math.round(s.hr / 4) * 4 }] : ['sinus-tachy', { rate: Math.round(s.hr / 4) * 4 }],
      acts: [['flood', 'Tell surgeon: flood field, bone wax', 'adr'], ['n2o', 'Stop N₂O, 100% O₂'], ['low', 'Lower the head / jugular compression'], ['asp', 'Aspirate the right-atrial catheter'], ['dur', 'Left lateral, head down (if possible)'], ['vp', 'Vasopressor / inotrope'], ['cpr', 'Start CPR'], ['peep', 'Add high PEEP']],
      act: (s, a) => {
        if (a === 'flood') { if (s.flood) return; s.flood = true; xLog('Field flooded with saline, bone edges waxed: entry stopped', 'ok'); }
        else if (a === 'n2o') { if (s.n2o) return; s.n2o = true; xLog('N₂O off, 100% O₂', 'ok'); }
        else if (a === 'low') { if (s.low) return; s.low = true; xLog('Head lowered, bilateral jugular compression', 'ok'); }
        else if (a === 'asp') { if (s.asp) return; s.asp = true; s.et += 5; s.sys += 8; xLog('Air aspirated from the multi-orifice CVC', 'ok'); }
        else if (a === 'dur') xLog('Left lateral head-down positioning, if the surgical field allows', 'ok');
        else if (a === 'vp') { if (s.vp) return; s.vp = true; s.sys += 15; xLog('Vasopressor and inotrope for RV failure', 'ok'); }
        else if (a === 'cpr') { if (!s.arrest) { xBad('CPR with a pulse', 10); return; } s.cpr = true; xLog('CPR in the supine position', 'ok'); }
        else if (a === 'peep') xBad('High PEEP may raise right atrial pressure and open a PFO (paradoxical embolism); not recommended', 5);
      },
      tick: s => {
        const entry = !s.flood;
        s.et = clamp(s.et + (entry ? -.08 : .25 + (s.asp ? .1 : 0)), 8, 36);
        s.sys = clamp(s.sys + (entry ? -.35 : (s.vp ? .5 : .25)), 30, 120);
        s.hr = clamp(s.hr + (entry ? .2 : -.4), 80, 150);
        if (!s.arrest && s.sys <= 45) { s.arrest = true; s.arrT = X.t; xLog('PEA arrest', 'bad'); }
        if (s.arrest && X.t - s.arrT > 30 && !s.cpr) return [false, 'PEA arrest without CPR.'];
        if (s.arrest && s.cpr && s.flood && s.asp) { s.arrest = false; s.sys = 70; xLog('ROSC after air aspiration and CPR', 'ok'); }
        if (X.t === 20 && !s.flood) xBad('Surgeon not told to flood the field within 20 seconds', 10);
        if (!s.arrest && s.flood && s.n2o && (s.low || s.asp) && s.et > 30 && s.sys >= 90) return [true, 'Air entry stopped and circulation recovered. Check for neurological deficit (paradoxical embolism).'];
      },
      vit: s => [['HR', s.arrest ? '--' : Math.round(s.hr)], ['BP', s.arrest ? '--/--' : Math.round(s.sys) + '/' + Math.round(s.sys * .6)], ['EtCO₂', Math.round(s.et)], ['SpO₂', Math.round(s.spo2)]],
      teach: 'Stop entry first (flood the field, wax bone, lower the head, jugular compression), 100% O₂ and stop N₂O, aspirate air from a right-atrial catheter, support the RV with vasopressors and inotropes, and CPR if arrest.'
    }
  ];
  const OT = {};
  function startOT() {
    xBegin('ot', renderOT);
    let sc; do { sc = OT_SC[Math.floor(Math.random() * OT_SC.length)]; } while (sc === OT.sc && OT_SC.length > 1);
    OT.sc = sc; OT.s = sc.init(); xLog(sc.title + ': event started'); renderOT();
  }
  function otData() { const [id, ctl] = OT.sc.ecg(OT.s), k = 'ot' + id + JSON.stringify(ctl); return dCache[k] || (dCache[k] = E.synth(LB.byId[id], { dur: 20, ctl })); }
  function renderOT() {
    stopLive(); const sc = OT.sc;
    main.innerHTML = xShell('OT · ' + sc.title, sc.story);
    const box = $('#dbox'), W = Math.max(280, box.clientWidth || 340), leads = sc.k === 'sux' ? [IDX.II, IDX.V3] : [IDX.II];
    startLive($('#dc'), { W, leads, rowMM: leads.length > 1 ? 26 : 34, T: X.T, get: otData, playing: () => true, exMM: 13, extra: () => { const v = OT.sc.vit(OT.s).find(x => x[0] === 'BP'); const m = v && /^(\d+)\/(\d+)$/.exec(String(v[1])); return [chans(hemo(otData(), m ? { pf: 1, sys: +m[1], dia: +m[2], spo2: 97 } : { pf: 0 }), 150, v ? String(v[1]) : '', '')[0]]; } });
    otCtl(); stopXT(); if (!X.done) X.iv = setInterval(otTick, 1000);
  }
  function otVits() {
    const v = $('#xvits'); if (!v) return;
    v.innerHTML = OT.sc.vit(OT.s).map((x, i, arr) => `<div class="${arr.length === 5 && i === 4 ? 'wide' : ''}"><small>${x[0]}</small><b class="${/ARREST|ASYSTOLE|APNOEA|ON$/.test(String(x[1])) ? 'warnt' : ''}">${x[1]}</b></div>`).join('');
    const c = $('#dclock'); if (c) c.textContent = dfmt(X.t); const st = $('#dstat'); if (st) st.textContent = X.done ? 'Finished' : 'Theatre';
  }
  function otTick() {
    if (!$('#dclock')) { stopXT(); return; }
    X.t++; const r = OT.sc.tick(OT.s);
    if (r) { xEnd(r[0], r[1]); return; }
    if (LIVE.o) LIVE.o.redraw(); otVits(); if (X.t % 5 === 0) { const l = $('.dlog'); if (l) l.outerHTML = xLogHTML(); }
  }
  function otCtl() {
    const el = $('#xctl'); if (!el) return;
    if (X.done) { el.innerHTML = xSummary(OT.sc.teach, 'ot'); otVits(); return; }
    el.innerHTML = `<div class="dgrid">${OT.sc.acts.map(([k, t, c]) => `<button class="dbtn ${c || ''}" data-ot="${k}">${t}</button>`).join('')}</div>
      <div class="row dcount"><span class="pill">Score <b>${X.score}</b></span></div>${xLogHTML()}`;
    otVits();
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'drill') return;
    const b = ev.target.closest('[data-ot]'); if (b && !X.done && X.kind === 'ot') { OT.sc.act(OT.s, b.dataset.ot); if (LIVE.o) LIVE.o.redraw(); otCtl(); return; }
    const x = ev.target.closest('[data-x="ot"]'); if (x) startOT();
  });

  /* ---------- style / settings ---------- */
  function themeSVG(t) {
    const [bg, card, ac, tr] = t.sw;
    return `<svg viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><rect width="120" height="34" fill="${bg}"/><rect x="6" y="6" width="38" height="22" rx="5" fill="${card}"/><circle cx="104" cy="17" r="7" fill="${ac}"/><path d="M8 18h8l3-9 5 17 4-12 3 4h12" fill="none" stroke="${tr}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="52" y="12" width="36" height="4" rx="2" fill="${ac}" opacity=".85"/><rect x="52" y="20" width="26" height="3" rx="1.5" fill="${tr}" opacity=".35"/></svg>`;
  }
  function renderSet() {
    const optSeg = (key, vals, cur, fmt) => `<div class="seg" data-set="${key}">${vals.map(v => `<button data-val="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${fmt ? fmt(v) : v}</button>`).join('')}</div>`;
    main.innerHTML = `<div class="stack">
      <div><h2 class="sh">Theme</h2><div class="themes" id="themes">${THEMES.map(t => `<button class="th ${S.theme === t.id ? 'on' : ''}" data-theme="${t.id}">${themeSVG(t)}<b>${t.name}</b>${t.tag ? `<small>${t.tag}</small>` : ''}</button>`).join('')}</div></div>
      <div><h2 class="sh">Font</h2><div class="fonts" id="fonts">${FONTS.map(f => `<button class="fn ${S.font === f[0] ? 'on' : ''}" data-font="${f[0]}"><b style="font-family:'${f[0]}',sans-serif">${f[0]}</b><small>${f[2] || 'Aa Bb 0123'}</small></button>`).join('')}</div></div>
      <div class="panel"><h2 class="sh" style="margin-top:0">ECG display</h2>
        <div class="setrow"><span>Paper<small>Classic pink paper regardless of theme</small></span>${optSeg('paper', ['theme', 'classic'], S.paper, v => v === 'theme' ? 'Theme' : 'Classic')}</div>
        <div class="setrow"><span>Realistic noise<small>Baseline drift and fine hiss</small></span>${optSeg('noise', [1, 0], S.noise ? 1 : 0, v => v ? 'On' : 'Off')}</div>
        <div class="setrow"><span>ECG style<small>Real-world: breathing changes QRS height, beat-to-beat variation, wandering baseline</small></span>${optSeg('real', [0, 1], S.real ? 1 : 0, v => v ? 'Real-world' : 'Textbook')}</div>
        <div class="setrow"><span>Trace weight</span>${optSeg('lw', ['t', 'n', 'b'], S.lw, v => ({ t: 'Thin', n: 'Normal', b: 'Bold' })[v])}</div>
        <div class="setrow"><span>Paper speed<small>Live and stack views</small></span>${optSeg('speed', [25, 50], S.speed, v => v + ' mm/s')}</div>
        <div class="setrow"><span>Gain</span>${optSeg('gain', [5, 10, 20], S.gain, v => v + ' mm/mV')}</div></div>
      <div class="panel" id="flagp"><h2 class="sh" style="margin-top:0">Flagged items · ${Object.keys(S.flags).length}</h2>
        ${Object.keys(S.flags).length ? `<p class="hint" style="padding:0 0 8px">Copy this list and send it to Claude to fix the problems you found.</p><textarea class="flagout" rows="8" readonly>${esc(flagText())}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn pri" data-fcopy>Copy list</button><button class="btn" data-fclear>Clear all</button></div>` : '<p class="hint" style="padding:0">Use the ⚑ button on any ECG or question to mark something that looks wrong.</p>'}</div>
      <div class="panel"><h2 class="sh" style="margin-top:0">Library layout</h2>
        <div class="setrow"><span>Default card size</span>${optSeg('size', ['s', 'm', 'l'], S.size, v => v.toUpperCase())}</div>
        <div class="setrow"><span>Reset layout<small>Clears custom order and per-card sizes</small></span><button class="btn" data-reset>Reset</button></div></div>
    </div>`;
    if (document.fonts) FONTS.forEach(f => loadFont(f[0]));
  }
  main.addEventListener('click', ev => {
    if (R.tab !== 'set') return;
    const t = ev.target, th = t.closest('[data-theme]');
    if (th) { S.theme = th.dataset.theme; save(); applyTheme(); renderSet(); return; }
    const fn = t.closest('[data-font]'); if (fn) { S.font = fn.dataset.font; save(); applyFont(); $$('#fonts .fn').forEach(b => b.classList.toggle('on', b.dataset.font === S.font)); return; }
    if (t.closest('[data-fcopy]')) { const ta = $('.flagout'); ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } try { if (navigator.clipboard) { navigator.clipboard.writeText(ta.value).then(() => {}, () => {}); ok = true; } } catch (e) { /* ignore */ } t.closest('[data-fcopy]').textContent = ok ? 'Copied' : 'Selected: copy it'; return; }
    if (t.closest('[data-fclear]')) { const b = t.closest('[data-fclear]'); if (b.dataset.sure) { S.flags = {}; save(); renderSet(); } else { b.dataset.sure = 1; b.textContent = 'Tap again to clear'; } return; }
    if (t.closest('[data-reset]')) { S.sizes = {}; S.order = []; S.sort = 'az'; save(); t.closest('[data-reset]').textContent = 'Done'; return; }
    const sg = t.closest('[data-set] [data-val]');
    if (sg) {
      const key = sg.parentElement.dataset.set, raw = sg.dataset.val;
      if (key === 'real') { setReal(raw === '1'); renderSet(); return; }
      if (key === 'noise') S.noise = raw === '1'; else if (key === 'speed' || key === 'gain') S[key] = Number(raw); else S[key] = raw;
      save(); if (key === 'paper') readCol();
      if (key === 'size') S.sizes = {};
      $$('button', sg.parentElement).forEach(b => b.classList.toggle('on', b === sg));
    }
  });

  /* ---------- tabs & lifecycle ---------- */
  function showTab(tab) {
    if (R.tab === 'drill' && tab !== 'drill') { if (LIVE.o) { D.T = LIVE.o.T; P.T = LIVE.o.T; K.T = LIVE.o.T; X.T = LIVE.o.T; } stopDrillTimer(); stopPeriTimer(); stopKTimer(); }
    R.tab = tab; R.arrange = false; stopMonitor(); stopLive(); stopOspeTimer(); LBL = null;
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#sub').textContent = { lib: '12-lead simulator', quiz: 'Test your reading', drill: 'ACLS drills', learn: 'Physiology and electrodes', set: 'Themes and fonts' }[tab];
    if (tab === 'lib') { renderLib(); $('#count').hidden = false; } else { $('#count').hidden = true; }
    if (tab === 'quiz') renderQuiz();
    if (tab === 'drill') { if (D.run) renderDrill(); else if (P.run) renderPeri(); else if (K.run) renderK(); else if (X.run) X.render(); else drillHome(); }
    if (tab === 'set') renderSet();
    if (tab === 'learn') renderLearn();
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', ev => { const b = ev.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

  function redrawAll() {
    readCol();
    if (R.tab === 'lib') scheduleMinis();
    if (R.tab === 'quiz' && Q.id) renderQuiz();
    if (viewer.classList.contains('open')) drawViewerStage();
  }
  let rz = 0, lastW = window.innerWidth;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; redrawAll(); } }, 180); });
  window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && viewer.classList.contains('open')) closeViewer(); });

  applyTheme(); applyFont(); showTab('lib');
  window.__ecglab = { S, LIB, data, showTab, openViewer, D, Q, P, V, K, kTrue: () => kTrue(), kEff: () => kEff() };
})();
