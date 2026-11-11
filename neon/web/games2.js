'use strict';
// Versus engines: player 0 is bottom / P1, player 1 is top / P2 or the CPU.

function pushOut(o, r, w) { // circle o (x,y) vs rect w; returns true if it touched
  const nx = clamp(o.x, w.x, w.x + w.w), ny = clamp(o.y, w.y, w.y + w.h), d = hyp(o.x - nx, o.y - ny);
  if (d >= r) return false;
  if (d > 0) { o.x = nx + (o.x - nx) / d * r; o.y = ny + (o.y - ny) / d * r } else o.y = w.y - r;
  return true;
}
const inRect = (x, y, w) => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d };

E.tanks = {
  t: 'Tanks', c: 'arcade', vs: 1, n: 1, v: [['NEON TANKS', {}], ['TANKS RICOCHET', { n: 4 }], ['TANKS TURBO', { sp: 1.5, pal: 'TOXIC' }], ['TANKS DARK MAZE', { mods: ['ghost'], pal: 'ULTRA' }]],
  f(g) {
    const K = g.K, s = [0, 0], L = [
      [[80, 300, 200, 20], [40, 160, 20, 90], [300, 390, 20, 90]],
      [[60, 200, 90, 20], [210, 420, 90, 20], [170, 280, 20, 80]],
      [[40, 310, 100, 20], [220, 310, 100, 20], [170, 160, 20, 60], [170, 420, 20, 60]]];
    let T, B, walls, pause = 0, rs = 0;
    const reset = () => {
      walls = pick(L).map(([x, y, w, h]) => ({ x, y, w, h })).concat([{ x: -50, y: -50, w: W + 100, h: 50 }, { x: -50, y: H, w: W + 100, h: 50 }, { x: -50, y: 0, w: 50, h: H }, { x: W, y: 0, w: 50, h: H }]);
      T = [{ x: W / 2, y: 580, a: -PI / 2, cd: 0, col: K.a }, { x: W / 2, y: 60, a: PI / 2, cd: 1, col: K.b }]; B = [];
    };
    reset();
    const fire = (t, i) => { if (t.cd > 0) return; t.cd = .45; B.push({ x: t.x + cos(t.a) * 20, y: t.y + sin(t.a) * 20, vx: cos(t.a) * 300 * g.sp, vy: sin(t.a) * 300 * g.sp, b: g.n, o: i }); sfx(300, .08, 'sawtooth') };
    return dt => {
      if (pause > 0) pause -= dt;
      else T.forEach((t, i) => {
        t.cd -= dt;
        if (i == 1 && g.cpu) {
          const o = T[0], want = atan2(o.y - t.y, o.x - t.x), d = angDiff(t.a, want), dist = hyp(o.x - t.x, o.y - t.y);
          const ox = t.x, oy = t.y;
          if (t.esc > 0) { t.esc -= dt; t.a = t.ea; t.x += cos(t.a) * 110 * g.sp * dt; t.y += sin(t.a) * 110 * g.sp * dt } // backing out of a wall
          else {
            t.a += clamp(d, -2.6 * g.ai * dt, 2.6 * g.ai * dt);
            const v = (dist > 170 ? 1 : -.4) * 100 * g.sp; t.x += cos(t.a) * v * dt + sin(t.a + VIEWT()) * 40 * dt; t.y += sin(t.a) * v * dt;
            const los = ![...Array(16)].some((_, k) => walls.some(w => inRect(t.x + (o.x - t.x) * k / 16, t.y + (o.y - t.y) * k / 16, w))); // only shoot with a clear line
            if (los && abs(d) < .12 && rnd() < dt * 3 * g.ai) fire(t, i);
          }
          for (const w of walls) pushOut(t, 15, w);
          t.st = hyp(t.x - ox, t.y - oy) < 25 * dt ? (t.st || 0) + dt : 0;
          if (t.st > .5) { t.st = 0; t.esc = .8; t.ea = t.a + PI + rnd(-1, 1) }
        } else {
          const I = P[i], m = Math.min(1, hyp(I.x, I.y));
          if (m > .2) { t.a = atan2(I.y, I.x); t.x += cos(t.a) * 130 * g.sp * m * dt; t.y += sin(t.a) * 130 * g.sp * m * dt }
          if (I.ap) fire(t, i);
        }
        for (const w of walls) pushOut(t, 15, w);
      });
      for (const b of B) {
        b.x += b.vx * dt; if (walls.some(w => inRect(b.x, b.y, w))) { b.vx = -b.vx; b.x += b.vx * dt; b.b--; sfx(800, .02) }
        b.y += b.vy * dt; if (walls.some(w => inRect(b.x, b.y, w))) { b.vy = -b.vy; b.y += b.vy * dt; b.b--; sfx(800, .02) }
        T.forEach((t, i) => {
          if (b.b >= 0 && pause <= 0 && hyp(b.x - t.x, b.y - t.y) < 15 && (i != b.o || b.b < g.n)) {
            b.b = -1; s[1 - i]++; boom(t.x, t.y, t.col, 50, 300); buzz(120); sfx(100, .5, 'sawtooth', .07);
            if (s[1 - i] >= 5) win(g, 1 - i); else { pause = 1.2; rs = 1 }
          }
        });
      }
      B = B.filter(b => b.b >= 0); if (rs) { rs = 0; reset() }
      for (const w of walls) if (w.x >= 0 && w.x + w.w <= W) rc(w.x, w.y, w.w, w.h, K.e, 1);
      for (const t of T) { rc(t.x - 13, t.y - 13, 26, 26, t.col, 1); ln(t.x, t.y, t.x + cos(t.a) * 22, t.y + sin(t.a) * 22, t.col, 5); ci(t.x, t.y, 6, t.col) }
      for (const b of B) ci(b.x, b.y, 4, K.d, 2);
      g.score = s[0]; g.hud = `${s[0]} : ${s[1]} · FIRST TO 5`;
    };
    function VIEWT() { return performance.now() / 700 } // CPU weaves side to side
  }
};

