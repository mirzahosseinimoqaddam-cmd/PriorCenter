'use strict';
// NEON shell: renderer, touch/keyboard/gamepad input, menus, creator, online play (PeerJS), offline install.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cv = $('#cv'), ctx = cv.getContext('2d');
let S = 1, OX = 0, OY = 0;
function fit() { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; S = Math.min(cv.width / W, cv.height / H); OX = (cv.width - W * S) / 2; OY = (cv.height - H * S) / 2 }
addEventListener('resize', fit); fit();
const VIEW = { ghost: 0, drunk: 0, flip: 0, t: 0 };

function render(dl) {
  const c = ctx, gl = SET.glow ? 6 * S : 0;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = VIEW.ghost ? 'rgba(4,0,14,.28)' : '#04000e'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(S, 0, 0, S, OX, OY);
  if (VIEW.flip || VIEW.drunk) { c.translate(W / 2, H / 2); if (VIEW.flip) c.scale(1, -1); if (VIEW.drunk) { c.rotate(sin(VIEW.t * 1.3) * .12); c.scale(1 + sin(VIEW.t * .9) * .05, 1) } c.translate(-W / 2, -H / 2) }
  if (!VIEW.ghost) { c.strokeStyle = 'rgba(140,50,255,.12)'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= W; x += 40) { c.moveTo(x, 0); c.lineTo(x, H) } for (let y = 0; y <= H; y += 40) { c.moveTo(0, y); c.lineTo(W, y) } c.stroke() }
  c.strokeStyle = 'rgba(255,43,214,.45)'; c.lineWidth = 1.5; c.strokeRect(0, 0, W, H);
  c.lineCap = c.lineJoin = 'round';
  for (const o of dl) {
    const k = o[0];
    if (k == 4) { c.font = `bold ${o[4]}px ui-monospace,Menlo,Consolas,monospace`; c.textAlign = o[6]; c.textBaseline = 'middle'; c.fillStyle = c.shadowColor = o[5]; c.shadowBlur = gl; c.save(); if (VIEW.flip) { c.translate(o[2], o[3]); c.scale(1, -1); c.fillText(o[1], 0, 0) } else c.fillText(o[1], o[2], o[3]); c.restore(); continue }
    const col = k == 0 ? o[5] : k == 1 ? o[4] : k == 2 ? o[5] : o[2], f = k == 1 ? o[5] : k == 2 ? o[6] : k == 3 ? o[4] : 0;
    c.strokeStyle = c.shadowColor = col; c.shadowBlur = gl; c.beginPath();
    if (k == 0) { c.lineWidth = o[6]; c.moveTo(o[1], o[2]); c.lineTo(o[3], o[4]) }
    else if (k == 1) { c.lineWidth = o[6]; c.arc(o[1], o[2], Math.max(0, o[3]), 0, TAU) }
    else if (k == 2) { c.lineWidth = o[7]; c.rect(o[1], o[2], o[3], o[4]) }
    else { const p = o[1]; c.lineWidth = o[5]; c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); if (o[3]) c.closePath() }
    if (f) { c.globalAlpha = f == 2 ? 1 : f == 1 ? .22 : f; c.fillStyle = col; c.fill(); c.globalAlpha = 1 }
    c.stroke();
  }
}

