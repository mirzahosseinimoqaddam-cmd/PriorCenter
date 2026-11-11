'use strict';
// NEON shell: renderer, input, screens (Play / Create / Me), results, previews, reminders. Fully offline.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cv = $('#cv'), ctx = cv.getContext('2d');
let S = 1, OX = 0, OY = 0, GLOW = 1;
function fit() { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; S = Math.min(cv.width / W, cv.height / H); OX = (cv.width - W * S) / 2; OY = (cv.height - H * S) / 2 }
addEventListener('resize', fit); fit();
const VIEW = { ghost: 0, drunk: 0, flip: 0, t: 0 };

// draws a frame list onto any canvas: the game screen or a card preview
function draw(c, cw, ch, dl, sc, ox, oy, o = {}) {
  const gl = o.glow ?? (SET.glow ? 6 * sc * GLOW : 0), big = SET.big ? 1.15 : 1;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = o.ghost ? 'rgba(4,0,14,.28)' : '#04000e'; c.fillRect(0, 0, cw, ch);
  let sx = 0, sy = 0; if (o.shake) { sx = rnd(-o.shake, o.shake) * sc; sy = rnd(-o.shake, o.shake) * sc }
  c.setTransform(sc, 0, 0, sc, ox + sx, oy + sy);
  if (o.flip || o.drunk) { c.translate(W / 2, H / 2); if (o.flip) c.scale(1, -1); if (o.drunk) { c.rotate(sin(VIEW.t * 1.3) * .12); c.scale(1 + sin(VIEW.t * .9) * .05, 1) } c.translate(-W / 2, -H / 2) }
  if (!o.ghost) { c.strokeStyle = 'rgba(140,50,255,.12)'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= W; x += 40) { c.moveTo(x, 0); c.lineTo(x, H) } for (let y = 0; y <= H; y += 40) { c.moveTo(0, y); c.lineTo(W, y) } c.stroke() }
  c.strokeStyle = 'rgba(255,43,214,.45)'; c.lineWidth = 1.5; c.strokeRect(0, 0, W, H);
  c.lineCap = c.lineJoin = 'round';
  for (const op of dl) {
    const k = op[0];
    if (k == 4) { c.font = `bold ${op[4] * big}px ui-monospace,Menlo,Consolas,monospace`; c.textAlign = op[6]; c.textBaseline = 'middle'; c.fillStyle = c.shadowColor = op[5]; c.shadowBlur = gl; c.save(); if (o.flip) { c.translate(op[2], op[3]); c.scale(1, -1); c.fillText(op[1], 0, 0) } else c.fillText(op[1], op[2], op[3]); c.restore(); continue }
    const col = k == 0 ? op[5] : k == 1 ? op[4] : k == 2 ? op[5] : op[2], f = k == 1 ? op[5] : k == 2 ? op[6] : k == 3 ? op[4] : 0;
    c.strokeStyle = c.shadowColor = col; c.shadowBlur = gl; c.beginPath();
    if (k == 0) { c.lineWidth = op[6]; c.moveTo(op[1], op[2]); c.lineTo(op[3], op[4]) }
    else if (k == 1) { c.lineWidth = op[6]; c.arc(op[1], op[2], Math.max(0, op[3]), 0, TAU) }
    else if (k == 2) { c.lineWidth = op[7]; c.rect(op[1], op[2], op[3], op[4]) }
    else { const p = op[1]; c.lineWidth = op[5]; c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); if (op[3]) c.closePath() }
    if (f) { c.globalAlpha = f == 2 ? 1 : f == 1 ? .22 : f; c.fillStyle = col; c.fill(); c.globalAlpha = 1 }
    c.stroke();
  }
  if (o.flash > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = Math.min(.35, o.flash); c.fillStyle = o.flashCol; c.shadowBlur = 0; c.fillRect(0, 0, cw, ch); c.globalAlpha = 1 }
}
const render = dl => draw(ctx, cv.width, cv.height, dl, S, OX, OY, { ...VIEW, shake: SET.calm ? 0 : FX.shake, flash: SET.calm ? 0 : FX.flash, flashCol: FX.col });