E.sumo = {
  t: 'Sumo', c: 'party', vs: 1, n: 1, v: [['NEON SUMO', {}], ['SUMO SHRINK', { n: 2 }], ['SUMO ICE', { sp: 1.5, pal: 'ICE' }], ['SUMO GIANTS', { mods: ['giant'] }]],
  f(g) {
    const K = g.K, cx = W / 2, cy = H / 2, s = [0, 0], r = 22 * g.sz; let R, D, pause = 0, T = 0;
    const reset = () => { R = 160; T = 0; D = [{ x: cx, y: cy + 80, vx: 0, vy: 0, cd: 0, col: K.a }, { x: cx, y: cy - 80, vx: 0, vy: 0, cd: 0, col: K.b }] };
    reset();
    return dt => {
      T += dt; if (g.n > 1) R = Math.max(70, 160 - T * 6);
      if (pause > 0) pause -= dt;
      else {
        D.forEach((d, i) => {
          let ix, iy, dash;
          if (i == 1 && g.cpu) {
            const o = D[0], a = atan2(o.y - d.y, o.x - d.x), toC = hyp(d.x - cx, d.y - cy) > R * .7;
            ix = toC ? (cx - d.x) / R : cos(a); iy = toC ? (cy - d.y) / R : sin(a);
            dash = hyp(o.x - d.x, o.y - d.y) < 90 && rnd() < dt * 2 * g.ai;
          } else { const I = P[i]; ix = I.x; iy = I.y; dash = I.ap }
          const k = 520 * g.sp * (i == 1 && g.cpu ? g.ai : 1); d.vx += ix * k * dt; d.vy += iy * k * dt;
          d.cd -= dt; if (dash && d.cd <= 0 && hyp(ix, iy) > .1) { const m = hyp(ix, iy); d.vx += ix / m * 380; d.vy += iy / m * 380; d.cd = 1.2; sfx(400, .1, 'triangle'); boom(d.x, d.y, d.col, 8) }
          d.vx *= Math.pow(.35, dt); d.vy *= Math.pow(.35, dt); d.x += d.vx * dt; d.y += d.vy * dt;
        });
        const [a, b] = D, dx = b.x - a.x, dy = b.y - a.y, dd = hyp(dx, dy);
        if (dd < r * 2 && dd > 0) {
          const nx = dx / dd, ny = dy / dd, p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) { a.vx -= p * nx * 1.1; a.vy -= p * ny * 1.1; b.vx += p * nx * 1.1; b.vy += p * ny * 1.1; sfx(200, .05) }
          const o = (r * 2 - dd) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        }
        D.forEach((d, i) => {
          if (hyp(d.x - cx, d.y - cy) > R + r * .3) { s[1 - i]++; boom(d.x, d.y, d.col, 50, 300); buzz(120); sfx(120, .5, 'sawtooth'); if (s[1 - i] >= 5) win(g, 1 - i); else { pause = 1; reset() } }
        });
      }
      ci(cx, cy, R, K.e, 1, 4); ci(cx, cy, R * .3, K.e, 0, 1);
      for (const d of D) { ci(d.x, d.y, r, d.col, 1, 3); if (d.cd <= 0) ci(d.x, d.y, r * .4, '#fff', 0, 1) }
      g.score = s[0]; g.hud = `${s[0]} : ${s[1]} · FIRST TO 5 · TAP = DASH`;
    };
  }
};