// ---- input
let ZONES = 0, MIRROR = 0, REM = null; // ZONES: split screen for two players on one device; REM: online guest's input
const KM = [{ u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', a: ['Space', 'KeyF'] }, { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight', a: ['Enter', 'KeyL', 'ShiftRight'] }];
addEventListener('keydown', e => {
  if (e.target.tagName == 'INPUT' || e.target.tagName == 'SELECT') return;
  if (!KEYS[e.code]) KP[e.code] = 1; KEYS[e.code] = 1;
  if (R && /Arrow|Space|Enter/.test(e.code)) e.preventDefault();
  if (e.code == 'Escape' && R) pause();
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
  let x = 0, y = 0, a = 0, tx = null, ty = null, touch = 0, rx = 0, ry = 0, dp = '';
  KM.forEach((m, j) => { if (!all && j != i) return; x += (KEYS[m.r] | 0) - (KEYS[m.l] | 0); y += (KEYS[m.d] | 0) - (KEYS[m.u] | 0); if (m.a.some(k => KEYS[k])) a = 1; for (const d of 'udlr') if (KP[m[d]]) dp = d });
  for (const t of TCH.values()) if (all || t.p == i) { rx = t.x - t.sx; ry = t.y - t.sy; x += clamp(rx / 30, -1, 1); y += clamp(ry / 30, -1, 1); a = 1; tx = t.x; ty = t.y; touch = 1 }
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [], pad = all ? pads[0] : pads[i];
  if (pad) {
    const ax = pad.axes, b = pad.buttons.map(b => b.pressed); let px = abs(ax[0]) > .25 ? ax[0] : 0, py = abs(ax[1]) > .25 ? ax[1] : 0;
    if (b[14]) px = -1; if (b[15]) px = 1; if (b[12]) py = -1; if (b[13]) py = 1; x += px; y += py; if (b[0] || b[1] || b[2] || b[3]) a = 1;
    const d = py < -.5 ? 'u' : py > .5 ? 'd' : px < -.5 ? 'l' : px > .5 ? 'r' : ''; if (d && d != PADP[i]) dp = d; PADP[i] = d;
  }
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), a, tx, ty, touch, rx, ry, dp };
}
const NONE = { x: 0, y: 0, a: 0, tx: null, ty: null, touch: 0, rx: 0, ry: 0, dp: '' };
function poll() {
  for (let i = 0; i < 2; i++) {
    const I = P[i]; let n;
    if (i == 1 && REM) { n = { ...NONE, ...REM, dp: REM.dpq || '' }; REM.dpq = '' } else n = i == 1 && !ZONES ? NONE : readLocal(i, !ZONES);
    if (MIRROR) { n = { ...n, x: -n.x, tx: n.tx == null ? null : W - n.tx, rx: -n.rx, dp: n.dp == 'l' ? 'r' : n.dp == 'r' ? 'l' : n.dp }; }
    I.ap = n.a && !I.a; I.ar = !n.a && I.a; Object.assign(I, n);
  }
}

// ---- screens and dialogs
function show(id) { for (const s of document.querySelectorAll('.scr')) s.classList.toggle('on', s.id == id) }
function dlg(html, btns = []) {
  const b = $('#box'); b.innerHTML = html;
  for (const [l, fn, c] of btns) { const e = document.createElement('button'); e.className = 'nb'; e.textContent = l; if (c) e.style.setProperty('--c', c); e.onclick = fn; b.append(e) }
  $('#ov').hidden = false;
}
const close = () => $('#ov').hidden = true;
const MODE_LABEL = { solo: '▶ 1 PLAYER', cpu: '▶ VS CPU', local: '▶ 2 PLAYERS · ONE DEVICE', hot: '▶ 2 PLAYERS · TAKE TURNS', online: '▶ ONLINE · TWO PHONES' };
const HINTS = { pong: 'Slide to move your paddle.', snake: 'Swipe to turn.', breakout: 'Slide to move, tap to launch.', rocks: 'Drag to fly. Firing is automatic.', flap: 'Tap to flap.', runner: 'Tap to jump, tap again in the air to double jump.', dodge: 'Slide to dodge.', shmup: 'Drag to fly. Firing is automatic.', catch: 'Catch the round ones, avoid the spiky ones.', stack: 'Tap to drop the block.', tanks: 'Drag to drive, tap to fire. Shots bounce.', sumo: 'Drag to push, tap to dash. Knock them out of the ring.', hockey: 'Drag your mallet. Score in the top goal.', duel: 'Tap the moment it says TAP!', tug: 'Tap as fast as you can.', c4: 'Tap a column.', ttt: 'Tap a square.', maze: 'Swipe to turn. Eat every dot.', simon: 'Watch, then repeat the pads.', tapper: 'Tap targets before they vanish.', ring: 'Hold the left or right side to orbit.', lander: 'Hold to thrust, drag sideways to tilt. Land softly on the pad.', golf: 'Drag back and release to putt.', jumper: 'Slide to steer.', racer: 'Slide to change lanes.', mines: 'Tap to dig. Switch to FLAG at the bottom.', merge: 'Swipe to slide tiles.', blocks: 'Drag sideways to move, tap to rotate, drag down to drop.', lights: 'Tap a light: it and its neighbours flip.', slide: 'Tap a tile next to the gap.', juggle: 'Slide to keep every ball in the air.', cross: 'Tap to hop forward, swipe to sidestep. Keep moving!', invaders: 'Slide to move. Firing is automatic.', defend: 'Tap the sky to blast missiles before they hit.', slice: 'Swipe through shapes. Never slice a bomb.', cave: 'Hold to rise, let go to fall.', moles: 'Tap the faces before they hide.', beat: 'Tap the lane as notes cross the line.', knife: 'Tap to throw. Don’t hit another knife.', stick: 'Hold to grow the bridge, let go to drop it.', pool: 'Drag back from anywhere and release to shoot.', reversi: 'Tap a dot to flip discs.', boxes: 'Tap between two dots to draw a line.', pairs: 'Tap two cards to find a pair.', volley: 'Slide to move, tap to jump.', artillery: 'Drag back and release to fire. Mind the wind.', barrage: 'Drag to aim, let go to fire every ball.', hoops: 'Drag down and release to throw.', goalie: 'Slide to block every shot.', math: 'Tap the right answer fast.' };
const KEYHELP = 'Keys: P1 WASD + Space · P2 arrows + Enter · Esc pauses · gamepads work.';
const palOf = c => { const n = Object.keys(PALS); return PALS[c.pal] || PALS[n[hash(c.name || c.e) % n.length]] };
const today = () => new Date().toISOString().slice(0, 10);
const favs = () => load('neon.fav', []), recent = () => load('neon.recent', []);

