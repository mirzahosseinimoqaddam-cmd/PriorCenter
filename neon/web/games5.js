'use strict';
const sqrt = Math.sqrt;
// Board, sport and versus engines. g.diff = 0 easy / 1 normal / 2 hard, g.ai = bot speed factor.

// whose input aims on a shared device: whoever is touching/holding, else player 2
const aimIn = (g, t) => g.net ? P[t] : (P[0].touch || P[0].a || P[0].ar) ? P[0] : P[1];
// shared: drag back and release to shoot (touch), or turn with left/right and hold action to charge (keys)
function aimer() {
  let aim = null, ka = -PI / 2, kp = 0, kc = 0;
  return {
    get ka() { return ka }, get kp() { return kp }, get aim() { return aim },
    step(I, dt, max = 150) { // returns [vx, vy] scaled 0..1 when a shot is released
      if (I.touch) { aim = [-I.rx, -I.ry]; return null }
      if (I.ar && aim) { const m = hyp(...aim), a = aim; aim = null; if (m < 12) return null; const k = Math.min(m, max) / m / max; return [a[0] * k, a[1] * k] }
      aim = null; ka += I.x * 2.5 * dt;
      if (I.a) { kc += dt; kp = .5 - .5 * cos(kc * 3.5) } else if (kp > 0) { const p = Math.max(.08, kp); kp = 0; kc = 0; return [cos(ka) * p, sin(ka) * p] }
      return null;
    },
    draw(x, y, col, max = 150) {
      if (aim && hyp(...aim) > 12) { const m = Math.min(hyp(...aim), max) / hyp(...aim); ln(x, y, x + aim[0] * m, y + aim[1] * m, col, 3); ci(x + aim[0] * m, y + aim[1] * m, 4, col, 2) }
      else if (!aim) ln(x, y, x + cos(ka) * (30 + kp * 90), y + sin(ka) * (30 + kp * 90), col, 3);
    }
  };
}