E.hockey = {
  t: 'Hockey', c: 'sport', vs: 1, n: 1, v: [['NEON HOCKEY', {}], ['HOCKEY TURBO', { sp: 1.4, pal: 'INFERNO' }], ['HOCKEY WIDE GOALS', { n: 2 }], ['HOCKEY TINY', { mods: ['tiny'], pal: 'MINT' }]],
  f(g) {
    const K = g.K, gw = (g.n > 1 ? 160 : 120), mr = 26 * g.sz, pr = 15 * g.sz, s = [0, 0];
    const M = [{ x: W / 2, y: 560, vx: 0, vy: 0 }, { x: W / 2, y: 80, vx: 0, vy: 0 }]; let pk, idle = 0;
    const serve = d => pk = { x: W / 2, y: H / 2 + d * 60, vx: 0, vy: 0 };
    serve(1);
    return dt => {
      M.forEach((m, i) => {
        const ox = m.x, oy = m.y, lo = i ? mr : H / 2 + mr, hi = i ? H / 2 - mr : H - mr;
        if (i == 1 && g.cpu) {
          let tx_ = W / 2, ty_ = 90;
          if (pk.y < H / 2 + 20) {
            if (pk.y < m.y + 6) { tx_ = pk.x + (pk.x < W / 2 ? 50 : -50); ty_ = Math.max(mr, pk.y - mr - pr - 12) } // get goal-side of the puck first, never knock it into its own goal
            else { tx_ = pk.x + clamp((pk.x - W / 2) * .2, -15, 15); ty_ = pk.y - mr * .6 }
          }
          const v = 300 * g.sp * g.ai * dt, dx = tx_ - m.x, dy = ty_ - m.y, d = hyp(dx, dy) || 1; m.x += dx / d * Math.min(v, d); m.y += dy / d * Math.min(v, d);
        } else { const I = P[i]; if (I.tx != null) { m.x += (I.tx - m.x) * Math.min(1, dt * 25); m.y += (I.ty - m.y) * Math.min(1, dt * 25) } else { m.x += I.x * 420 * dt; m.y += I.y * 420 * dt } }
        m.x = clamp(m.x, mr, W - mr); m.y = clamp(m.y, lo, hi); m.vx = (m.x - ox) / Math.max(dt, .001); m.vy = (m.y - oy) / Math.max(dt, .001);
        const dx = pk.x - m.x, dy = pk.y - m.y, d = hyp(dx, dy);
        if (d < mr + pr && d > 0) {
          const nx = dx / d, ny = dy / d; pk.x = m.x + nx * (mr + pr); pk.y = m.y + ny * (mr + pr);
          const rel = (pk.vx - m.vx) * nx + (pk.vy - m.vy) * ny; if (rel < 0) { pk.vx -= 1.9 * rel * nx; pk.vy -= 1.9 * rel * ny; sfx(500, .04) }
        }
      });
      const sp = hyp(pk.vx, pk.vy), mx = 900 * g.sp; if (sp > mx) { pk.vx *= mx / sp; pk.vy *= mx / sp }
      pk.vx *= Math.pow(.7, dt); pk.vy *= Math.pow(.7, dt); pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      idle = hyp(pk.vx, pk.vy) < 30 ? idle + dt : 0;
      if (idle > 3) { idle = 0; pk.vy = (pk.y > H / 2 ? -1 : 1) * 140; pk.vx += rnd(-40, 40) } // a dead puck drifts to the centre line
      if (pk.x < pr || pk.x > W - pr) { pk.vx = -pk.vx; pk.x = clamp(pk.x, pr, W - pr); sfx(300, .03) }
      const inGoal = abs(pk.x - W / 2) < gw / 2;
      if (!inGoal && (pk.y < pr || pk.y > H - pr)) { pk.vy = -pk.vy; pk.y = clamp(pk.y, pr, H - pr); sfx(300, .03) }
      if (pk.y < -pr || pk.y > H + pr) {
        const w = pk.y < 0 ? 0 : 1; s[w]++; boom(pk.x, clamp(pk.y, 0, H), K.c, 50, 300); buzz(100); sfx(900, .4, 'triangle');
        if (s[w] >= 7) win(g, w); else serve(w ? 1 : -1);
      }
      ln(0, H / 2, W, H / 2, K.e, 1); ci(W / 2, H / 2, 50, K.e, 0, 1);
      ln(W / 2 - gw / 2, 2, W / 2 + gw / 2, 2, K.b, 6); ln(W / 2 - gw / 2, H - 2, W / 2 + gw / 2, H - 2, K.a, 6);
      ci(M[0].x, M[0].y, mr, K.a, 1, 3); ci(M[1].x, M[1].y, mr, K.b, 1, 3); ci(pk.x, pk.y, pr, K.c, 2);
      tx(s[0], 24, H / 2 + 30, 30, K.a); tx(s[1], 24, H / 2 - 30, 30, K.b);
      g.score = s[0]; g.hud = 'FIRST TO 7';
    };
  }
};

