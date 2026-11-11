'use strict';
// NEON core with no DOM: math helpers, the draw list, particles, sounds, player input state, game setup.
// Every game draws only through ln/ci/rc/pg/tx, so a frame is a plain list (what online guests receive).
const W = 360, H = 640, TAU = Math.PI * 2, PI = Math.PI;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.random() * a.length | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot, sgn = Math.sign, abs = Math.abs, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2;
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d } catch (e) { return d } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } }

const PALS = {
  SYNTH: ['#ff2bd6', '#00f0ff', '#fff01f', '#39ff14', '#b026ff'],
  TOXIC: ['#39ff14', '#fff01f', '#ff2b4e', '#00f0ff', '#ff9f1a'],
  ICE: ['#00f0ff', '#ff2bd6', '#ff2b4e', '#ffffff', '#4d7cff'],
  INFERNO: ['#ff6b1a', '#fff01f', '#ff2b4e', '#ff2bd6', '#ffd1a1'],
  ULTRA: ['#b026ff', '#00f0ff', '#ff2b4e', '#39ff14', '#ff2bd6'],
  MINT: ['#2bffc6', '#ff7ad9', '#ff2b4e', '#fff01f', '#00b3ff'],
  BLOOD: ['#ff2b4e', '#ffffff', '#ff9f1a', '#ff2bd6', '#ffd400'],
  SUNSET: ['#ff9f1a', '#ff2bd6', '#00f0ff', '#fff01f', '#b026ff'],
};
const MODS = { turbo: 'TURBO speed', slowmo: 'SLOW-MO', mirror: 'MIRROR controls', drunk: 'DRUNK screen', flip: 'UPSIDE DOWN', ghost: 'GHOST trails', rainbow: 'RAINBOW colors', tiny: 'TINY things', giant: 'GIANT things' };
const SET = Object.assign({ snd: 1, mus: 0, glow: 1, vib: 1, diff: 1 }, load('neon.set', {}));

let DL = [], SQ = [], PT = [];
const ln = (a, b, c, d, col, w = 2) => DL.push([0, a, b, c, d, col, w]);
const ci = (x, y, r, col, f = 0, w = 2) => DL.push([1, x, y, r, col, f, w]);
const rc = (x, y, w, h, col, f = 0, lw = 2) => DL.push([2, x, y, w, h, col, f, lw]);
const pg = (pts, col, closed = 1, f = 0, w = 2) => DL.push([3, pts, col, closed, f, w]);
const tx = (s, x, y, sz = 20, col = '#fff', al = 'center') => DL.push([4, String(s), x, y, sz, col, al]);
// regular polygon / star points as a flat [x,y,...] list
const poly = (x, y, r, n, a = 0, r2) => { const p = []; for (let i = 0; i < n * (r2 ? 2 : 1); i++) { const rr = r2 && i % 2 ? r2 : r, t = a + i * TAU / (n * (r2 ? 2 : 1)); p.push(x + cos(t) * rr, y + sin(t) * rr) } return p };

function boom(x, y, col, n = 14, sp = 160) { for (let i = 0; i < n; i++) { const a = rnd(TAU), v = rnd(.3, 1) * sp; PT.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, l: rnd(.3, .7), col }) } }
function parts(dt) { PT = PT.filter(p => (p.l -= dt) > 0); for (const p of PT) { p.x += p.vx * dt; p.y += p.vy * dt; ln(p.x, p.y, p.x - p.vx * .04, p.y - p.vy * .04, p.col, 2) } }

let AC;
function play(f, d, t, v) {
  if (!SET.snd || typeof window == 'undefined') return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const n = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = t; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * .6), n + d);
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(1e-4, n + d);
    o.connect(g).connect(AC.destination); o.start(n); o.stop(n + d + .02);
  } catch (e) { }
}
function sfx(f = 440, d = .08, t = 'square', v = .04) { SQ.push([f, d, t, v]); play(f, d, t, v) }
const buzz = ms => { try { if (SET.vib && navigator.vibrate) navigator.vibrate(ms) } catch (e) { } };