E.pool = {
  t: 'Pool', c: 'sport', vs: 2, n: 1, v: [['NEON POOL', {}], ['POOL NINE BALL', { n: 2, pal: 'ICE' }], ['POOL SLICK', { sp: .6, pal: 'MINT' }], ['POOL BIG POCKETS', { sz: 1.4, pal: 'SUNSET' }], ['POOL DRUNK', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, X0 = 30, Y0 = 70, TW = 300, TH = 520, r = 11, pr = 17 * g.sz, cols = [K.a, K.b, K.c, K.d, K.e];
    const pockets = [[X0, Y0], [X0 + TW, Y0], [X0, Y0 + TH / 2], [X0 + TW, Y0 + TH / 2], [X0, Y0 + TH], [X0 + TW, Y0 + TH]];
    const cue = { x: W / 2, y: Y0 + TH - 110, vx: 0, vy: 0, cue: 1 }, B = [cue], s = [0, 0], am = aimer();
    let k = 0; const rows = g.n > 1 ? 4 : 3;
    for (let row = 0; row < rows; row++) for (let i = 0; i <= row; i++) B.push({ x: W / 2 + (i - row / 2) * (r * 2 + 1), y: Y0 + 150 - row * (r * 1.8), vx: 0, vy: 0, c: cols[k++ % 5] });
    let turn = 0, shots = 0, moving = 0, potted = 0, ct = 1, foul = 0;
    const still = () => B.every(b => hyp(b.vx, b.vy) < 4);
    const shoot = (vx, vy) => { cue.vx = vx * 900; cue.vy = vy * 900; moving = 1; potted = 0; foul = 0; shots++; sfx(300, .06) };
    const cpuShot = () => {
      let best = null;
      for (const b of B) if (!b.cue && !b.in) for (const [px, py] of pockets) {
        const dx = px - b.x, dy = py - b.y, d = hyp(dx, dy), gx = b.x - dx / d * r * 2, gy = b.y - dy / d * r * 2;
        const ax = gx - cue.x, ay = gy - cue.y, ad = hyp(ax, ay), cut = (ax * dx + ay * dy) / (ad * d);
        if (cut < .3) continue;
        const v = cut * 2 - (ad + d) / 600 + rnd(.2);
        if (!best || v > best.v) best = { v, ax: ax / ad, ay: ay / ad, p: clamp((ad + d) / 650 + .25, .35, 1) };
      }
      if (!best) { const t = B.find(b => !b.cue && !b.in); const a = atan2(t.y - cue.y, t.x - cue.x); best = { ax: cos(a), ay: sin(a), p: .7 } }
      const err = [.12, .05, .015][g.diff ?? 1], a = atan2(best.ay, best.ax) + rnd(-err, err);
      shoot(cos(a) * best.p, sin(a) * best.p);
    };
    return dt => {
      const subs = 4, h = dt / subs;
      for (let st = 0; st < subs; st++) {
        for (const b of B) if (!b.in) {
          b.x += b.vx * h; b.y += b.vy * h; const f = Math.pow(g.sp < 1 ? .6 : .42, h); b.vx *= f; b.vy *= f;
          if (b.x < X0 + r) { b.x = X0 + r; b.vx = abs(b.vx) * .85 } if (b.x > X0 + TW - r) { b.x = X0 + TW - r; b.vx = -abs(b.vx) * .85 }
          if (b.y < Y0 + r) { b.y = Y0 + r; b.vy = abs(b.vy) * .85 } if (b.y > Y0 + TH - r) { b.y = Y0 + TH - r; b.vy = -abs(b.vy) * .85 }
          if (pockets.some(([px, py]) => hyp(px - b.x, py - b.y) < pr)) {
            b.vx = b.vy = 0; boom(b.x, b.y, b.cue ? '#fff' : b.c, 20); sfx(b.cue ? 120 : 900, .2, 'triangle');
            if (b.cue) { foul = 1; b.x = W / 2; b.y = Y0 + TH - 110 } else { b.in = 1; potted++; s[turn]++ }
          }
        }
        for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
          const a = B[i], b = B[j]; if (a.in || b.in) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
          if (d < r * 2 && d > 0) { const nx = dx / d, ny = dy / d, p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny, o = (r * 2 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; if (p > 0) { a.vx -= p * nx; a.vy -= p * ny; b.vx += p * nx; b.vy += p * ny; if (p > 40) sfx(1400, .02, 'square', .02) } }
        }
      }
      const left = B.filter(b => !b.cue && !b.in).length;
      if (moving && still()) {
        moving = 0; for (const b of B) b.vx = b.vy = 0;
        if (foul && s[turn] > 0 && g.pl == 2) { s[turn]--; }
        if (!left) { if (g.pl == 1) { g.score = Math.max(100, 2000 - shots * 100); lose(g, 'CLEARED IN ' + shots + ' SHOTS') } else win(g, s[0] == s[1] ? -1 : s[0] > s[1] ? 0 : 1) }
        else if (g.pl == 2 && (!potted || foul)) turn ^= 1;
        ct = .8;
      }
      if (!moving && !g.over) {
        if (g.pl == 2 && turn == 1 && g.cpu) { if ((ct -= dt) <= 0) cpuShot() }
        else { const v = am.step(g.pl == 2 ? aimIn(g, turn) : P[0], dt); if (v) shoot(...v) }
      }
      rc(X0 - 10, Y0 - 10, TW + 20, TH + 20, K.e, 0, 3); rc(X0, Y0, TW, TH, K.e, .06, 1);
      for (const [px, py] of pockets) ci(px, py, pr, '#fff', 0, 2);
      ln(X0, Y0 + TH - 140, X0 + TW, Y0 + TH - 140, K.e, 1);
      for (const b of B) if (!b.in) ci(b.x, b.y, r, b.cue ? '#fff' : b.c, b.cue ? 0 : 1, 3);
      if (!moving && !g.over && !(g.cpu && turn == 1)) am.draw(cue.x, cue.y, turn ? K.b : K.a);
      if (g.pl == 2) { g.score = s[0]; g.hud = `P1 ${s[0]} · ${g.cpu ? 'CPU' : 'P2'} ${s[1]} · ${turn ? (g.cpu ? 'CPU' : 'P2') : 'P1'} TO SHOOT` }
      else g.hud = `BALLS LEFT ${left} · SHOTS ${shots}`;
    };
  }
};

E.reversi = {
  t: 'Reversi', c: 'puzzle', vs: 1, n: 1, v: [['NEON REVERSI', {}], ['REVERSI ICE', { pal: 'ICE' }], ['REVERSI TOXIC', { pal: 'TOXIC' }], ['REVERSI RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, Z = 40, X0 = 20, Y0 = 170, b = new Array(64).fill(0), WT = [100, -20, 10, 5, 5, 10, -20, 100, -20, -50, -2, -2, -2, -2, -50, -20, 10, -2, 1, 1, 1, 1, -2, 10, 5, -2, 1, 0, 0, 1, -2, 5, 5, -2, 1, 0, 0, 1, -2, 5, 10, -2, 1, 1, 1, 1, -2, 10, -20, -50, -2, -2, -2, -2, -50, -20, 100, -20, 10, 5, 5, 10, -20, 100];
    b[27] = b[36] = 2; b[28] = b[35] = 1;
    let turn = 0, cur = 19, ct = .6, end = 0, passMsg = 0;
    const flips = (bd, i, p) => {
      if (bd[i]) return []; const o = [], x = i % 8, y = i >> 3;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const l = []; let cx = x + dx, cy = y + dy; while (cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && bd[cy * 8 + cx] == 3 - p) { l.push(cy * 8 + cx); cx += dx; cy += dy } if (l.length && cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && bd[cy * 8 + cx] == p) o.push(...l) }
      return o;
    };
    const moves = (bd, p) => { const m = []; for (let i = 0; i < 64; i++) { const f = flips(bd, i, p); if (f.length) m.push([i, f]) } return m };
    const apply = (bd, i, f, p) => { const n = bd.slice(); n[i] = p; for (const j of f) n[j] = p; return n };
    const ev = bd => { let s = 0; for (let i = 0; i < 64; i++) s += bd[i] == 2 ? WT[i] : bd[i] == 1 ? -WT[i] : 0; return s + (moves(bd, 2).length - moves(bd, 1).length) * 3 };
    const mm = (bd, d, me, al, be) => { const p = me ? 2 : 1, ms = moves(bd, p); if (!d) return ev(bd); if (!ms.length) return moves(bd, 3 - p).length ? mm(bd, d - 1, !me, al, be) : (bd.filter(v => v == 2).length - bd.filter(v => v == 1).length) * 1000; let best = me ? -1e9 : 1e9; for (const [i, f] of ms) { const v = mm(apply(bd, i, f, p), d - 1, !me, al, be); if (me) { best = Math.max(best, v); al = Math.max(al, v) } else { best = Math.min(best, v); be = Math.min(be, v) } if (al >= be) break } return best };
    const play_ = (i, f) => { const nb = apply(b, i, f, turn + 1); for (let k = 0; k < 64; k++) b[k] = nb[k]; sfx(turn ? 330 : 520, .08, 'triangle'); boom(X0 + (i % 8) * Z + 20, Y0 + (i >> 3) * Z + 20, turn ? K.b : K.a, 8); turn ^= 1; ct = .5;
      if (!moves(b, turn + 1).length) { if (!moves(b, 2 - turn).length) end = 1.2; else { turn ^= 1; passMsg = 1.5 } } };
    return dt => {
      const c1 = b.filter(v => v == 1).length, c2 = b.filter(v => v == 2).length;
      if (end) { if ((end -= dt) <= 0) { g.score = c1; win(g, c1 == c2 ? -1 : c1 > c2 ? 0 : 1) } }
      else if (turn == 1 && g.cpu) {
        if ((ct -= dt) <= 0) { const ms = moves(b, 2); let best = ms[0], bv = -1e9; for (const m of ms) { const v = g.diff == 0 ? m[1].length + rnd(4) : g.diff == 2 ? mm(apply(b, m[0], m[1], 2), 3, false, -1e9, 1e9) : WT[m[0]] + m[1].length + rnd(3); if (v > bv) { bv = v; best = m } } play_(...best) }
      } else {
        const I = turnIn(g, turn); let hit = -1;
        if (I.dp) cur = clamp((cur >> 3) + (I.dp == 'd') - (I.dp == 'u'), 0, 7) * 8 + clamp(cur % 8 + (I.dp == 'r') - (I.dp == 'l'), 0, 7);
        if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < 8 && r < 8) hit = r * 8 + c } else if (I.ap) hit = cur;
        if (hit >= 0) { const f = flips(b, hit, turn + 1); if (f.length) play_(hit, f); else sfx(120, .05) }
      }
      const valid = end ? [] : moves(b, turn + 1).map(m => m[0]);
      rc(X0, Y0, 320, 320, K.e, .05, 2); for (let i = 1; i < 8; i++) { ln(X0 + i * Z, Y0, X0 + i * Z, Y0 + 320, K.e, 1); ln(X0, Y0 + i * Z, X0 + 320, Y0 + i * Z, K.e, 1) }
      for (let i = 0; i < 64; i++) { const x = X0 + (i % 8) * Z + 20, y = Y0 + (i >> 3) * Z + 20; if (b[i]) ci(x, y, 15, b[i] == 1 ? K.a : K.b, b[i] == 1 ? 1 : 2, 3); else if (valid.includes(i) && !(turn && g.cpu)) ci(x, y, 4, turn ? K.b : K.a, 2); if (i == cur && !P[0].touch && !end) rc(x - 19, y - 19, 38, 38, K.d, 0, 1) }
      tx(`P1 ${c1}`, 90, 520, 22, K.a); tx(`${g.cpu ? 'CPU' : 'P2'} ${c2}`, 270, 520, 22, K.b);
      if (!end) tx(turn ? (g.cpu ? 'CPU THINKING…' : 'P2 TURN') : 'P1 TURN', W / 2, 120, 22, turn ? K.b : K.a);
      if ((passMsg -= dt) > 0) tx('NO MOVES · PASS', W / 2, 580, 18, K.c);
      g.hud = 'MOST DISCS WINS';
    };
  }
};