E.duel = {
  t: 'Quick Draw', c: 'party', vs: 1, n: 1, v: [['NEON QUICK DRAW', {}], ['QUICK DRAW PRO', { n: 2, pal: 'BLOOD' }], ['QUICK DRAW DRUNK', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, s = [0, 0]; let st = 'wait', t = rnd(1.5, 4), cpuT = 0, msg = '', who = -1;
    const pt = (w, why) => { s[w]++; who = w; msg = why; st = 'show'; t = 1.6; sfx(w == 0 ? 880 : 330, .3, 'triangle'); if (s[w] >= 5) win(g, w) };
    return dt => {
      t -= dt;
      const tap = [P[0].ap, g.cpu ? 0 : P[1].ap];
      if (st == 'wait') {
        if (tap[0] || tap[1]) pt(tap[0] ? 1 : 0, 'FALSE START!');
        else if (t <= 0) { st = 'go'; cpuT = rnd(.22, .5) / g.n / g.ai; sfx(1200, .15) }
      } else if (st == 'go') {
        if (g.cpu && (cpuT -= dt) <= 0) tap[1] = 1;
        if (tap[0] || tap[1]) { pt(tap[0] ? 0 : 1, 'FASTEST!'); boom(W / 2, tap[0] ? 480 : 160, tap[0] ? K.a : K.b, 50, 300) }
      } else if (t <= 0) { st = 'wait'; t = rnd(1.5, 4); msg = '' }
      const go = st == 'go';
      rc(10, H / 2 + 10, W - 20, H / 2 - 20, K.a, go ? 1 : 0, 3); rc(10, 10, W - 20, H / 2 - 20, K.b, go ? 1 : 0, 3);
      const big = go ? 'TAP!' : st == 'wait' ? 'WAIT…' : msg;
      tx(big, W / 2, H * .75, 44, go ? K.d : K.a); tx(big, W / 2, H * .25, 44, go ? K.d : K.b);
      if (st == 'show') tx(who == 0 ? 'POINT P1' : g.cpu ? 'POINT CPU' : 'POINT P2', W / 2, H / 2, 20, '#fff');
      tx(s[0], W / 2, H - 50, 30, K.a); tx(s[1], W / 2, 50, 30, K.b);
      g.score = s[0]; g.hud = 'FIRST TO 5';
    };
  }
};

E.tug = {
  t: 'Tug of War', c: 'party', vs: 1, n: 1, v: [['NEON TUG', {}], ['TUG MARATHON', { n: 2 }], ['TUG RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, goal = 180 * g.n; let p = 0, ct = 0, T = 0;
    return dt => {
      T += dt;
      if (P[0].ap) { p += 9; sfx(400 + p, .03) }
      if (g.cpu) { if ((ct -= dt) <= 0) { ct = 1 / (rnd(5, 7.5 + T / 20) * g.ai); p -= 9 } } else if (P[1].ap) { p -= 9; sfx(400 - p, .03) }
      const y = H / 2 + p * (220 / goal);
      ln(W / 2, 30, W / 2, H - 30, K.e, 3);
      for (let i = -3; i <= 3; i++) ln(W / 2 - 14, y + i * 14, W / 2 + 14, y + i * 14 + 7, K.e, 2);
      ci(W / 2, y, 16, K.d, 2);
      ln(40, H / 2 + 220, W - 40, H / 2 + 220, K.a, 4); ln(40, H / 2 - 220, W - 40, H / 2 - 220, K.b, 4);
      tx('MASH!', W / 2 - 100, H - 60, 22, K.a); tx('MASH!', W / 2 + 100, 60, 22, K.b);
      if (p >= goal) win(g, 0); else if (p <= -goal) win(g, 1);
      g.score = p > 0 ? 1 : 0; g.hud = 'PULL THE MARK TO YOUR LINE';
    };
  }
};

// ---- turn-based board games
E.c4 = {
  t: 'Four in a Row', c: 'puzzle', vs: 1, n: 2, v: [['NEON FOUR', {}], ['FOUR EASY', { n: 1, pal: 'MINT' }], ['FOUR HARD', { n: 3, pal: 'BLOOD' }]],
  f(g) {
    const K = g.K, CW = 46, X0 = 19, Y0 = 190, b = new Array(42).fill(0); let turn = 0, cur = 3, wl = null, end = 0, ct = .6;
    const col = c => { for (let r = 5; r >= 0; r--)if (!b[r * 7 + c]) return r; return -1 };
    const lines = []; for (let r = 0; r < 6; r++)for (let c = 0; c < 7; c++)for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const L = [0, 1, 2, 3].map(k => [r + dr * k, c + dc * k]); if (L.every(([a, d]) => a >= 0 && a < 6 && d >= 0 && d < 7)) lines.push(L.map(([a, d]) => a * 7 + d)) }
    const winner = () => { for (const L of lines) { const v = b[L[0]]; if (v && L.every(i => b[i] == v)) return [v, L] } return null };
    const evalB = () => { let s = 0; for (const L of lines) { let a = 0, o = 0; for (const i of L) { if (b[i] == 2) a++; else if (b[i] == 1) o++ } if (!o) s += [0, 1, 5, 40, 1e4][a]; if (!a) s -= [0, 1, 5, 40, 1e4][o] } return s };
    const mm = (d, al, be, me) => {
      const w = winner(); if (w) return w[0] == 2 ? 1e6 + d : -1e6 - d; if (!d || b.every(x => x)) return evalB();
      let best = me ? -1e9 : 1e9;
      for (const c of [3, 2, 4, 1, 5, 0, 6]) { const r = col(c); if (r < 0) continue; b[r * 7 + c] = me ? 2 : 1; const v = mm(d - 1, al, be, !me); b[r * 7 + c] = 0; if (me) { best = Math.max(best, v); al = Math.max(al, v) } else { best = Math.min(best, v); be = Math.min(be, v) } if (al >= be) break }
      return best;
    };
    const drop = c => { const r = col(c); if (r < 0) return; b[r * 7 + c] = turn + 1; sfx(turn ? 330 : 440, .1, 'triangle'); boom(X0 + c * CW + CW / 2, Y0 + r * CW + CW / 2, turn ? K.b : K.a, 10); const w = winner(); if (w) { wl = w[1]; end = 1.2; g.score = w[0] == 1 ? 1 : 0 } else if (b.every(x => x)) { end = 1.2; wl = [] } turn ^= 1; ct = .5 };
    return dt => {
      if (end) { if ((end -= dt) <= 0) { const w = winner(); win(g, w ? w[0] - 1 : -1) } }
      else if (turn == 1 && g.cpu) { if ((ct -= dt) <= 0) { let bc = 3, bv = -1e9; const d = clamp(([2, 4, 5][g.n - 1] || 4) + g.diff - 1, 1, 6); for (const c of [3, 2, 4, 1, 5, 0, 6]) { const r = col(c); if (r < 0) continue; b[r * 7 + c] = 2; const v = mm(d, -1e9, 1e9, false) + rnd(g.n == 1 || g.diff == 0 ? 300 : 1); b[r * 7 + c] = 0; if (v > bv) { bv = v; bc = c } } cur = bc; drop(bc) } }
      else {
        const I = turnIn(g, turn);
        if (I.dp == 'l') cur = Math.max(0, cur - 1); if (I.dp == 'r') cur = Math.min(6, cur + 1);
        if (I.touch && I.tx != null) cur = clamp((I.tx - X0) / CW | 0, 0, 6);
        if (I.ap) drop(cur);
      }
      rc(X0 - 4, Y0 - 4, CW * 7 + 8, CW * 6 + 8, K.e, 0, 3);
      for (let r = 0; r < 6; r++)for (let c = 0; c < 7; c++) { const v = b[r * 7 + c], hl = wl && wl.includes(r * 7 + c); ci(X0 + c * CW + CW / 2, Y0 + r * CW + CW / 2, 18, v ? (v == 1 ? K.a : K.b) : K.e, v ? (hl ? 2 : 1) : 0, v ? 3 : 1) }
      if (!end) { pg(poly(X0 + cur * CW + CW / 2, Y0 - 24, 12, 3, PI / 2), turn ? K.b : K.a, 1, 1); tx(turn ? (g.cpu ? 'CPU THINKING…' : 'P2 TURN') : 'P1 TURN', W / 2, 130, 22, turn ? K.b : K.a) }
      g.hud = 'CONNECT FOUR TO WIN';
    };
  }
};

E.ttt = {
  t: 'Tic Tac Toe', c: 'puzzle', vs: 1, n: 1, v: [['NEON TIC TAC TOE', {}], ['TIC TAC FIVE', { n: 2, pal: 'ICE' }], ['TIC TAC SEVEN', { n: 3, pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, N = [3, 5, 7][g.n - 1] || 3, L = N == 3 ? 3 : N == 5 ? 4 : 5, CS = 300 / N, X0 = 30, Y0 = 170, b = new Array(N * N).fill(0);
    let turn = 0, cur = (N * N) >> 1, end = 0, wl = null, ct = .5;
    const lines = []; for (let r = 0; r < N; r++)for (let c = 0; c < N; c++)for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const l = []; for (let k = 0; k < L; k++)l.push([r + dr * k, c + dc * k]); if (l.every(([a, d]) => a >= 0 && a < N && d >= 0 && d < N)) lines.push(l.map(([a, d]) => a * N + d)) }
    const winner = () => { for (const l of lines) { const v = b[l[0]]; if (v && l.every(i => b[i] == v)) return [v, l] } return null };
    const mm = me => { const w = winner(); if (w) return w[0] == 2 ? 1 : -1; if (b.every(x => x)) return 0; let best = me ? -2 : 2; for (let i = 0; i < N * N; i++)if (!b[i]) { b[i] = me ? 2 : 1; const v = mm(!me); b[i] = 0; best = me ? Math.max(best, v) : Math.min(best, v) } return best };
    const heur = () => { let bi = -1, bv = -1; for (let i = 0; i < N * N; i++)if (!b[i]) { let v = rnd(.5); for (const l of lines) if (l.includes(i)) { let a = 0, o = 0; for (const j of l) { if (b[j] == 2) a++; else if (b[j] == 1) o++ } if (!o) v += Math.pow(4, a) * 1.1; if (!a) v += Math.pow(4, o) } if (v > bv) { bv = v; bi = i } } return bi };
    const place = i => { if (b[i] || end) return; b[i] = turn + 1; sfx(turn ? 330 : 520, .1, 'triangle'); const w = winner(); if (w) { wl = w[1]; end = 1.2; g.score = w[0] == 1 ? 1 : 0 } else if (b.every(x => x)) { end = 1.2; wl = [] } turn ^= 1; ct = .4 };
    return dt => {
      if (end) { if ((end -= dt) <= 0) { const w = winner(); win(g, w ? w[0] - 1 : -1) } }
      else if (turn == 1 && g.cpu) { if ((ct -= dt) <= 0) { let bi = -1; if (g.diff == 0 && rnd() < .45) { const e = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); bi = pick(e) } else if (N == 3) { let bv = -9; for (let i = 0; i < 9; i++)if (!b[i]) { b[i] = 2; const v = mm(false) + rnd(.3); b[i] = 0; if (v > bv) { bv = v; bi = i } } } else bi = heur(); place(bi) } }
      else {
        const I = turnIn(g, turn), r = cur / N | 0, c = cur % N;
        if (I.dp) cur = clamp(r + (I.dp == 'd') - (I.dp == 'u'), 0, N - 1) * N + clamp(c + (I.dp == 'r') - (I.dp == 'l'), 0, N - 1);
        if (I.ap) { if (I.touch) { const cc = (I.tx - X0) / CS | 0, rr = (I.ty - Y0) / CS | 0; if (cc >= 0 && cc < N && rr >= 0 && rr < N && I.tx > X0 && I.ty > Y0) place(rr * N + cc) } else place(cur) }
      }
      for (let i = 1; i < N; i++) { ln(X0 + i * CS, Y0, X0 + i * CS, Y0 + 300, K.e, 2); ln(X0, Y0 + i * CS, X0 + 300, Y0 + i * CS, K.e, 2) }
      for (let i = 0; i < N * N; i++) {
        const x = X0 + (i % N) * CS + CS / 2, y = Y0 + (i / N | 0) * CS + CS / 2, q = CS * .3, hl = wl && wl.includes(i) ? 6 : 4;
        if (b[i] == 1) { ln(x - q, y - q, x + q, y + q, K.a, hl); ln(x + q, y - q, x - q, y + q, K.a, hl) } else if (b[i] == 2) ci(x, y, q, K.b, 0, hl);
        if (i == cur && !end && !(turn && g.cpu)) rc(x - CS / 2 + 4, y - CS / 2 + 4, CS - 8, CS - 8, K.d, 0, 1);
      }
      if (!end) tx(turn ? (g.cpu ? 'CPU…' : 'P2 · O') : 'P1 · X', W / 2, 120, 24, turn ? K.b : K.a);
      g.hud = `${L} IN A ROW WINS`;
    };
  }
};