// ---- input: touch (split in two halves for 2 players on one phone), keyboard, gamepads
let ZONES = 0, MIRROR = 0;
const KM = [{ u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', a: ['Space', 'KeyF'] }, { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight', a: ['Enter', 'KeyL', 'ShiftRight'] }];
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (!KEYS[e.code]) KP[e.code] = 1; KEYS[e.code] = 1;
  if (R && /Arrow|Space|Enter/.test(e.code)) e.preventDefault();
  if (e.code == 'Escape') { if (R) PAUSED ? resume() : pause(); else closeSheet() }
});
addEventListener('keyup', e => KEYS[e.code] = 0);
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = 0 });
const TCH = new Map(), PADP = ['', ''];
function toWorld(e) { const r = cv.getBoundingClientRect(), k = cv.width / r.width; let x = ((e.clientX - r.left) * k - OX) / S, y = ((e.clientY - r.top) * k - OY) / S; if (VIEW.flip) y = H - y; return { x, y } }
cv.addEventListener('pointerdown', e => { e.preventDefault(); const w = toWorld(e); TCH.set(e.pointerId, { p: ZONES && w.y < H / 2 ? 1 : 0, sx: w.x, sy: w.y, x: w.x, y: w.y }); try { cv.setPointerCapture(e.pointerId) } catch (_) { } });
cv.addEventListener('pointermove', e => { const t = TCH.get(e.pointerId); if (t) { const w = toWorld(e); t.x = w.x; t.y = w.y } });
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => TCH.delete(e.pointerId));
reOrigin = (i, dx, dy) => { for (const t of TCH.values()) if (t.p == i || !ZONES) { if (dx == null) { t.sx = t.x; t.sy = t.y } else { t.sx += dx; t.sy += dy } } };
function readLocal(i, all) {
  let x = 0, y = 0, a = 0, tx = null, ty = null, touch = 0, rx = 0, ry = 0, dp = ''; const pts = [];
  KM.forEach((m, j) => { if (!all && j != i) return; x += (KEYS[m.r] | 0) - (KEYS[m.l] | 0); y += (KEYS[m.d] | 0) - (KEYS[m.u] | 0); if (m.a.some(k => KEYS[k])) a = 1; for (const d of 'udlr') if (KP[m[d]]) dp = d });
  for (const t of TCH.values()) if (all || t.p == i) { rx = t.x - t.sx; ry = t.y - t.sy; x += clamp(rx / 30, -1, 1); y += clamp(ry / 30, -1, 1); a = 1; tx = t.x; ty = t.y; touch = 1; pts.push([t.x, t.y]) }
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [], pad = all ? pads[0] : pads[i];
  if (pad) {
    const ax = pad.axes, b = pad.buttons.map(b => b.pressed); let px = abs(ax[0]) > .25 ? ax[0] : 0, py = abs(ax[1]) > .25 ? ax[1] : 0;
    if (b[14]) px = -1; if (b[15]) px = 1; if (b[12]) py = -1; if (b[13]) py = 1; x += px; y += py; if (b[0] || b[1] || b[2] || b[3]) a = 1;
    const d = py < -.5 ? 'u' : py > .5 ? 'd' : px < -.5 ? 'l' : px > .5 ? 'r' : ''; if (d && d != PADP[i]) dp = d; PADP[i] = d;
  }
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), a, tx, ty, touch, rx, ry, dp, pts };
}
const NONE = { x: 0, y: 0, a: 0, tx: null, ty: null, touch: 0, rx: 0, ry: 0, dp: '', pts: [] };
function poll() {
  for (let i = 0; i < 2; i++) {
    const I = P[i]; let n = i == 1 && !ZONES ? NONE : readLocal(i, !ZONES);
    if (MIRROR) n = { ...n, x: -n.x, tx: n.tx == null ? null : W - n.tx, rx: -n.rx, dp: n.dp == 'l' ? 'r' : n.dp == 'r' ? 'l' : n.dp, pts: n.pts.map(([x, y]) => [W - x, y]) };
    I.ap = n.a && !I.a; I.ar = !n.a && I.a; Object.assign(I, n);
  }
}

// ---- small UI helpers
const palOf = c => { const n = Object.keys(PALS).filter(k => k != 'SAFE'); return SET.cb ? PALS.SAFE : PALS[c.pal] || PALS[n[hash(c.name || c.e) % n.length]] };
const fmtT = s => s >= 3600 ? `${s / 3600 | 0}${t('h')} ${(s % 3600) / 60 | 0}${t('m')}` : `${Math.max(s ? 1 : 0, s / 60 | 0)}${t('m')}`;
const groupOf = c => c.mine ? 'mine' : c.mix ? 'mix' : c.e;
const groupTitle = k => k == 'mine' ? t('mine') : k == 'mix' ? (fa() ? 'ترکیبی‌ها' : 'Mashups') : E[k].t;
function sheet(html, cls = '') { const b = $('#box'); b.className = 'box ' + cls; b.innerHTML = html; $('#ov').hidden = false; b.scrollTop = 0; return b }
const closeSheet = () => { $('#ov').hidden = true };
$('#ov').addEventListener('click', e => { if (e.target.id == 'ov' && !R) closeSheet() });
const btn = (label, fn, cls = '') => { const e = document.createElement('button'); e.className = 'nb ' + cls; e.innerHTML = label; e.onclick = fn; return e };
function toast(html, col = '#39ff14') { const d = document.createElement('div'); d.className = 'toast'; d.style.setProperty('--c', col); d.innerHTML = html; $('#toasts').append(d); setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3100) }
function confirmDlg(q, yes) { const b = sheet(`<h2>${esc(t('sure'))}</h2><p>${esc(q)}</p>`); b.append(btn(t('yesDel'), yes, 'red'), btn(t('cancel'), closeSheet, 'dim')) }

// ---- live previews on game cards: run the game silently for a moment and draw one frame
const PREV = new Map(), PQ = [];
function preview(c, canvas) {
  if (PREV.has(c.name)) { paintPrev(canvas, PREV.get(c.name)); return }
  PQ.push([c, canvas]); if (PQ.length == 1) setTimeout(runPrev, 30);
}
function runPrev() {
  const job = PQ.shift(); if (!job) return;
  const [c, canvas] = job;
  if (!PREV.has(c.name)) {
    const keep = [DL, PT, SQ, P.map(p => ({ ...p })), FX.shake, FX.flash]; MUTE = 1;
    try {
      const r = makeRun({ ...c, mods: (c.mods || []).filter(m => m != 'flip' && m != 'drunk') }, modesOf(c)[0] == 'hot' ? 'solo' : modesOf(c)[0]);
      const seed = hash(c.name); PT = [];
      for (let f = 0; f < 70; f++) { for (const I of P) Object.assign(I, NONE, { x: sin(f / 9 + seed) , ap: f % 23 == 5 ? 1 : 0, a: f % 23 < 9 ? 1 : 0 }); DL = []; r.tick(1 / 30); parts(1 / 30); if (r.g.over) break }
      PREV.set(c.name, DL);
    } catch (e) { PREV.set(c.name, []) }
    [DL, PT, SQ] = keep; keep[3].forEach((p, i) => Object.assign(P[i], p)); FX.shake = keep[4]; FX.flash = keep[5]; MUTE = 0;
  }
  paintPrev(canvas, PREV.get(c.name));
  if (PQ.length) setTimeout(runPrev, 16);
}
function paintPrev(canvas, dl) {
  const d = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth || 140, h = canvas.clientHeight || 100; canvas.width = w * d; canvas.height = h * d;
  const sc = canvas.width / W; draw(canvas.getContext('2d'), canvas.width, canvas.height, dl.filter(o => o[0] != 4 || o[4] > 20), sc, 0, (canvas.height - H * sc) / 2, { glow: 3 * sc });
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); const c = CAT.find(x => x.name == e.target.dataset.n); if (c) preview(c, e.target) } }, { rootMargin: '200px' }) : null;
const prevCanvas = c => { const el = document.createElement('canvas'); el.className = 'pv'; el.dataset.n = c.name; if (io) io.observe(el); else setTimeout(() => preview(c, el)); return el };