E.boxes = {
  t: 'Dots & Boxes', c: 'puzzle', vs: 1, n: 5, v: [['NEON BOXES', {}], ['BOXES SMALL', { n: 4, pal: 'MINT' }], ['BOXES BIG', { n: 6, pal: 'ULTRA' }], ['BOXES RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, N = g.n, Z = 300 / (N - 1), X0 = 30, Y0 = 180, L = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) L.push({ h: 1, r, c, x: X0 + c * Z + Z / 2, y: Y0 + r * Z });
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) L.push({ h: 0, r, c, x: X0 + c * Z, y: Y0 + r * Z + Z / 2 });
    const own = new Array((N - 1) * (N - 1)).fill(0), s = [0, 0]; let turn = 0, cur = 0, ct = .5, end = 0;
    const lineAt = (h, r, c) => L.find(l => l.h == h && l.r == r && l.c == c);
    const boxSides = (r, c) => [lineAt(1, r, c), lineAt(1, r + 1, c), lineAt(0, r, c), lineAt(0, r, c + 1)];
    const boxesOf = l => (l.h ? [[l.r - 1, l.c], [l.r, l.c]] : [[l.r, l.c - 1], [l.r, l.c]]).filter(([r, c]) => r >= 0 && c >= 0 && r < N - 1 && c < N - 1);
    const take = l => {
      l.o = turn + 1; sfx(turn ? 330 : 520, .06, 'triangle'); let got = 0;
      for (const [r, c] of boxesOf(l)) if (boxSides(r, c).every(x => x.o)) { own[r * (N - 1) + c] = turn + 1; s[turn]++; got = 1; boom(X0 + c * Z + Z / 2, Y0 + r * Z + Z / 2, turn ? K.b : K.a, 12); sfx(900, .1, 'triangle') }
      if (!got) turn ^= 1; ct = .45;
      if (L.every(x => x.o)) end = 1;
    };
    const sidesAfter = l => boxesOf(l).map(([r, c]) => boxSides(r, c).filter(x => x.o).length + 1);
    return dt => {
      if (end) { if ((end -= dt) <= 0) { g.score = s[0]; win(g, s[0] == s[1] ? -1 : s[0] > s[1] ? 0 : 1) } }
      else if (turn == 1 && g.cpu) {
        if ((ct -= dt) <= 0) {
          const free = L.filter(l => !l.o), sm = g.diff ?? 1;
          const win4 = free.filter(l => sidesAfter(l).includes(4)), safe = free.filter(l => !sidesAfter(l).includes(3));
          take(sm > 0 && win4.length ? pick(win4) : sm == 0 && rnd() < .5 ? pick(free) : safe.length ? pick(safe) : win4.length ? pick(win4) : free.reduce((a, l) => sidesAfter(l).filter(v => v == 3).length < sidesAfter(a).filter(v => v == 3).length ? l : a));
        }
      } else {
        const I = turnIn(g, turn);
        if (I.dp) { const c = L[cur]; let best = cur, bd = 1e9; const [dx, dy] = DIRS[I.dp]; L.forEach((l, i) => { const ex = l.x - c.x, ey = l.y - c.y; if (ex * dx + ey * dy > 1) { const d = hyp(ex, ey) + abs(ex * dy - ey * dx); if (d < bd) { bd = d; best = i } } }); cur = best }
        if (I.ap && I.touch) { let bi = -1, bd = Z * .45; L.forEach((l, i) => { const d = hyp(l.x - I.tx, l.y - I.ty); if (!l.o && d < bd) { bd = d; bi = i } }); if (bi >= 0) take(L[bi]) }
        else if (I.ap && !L[cur].o) take(L[cur]);
      }
      own.forEach((o, i) => { if (o) rc(X0 + (i % (N - 1)) * Z + 5, Y0 + (i / (N - 1) | 0) * Z + 5, Z - 10, Z - 10, o == 1 ? K.a : K.b, 1, 1) });
      for (const [i, l] of L.entries()) {
        const col = l.o ? (l.o == 1 ? K.a : K.b) : K.e, w = l.o ? 4 : 1;
        if (l.h) ln(l.x - Z / 2 + 6, l.y, l.x + Z / 2 - 6, l.y, col, w); else ln(l.x, l.y - Z / 2 + 6, l.x, l.y + Z / 2 - 6, col, w);
        if (i == cur && !P[0].touch && !end && !l.o) ci(l.x, l.y, 6, K.d, 0, 2);
      }
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) ci(X0 + c * Z, Y0 + r * Z, 4, '#fff', 2);
      tx(`P1 ${s[0]}`, 90, 540, 22, K.a); tx(`${g.cpu ? 'CPU' : 'P2'} ${s[1]}`, 270, 540, 22, K.b);
      if (!end) tx(turn ? (g.cpu ? 'CPU…' : 'P2 TURN') : 'P1 TURN', W / 2, 130, 22, turn ? K.b : K.a);
      g.hud = 'CLOSE A BOX = GO AGAIN';
    };
  }
};