let CAT = [], FIL = 'ALL';
const CHIPS = ['ALL', '★ FAVS', 'RECENT', 'VS', 'SOLO', 'ARCADE', 'PUZZLE', 'PARTY', 'SPORT', 'MIX', 'MINE'];
const groupOf = c => c.mine ? 'mine' : c.mix ? 'mix' : c.e;
const groupTitle = k => k == 'mine' ? 'My Games' : k == 'mix' ? 'Mashups' : E[k].t;
function home() {
  CAT = catalog(); $('#sub').textContent = `${CAT.length} neon line games · make & mix your own`;
  $('#chips').innerHTML = CHIPS.map(c => `<button class="chip${c == FIL ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
  list();
}
$('#chips').onclick = e => { const c = e.target.dataset.c; if (c) { FIL = c; home() } };
$('#q').oninput = () => list();
const daily = () => { const L = CAT.filter(c => !c.mine && !c.mix && vsOf(c) != 1); return L[hash(today()) % L.length] };
function card(html, col, fn) { const d = document.createElement('button'); d.className = 'card'; d.style.setProperty('--c', col); d.innerHTML = html; d.onclick = fn; return d }
const dots = pal => `<svg viewBox="0 0 100 20" width="100%" height="20">${pal.map((p, k) => `<circle cx="${10 + k * 20}" cy="10" r="6" fill="none" stroke="${p}" stroke-width="2" style="filter:drop-shadow(0 0 3px ${p})"/>`).join('')}</svg>`;
const tags = c => { const v = vsOf(c); return v == 1 ? '<span class=tag>VS</span><span class=tag>ONLINE</span>' : v == 2 ? '<span class=tag>1P</span><span class=tag>VS</span>' : '<span class=tag>1P</span><span class=tag>2P TURNS</span>' };
function list() {
  const q = $('#q').value.trim().toUpperCase(), L = $('#list'); L.innerHTML = '';
  const match = c => !q || (c.name + ' ' + E[c.e].t + ' ' + groupTitle(groupOf(c))).toUpperCase().includes(q);
  if (FIL == 'ALL' && !q) { const d = daily(), b = load('neon.daily.' + today(), 0); const el = card(`${dots(palOf(d))}<b>☀ DAILY CHALLENGE</b><small>${esc(d.name)}</small><small>${b ? 'today ★' + b : 'new every day'}</small>`, '#fff01f', () => openGroup(groupOf(d), d.name, 1)); el.style.gridColumn = '1/-1'; L.append(el) }
  if (FIL == '★ FAVS' || FIL == 'RECENT') { // single versions
    const names = FIL == 'RECENT' ? recent() : favs();
    for (const n of names) { const c = CAT.find(x => x.name == n); if (c && match(c)) L.append(card(`${dots(palOf(c))}<b>${esc(c.name)}</b><small>${esc(groupTitle(groupOf(c)))}</small><small>${tags(c)}</small>`, palOf(c)[0], () => openGroup(groupOf(c), c.name))) }
  } else {
    const G = new Map();
    for (const c of CAT) {
      const e = E[c.e], v = vsOf(c), k = groupOf(c);
      const ok = FIL == 'ALL' || (FIL == 'VS' && v) || (FIL == 'SOLO' && v != 1) || (FIL == 'MIX' && c.mix && !c.mine) || (FIL == 'MINE' && c.mine) || (!c.mix && !c.mine && e.c.toUpperCase() == FIL);
      if (!ok || !match(c)) continue;
      if (!G.has(k)) G.set(k, []); G.get(k).push(c);
    }
    for (const [k, vs] of G) {
      const c = vs[0], best = Math.max(0, ...vs.map(x => load('neon.best.' + x.name, 0)));
      L.append(card(`${dots(palOf(c))}<b>${esc(groupTitle(k).toUpperCase())}</b><small>${vs.length} version${vs.length > 1 ? 's' : ''}${k == 'mix' || k == 'mine' ? '' : ' · ' + esc(E[c.e].c)}</small><small>${k == 'mix' || k == 'mine' ? '' : tags(c)}${best ? ' ★' + best : ''}</small>`, palOf(c)[0], () => openGroup(k, q ? vs[0].name : null)));
    }
  }
  if (!L.children.length) L.innerHTML = `<p style="color:var(--dim)">${FIL == 'MINE' ? 'Nothing yet. Tap + CREATE to make your own game.' : FIL == '★ FAVS' ? 'Tap ☆ on any game to keep it here.' : 'Nothing here yet.'}</p>`;
}
// one dialog per game: pick a version, a difficulty and a mode
function openGroup(k, sel, isDaily) {
  const vs = CAT.filter(c => groupOf(c) == k); if (!vs.length) return;
  const c = vs.find(x => x.name == sel) || vs[0], m = modesOf(c), mods = (c.mods || []).map(x => MODS[x]).join(', '), fav = favs().includes(c.name), best = load('neon.best.' + c.name, 0);
  const diffRow = m.includes('cpu') ? `<div class=vers>${['EASY', 'NORMAL', 'HARD'].map((d, i) => `<button class="chip${(SET.diff ?? 1) == i ? ' on' : ''}" data-d="${i}">${d}</button>`).join('')}</div>` : '';
  dlg(`<h2>${esc(isDaily ? '☀ ' + c.name : groupTitle(k).toUpperCase())}</h2>
    ${vs.length > 1 && !isDaily ? `<div class=vers>${vs.map(v => `<button class="chip${v === c ? ' on' : ''}" data-v="${esc(v.name)}">${esc(v.name)}</button>`).join('')}</div>` : ''}
    <p>${esc(c.name)}${c.mix ? '<br>' + esc(E[c.e].t) + ' × ' + esc(E[c.mix].t) + ' · switches every 15 s' : ''}${mods ? '<br>' + esc(mods) : ''}${best ? '<br>BEST ★' + best : ''}</p>
    <p class=help>${esc(HINTS[c.e] || '')}${c.mix ? ' ' + esc(HINTS[c.mix] || '') : ''}<br>${KEYHELP}</p>${diffRow}`,
    [...m.map(x => [MODE_LABEL[x], () => { close(); x == 'online' ? hostOnline(c) : startGame(c, x, isDaily) }]),
    [fav ? '★ FAVORITE' : '☆ ADD TO FAVORITES', () => { const f = favs().filter(n => n != c.name); if (!fav) f.unshift(c.name); save('neon.fav', f); openGroup(k, c.name, isDaily); if (FIL == '★ FAVS') list() }, '#fff01f'],
    c.mine ? ['✎ EDIT', () => creator(c), '#39ff14'] : ['✎ REMIX THIS', () => creator({ ...c, name: c.name + ' REMIX', id: 0 }), '#39ff14'],
    ...(c.mine ? [['⇪ SHARE CODE', () => shareCode(c), '#00f0ff'], ['🗑 DELETE', () => confirmDlg(`Delete ${c.name}?`, () => { save('neon.my', load('neon.my', []).filter(x => x.id != c.id)); close(); home() }), '#ff2b4e']] : []),
    ['BACK', close, '#8a84b8']]);
  for (const b of document.querySelectorAll('#box [data-v]')) b.onclick = () => openGroup(k, b.dataset.v);
  for (const b of document.querySelectorAll('#box [data-d]')) b.onclick = () => { SET.diff = +b.dataset.d; save('neon.set', SET); openGroup(k, c.name, isDaily) };
  const on = document.querySelector('#box .vers .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function confirmDlg(q, yes) { dlg(`<h2>SURE?</h2><p>${esc(q)}</p>`, [['YES', yes, '#ff2b4e'], ['NO', close, '#8a84b8']]) }

// ---- running a game
let R = null, PAUSED = 0, NET = null, last = 0, FR = 0;
function startGame(c, mode, isDaily) {
  R = { c, mode, res: [], daily: isDaily }; ZONES = mode == 'local' && vsOf(c) ? 1 : 0; TCH.clear(); show('game');
  save('neon.recent', [c.name, ...recent().filter(n => n != c.name)].slice(0, 16)); save('neon.plays', load('neon.plays', 0) + 1);
  newRound();
}
function newRound() {
  close(); const c = R.c, m = c.mods || [];
  PT = []; DL = []; SQ = []; PAUSED = 0; MIRROR = m.includes('mirror');
  Object.assign(VIEW, { ghost: m.includes('ghost'), drunk: m.includes('drunk'), flip: m.includes('flip') });
  Object.assign(R, makeRun(c, R.mode == 'hot' ? 'solo' : R.mode, SET.diff ?? 1), { done: 0, hint: 3 });
  for (const I of P) Object.assign(I, NONE, { ap: 0, ar: 0 });
  send({ t: 'start', n: c.name, v: VIEW });
}
function hud(dt) {
  const g = R.g; tx(g.hud || 'SCORE ' + g.score, W / 2, 14, 12, g.K.e);
  if (R.mode == 'hot') tx(`PLAYER ${R.res.length + 1}`, W / 2, 30, 11, R.res.length ? g.K.b : g.K.a);
  if ((R.hint -= dt) > 0) { const h = (HINTS[R.c.e] || '') + (R.mode == 'local' ? ' · P2 plays on the top half' : ''); tx(h.length > 34 ? h.slice(0, h.lastIndexOf(' ', 34)) : h, W / 2, H - 50, 13, '#fff'); if (h.length > 34) tx(h.slice(h.lastIndexOf(' ', 34) + 1), W / 2, H - 32, 13, '#fff') }
}
function loop(t) {
  requestAnimationFrame(loop);
  const dt = clamp((t - last) / 1000 || 0, 0, .05); last = t;
  if (!R) return;
  VIEW.t += dt;
  if (R.mode == 'guest') { guestInput(); if (R.frame) render(R.frame) }
  else {
    if (!PAUSED && !R.g.over && dt > 0) {
      poll(); DL = [];
      try { R.tick(dt); parts(dt); hud(dt) }
      catch (e) { console.error(e); R.g.over = 1; R.g.msg = 'OOPS · GAME ERROR'; R.g.score = 0 } // never freeze the app on a game bug
      if (R.g.over && !R.done) { R.done = 1; const g = R.g; setTimeout(() => { if (R && R.g === g) gameOver() }, 700) } // only for this round
    }
    render(DL);
    if (NET && NET.role == 'host') { if (++FR % 2 == 0) { send({ t: 'f', d: DL.map(rd), s: SQ }); SQ = [] } } else SQ = [];
  }
  for (const k in KP) delete KP[k];
}
const rd = v => typeof v == 'number' ? Math.round(v * 10) / 10 : Array.isArray(v) ? v.map(rd) : v;
function gameOver() {
  if (!R || R.mode == 'guest') return;
  const c = R.c, g = R.g; buzz(60);
  if (R.mode == 'hot') {
    R.res.push(g.score);
    if (R.res.length == 1) return dlg(`<h2>PLAYER 1: ${g.score}</h2><p>Pass the device to player 2.</p>`, [['▶ PLAYER 2 GO', newRound, '#00f0ff'], ['MENU', quit, '#8a84b8']]);
    const [a, b] = R.res; R.res = [];
    return dlg(`<h2>${a == b ? 'DRAW' : a > b ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS'}</h2><p>P1 ${a} · P2 ${b}</p>`, [['↻ REMATCH', newRound], ['MENU', quit, '#8a84b8']]);
  }
  let sub = '';
  if (!vsOf(c)) {
    const k = 'neon.best.' + c.name, b = load(k, 0); if (g.score > b) { save(k, g.score); sub = '★ NEW BEST!' } else sub = 'BEST ' + b;
    if (R.daily) { const dk = 'neon.daily.' + today(); if (g.score > load(dk, 0)) save(dk, g.score); sub += ' · TODAY ' + load(dk, 0) }
  } else if (R.mode == 'cpu') { const k = 'neon.wins.' + c.name, w = load(k, [0, 0]); w[g.win == 0 ? 0 : 1]++; save(k, w); sub = `YOU ${w[0]} · CPU ${w[1]}` }
  send({ t: 'over', m: g.msg });
  dlg(`<h2>${esc(g.msg || 'GAME OVER')}</h2><p>${sub}</p>`, [['↻ PLAY AGAIN', newRound], ['MENU', quit, '#8a84b8']]);
}
function pause() {
  if (!R || R.mode == 'guest' || R.g.over || PAUSED) return;
  PAUSED = 1; dlg(`<h2>PAUSED</h2><p class=help>${esc(HINTS[R.c.e] || '')}<br>${KEYHELP}</p>`, [['▶ RESUME', () => { PAUSED = 0; close() }], ['↻ RESTART', () => { if (R.mode == 'hot') R.res = []; newRound() }], ['MENU', quit, '#8a84b8']]);
}
function quit() {
  R = null; PAUSED = 0; REM = null; close();
  if (NET) { try { NET.peer.destroy() } catch (e) { } NET = null }
  show('home'); home();
}
$('#bX').onclick = quit; $('#bP').onclick = pause;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause() });
window.neonBack = () => { if (R && !$('#ov').hidden && !PAUSED) { quit(); return true } if (R && PAUSED) { quit(); return true } if (R) { pause(); return true } if (!$('#ov').hidden) { close(); return true } return false }; // Android back button