// ---- PLAY tab
let CAT = [], CATF = 'all', TAB = 'play', SEARCH = '';
const daily = () => { const L = CAT.filter(c => !c.mine && !c.mix && vsOf(c) != 1 && isOpen(c.e)); return L[hash(dayKey()) % L.length] };
const groups = () => { const G = new Map(); for (const c of CAT) { const k = groupOf(c); if (k == 'mine') continue; if (!G.has(k)) G.set(k, []); G.get(k).push(c) } return G };
function card(k, vs, big) {
  const c = vs[0], el = document.createElement('button'), open = isOpen(k), st = vs.reduce((a, v) => { const s = statOf(v.name); a.t += s.t; a.b = Math.max(a.b, s.b); return a }, { t: 0, b: 0 });
  el.className = 'card' + (big ? ' big' : '') + (open ? '' : ' locked'); el.style.setProperty('--c', palOf(c)[0]);
  el.append(prevCanvas(c));
  el.insertAdjacentHTML('beforeend', `<div class=ct><b>${esc(groupTitle(k))}</b><small>${open ? (st.t ? '⏱ ' + fmtT(st.t) : esc(t(E[c.e].c))) + (st.b ? ' · ★' + st.b : '') : '🔒 ' + esc(t('locked')) + ' ' + unlockLevel(k)}</small></div>`);
  el.onclick = () => open ? openGame(k) : toast(`🔒 ${esc(t('locked'))} ${unlockLevel(k)}`, '#8a84b8');
  return el;
}
function renderPlay() {
  const m = $('#play'); m.innerHTML = ''; CAT = catalog();
  const L = lvlOf(PR.xp), need = lvlXP(L + 1) - lvlXP(L), have = PR.xp - lvlXP(L), st = streak();
  m.insertAdjacentHTML('beforeend', `<div class=hello><div class=stk>${st ? '🔥 ' + st + ' ' + esc(t('streak')) : '✦ NEON'}</div><div class=lv><span>${esc(t('level'))} ${L}</span><i style="width:${(have / need * 100).toFixed(0)}%"></i></div></div>`);
  // continue: your most recent game
  const last = Object.entries(PR.g).sort((a, b) => b[1].last - a[1].last)[0], lc = last && CAT.find(c => c.name == last[0]);
  if (lc && !SEARCH) {
    const s = statOf(lc.name), el = document.createElement('button'); el.className = 'hero'; el.style.setProperty('--c', palOf(lc)[0]); el.append(prevCanvas(lc));
    el.insertAdjacentHTML('beforeend', `<div class=ct><small>${esc(t('recent'))}</small><b>${esc(lc.name)}</b><small>${E[lc.e].lv && s.lv ? esc(t('lvl')) + ' ' + (s.lv + 1) + ' · ' : ''}⏱ ${fmtT(s.t)}${s.b ? ' · ★' + s.b : ''}</small></div><span class=go>▶</span>`);
    el.onclick = () => openGroup(groupOf(lc), lc.name); m.append(el);
  }
  if (!SEARCH) { const d = daily(), b = load('neon.daily.' + dayKey(), 0), el = document.createElement('button'); el.className = 'hero daily'; el.style.setProperty('--c', '#fff01f'); el.append(prevCanvas(d)); el.insertAdjacentHTML('beforeend', `<div class=ct><small>☀ ${esc(t('daily'))}</small><b>${esc(d.name)}</b><small>${b ? esc(t('today')) + ' ★' + b : esc(t('dailySub'))}</small></div><span class=go>▶</span>`); el.onclick = () => openGroup(groupOf(d), d.name, 1); m.append(el) }
  const G = groups();
  if (!SEARCH) { m.insertAdjacentHTML('beforeend', `<h3>${esc(t('featured'))}</h3>`); const row = document.createElement('div'); row.className = 'row'; for (const k of FEATURED) if (G.has(k)) row.append(card(k, G.get(k), 1)); m.append(row) }
  m.insertAdjacentHTML('beforeend', `<h3>${esc(t('cats'))}</h3>`);
  const likes = load('neon.fav', []), cats = ['all', 'arcade', 'puzzle', 'party', 'sport', ...(likes.length ? ['favs'] : [])];
  const seg = document.createElement('div'); seg.className = 'seg'; for (const k of cats) seg.append(btn(esc(t(k)), () => { CATF = k; renderPlay() }, k == CATF ? 'on' : '')); m.append(seg);
  const grid = document.createElement('div'); grid.className = 'grid'; const q = SEARCH.toUpperCase();
  const list = [...G].filter(([k, vs]) => (CATF == 'all' || (CATF == 'favs' ? vs.some(v => likes.includes(v.name)) : k != 'mix' && E[k].c == CATF)) && (!q || (groupTitle(k) + ' ' + vs.map(v => v.name).join(' ')).toUpperCase().includes(q)));
  list.sort((a, b) => isOpen(b[0]) - isOpen(a[0]));
  for (const [k, vs] of list) grid.append(card(k, vs));
  if (!list.length) grid.innerHTML = `<p class=dim>${esc(t('nothing'))}</p>`;
  m.append(grid);
}