// Player input, filled each frame by the shell: x,y in -1..1, a = held, ap/ar = pressed/released this frame,
// tx,ty = touch point in world space (null if not touching), rx,ry = raw drag in px, dp = direction key just pressed.
const KEYS = {}, KP = {}; // keys held / pressed this frame
const P = [0, 1].map(() => ({ x: 0, y: 0, a: 0, ap: 0, ar: 0, tx: null, ty: null, touch: 0, rx: 0, ry: 0, dp: '' }));
let reOrigin = () => { }; // set by the shell: restart a player's drag from where the finger is now
// one-step direction from keys or a swipe (grid games)
function swipe(i) {
  const I = P[i];
  if (I.dp) return I.dp;
  if (I.touch && hyp(I.rx, I.ry) > 24) { reOrigin(i); return abs(I.rx) > abs(I.ry) ? (I.rx > 0 ? 'r' : 'l') : (I.ry > 0 ? 'd' : 'u') }
  return '';
}
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
function win(g, w) { g.over = 1; g.win = w; g.msg = w < 0 ? 'DRAW' : g.cpu ? (w == 0 ? 'YOU WIN' : 'CPU WINS') : `P${w + 1} WINS`; sfx(w == 0 ? 880 : 220, .5, 'sawtooth', .05) }
function lose(g, msg) { g.over = 1; g.msg = msg || 'SCORE ' + g.score; sfx(120, .5, 'sawtooth', .06) }
// turn-based games: whose input counts (online: only that player; one device: either half of the screen)
const turnIn = (g, t) => g.net ? P[t] : (P[0].ap || P[0].dp || P[0].ar) ? P[0] : P[1];

const E = {}; // game engines: E.key = {t: title, c: category, vs: 0 solo | 1 versus | 2 both, n: default amount, v: [[name, params]], f: g => tick(dt)}
const vsOf = c => c.mix ? 0 : (c.vs ?? E[c.e].vs);
function modesOf(c) { const v = vsOf(c); return v == 1 ? ['cpu', 'local', 'online'] : v == 2 ? ['solo', 'cpu', 'local', 'online'] : ['solo', 'hot'] }
function mkG(c, e, mode, diff = 1) {
  const names = Object.keys(PALS), pal = PALS[c.pal] || PALS[names[hash(c.name || e) % names.length]], m = c.mods || [];
  const g = { sp: 1, sz: 1, n: E[e].n || 1, ...c, e, pal, score: 0, over: 0, msg: '', hud: '', net: mode == 'online' };
  g.diff = diff; g.ai = [.7, 1, 1.3][diff] || 1; // bot strength
  g.K = { a: pal[0], b: pal[1], c: pal[2], d: pal[3], e: pal[4] };
  g.sz *= m.includes('tiny') ? .7 : m.includes('giant') ? 1.35 : 1;
  const v = c.mix ? E[e].vs : vsOf(c);
  g.pl = mode == 'solo' && v == 2 ? 1 : v ? 2 : 1;
  g.cpu = !!v && g.pl == 2 && (mode == 'cpu' || mode == 'solo');
  return g;
}
// builds {g, tick} for a catalog entry; a mix swaps between two games every 15 s and adds their scores
function makeRun(c, mode, diff = 1) {
  const m = c.mods || [], tm = m.includes('turbo') ? 1.4 : m.includes('slowmo') ? .7 : 1, rb = m.includes('rainbow');
  const wrap = (gs, f) => { let t = 0; return dt => { t += dt; if (rb) for (const g of gs) { const o = t * 1.5 | 0; 'abcde'.split('').forEach((k, i) => g.K[k] = g.pal[(i + o) % 5]) } f(clamp(dt, .001, .05) * tm) } }; // a 0 or huge frame time must never reach a game
  if (!c.mix) { const g = mkG(c, c.e, mode, diff); return { g, tick: wrap([g], E[c.e].f(g)) } }
  const a = mkG(c, c.e, 'solo', diff), b = mkG({ ...c, pal: c.pal2 || c.pal }, c.mix, 'solo', diff), ta = E[c.e].f(a), tb = E[c.mix].f(b), SW = 15;
  const g = { ...a, score: 0, over: 0 }; let cur = 0, t = 0;
  return {
    g, tick: wrap([a, b], dt => {
      t += dt; if (t >= SW) { t = 0; cur ^= 1; sfx(880, .25, 'sawtooth'); boom(W / 2, H / 2, g.K.e, 40, 300) }
      const gg = cur ? b : a; (cur ? tb : ta)(dt);
      g.score = a.score + b.score; g.hud = gg.hud ? gg.hud + ' · Σ' + g.score : '';
      tx(`${E[cur ? c.mix : c.e].t.toUpperCase()} · SWITCH IN ${Math.ceil(SW - t)}`, W / 2, H - 10, 11, gg.K.e);
      if (a.over || b.over) { g.over = 1; g.msg = 'SCORE ' + g.score }
    })
  };
}
const CALM = ['c4', 'ttt', 'reversi', 'boxes', 'pairs', 'mines', 'merge', 'lights', 'slide', 'artillery', 'duel', 'tug', 'simon']; // turn-based: speed versions make no sense
function catalog() {
  const L = [];
  for (const [k, e] of Object.entries(E)) {
    for (const [name, p] of e.v) L.push({ name, e: k, ...p });
    if (!CALM.includes(k)) { const b = e.v[0][0]; L.push({ name: b + ' HARDCORE', e: k, ...e.v[0][1], sp: 1.35, pal: 'BLOOD' }, { name: b + ' ZEN', e: k, ...e.v[0][1], sp: .75, pal: 'MINT' }) }
  }
  return L.concat(MIXES, load('neon.my', []).map(c => ({ ...c, mine: 1 })));
}
const MIXES = [
  ['SNAKE × FLAP', 'snake', 'flap'], ['PONG × BREAKOUT', 'pong', 'breakout'], ['RUNNER × DODGE', 'runner', 'dodge'],
  ['ROCKS × SHMUP', 'rocks', 'shmup'], ['STACK × JUMPER', 'stack', 'jumper'], ['RACER × CATCH', 'racer', 'catch'],
  ['RING × TAPPER', 'ring', 'tapper'], ['MAZE × LANDER', 'maze', 'lander'], ['BLOCKS × MERGE', 'blocks', 'merge'], ['HOCKEY × SUMO', 'hockey', 'sumo'],
  ['JUGGLE × HOOPS', 'juggle', 'hoops'], ['INVADERS × DEFENDER', 'invaders', 'defend'], ['CAVE × FLAP', 'cave', 'flap'], ['SLICE × TARGETS', 'slice', 'tapper'],
  ['KNIFE × STACK', 'knife', 'stack'], ['BEAT × WHACK', 'beat', 'moles'], ['CROSSING × RACER', 'cross', 'racer'], ['BRIDGE × JUMPER', 'stick', 'jumper'],
  ['GOALIE × CATCH', 'goalie', 'catch'], ['MATH × ECHO', 'math', 'simon'], ['BARRAGE × BREAKOUT', 'barrage', 'breakout'], ['PAIRS × LIGHTS OUT', 'pairs', 'lights'],
].map(([name, e, mix]) => ({ name, e, mix }));