// ---- creator and share codes
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
function shareCode(c) {
  const code = toCode(c);
  dlg(`<h2>SHARE</h2><p>Send this code to a friend. They tap + CREATE → IMPORT.</p><textarea id=sc readonly rows=4 style="width:100%;font-size:11px">${esc(code)}</textarea>`,
    [['⧉ COPY', () => { try { navigator.clipboard.writeText(code) } catch (e) { } $('#sc').select(); try { document.execCommand('copy') } catch (e) { } $('#box p').textContent = 'Copied!' }, '#00f0ff'], ['DONE', close, '#8a84b8']]);
}
function importDlg() {
  dlg('<h2>IMPORT</h2><p>Paste a NEON game code.</p><textarea id=ic rows=4 style="width:100%;font-size:11px" placeholder="NEON1:…"></textarea>',
    [['✔ IMPORT', () => { try { const g = fromCode($('#ic').value); const L = load('neon.my', []); L.unshift(g); save('neon.my', L); FIL = 'MINE'; home(); openGroup('mine', g.name) } catch (e) { $('#box p').textContent = 'That code doesn’t work. Check it was copied fully.' } }, '#39ff14'], ['CANCEL', close, '#8a84b8']]);
}
function creator(base) {
  const c = { name: 'MY NEON GAME', e: 'pong', mix: '', pal: 'SYNTH', sp: 1, sz: 1, n: 0, mods: [], ...base };
  const eng = Object.entries(E).sort((a, b) => a[1].t.localeCompare(b[1].t)).map(([k, e]) => `<option value="${k}">${esc(e.t)}</option>`).join('');
  dlg(`<h2>CREATE</h2><p>Pick a game, tune it, mix two together.</p><div class=form>
    <label>NAME<input id=cN maxlength=28></label>
    <label>GAME<select id=cE>${eng}</select></label>
    <label>MIX WITH · switches games every 15 s<select id=cM><option value="">— none —</option>${eng}</select></label>
    <label>COLORS<select id=cP>${Object.keys(PALS).map(p => `<option>${p}</option>`).join('')}</select></label>
    <label>SPEED <output id=oS></output><input id=cS type=range min=.5 max=2 step=.1></label>
    <label>SIZE <output id=oZ></output><input id=cZ type=range min=.5 max=1.6 step=.1></label>
    <label>AMOUNT · balls, enemies, board size or difficulty<select id=cA></select></label>
    <div class=mods>${Object.entries(MODS).map(([k, v]) => `<label><input type=checkbox value=${k}>${esc(v)}</label>`).join('')}</div></div>`,
    [['🎲 RANDOMIZE', () => fill(randomGame()), '#fff01f'], ['✔ SAVE & PLAY', () => { const n = read(); const L = load('neon.my', []).filter(x => x.id != n.id); L.unshift(n); save('neon.my', L); home(); openGroup('mine', n.name) }, '#39ff14'], ['📋 IMPORT A CODE', importDlg, '#00f0ff'], ['CANCEL', close, '#8a84b8']]);
  const amt = (e, n) => { const [a, b] = nrOf(e); $('#cA').innerHTML = '<option value=0>default</option>' + Array.from({ length: b - a + 1 }, (_, k) => `<option>${a + k}</option>`).join(''); $('#cA').value = n >= a && n <= b ? n : 0 };
  const sync = () => { $('#oS').textContent = '×' + $('#cS').value; $('#oZ').textContent = '×' + $('#cZ').value };
  function fill(x) { $('#cN').value = x.name; $('#cE').value = x.e; $('#cM').value = x.mix || ''; $('#cP').value = x.pal || 'SYNTH'; $('#cS').value = x.sp || 1; $('#cZ').value = x.sz || 1; amt(x.e, x.n); for (const b of document.querySelectorAll('.mods input')) b.checked = (x.mods || []).includes(b.value); sync() }
  function read() {
    const n = +$('#cA').value, x = { id: c.id || Date.now(), name: ($('#cN').value.trim() || 'MY NEON GAME').toUpperCase(), e: $('#cE').value, pal: $('#cP').value, sp: +$('#cS').value, sz: +$('#cZ').value, mods: [...document.querySelectorAll('.mods input:checked')].map(b => b.value) };
    if (n) x.n = n; if ($('#cM').value && $('#cM').value != x.e) x.mix = $('#cM').value;
    if (c.tron && x.e == 'snake') { x.tron = 1; x.vs = 1 }
    return x;
  }
  $('#cE').onchange = () => amt($('#cE').value, 0); $('#cS').oninput = $('#cZ').oninput = sync;
  fill(c);
}
$('#bCreate').onclick = () => creator();
$('#bMash').onclick = () => startMash(randomGame());
function startMash(c) { dlg(`<h2>⚡ ${esc(c.name)}</h2><p>A random new game. Like it? Save it as yours.</p><p class=help>${esc(HINTS[c.e] || '')} ${c.mix ? esc(HINTS[c.mix] || '') : ''}</p>`, [['▶ PLAY', () => { close(); startGame(c, modesOf(c)[0]) }], ['✔ SAVE', () => { const L = load('neon.my', []); L.unshift({ ...c, id: Date.now() }); save('neon.my', L); home(); openGroup('mine', c.name) }, '#39ff14'], ['🎲 ANOTHER', () => startMash(randomGame()), '#fff01f'], ['BACK', close, '#8a84b8']]) }