// ---- game sheet: one big PLAY, optional continue, 2 players, difficulty, other versions
function openGame(k) { const vs = CAT.filter(c => groupOf(c) == k); const fav = vs.find(v => statOf(v.name).last) ; openGroup(k, (vs.slice().sort((a, b) => statOf(b.name).last - statOf(a.name).last)[0] || fav || vs[0]).name) }
function openGroup(k, sel, isDaily, showVers) {
  const vs = CAT.filter(c => groupOf(c) == k); if (!vs.length) return;
  const c = vs.find(x => x.name == sel) || vs[0], m = modesOf(c), s = statOf(c.name), lv = E[c.e].lv && !c.mix ? s.lv : 0, liked = load('neon.fav', []).includes(c.name);
  const b = sheet(`<div class=sh><canvas class=pv></canvas><button class="heart${liked ? ' on' : ''}" title="like">${liked ? '♥' : '♡'}</button></div>
    <h2>${esc(isDaily ? '☀ ' + c.name : c.name)}</h2><p class=dim>${esc(hint(c.e))}${c.mix ? ' ' + esc(hint(c.mix)) : ''}</p>
    <div class=stats>${s.p ? `<span>★ ${s.b || (s.w + '–' + s.l)}</span><span>⏱ ${fmtT(s.t)}</span><span>▶ ${s.p}</span>` : ''}</div>`, 'game');
  preview(c, b.querySelector('canvas'));
  b.querySelector('.heart').onclick = () => { const f = load('neon.fav', []).filter(n => n != c.name); if (!liked) f.unshift(c.name); save('neon.fav', f); openGroup(k, c.name, isDaily, showVers) };
  const first = m[0], go = (mode, from) => { closeSheet(); startGame(c, mode, isDaily, from) };
  if (lv > 0) { b.append(btn(`▶ ${esc(t('cont'))} ${lv + 1}`, () => go(first, lv), 'big')); b.append(btn(esc(t('over')), () => go(first, 0), 'dim')) }
  else b.append(btn(`▶ ${esc(first == 'cpu' ? t('cpu') : t('play'))}`, () => go(first, 0), 'big'));
  if (m.includes('cpu')) { const seg = document.createElement('div'); seg.className = 'seg small'; ['easy', 'normal', 'hard'].forEach((d, i) => seg.append(btn(esc(t(d)), () => { SET.diff = i; save('neon.set', SET); openGroup(k, c.name, isDaily, showVers) }, (SET.diff ?? 1) == i ? 'on' : ''))); b.append(seg) }
  const twoMode = m.find(x => x == 'local' || x == 'hot'); if (twoMode) b.append(btn(`👥 ${esc(t(twoMode))}`, () => go(twoMode, 0), 'ghost'));
  if (m.includes('solo') && m.includes('cpu')) b.append(btn(`🤖 ${esc(t('cpu'))}`, () => go('cpu', 0), 'ghost'));
  if (vs.length > 1 && !isDaily) {
    const more = btn(`${showVers ? '▾' : '▸'} ${esc(t('versions'))} (${vs.length})`, () => openGroup(k, c.name, isDaily, !showVers), 'link'); b.append(more);
    if (showVers) { const l = document.createElement('div'); l.className = 'vlist'; for (const v of vs) { const vs_ = statOf(v.name); l.append(btn(`<span>${esc(v.name)}</span><small>${vs_.b ? '★' + vs_.b : ''}</small>`, () => openGroup(k, v.name, 0, 1), v === c ? 'on' : '')) } b.append(l) }
  }
  const tools = document.createElement('div'); tools.className = 'tools';
  if (c.mine) tools.append(btn('✎ ' + esc(t('edit')), () => creator(c), 'link'), btn('⇪ ' + esc(t('share')), () => shareCode(c), 'link'), btn('🗑 ' + esc(t('del')), () => confirmDlg(c.name, () => { save('neon.my', load('neon.my', []).filter(x => x.id != c.id)); closeSheet(); go_(TAB) }), 'link'));
  else tools.append(btn('✎ ' + esc(t('remix')), () => creator({ ...c, name: c.name + ' REMIX', id: 0 }), 'link'));
  b.append(tools);
}