E.pairs = {
  t: 'Pairs', c: 'puzzle', vs: 0, n: 2, v: [['NEON PAIRS', {}], ['PAIRS EASY', { n: 1, pal: 'MINT' }], ['PAIRS HARD', { n: 3, pal: 'ULTRA' }], ['PAIRS RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, [C, R] = [[3, 4], [4, 4], [4, 6]][g.n - 1] || [4, 4], Z = Math.min(300 / C, 380 / R), X0 = (W - C * Z) / 2, Y0 = 140, cols = [K.a, K.b, K.c, K.d, K.e, '#fff'];
    const ids = []; for (let i = 0; i < C * R / 2; i++) ids.push(i, i); for (let i = ids.length - 1; i > 0; i--) { const j = ri(0, i);[ids[i], ids[j]] = [ids[j], ids[i]] }
    const cards = ids.map(id => ({ id, up: 0, done: 0 })); let open = [], wait = 0, moves = 0, T = 0, cur = 0, end = 0;
    const face = (id, x, y, r) => { const sh = id % 6, c = cols[(id / 6 | 0) * 2 % 6 + (id % 2)] || cols[id % 6]; if (sh == 0) ci(x, y, r, c, 1, 3); else pg(sh == 5 ? poly(x, y, r, 5, -PI / 2, r * .45) : poly(x, y, r, sh + 2, -PI / 2), c, 1, 1, 3) };
    return dt => {
      T += dt;
      if (end) { if ((end -= dt) <= 0) { g.score = Math.max(50, 1000 - moves * 20 - (T | 0) * 3); lose(g, `ALL PAIRS · ${moves} MOVES`) } }
      else if (wait > 0) { if ((wait -= dt) <= 0) { for (const c of open) c.up = 0; open = [] } }
      else {
        const I = P[0]; let hit = -1;
        if (I.dp) cur = clamp((cur / C | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, R - 1) * C + clamp(cur % C + (I.dp == 'r') - (I.dp == 'l'), 0, C - 1);
        if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < C && r < R) hit = r * C + c } else if (I.ap) hit = cur;
        if (hit >= 0 && !cards[hit].up && !cards[hit].done) {
          cards[hit].up = 1; open.push(cards[hit]); sfx(600, .04, 'triangle');
          if (open.length == 2) { moves++; if (open[0].id == open[1].id) { for (const c of open) c.done = 1; open = []; sfx(1000, .15, 'triangle'); if (cards.every(c => c.done)) end = 1 } else wait = .8 }
        }
      }
      cards.forEach((c, i) => {
        const x = X0 + (i % C) * Z + Z / 2, y = Y0 + (i / C | 0) * Z + Z / 2;
        rc(x - Z / 2 + 5, y - Z / 2 + 5, Z - 10, Z - 10, c.done ? K.d : K.e, c.up || c.done ? .08 : 1, c.done ? 1 : 2);
        if (c.up || c.done) face(c.id, x, y, Z * .28); else tx('?', x, y + 2, Z * .3, K.e);
        if (i == cur && !P[0].touch) rc(x - Z / 2 + 1, y - Z / 2 + 1, Z - 2, Z - 2, K.a, 0, 1);
      });
      g.hud = `MOVES ${moves} · ${T | 0}s`;
    };
  }
};