// ---- online: host runs the game, the guest sends input and draws the host's frames
const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const loadPeer = () => window.Peer ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = PEERJS; s.onload = ok; s.onerror = () => { s.remove(); no() }; document.head.append(s) });
const send = m => { try { if (NET && NET.conn && NET.conn.open) NET.conn.send(m) } catch (e) { } };
const offline = () => dlg('<h2>NO INTERNET</h2><p>Online play needs a connection. Every other mode works offline.</p>', [['OK', quit]]);
const netErr = e => dlg(`<h2>ONLINE ERROR</h2><p>${esc(e && e.type == 'peer-unavailable' ? 'No game with that code.' : (e && e.type) || e)}</p>`, [['OK', quit]]);
async function hostOnline(c) {
  dlg('<h2>ONLINE</h2><p>Connecting…</p>', [['CANCEL', quit, '#8a84b8']]);
  try { await loadPeer() } catch (e) { return offline() }
  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[ri(0, 30)]).join(''), peer = new Peer('neon-game-' + code);
  NET = { role: 'host', peer };
  peer.on('open', () => dlg(`<h2>HOST · ${esc(c.name)}</h2><div class=code>${code}</div><p>On the other phone open NEON → ONLINE and type this code.</p>`, [['CANCEL', quit, '#8a84b8']]));
  peer.on('connection', conn => {
    if (NET.conn) return conn.close(); NET.conn = conn;
    conn.on('open', () => { REM = { ...NONE }; startGame(c, 'online') });
    conn.on('data', onData); conn.on('close', lost);
  });
  peer.on('error', netErr);
}
function onlineMenu() {
  dlg(`<h2>ONLINE</h2><p>Two phones, one game.<br><b>Host:</b> pick any VS game → ONLINE.<br><b>Join:</b> type the host's code.</p>
    <input id=jc maxlength=4 autocomplete=off style="text-transform:uppercase;text-align:center;font-size:28px;width:100%;letter-spacing:8px" placeholder="CODE">`,
    [['JOIN', () => join($('#jc').value)], ['BACK', close, '#8a84b8']]);
}
async function join(code) {
  code = code.trim().toUpperCase(); if (code.length != 4) return;
  dlg('<h2>JOINING…</h2>', [['CANCEL', quit, '#8a84b8']]);
  try { await loadPeer() } catch (e) { return offline() }
  const peer = new Peer(); NET = { role: 'guest', peer };
  peer.on('open', () => {
    const conn = peer.connect('neon-game-' + code, { serialization: 'json', reliable: true }); NET.conn = conn;
    conn.on('open', () => R || dlg('<h2>CONNECTED</h2><p>Waiting for the host…</p>', [['LEAVE', quit, '#8a84b8']]));
    conn.on('data', onData); conn.on('close', lost);
  });
  peer.on('error', netErr);
}
function onData(m) {
  if (!NET || !m) return;
  if (NET.role == 'host') { if (m.t == 'i' && REM) { const dq = REM.dpq; Object.assign(REM, m); REM.dpq = m.dp || dq } return }
  if (m.t == 'start') { close(); R = { mode: 'guest', c: { name: m.n }, g: { over: 0 } }; Object.assign(VIEW, m.v); ZONES = 0; TCH.clear(); show('game') }
  else if (m.t == 'f' && R) { R.frame = m.d; for (const s of m.s || []) play(...s) }
  else if (m.t == 'over') dlg(`<h2>${esc(m.m)}</h2><p>Waiting for the host…</p>`, [['LEAVE', quit, '#8a84b8']]);
}
let lastIn = '';
function guestInput() { const n = readLocal(0, true), s = JSON.stringify(n); if (s != lastIn || ++FR % 15 == 0) { lastIn = s; send({ t: 'i', ...n }) } }
function lost() { if (NET) dlg('<h2>DISCONNECTED</h2><p>The other phone left.</p>', [['MENU', quit]]) }
$('#bOnline').onclick = onlineMenu;