// ---- running a game
let R = null, PAUSED = 0, last = 0, slow = 0;
function startGame(c, mode, isDaily, from = 0) {
  R = { c, mode, res: [], daily: isDaily, from }; ZONES = mode == 'local' && vsOf(c) ? 1 : 0; TCH.clear();
  $('#game').classList.add('on'); newRound();
}
function newRound() {
  closeSheet(); const c = R.c, m = c.mods || [];
  PT = []; DL = []; SQ = []; PAUSED = 0; MIRROR = m.includes('mirror'); FX.shake = FX.flash = 0;
  Object.assign(VIEW, { ghost: m.includes('ghost'), drunk: m.includes('drunk') && !SET.calm, flip: m.includes('flip') });
  Object.assign(R, makeRun({ ...c, lv0: R.from || 0 }, R.mode == 'hot' ? 'solo' : R.mode, SET.diff ?? 1), { done: 0, hint: 3, t0: performance.now(), play: 0 });
  for (const I of P) Object.assign(I, NONE, { ap: 0, ar: 0 });
}
function hud(dt) {
  const g = R.g; tx(g.hud || 'SCORE ' + g.score, W / 2, 14, 12, g.K.e);
  if (R.mode == 'hot') tx(`P${R.res.length + 1}`, 30, 34, 12, R.res.length ? g.K.b : g.K.a);
  if ((R.hint -= dt) > 0) { const h = hint(R.c.e) + (ZONES ? (fa() ? ' · بازیکن ۲ نیمهٔ بالا' : ' · P2 plays on the top half') : ''), cut = h.length > 34 ? h.lastIndexOf(' ', 34) : -1; tx(cut > 0 ? h.slice(0, cut) : h, W / 2, H - 50, 13, '#fff'); if (cut > 0) tx(h.slice(cut + 1), W / 2, H - 32, 13, '#fff') }
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000 || 0, 0, .05); last = now;
  if (!R) return;
  VIEW.t += dt;
  if (!PAUSED && !R.g.over && dt > 0) {
    slow = slow * .97 + (dt > 1 / 40 ? .03 : 0); GLOW = slow > .5 ? .35 : 1; // a slow phone gets lighter glow automatically
    poll(); DL = []; R.play += dt;
    try { R.tick(dt); parts(dt); hud(dt) }
    catch (e) { console.error(e); save('neon.crash', [String(e && e.stack || e).slice(0, 400), ...load('neon.crash', [])].slice(0, 5)); R.g.over = 1; R.g.msg = 'OOPS'; R.err = 1 }
    FX.shake = Math.max(0, FX.shake - dt * 30); FX.flash = Math.max(0, FX.flash - dt);
  }
  if (R.g.over && !R.done) { R.done = 1; const g = R.g; setTimeout(() => { if (R && R.g === g) gameOver() }, 800) }
  render(DL);
  for (const k in KP) delete KP[k];
}
function gameOver() {
  const c = R.c, g = R.g; buzz(60);
  if (R.err) { const b = sheet(`<h2>OOPS</h2><p>${esc(t('oops'))}</p>`); b.append(btn('↻ ' + esc(t('again')), newRound, 'big'), btn(esc(t('menu')), quit, 'dim')); return }
  const res = record(c, { mode: R.mode, secs: Math.round(R.play), score: g.score, win: vsOf(c) && R.mode == 'cpu' ? g.win : undefined, level: E[c.e].lv && !c.mix ? g.level : undefined, daily: R.daily, diff: SET.diff });
  if (R.daily) { const k = 'neon.daily.' + dayKey(); if (g.score > load(k, 0)) save(k, g.score) }
  if (!vsOf(c)) save('neon.best.' + c.name, Math.max(load('neon.best.' + c.name, 0), g.score));
  remind();
  let title = g.msg || 'GAME OVER', sub = '';
  if (R.mode == 'hot') {
    R.res.push(g.score);
    if (R.res.length == 1) { const b = sheet(`<h2>P1 · ${g.score}</h2><p>${esc(t('pass'))}</p>`, 'res'); b.append(btn('▶ ' + esc(t('p2go')), newRound, 'big'), btn(esc(t('menu')), quit, 'dim')); return }
    const [a, b2] = R.res; R.res = []; title = a == b2 ? t('draw') : a > b2 ? t('p1w') : t('p2w'); sub = `P1 ${a} · P2 ${b2}`;
  } else if (vsOf(c) && R.mode == 'cpu') { const s = statOf(c.name); sub = `${fa() ? 'تو' : 'YOU'} ${s.w} · CPU ${s.l}` }
  else if (!vsOf(c)) sub = res.newBest ? '★ ' + t('newBest') : `${t('best')} ${statOf(c.name).b}`;
  const L = lvlOf(PR.xp), need = lvlXP(L + 1) - lvlXP(L), have = PR.xp - lvlXP(L);
  const b = sheet(`<h2>${esc(title)}</h2><p class=big>${esc(sub)}</p><div class=xp><span>+${res.xp} ${esc(t('xp'))}</span><div class=lv><span>${esc(t('level'))} ${L}</span><i style="width:${(have / need * 100).toFixed(0)}%"></i></div></div>`, 'res');
  b.append(btn('↻ ' + esc(t('again')), () => { if (E[c.e].lv && !c.mix) R.from = statOf(c.name).lv; newRound() }, 'big'), btn(esc(t('menu')), quit, 'dim'));
  if (res.newBest) toast('★ ' + esc(t('newBest')), '#fff01f');
  if (res.levelUp) setTimeout(() => toast(`⬆ ${esc(t('levelUp'))} ${res.levelUp}`, '#00f0ff'), 400);
  if (res.unlocked.length) setTimeout(() => toast(`🔓 ${esc(t('unlockedN'))}: ${res.unlocked.map(k => esc(E[k] ? E[k].t : k)).join(', ')}`, '#39ff14'), 900);
  res.trophies.forEach((tr, i) => setTimeout(() => toast(`🏆 ${esc(t('trophy'))}: ${esc(fa() ? tr[3] : tr[1])}`, '#ff2bd6'), 1400 + i * 600));
  if (PR.plays == 1 && window.NeonNative && SET.rem && !load('neon.asked', 0)) setTimeout(askReminders, 1200);
}
function pause() {
  if (!R || R.g.over || PAUSED) return;
  PAUSED = 1; const b = sheet(`<h2>${esc(t('paused'))}</h2><p class=dim>${esc(hint(R.c.e))}</p>`, 'res');
  b.append(btn('▶ ' + esc(t('resume')), resume, 'big'), btn('↻ ' + esc(t('restart')), () => { R.res = []; newRound() }, 'ghost'), btn(esc(t('menu')), quit, 'dim'));
}
const resume = () => { PAUSED = 0; closeSheet() };
function quit() {
  if (R && R.play > 5 && !R.done) { const c = R.c, g = R.g; record(c, { mode: R.mode, secs: Math.round(R.play), score: g.score, level: E[c.e].lv && !c.mix ? g.level : undefined }); remind() } // time still counts when you leave early
  R = null; PAUSED = 0; closeSheet(); $('#game').classList.remove('on'); go_(TAB);
}
$('#bX').onclick = quit; $('#bP').onclick = pause;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause() });
window.neonBack = () => { if (R) { if (PAUSED) quit(); else if (!$('#ov').hidden) quit(); else pause(); return true } if (!$('#ov').hidden) { closeSheet(); return true } if (TAB != 'play') { go_('play'); return true } return false }; // Android back button