E.volley = {
  t: 'Volley', c: 'sport', vs: 1, n: 1, v: [['NEON VOLLEY', {}], ['VOLLEY MOON', { sp: .7, pal: 'ICE' }], ['VOLLEY HIGH NET', { n: 2, pal: 'TOXIC' }], ['VOLLEY GIANTS', { mods: ['giant'], pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, GY = 560, NH = g.n > 1 ? 150 : 110, br = 14, pr = 30 * g.sz, gr = 900 * g.sp, s = [0, 0];
    const Pl = [{ x: 90, y: GY, vy: 0, lo: pr, hi: W / 2 - 6 - pr, col: K.a }, { x: 270, y: GY, vy: 0, lo: W / 2 + 6 + pr, hi: W - pr, col: K.b }];
    let b, pause = 0;
    const serve = w => { b = { x: w ? 270 : 90, y: 220, vx: (w ? -1 : 1) * rnd(20, 60), vy: 0 }; pause = .8 };
    serve(0);
    return dt => {
      Pl.forEach((p, i) => {
        let mx, jump;
        if (i == 1 && g.cpu) {
          let lx = b.x, ly = b.y, lvx = b.vx, lvy = b.vy; for (let k = 0; k < 90 && ly < GY - pr; k++) { lvy += gr / 60; lx += lvx / 60; ly += lvy / 60; if (lx < br || lx > W - br) lvx = -lvx }
          const tgt = lx > W / 2 ? lx + 12 : 270; mx = clamp((tgt - p.x) / 30, -1, 1) * g.ai; jump = lx > W / 2 && abs(b.x - p.x) < 50 && b.y < p.y - 40 && b.y > p.y - 160 && b.vy > 0;
        } else { const I = P[i]; mx = I.tx != null ? clamp((I.tx - p.x) / 25, -1, 1) : I.x; jump = I.ap || I.y < -.6 }
        p.x = clamp(p.x + mx * 300 * dt, p.lo, p.hi);
        if (jump && p.y >= GY) { p.vy = -560; sfx(400, .05, 'triangle') }
        p.vy += gr * dt; p.y = Math.min(GY, p.y + p.vy * dt); if (p.y >= GY) p.vy = 0;
      });
      if (pause > 0) pause -= dt;
      else {
        b.vy += gr * .55 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < br || b.x > W - br) { b.vx = -b.vx; b.x = clamp(b.x, br, W - br) }
        if (b.y < br) { b.vy = abs(b.vy); b.y = br }
        if (b.y > GY - NH - br && abs(b.x - W / 2) < 4 + br) { if (b.y < GY - NH) { b.vy = -abs(b.vy) } else { b.vx = -b.vx; b.x = W / 2 + sgn(b.x - W / 2 || 1) * (4 + br) } }
        for (const p of Pl) {
          const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy);
          if (d < pr + br && dy < 4) { const nx = dx / d, ny = dy / d, rel = b.vx * nx + (b.vy - p.vy) * ny; b.x = p.x + nx * (pr + br); b.y = p.y + ny * (pr + br); if (rel < 0) { b.vx -= 2 * rel * nx; b.vy -= 2 * rel * ny; b.vy = Math.min(b.vy, -420); b.vx = clamp(b.vx, -380, 380); sfx(600, .04) } }
        }
        if (b.y > GY - br) { const w = b.x < W / 2 ? 1 : 0; s[w]++; boom(b.x, GY, K.c, 40, 250); buzz(80); sfx(w ? 200 : 800, .3, 'triangle'); if (s[w] >= 7) win(g, w); else serve(w) }
      }
      ln(0, GY, W, GY, K.e, 3); rc(W / 2 - 3, GY - NH, 6, NH, K.e, 1, 2);
      for (const p of Pl) { pg(poly(p.x, p.y, pr, 16, PI, 0).slice(0, 18).concat([p.x - pr, p.y]), p.col, 1, 1, 3); ci(p.x + (p === Pl[0] ? 10 : -10), p.y - pr * .55, 3, '#fff', 2) }
      ci(b.x, b.y, br, K.d, 1, 3);
      tx(s[0], 60, 80, 40, K.a); tx(s[1], 300, 80, 40, K.b);
      g.score = s[0]; g.hud = 'FIRST TO 7 · TAP = JUMP';
    };
  }
};