// ---- music: a quiet synth arpeggio while a game runs
const VERSION = '2.0';
let mStep = 0;
setInterval(() => {
  if (!SET.mus || !R || PAUSED || R.mode == 'guest' || (R.g && R.g.over) || document.hidden) return;
  const root = [110, 87.3, 130.8, 98][(mStep >> 4) % 4], k = mStep++ % 16;
  if (k % 4 == 0) play(root, .25, 'triangle', .035);
  if (k % 2 == 1) play(root * [2, 3, 4, 3, 5, 4, 3, 2][(k >> 1) % 8], .1, 'square', .008);
}, 140);

// ---- settings, about, install, offline cache
let installEv = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e });
function settings() {
  const t = (k, l) => [`${l}: ${SET[k] ? 'ON' : 'OFF'}`, () => { SET[k] ^= 1; save('neon.set', SET); settings() }];
  const mine = load('neon.my', []).length, bests = Object.keys(localStorage).filter(k => k.startsWith('neon.best.')).length;
  dlg(`<h2>SETTINGS</h2><p class=help>Games played: ${load('neon.plays', 0)} · high scores: ${bests} · your games: ${mine}<br>CPU level: ${['EASY', 'NORMAL', 'HARD'][SET.diff ?? 1]} (change it on any VS game)</p>`,
    [t('snd', '♪ SOUND'), t('mus', '♫ MUSIC'), t('glow', '✦ GLOW (turn off if slow)'), t('vib', '≋ VIBRATION'),
    ...(installEv ? [['⬇ INSTALL APP', () => installEv.prompt(), '#39ff14']] : []),
    ['ⓘ HOW TO PLAY', welcome, '#00f0ff'], ['🔒 ABOUT & PRIVACY', about, '#00f0ff'],
    ['🗑 RESET ALL DATA', () => confirmDlg('Delete all scores, favorites and your games on this device?', () => { for (const k of Object.keys(localStorage)) if (k.startsWith('neon.')) localStorage.removeItem(k); location.reload() }), '#ff2b4e'],
    ['DONE', close, '#8a84b8']]);
}
function about() {
  dlg(`<h2>NEON ${VERSION}</h2><p class=help>${CAT.length} neon line games, a game creator and a mixer.<br><br><b>Privacy.</b> No accounts, no ads, no tracking. Scores, favorites and the games you make stay on this device. Online mode connects two phones through the free open-source PeerJS service; only game frames and touches pass between them, and nothing is stored.<br><br><b>Credits.</b> Made with Claude Code. Online play uses PeerJS (MIT license). All games are original code; no outside art or music.</p>`, [['BACK', settings, '#8a84b8']]);
}
function welcome() {
  save('neon.seen', 1);
  dlg(`<h2>WELCOME TO NEON</h2><p class=help>• Tap a game, pick a <b>version</b> and how to play: alone, vs the CPU, two players on one phone, or online with two phones.<br>• <b>+ CREATE</b> makes your own game: mix two games, change speed, size, colors and add crazy effects. Share it with a code.<br>• <b>⚡ MASHUP</b> invents a random game.<br>• Try the <b>DAILY CHALLENGE</b> every day.<br>• Everything works offline.<br><br>${KEYHELP}</p>`, [['LET’S PLAY', close, '#39ff14']]);
}
$('#bSet').onclick = settings;
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname != 'neon.local') navigator.serviceWorker.register('sw.js').catch(() => { });
home(); requestAnimationFrame(loop);
if (!load('neon.seen', 0)) welcome();