// ---- CREATE tab
function sanitize(x) { // anything from a share code is untrusted
  if (!x || typeof x != 'object' || !E[x.e]) throw new Error('bad game');
  const o = { id: Date.now(), name: String(x.name || 'SHARED GAME').slice(0, 28).toUpperCase(), e: x.e, pal: PALS[x.pal] ? x.pal : 'SYNTH', sp: clamp(+x.sp || 1, .5, 2), sz: clamp(+x.sz || 1, .5, 1.6), mods: Array.isArray(x.mods) ? x.mods.filter(m => MODS[m]).slice(0, 9) : [] };
  const [a, b] = nrOf(x.e); if (Number.isInteger(x.n) && x.n >= a && x.n <= b) o.n = x.n;
  if (E[x.mix] && x.mix != x.e) o.mix = x.mix;
  if (x.e == 'snake' && x.tron) { o.tron = 1; o.vs = 1 }
  return o;
}
const toCode = c => 'NEON1:' + btoa(unescape(encodeURIComponent(JSON.stringify(sanitize(c)))));
const fromCode = s => sanitize(JSON.parse(decodeURIComponent(escape(atob(s.trim().replace(/^NEON1:/, ''))))));
const saveMine = g => { const L = load('neon.my', []).filter(x => x.id != g.id); L.unshift(g); save('neon.my', L); CAT = catalog() };
function shareCode(c) {
  const code = toCode(c); PR.shared++; checkTrophies(); saveProg();
  const b = sheet(`<h2>${esc(t('share'))}</h2><p>${esc(t('shareBody'))}</p><textarea id=sc readonly rows=4>${esc(code)}</textarea>`);
  b.append(btn('⧉ ' + esc(t('copy')), () => { try { navigator.clipboard.writeText(code) } catch (e) { } $('#sc').select(); try { document.execCommand('copy') } catch (e) { } b.querySelector('p').textContent = t('copied') }, 'big'), btn(esc(t('done')), closeSheet, 'dim'));
}
function importDlg() {
  const b = sheet(`<h2>${esc(t('import'))}</h2><p>${esc(t('pasteBody'))}</p><textarea id=ic rows=4 placeholder="NEON1:…"></textarea>`);
  b.append(btn('✔ ' + esc(t('import')), () => { try { const g = fromCode($('#ic').value); saveMine(g); go_('make'); openGroup('mine', g.name) } catch (e) { b.querySelector('p').textContent = t('badCode') } }, 'big'), btn(esc(t('cancel')), closeSheet, 'dim'));
}
function creator(base) {
  const c = { name: 'MY NEON GAME', e: 'pong', mix: '', pal: 'SYNTH', sp: 1, sz: 1, n: 0, mods: [], ...base };
  const eng = Object.entries(E).filter(([k]) => isOpen(k)).sort((a, b) => a[1].t.localeCompare(b[1].t)).map(([k, e]) => `<option value="${k}">${esc(e.t)}</option>`).join('');
  const b = sheet(`<h2>${esc(t('create'))}</h2><div class=form>
    <label>${esc(t('name'))}<input id=cN maxlength=28></label>
    <label>${esc(t('game'))}<select id=cE>${eng}</select></label>
    <label>${esc(t('mixWith'))}<select id=cM><option value="">${esc(t('none'))}</option>${eng}</select></label>
    <label>${esc(t('colors'))}<select id=cP>${Object.keys(PALS).filter(k => k != 'SAFE').map(p => `<option>${p}</option>`).join('')}</select></label>
    <label>${esc(t('speed'))} <output id=oS></output><input id=cS type=range min=.5 max=2 step=.1></label>
    <label>${esc(t('size'))} <output id=oZ></output><input id=cZ type=range min=.5 max=1.6 step=.1></label>
    <label>${esc(t('amount'))}<select id=cA></select></label>
    <label>${esc(t('effects'))}</label><div class=mods>${Object.entries(MODS).map(([k, v]) => `<label><input type=checkbox value=${k}>${esc(v)}</label>`).join('')}</div></div>`);
  b.append(btn('✔ ' + esc(t('savePlay')), () => { const n = read(); saveMine(n); PR.made++; checkTrophies(); saveProg(); go_('make'); openGroup('mine', n.name) }, 'big'), btn('🎲 ' + esc(t('random')), () => fill(randomGame()), 'ghost'), btn(esc(t('cancel')), closeSheet, 'dim'));
  const amt = (e, n) => { const [a, z] = nrOf(e); $('#cA').innerHTML = `<option value=0>${esc(t('dflt'))}</option>` + Array.from({ length: z - a + 1 }, (_, k) => `<option>${a + k}</option>`).join(''); $('#cA').value = n >= a && n <= z ? n : 0 };
  const sync = () => { $('#oS').textContent = '×' + $('#cS').value; $('#oZ').textContent = '×' + $('#cZ').value };
  function fill(x) { $('#cN').value = x.name; $('#cE').value = isOpen(x.e) ? x.e : 'pong'; $('#cM').value = x.mix && isOpen(x.mix) ? x.mix : ''; $('#cP').value = x.pal || 'SYNTH'; $('#cS').value = x.sp || 1; $('#cZ').value = x.sz || 1; amt($('#cE').value, x.n); for (const i of $$('.mods input')) i.checked = (x.mods || []).includes(i.value); sync() }
  function read() {
    const n = +$('#cA').value, x = { id: c.id || Date.now(), name: ($('#cN').value.trim() || 'MY NEON GAME').toUpperCase(), e: $('#cE').value, pal: $('#cP').value, sp: +$('#cS').value, sz: +$('#cZ').value, mods: $$('.mods input:checked').map(i => i.value) };
    if (n) x.n = n; if ($('#cM').value && $('#cM').value != x.e) x.mix = $('#cM').value;
    if (c.tron && x.e == 'snake') { x.tron = 1; x.vs = 1 }
    return x;
  }
  $('#cE').onchange = () => amt($('#cE').value, 0); $('#cS').oninput = $('#cZ').oninput = sync;
  fill(c);
}
function surprise() {
  let c; do c = randomGame(); while (!isOpen(c.e) || (c.mix && !isOpen(c.mix)));
  const b = sheet(`<div class=sh><canvas class=pv></canvas></div><h2>⚡ ${esc(c.name)}</h2><p class=dim>${esc(hint(c.e))} ${c.mix ? esc(hint(c.mix)) : ''}</p>`, 'game'); preview(c, b.querySelector('canvas'));
  b.append(btn('▶ ' + esc(t('play')), () => { closeSheet(); startGame(c, modesOf(c)[0]) }, 'big'), btn('✔ ' + esc(t('save')), () => { const g = { ...c, id: Date.now() }; saveMine(g); PR.made++; checkTrophies(); saveProg(); go_('make') }, 'ghost'), btn('🎲 ' + esc(t('another')), surprise, 'ghost'));
}
function renderMake() {
  const m = $('#make'); m.innerHTML = ''; CAT = catalog();
  const tile = (icon, title, sub, fn, col) => { const e = btn(`<span class=ic>${icon}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>`, fn, 'tile'); e.style.setProperty('--c', col); m.append(e) };
  tile('✚', t('create'), t('createSub'), () => creator(), '#39ff14'); tile('⚡', t('mash'), t('mashSub'), surprise, '#fff01f'); tile('⇩', t('import'), t('importSub'), importDlg, '#00f0ff');
  m.insertAdjacentHTML('beforeend', `<h3>${esc(t('mine'))}</h3>`);
  const mine = CAT.filter(c => c.mine), grid = document.createElement('div'); grid.className = 'grid';
  for (const c of mine) { const el = card('mine', [c]); el.querySelector('b').textContent = c.name; el.onclick = () => openGroup('mine', c.name); grid.append(el) }
  if (!mine.length) grid.innerHTML = `<p class=dim>${esc(t('noMine'))}</p>`;
  m.append(grid);
}