E.artillery = {
  t: 'Artillery', c: 'sport', vs: 1, n: 1, v: [['NEON ARTILLERY', {}], ['ARTILLERY STORM WIND', { n: 2, pal: 'ICE' }], ['ARTILLERY BIG BOOM', { sz: 1.5, pal: 'INFERNO' }], ['ARTILLERY MOON', { sp: .6, pal: 'ULTRA' }]],
  f(g) {
    const K = g.K, SW = 4, G = 300 * g.sp, ter = [], am = aimer(); let base = rnd(470, 540);
    for (let x = 0; x <= W; x += SW) { base = clamp(base + rnd(-6, 6), 400, 590); ter.push(base) }
    const gy = x => ter[clamp(Math.round(x / SW), 0, ter.length - 1)];
    const T = [{ x: 40, hp: 100, col: K.a }, { x: 320, hp: 100, col: K.b }];
    for (const t of T) { const i = Math.round(t.x / SW); for (let k = -6; k <= 6; k++) if (ter[i + k]) ter[i + k] = ter[i] }
    let turn = 0, shell = null, wind = 0, ct = 1, end = 0;
    const newWind = () => wind = rnd(-40, 40) * g.n;
    newWind();
    const sim = (x, y, vx, vy) => { for (let k = 0; k < 600; k++) { vx += wind * .01; vy += G * .01; x += vx * .01; y += vy * .01; if (x < 0 || x > W) return [x, 9e3]; if (y >= gy(x)) return [x, y] } return [x, 9e3] };
    const fire = (vx, vy) => { const t = T[turn]; shell = { x: t.x, y: gy(t.x) - 16, vx: vx * 520, vy: vy * 520 }; sfx(150, .3, 'sawtooth', .06) };
    return dt => {
      for (const t of T) t.y = gy(t.x);
      if (end) { if ((end -= dt) <= 0) win(g, T[0].hp > 0 ? 0 : 1) }
      else if (shell) {
        for (let k = 0; k < 4; k++) {
          const h = dt / 4; shell.vx += wind * h; shell.vy += G * h; shell.x += shell.vx * h; shell.y += shell.vy * h;
          if (shell.x < -20 || shell.x > W + 20 || shell.y > H) { shell = null; break }
          if (shell.y >= gy(shell.x)) {
            const R = 26 * g.sz, ex = shell.x; boom(ex, shell.y, K.d, 50, 260); buzz(80); sfx(80, .5, 'sawtooth', .07);
            for (let i = 0; i < ter.length; i++) { const d = abs(i * SW - ex); if (d < R) ter[i] = Math.min(620, Math.max(ter[i], shell.y + sqrt(R * R - d * d) * .8)) }
            for (const t of T) { const d = hyp(t.x - ex, t.y - 8 - shell.y); if (d < R + 16) t.hp -= Math.round(55 * (1 - d / (R + 16)) + 15) }
            shell = null; break;
          }
        }
        if (!shell) { if (T.some(t => t.hp <= 0)) end = 1; else { turn ^= 1; newWind(); ct = 1 } }
      } else if (turn == 1 && g.cpu) {
        if ((ct -= dt) <= 0) {
          let best = null; const tg = T[0].x;
          for (let a = -PI * .95; a < -PI * .52; a += .04) for (let p = .35; p <= 1; p += .05) { const [hx] = sim(T[1].x, gy(T[1].x) - 16, cos(a) * p * 520, sin(a) * p * 520), d = abs(hx - tg); if (!best || d < best.d) best = { d, a, p } }
          const e = [.12, .05, .02][g.diff ?? 1]; fire(cos(best.a + rnd(-e, e)) * best.p, sin(best.a + rnd(-e, e)) * best.p);
        }
      } else { const v = am.step(aimIn(g, turn), dt); if (v) fire(...v) }
      pg([0, H].concat(ter.flatMap((y, i) => [i * SW, y]), [W, H]), K.e, 1, .25, 2);
      T.forEach((t, i) => { rc(t.x - 14, t.y - 12, 28, 12, t.col, 1); ci(t.x, t.y - 12, 8, t.col, 1); rc(t.x - 20, t.y - 34, 40, 5, t.col); rc(t.x - 20, t.y - 34, 40 * Math.max(0, t.hp) / 100, 5, t.col, 2) });
      if (!shell && !end && !(turn == 1 && g.cpu)) am.draw(T[turn].x, T[turn].y - 16, T[turn].col);
      if (shell) ci(shell.x, shell.y, 4, '#fff', 2);
      const wx = W / 2; ln(wx, 60, wx + wind * 1.2, 60, K.c, 3); tx('WIND', wx, 76, 11, K.c);
      if (!end && !shell) tx(turn ? (g.cpu ? 'CPU AIMING…' : 'P2 FIRE') : 'P1 FIRE', W / 2, 110, 20, T[turn].col);
      g.score = T[0].hp > 0 && T[1].hp <= 0 ? 1 : 0; g.hud = 'DRAG BACK & RELEASE TO FIRE';
    };
  }
};

E.barrage = {
  t: 'Ball Barrage', c: 'puzzle', vs: 0, n: 1, v: [['NEON BARRAGE', {}], ['BARRAGE TOUGH', { n: 2, pal: 'BLOOD' }], ['BARRAGE FAST', { sp: 1.6, pal: 'TOXIC' }], ['BARRAGE RAINBOW', { mods: ['rainbow'] }], ['BARRAGE GHOST', { mods: ['ghost'], pal: 'ICE' }]],
  f(g) {
    const K = g.K, C = 7, Z = 48, X0 = 12, Y0 = 70, BY = 590, br = 6, cols = [K.a, K.b, K.c, K.d, K.e];
    let blocks = [], ups = [], lx = W / 2, nb = 1, turn = 0, balls = [], q = 0, qt = 0, aimA = null, ka = -PI / 2, firstX = null, state = 'aim';
    const row = () => { turn++; for (const b of blocks) b.r++; for (const u of ups) u.r++; const free = Array.from({ length: C }, (_, i) => i).sort(() => rnd() - .5); const k = ri(2, 5); for (let i = 0; i < k; i++) blocks.push({ c: free[i], r: 1, hp: turn * g.n + (rnd() < .2 ? turn : 0) }); ups.push({ c: free[k], r: 1 }) };
    row();
    return dt => {
      const I = P[0];
      if (state == 'aim') {
        let fire = null;
        if (I.touch) { const a = atan2(I.ty - BY, I.tx - lx); aimA = a < -.15 && a > -PI + .15 ? a : null }
        else { if (I.ar && aimA != null) fire = aimA; aimA = null; ka = clamp(ka + I.x * 1.6 * dt, -PI + .15, -.15); if (I.ap) fire = ka }
        if (fire != null) { aimA = fire; balls = []; q = nb; qt = 0; firstX = null; state = 'fly'; sfx(500, .05) }
      }
      if (state == 'fly') {
        if (q > 0 && (qt -= dt) <= 0) { qt = .07; q--; balls.push({ x: lx, y: BY, vx: cos(aimA) * 650 * g.sp, vy: sin(aimA) * 650 * g.sp }) }
        for (let st = 0; st < 3; st++) for (const b of balls) {
          if (b.done) continue; const h = dt / 3; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < X0 + br || b.x > X0 + C * Z - br) { b.vx = -b.vx; b.x = clamp(b.x, X0 + br, X0 + C * Z - br) }
          if (b.y < Y0 + br) { b.vy = abs(b.vy); b.y = Y0 + br }
          if (b.y > BY && b.vy > 0) { b.done = 1; if (firstX == null) firstX = b.x; continue }
          for (const k of blocks) { const x = X0 + k.c * Z, y = Y0 + k.r * Z; if (b.x > x - br && b.x < x + Z + br && b.y > y - br && b.y < y + Z + br) { const ox = Math.min(b.x - x + br, x + Z + br - b.x), oy = Math.min(b.y - y + br, y + Z + br - b.y); if (ox < oy) { b.vx = -b.vx; b.x += sgn(b.vx) * ox } else { b.vy = -b.vy; b.y += sgn(b.vy) * oy } k.hp--; g.score++; if (k.hp <= 0) { k.d = 1; boom(x + Z / 2, y + Z / 2, cols[k.c % 5], 12) } sfx(700 + rnd(300), .02, 'square', .015); break } }
          blocks = blocks.filter(k => !k.d);
          for (const u of ups) if (!u.d && hyp(b.x - (X0 + u.c * Z + Z / 2), b.y - (Y0 + u.r * Z + Z / 2)) < 14) { u.d = 1; nb++; sfx(1200, .1, 'triangle') }
        }
        ups = ups.filter(u => !u.d);
        if (!q && balls.every(b => b.done)) { lx = clamp(firstX ?? lx, 20, W - 20); row(); state = 'aim'; aimA = null; if (blocks.some(k => Y0 + k.r * Z + Z > BY - 10)) lose(g, 'ROUND ' + turn) }
      }
      for (const k of blocks) { const x = X0 + k.c * Z, y = Y0 + k.r * Z; rc(x + 3, y + 3, Z - 6, Z - 6, cols[Math.min(4, k.hp / 6 | 0)], 1, 2); tx(k.hp, x + Z / 2, y + Z / 2, 16, '#fff') }
      for (const u of ups) { const x = X0 + u.c * Z + Z / 2, y = Y0 + u.r * Z + Z / 2; ci(x, y, 10, K.d, 0, 2); tx('+', x, y, 14, K.d) }
      for (const b of balls) if (!b.done) ci(b.x, b.y, br, '#fff', 2);
      ln(0, BY + 8, W, BY + 8, K.e, 2); ci(lx, BY, br + 2, K.a, 2);
      if (state == 'aim') { const a = P[0].touch ? aimA : ka; if (a != null) for (let k = 1; k < 10; k++) ci(lx + cos(a) * k * 22, BY + sin(a) * k * 22, 2, K.a, 2) }
      g.hud = `ROUND ${turn} · BALLS ${nb} · ${g.score}`;
    };
  }
};