// allowed AMOUNT range per engine (board sizes, difficulty levels…); default 1..6
const NR = { ttt: [1, 3], c4: [1, 3], mines: [1, 3], merge: [3, 6], lights: [3, 7], slide: [3, 5], ring: [3, 10], racer: [2, 6], simon: [1, 2], tug: [1, 3], duel: [1, 3], snake: [1, 9], moles: [3, 5], pairs: [1, 3], boxes: [4, 6], pool: [1, 2], volley: [1, 2], knife: [1, 4], beat: [1, 3], cave: [1, 2], math: [1, 3], reversi: [1, 1], artillery: [1, 3] };
const nrOf = e => NR[e] || [1, 6];
function randomGame() {
  const ks = Object.keys(E), e = pick(ks), mix = rnd() < .5 ? pick(ks.filter(k => k != e && !E[k].vs)) : '', [a, b] = nrOf(e);
  const mods = Object.keys(MODS).filter(() => rnd() < .15).slice(0, 2);
  return { name: `${pick(['HYPER', 'ULTRA', 'COSMIC', 'GLITCH', 'TURBO', 'LASER', 'VOLT', 'PLASMA', 'RETRO', 'CYBER'])} ${E[e].t.toUpperCase()}${mix ? ' × ' + E[mix].t.toUpperCase() : ''}`, e, mix, pal: pick(Object.keys(PALS)), sp: +rnd(.7, 1.5).toFixed(1), sz: +rnd(.7, 1.3).toFixed(1), n: ri(a, b), mods };
}