// ---- ME tab: level, streak, play time, week chart, most played, trophies
function renderMe() {
  const m = $('#me'), L = lvlOf(PR.xp), need = lvlXP(L + 1) - lvlXP(L), have = PR.xp - lvlXP(L), st = streak();
  const days = Array.from({ length: 7 }, (_, i) => { const d = Date.now() - (6 - i) * 864e5; return [new Date(d).toLocaleDateString(fa() ? 'fa-IR' : 'en', { weekday: 'narrow' }), (PR.days[dayKey(d)] || 0) / 60] }), mx = Math.max(10, ...days.map(d => d[1]));
  const top = Object.entries(PR.g).sort((a, b) => b[1].t - a[1].t).slice(0, 6);
  m.innerHTML = `<div class=prof><div class=ring style="--p:${(have / need * 100).toFixed(0)}"><b>${L}</b><small>${esc(t('level'))}</small></div>
    <div><div class=big>${st ? '🔥 ' + st + ' ' + esc(t('streak')) : '✦'}</div><small>${need - have} ${esc(t('toNext'))}</small></div></div>
    <div class=kpis><div><b>${fmtT(PR.time)}</b><small>${esc(t('total'))}</small></div><div><b>${PR.plays}</b><small>${esc(t('games'))}</small></div><div><b>${Object.keys(PR.got).length}/${TROPHIES.length}</b><small>${esc(t('trophies'))}</small></div></div>
    <h3>${esc(t('week'))}</h3><div class=bars>${days.map(([d, v]) => `<div><i style="height:${(v / mx * 100).toFixed(0)}%"></i><small>${esc(d)}</small><em>${v >= 1 ? Math.round(v) : ''}</em></div>`).join('')}</div>
    <h3>${esc(t('top'))}</h3>${top.length ? `<div class=tops>${top.map(([n, s]) => `<button data-n="${esc(n)}"><b>${esc(n)}</b><small>⏱ ${fmtT(s.t)} · ▶ ${s.p}${s.b ? ' · ★' + s.b : ''}${s.lv ? ' · ' + esc(t('lvl')) + ' ' + (s.lv + 1) : ''}${s.w + s.l ? ` · ${s.w}–${s.l}` : ''}</small></button>`).join('')}</div>` : `<p class=dim>${esc(t('noStats'))}</p>`}
    <h3>${esc(t('trophies'))}</h3><div class=troph>${TROPHIES.map(tr => `<div class="${PR.got[tr[0]] ? 'got' : ''}"><span>🏆</span><b>${esc(fa() ? tr[3] : tr[1])}</b><small>${esc(fa() ? tr[4] : tr[2])}</small></div>`).join('')}</div>`;
  for (const el of m.querySelectorAll('.tops button')) el.onclick = () => { const c = catalog().find(x => x.name == el.dataset.n); if (c) openGroup(groupOf(c), c.name) };
}