E.hoops = {
  t: 'Hoops', c: 'sport', vs: 0, n: 1, v: [['NEON HOOPS', {}], ['HOOPS MOVING RIM', { n: 2, pal: 'SUNSET' }], ['HOOPS MOON', { sp: .7, pal: 'ICE' }], ['HOOPS SMALL RIM', { sz: .75, pal: 'BLOOD' }], ['HOOPS RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, am = aimer(), RW = 70 * g.sz; let b, T = 60, hx = W / 2, hy = 200, ht = 0, streak = 0;
    const reset = () => b = { x: rnd(80, 280), y: 560, vx: 0, vy: 0, fly: 0, scored: 0 };
    reset();
    return dt => {
      T -= dt; if (T <= 0 && !b.fly) return lose(g, 'TIME! ' + g.score + ' PTS');
      ht += dt; if (g.n > 1 || g.score > 10) hx = W / 2 + sin(ht * (.8 + g.score / 40)) * 100;
      if (!b.fly) { const v = am.step(P[0], dt, 170); if (v) { b.vx = v[0] * 620; b.vy = v[1] * 1100; b.fly = 1; sfx(300, .06) } }
      else {
        const G = 980 * g.sp; for (let k = 0; k < 3; k++) {
          const h = dt / 3, py = b.y; b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h;
          for (const ex of [hx - RW / 2, hx + RW / 2]) { const d = hyp(b.x - ex, b.y - hy); if (d < 16) { const nx = (b.x - ex) / d, ny = (b.y - hy) / d, p = b.vx * nx + b.vy * ny; if (p < 0) { b.vx -= 1.6 * p * nx; b.vy -= 1.6 * p * ny; sfx(500, .03) } b.x = ex + nx * 16; b.y = hy + ny * 16 } }
          if (!b.scored && py < hy && b.y >= hy && abs(b.x - hx) < RW / 2 - 6 && b.vy > 0) { b.scored = 1; streak++; g.score += streak > 2 ? 3 : 2; sfx(1000, .25, 'triangle'); boom(hx, hy + 20, K.d, 30) }
          if (b.x < 12 || b.x > W - 12) { b.vx = -b.vx * .7; b.x = clamp(b.x, 12, W - 12) }
        }
        if (b.y > H + 30) { if (!b.scored) streak = 0; reset() }
      }
      rc(hx - 45, hy - 90, 90, 64, K.e, .05, 2); rc(hx - 18, hy - 60, 36, 26, K.e, 0, 1);
      ln(hx - RW / 2, hy, hx + RW / 2, hy, K.c, 4);
      for (let i = 0; i <= 4; i++) { const x1 = hx - RW / 2 + i * RW / 4; ln(x1, hy, hx - RW / 3 + i * RW / 6, hy + 34, K.e, 1) }
      ci(b.x, b.y, 15, K.a, 1, 3); ln(b.x - 15, b.y, b.x + 15, b.y, K.a, 1); ln(b.x, b.y - 15, b.x, b.y + 15, K.a, 1);
      if (!b.fly) am.draw(b.x, b.y, K.d, 170);
      rc(30, 40, 300, 6, K.e); rc(30, 40, 300 * Math.max(0, T) / 60, 6, K.d, 2);
      tx(g.score, W / 2, 330, 44, K.d); if (streak > 2) tx('ON FIRE ×' + streak, W / 2, 370, 16, K.c);
      g.hud = 'FLICK UP TO SHOOT';
    };
  }
};

E.goalie = {
  t: 'Goalie', c: 'sport', vs: 0, n: 1, v: [['NEON GOALIE', {}], ['GOALIE CURVEBALLS', { n: 2, pal: 'TOXIC' }], ['GOALIE PENALTY RUSH', { sp: 1.4, pal: 'INFERNO' }], ['GOALIE WIDE', { sz: 1.3, pal: 'MINT' }], ['GOALIE MIRROR', { mods: ['mirror'], pal: 'ICE' }]],
  f(g) {
    const K = g.K, GL = 50, GR = 310, GY = 600, kw = 64 * g.sz; let kx = W / 2, ball = null, t = 1, lives = 3, n = 0;
    return dt => {
      kx = follow(P[0], kx, 520, dt, GL, GR);
      if (!ball && (t -= dt) <= 0) { n++; const tx_ = rnd(GL + 10, GR - 10), sx = rnd(80, 280), T = rnd(.8, 1.2) / g.sp / (1 + n / 40); ball = { sx, sy: 120, tx: tx_, k: 0, T, curve: g.n > 1 ? rnd(-90, 90) : rnd(-20, 20) } }
      if (ball) {
        ball.k += dt / ball.T; const k = ball.k, x = ball.sx + (ball.tx - ball.sx) * k + sin(k * PI) * ball.curve, y = ball.sy + (GY - ball.sy) * k, r = 8 + k * 8;
        if (k > .9 && abs(x - kx) < kw / 2 + r && !ball.saved) { ball.saved = 1; g.score++; sfx(800, .1, 'triangle'); boom(x, y, K.d, 16); ball = null; t = rnd(.4, .9) }
        else if (k >= 1) { boom(x, GY, K.c, 40, 250); buzz(100); sfx(150, .4, 'sawtooth'); ball = null; t = .8; if (--lives <= 0) lose(g, 'SAVES ' + g.score) }
        else { ci(x, y, r, '#fff', 1, 2); ci(x, y, r * .4, K.d, 0, 1) }
      }
      pg([GL, GY + 20, GL, GY - 50, GR, GY - 50, GR, GY + 20], K.e, 0, 0, 4);
      for (let i = 1; i < 6; i++) ln(GL + i * (GR - GL) / 6, GY - 50, GL + i * (GR - GL) / 6, GY + 20, K.e, 1);
      pg(poly(W / 2, 120, 12, 3, -PI / 2), K.b, 1, 1);
      rc(kx - kw / 2, GY - 34, kw, 24, K.a, 1, 3); ci(kx, GY - 46, 10, K.a, 1, 3);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      tx(g.score, W / 2, 300, 44, K.d);
    };
  }
};

E.math = {
  t: 'Quick Math', c: 'puzzle', vs: 0, n: 1, v: [['NEON QUICK MATH', {}], ['MATH TIMES TABLES', { ops: 'x', pal: 'ICE' }], ['MATH HARD MODE', { n: 2, pal: 'BLOOD' }], ['MATH SPEED', { sp: 1.5, pal: 'TOXIC' }]],
  f(g) {
    const K = g.K, BX = [[30, 360], [190, 360], [30, 470], [190, 470]], key = { u: 0, r: 1, l: 2, d: 3 }; let q, ans, opts, t, lives = 3, flash = 0, lvl = 0;
    const next = () => {
      lvl++; const big = Math.min(12 * g.n + lvl, 99), op = g.ops == 'x' ? 'x' : pick(lvl < 5 ? ['+', '-'] : ['+', '-', 'x']);
      let a = ri(1, big), b = ri(1, big); if (op == 'x') { a = ri(2, Math.min(12, 3 + lvl / 2 | 0) * g.n); b = ri(2, 12) } if (op == '-' && b > a) [a, b] = [b, a];
      ans = op == '+' ? a + b : op == '-' ? a - b : a * b; q = `${a} ${op == 'x' ? '×' : op} ${b}`;
      const s = new Set([ans]); while (s.size < 4) s.add(Math.max(0, ans + ri(-10, 10))); opts = [...s].sort(() => rnd() - .5); t = Math.max(2.5, 7 - lvl * .12) / g.sp;
    };
    next(); let T0 = t;
    const answer = i => { if (opts[i] == ans) { g.score += 10 + Math.round(t * 5); sfx(900, .08, 'triangle'); boom(BX[i][0] + 70, BX[i][1] + 40, K.d, 10) } else { lives--; flash = .4; buzz(120); sfx(150, .3, 'sawtooth') } if (lives <= 0) lose(g); else { next(); T0 = t } };
    return dt => {
      t -= dt; flash -= dt; if (t <= 0) { lives--; flash = .4; sfx(150, .3, 'sawtooth'); if (lives <= 0) return lose(g); next(); T0 = t }
      const I = P[0];
      if (I.dp) answer(key[I.dp]);
      else if (I.ap && I.touch) BX.forEach(([x, y], i) => { if (I.tx > x && I.tx < x + 140 && I.ty > y && I.ty < y + 80) answer(i) });
      tx(q + ' = ?', W / 2, 220, 44, flash > 0 ? K.c : '#fff');
      rc(30, 290, 300, 8, K.e); rc(30, 290, 300 * Math.max(0, t / T0), 8, t < 1.5 ? K.c : K.d, 2);
      BX.forEach(([x, y], i) => { rc(x, y, 140, 80, [K.a, K.b, K.d, K.e][i], 1, 3); tx(opts[i], x + 70, y + 40, 30, '#fff') });
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = 'SCORE ' + g.score + ' · ARROWS ↑→←↓';
    };
  }
};