// ---- tabs, header, settings
function go_(tab) {
  TAB = tab; for (const s of $$('.page')) s.classList.toggle('on', s.id == tab); for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.t == tab);
  $('#search').hidden = tab != 'play'; ({ play: renderPlay, make: renderMake, me: renderMe })[tab](); $('main').scrollTop = 0;
}
for (const b of $$('#tabs button')) b.onclick = () => go_(b.dataset.t);
$('#search').oninput = e => { SEARCH = e.target.value.trim(); renderPlay() };
function settings() {
  const row = (k, l, after) => btn(`<span>${esc(l)}</span><b>${SET[k] ? '●' : '○'}</b>`, () => { SET[k] ^= 1; save('neon.set', SET); if (after) after(); settings() }, 'opt' + (SET[k] ? ' on' : ''));
  const b = sheet(`<h2>${esc(t('settings'))}</h2>`);
  b.append(btn(`<span>${esc(t('lang'))}</span><b>${fa() ? 'فارسی' : 'English'}</b>`, () => { SET.lang = fa() ? 'en' : 'fa'; save('neon.set', SET); applyLang(); remind(); go_(TAB); settings() }, 'opt'));
  b.append(row('snd', t('sound')), row('mus', t('music')), row('vib', t('vib')), row('rem', t('rem'), remind));
  if (!window.NeonNative) b.insertAdjacentHTML('beforeend', `<p class=dim>${esc(t('remWeb'))}</p>`);
  b.insertAdjacentHTML('beforeend', `<h3>${esc(t('access'))}</h3>`);
  b.append(row('big', t('big'), applyLang), row('cb', t('cb'), () => PREV.clear()), row('calm', t('calm')), row('all', t('allG')));
  b.append(btn('🔒 ' + esc(t('about')), about, 'ghost'), btn('🗑 ' + esc(t('reset')), () => confirmDlg(t('reset'), () => { for (const k of Object.keys(localStorage)) if (k.startsWith('neon.')) localStorage.removeItem(k); remind(); location.reload() }), 'dim'), btn(esc(t('done')), () => { closeSheet(); go_(TAB) }, 'big'));
}
function about() {
  const crash = load('neon.crash', []);
  const b = sheet(`<h2>NEON ${VERSION}</h2><p>${esc(t('aboutBody'))}</p><p class=dim>${catalog().length} games · ${Object.keys(E).length} types · offline</p>${crash.length ? `<details><summary class=dim>Error log (${crash.length})</summary><textarea rows=5 readonly>${esc(crash.join('\n\n'))}</textarea></details>` : ''}`);
  b.append(btn(esc(t('back')), settings, 'dim'));
}
function welcome() { save('neon.seen', 1); const b = sheet(`<div class=logo>NEON</div><p>${esc(t('welcomeBody'))}</p>`, 'res'); b.append(btn(esc(t('letsGo')), closeSheet, 'big')) }
function askReminders() { save('neon.asked', 1); const b = sheet(`<h2>🔔</h2><p>${esc(t('remAsk'))}</p>`, 'res'); b.append(btn(esc(t('yes')), () => { SET.rem = 1; save('neon.set', SET); try { NeonNative.askPermission() } catch (e) { } remind(); closeSheet() }, 'big'), btn(esc(t('no')), () => { SET.rem = 0; save('neon.set', SET); remind(); closeSheet() }, 'dim')) }
// hand the next week's reminders to Android (it shows them even when the app is closed)
function remind() { try { if (window.NeonNative) NeonNative.plan(JSON.stringify(SET.rem ? planReminders(Date.now(), fa()) : [])) } catch (e) { } }
function applyLang() { document.documentElement.lang = SET.lang; document.documentElement.dir = fa() ? 'rtl' : 'ltr'; document.documentElement.classList.toggle('bigtext', !!SET.big); $('#search').placeholder = t('search'); for (const b of $$('#tabs button')) b.querySelector('span').textContent = t({ play: 'tPlay', make: 'tMake', me: 'tMe' }[b.dataset.t]) }
$('#bSet').onclick = settings;

// ---- music: a soft generative synth loop while a game runs
const VERSION = '3.0';
let mStep = 0;
setInterval(() => {
  if (!SET.mus || !R || PAUSED || R.g.over || document.hidden) return;
  const prog = [[110, 165, 220, 277], [87.3, 131, 175, 220], [131, 196, 262, 330], [98, 147, 196, 247]], ch = prog[(mStep >> 4) % 4], k = mStep++ % 16;
  if (k % 4 == 0) play(ch[0], .3, 'triangle', .03);
  if (k % 2 == 1) play(ch[1 + (k >> 1) % 3] * 2, .12, 'sine', .012);
  if (k == 8) play(ch[3], .6, 'sine', .01);
}, 150);

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname != 'neon.local') navigator.serviceWorker.register('sw.js').catch(() => { });
applyLang(); CAT = catalog(); go_('play'); requestAnimationFrame(loop); remind();
if (!load('neon.seen', 0)) welcome();
