'use strict';
// Level-based puzzles and physics games. g.lv0 = level to start from (saved progress); engines report g.level.

// seeded random (mulberry32) so level N is always the same puzzle
const srnd = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a };
// circle b (x,y,vx,vy) vs segment; bounce with restitution e, plus an optional push along the normal (moving flippers)
function segHit(b, r, x1, y1, x2, y2, e = .6, push = 0) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1, k = clamp(((b.x - x1) * dx + (b.y - y1) * dy) / l, 0, 1);
  const px = x1 + dx * k, py = y1 + dy * k, d = hyp(b.x - px, b.y - py);
  if (d >= r || d == 0) return false;
  const nx = (b.x - px) / d, ny = (b.y - py) / d, vn = b.vx * nx + b.vy * ny;
  b.x = px + nx * r; b.y = py + ny * r;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny }
  if (push) { b.vx += nx * push; b.vy += ny * push }
  return true;
}
// one shared level header + "level clear" banner
function lvHud(g, lv, extra) { g.level = lv; g.hud = `LEVEL ${lv + 1}${extra ? ' · ' + extra : ''}` }
// on-canvas buttons along the bottom: returns index tapped
function btns(I, labels, K, y = 596) {
  const w = (W - 20) / labels.length; let hit = -1;
  labels.forEach((l, i) => { const x = 10 + i * w; rc(x + 4, y - 20, w - 8, 40, K.e, .1, 2); tx(l, x + w / 2, y, 14, '#fff'); if (I.ap && I.touch && I.ty > y - 22 && I.tx > x && I.tx < x + w) hit = i });
  return hit;
}

E.pinball = {
  t: 'Pinball', c: 'arcade', vs: 0, n: 1, v: [['NEON PINBALL', {}], ['PINBALL MULTIBALL', { n: 2, pal: 'INFERNO' }], ['PINBALL BIG FLIPPERS', { sz: 1.25, pal: 'MINT' }], ['PINBALL MOON', { sp: .7, pal: 'ICE' }], ['PINBALL TURBO', { sp: 1.3, pal: 'BLOOD' }]],
  f(g) {
    const K = g.K, br = 9, FL = 64 * g.sz, piv = [[112, 566], [248, 566]], fa = [.45, .45], fw = [0, 0];
    const walls = [[20, 200, 20, 470], [340, 200, 340, 470], [20, 470, 98, 540], [340, 470, 262, 540], [60, 400, 60, 460], [300, 400, 300, 460], [60, 460, 96, 494], [300, 460, 264, 494]];
    const arc = poly(180, 200, 160, 24, PI).slice(0, 26); for (let i = 0; i < arc.length - 2; i += 2) walls.push([arc[i], arc[i + 1], arc[i + 2], arc[i + 3]]);
    const bump = [[130, 210, 22], [230, 210, 22], [180, 290, 22], [100, 330, 14], [260, 330, 14]], lit = [0, 0, 0, 0, 0], hitT = bump.map(() => 0);
    let balls = [], lives = 3, mult = 1;
    const launch = () => { balls.push({ x: rnd(150, 210), y: 90, vx: rnd(-80, 80), vy: 60 }) };
    for (let i = 0; i < g.n; i++) launch();
    return dt => {
      const I = P[0], pts = I.pts || [], L = I.x < -.3 || (I.a && !I.touch) || pts.some(p => p[0] < W / 2), R_ = I.x > .3 || (I.a && !I.touch) || pts.some(p => p[0] >= W / 2);
      [L, R_].forEach((on, i) => { const t = on ? -.5 : .45, o = fa[i]; fa[i] += clamp(t - fa[i], -14 * dt, 14 * dt); fw[i] = (o - fa[i]) / Math.max(dt, .001); if (on && o > .3 && fa[i] <= .3) sfx(220, .04, 'square', .02) });
      const G = 640 * g.sp, sub = 5, h = dt / sub;
      for (let s = 0; s < sub; s++) for (const b of balls) {
        b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h;
        for (const w of walls) segHit(b, br, ...w, .5);
        bump.forEach(([x, y, r], k) => { const d = hyp(b.x - x, b.y - y); if (d < r + br) { const nx = (b.x - x) / d, ny = (b.y - y) / d; b.x = x + nx * (r + br); b.y = y + ny * (r + br); const vn = b.vx * nx + b.vy * ny; b.vx += (-2 * vn + 260) * nx; b.vy += (-2 * vn + 260) * ny; g.score += 100 * mult; hitT[k] = .15; sfx(600 + k * 90, .05, 'triangle'); boom(b.x, b.y, K.c, 6) } });
        piv.forEach(([px, py], i) => { const a = i ? PI - fa[i] : fa[i], tx_ = px + cos(a) * FL, ty_ = py + sin(a) * FL; const d = hyp(b.x - px, b.y - py); segHit(b, br + 4, px, py, tx_, ty_, .3, fw[i] > 1 ? fw[i] * d * .25 : 0) });
        for (let k = 0; k < 5; k++) { const x = 100 + k * 40; if (!lit[k] && abs(b.x - x) < 12 && abs(b.y - 120) < 12) { lit[k] = 1; g.score += 50 * mult; sfx(1200, .05, 'triangle'); if (lit.every(v => v)) { mult++; lit.fill(0); boom(180, 120, K.d, 40, 250); sfx(1500, .3, 'triangle') } } }
        const sp = hyp(b.vx, b.vy); if (sp > 1300) { b.vx *= 1300 / sp; b.vy *= 1300 / sp }
      }
      for (const b of balls) if (b.y > H + 20) b.d = 1;
      balls = balls.filter(b => !b.d);
      if (!balls.length) { mult = 1; sfx(150, .5, 'sawtooth'); buzz(120); if (--lives <= 0) return lose(g); for (let i = 0; i < g.n; i++) launch() }
      for (const w of walls) ln(...w, K.e, 3);
      bump.forEach(([x, y, r], k) => { ci(x, y, r, K.b, hitT[k] > 0 ? 2 : 1, 3); hitT[k] -= dt });
      for (let k = 0; k < 5; k++) ci(100 + k * 40, 120, 7, K.d, lit[k] ? 2 : 0, 2);
      piv.forEach(([px, py], i) => { const a = i ? PI - fa[i] : fa[i]; ln(px, py, px + cos(a) * FL, py + sin(a) * FL, K.a, 10); ci(px, py, 6, K.a, 2) });
      for (const b of balls) ci(b.x, b.y, br, '#fff', 2);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = `${g.score}${mult > 1 ? ' · ×' + mult : ''}`;
    };
  }
};

E.draw = {
  t: 'Line Rider', c: 'puzzle', vs: 0, n: 1, lv: 1, v: [['NEON LINE RIDER', {}], ['LINE RIDER TWIN BALLS', { n: 2, pal: 'ICE' }], ['LINE RIDER LOW INK', { sz: .7, pal: 'BLOOD' }], ['LINE RIDER MOON', { sp: .6, pal: 'ULTRA' }], ['LINE RIDER RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K; let lv = g.lv0 || 0, L, strokes, cur, balls, run, ink, wait = 0, tries = 0;
    const lay = () => {
      const r = srnd(lv * 7919 + g.n * 13); strokes = []; cur = null; run = 0; tries = 0;
      const sx = 40 + r() * 280, gx = 40 + r() * 280, obs = [], bad = [];
      for (let i = 0; i < Math.min(6, 1 + lv / 2 | 0); i++) obs.push({ x: 20 + r() * 260, y: 160 + r() * 330, w: 40 + r() * 80, h: 14 });
      for (let i = 0; i < Math.min(4, lv / 3 | 0); i++) bad.push({ x: 20 + r() * 280, y: 200 + r() * 300, w: 50, h: 12 });
      L = { sx, gx, gy: 545, obs: obs.filter(o => abs(o.x + o.w / 2 - gx) > 60 || o.y < 420), bad: bad.filter(o => abs(o.x - sx) > 70 && abs(o.x - gx) > 70) };
      ink = (900 - Math.min(400, lv * 25)) * g.sz; reset();
    };
    const reset = () => { balls = Array.from({ length: g.n }, (_, i) => ({ x: L.sx + i * 22, y: 70, vx: 0, vy: 0 })); run = 0 };
    lay();
    return dt => {
      const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        const b = btns(I, [run ? '■ STOP' : '▶ GO', '↶ UNDO', '✕ CLEAR'], K);
        if (b == 0) { if (run) reset(); else { run = 1; tries++; sfx(500, .06) } } else if (b == 1) { strokes.pop(); reset() } else if (b == 2) { strokes = []; reset() }
        if (!run && I.touch && I.ty < 570 && b < 0) {
          if (!cur) { cur = [I.tx, I.ty]; strokes.push(cur) }
          const lx = cur[cur.length - 2], ly = cur[cur.length - 1], d = hyp(I.tx - lx, I.ty - ly), used = strokes.reduce((a, s) => { let t = 0; for (let i = 2; i < s.length; i += 2) t += hyp(s[i] - s[i - 2], s[i + 1] - s[i - 1]); return a + t }, 0);
          if (d > 8 && used + d < ink) cur.push(I.tx, I.ty);
        } else cur = null;
        if (!I.touch && KP.Space) { run = !run; if (!run) reset() }
        if (run) for (let s = 0; s < 4; s++) for (const ba of balls) {
          if (ba.done) continue; const h = dt / 4; ba.vy += 600 * g.sp * h; ba.x += ba.vx * h; ba.y += ba.vy * h; ba.vx *= .999;
          for (const st of strokes) for (let i = 2; i < st.length; i += 2) segHit(ba, 9, st[i - 2], st[i - 1], st[i], st[i + 1], .25);
          for (const o of L.obs) { segHit(ba, 9, o.x, o.y, o.x + o.w, o.y, .3); segHit(ba, 9, o.x, o.y + o.h, o.x + o.w, o.y + o.h, .3); segHit(ba, 9, o.x, o.y, o.x, o.y + o.h, .3); segHit(ba, 9, o.x + o.w, o.y, o.x + o.w, o.y + o.h, .3) }
          if (L.bad.some(o => inRect(ba.x, ba.y, { ...o, x: o.x - 8, y: o.y - 8, w: o.w + 16, h: o.h + 16 })) || ba.y > 600 || ba.x < -20 || ba.x > W + 20) { boom(ba.x, Math.min(ba.y, 590), K.c, 20); sfx(150, .2); reset(); break }
          if (abs(ba.x - L.gx) < 26 && abs(ba.y - L.gy) < 16) { ba.done = 1; sfx(1000, .1, 'triangle') }
        }
        if (run && balls.every(b => b.done)) { g.score += Math.max(1, 4 - tries); wait = 1.2; sfx(1200, .4, 'triangle'); boom(L.gx, L.gy, K.d, 50, 260) }
      }
      ci(L.sx, 70, 14, K.a, 0, 2); pg([L.gx - 28, L.gy - 18, L.gx - 22, L.gy + 14, L.gx + 22, L.gy + 14, L.gx + 28, L.gy - 18], K.d, 0, .2, 3);
      for (const o of L.obs) rc(o.x, o.y, o.w, o.h, K.e, 1);
      for (const o of L.bad) { rc(o.x, o.y, o.w, o.h, K.c, 2); }
      for (const st of strokes) if (st.length > 2) pg(st, K.b, 0, 0, 4);
      for (const b of balls) if (!b.done || run) ci(b.x, b.y, 9, '#fff', 2);
      const used = strokes.reduce((a, s) => { let t = 0; for (let i = 2; i < s.length; i += 2) t += hyp(s[i] - s[i - 2], s[i + 1] - s[i - 1]); return a + t }, 0);
      rc(20, 34, 320, 5, K.e); rc(20, 34, 320 * Math.max(0, 1 - used / ink), 5, K.b, 2);
      if (wait > 0) tx('LEVEL CLEAR!', W / 2, 300, 30, K.d); else if (!strokes.length && !run) tx('DRAW A PATH, THEN TAP GO', W / 2, 140, 14, K.e);
      lvHud(g, lv, 'INK');
    };
  }
};

E.crates = {
  t: 'Crates', c: 'puzzle', vs: 0, n: 2, lv: 1, v: [['NEON CRATES', {}], ['CRATES SIMPLE', { n: 1, pal: 'MINT' }], ['CRATES TRICKY', { n: 3, pal: 'INFERNO' }], ['CRATES ICE', { pal: 'ICE' }], ['CRATES RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, C = 8, R = 10, Z = 40, X0 = 20, Y0 = 110; let lv = g.lv0 || 0, wall, goals, box, pl, hist, moves, wait = 0;
    const lay = () => { // build by pulling boxes backwards from a solved state, so every level can be solved
      const r = srnd(lv * 4099 + g.n * 31 + 5);
      for (let tryN = 0; tryN < 50; tryN++) {
        wall = new Uint8Array(C * R).map((_, i) => i % C == 0 || i % C == C - 1 || i < C || i >= C * (R - 1) ? 1 : 0);
        for (let i = 0; i < 4 + (r() * 6 | 0); i++) wall[(1 + (r() * (R - 2) | 0)) * C + 1 + (r() * (C - 2) | 0)] = 1;
        const free = [...wall.keys()].filter(i => !wall[i]); const k = Math.min(5, g.n + 1 + (lv / 4 | 0));
        shuffle(free, r); goals = new Set(free.slice(0, k)); box = new Set(goals); pl = free[k];
        const step = (a, d) => a + d[0] + d[1] * C;
        for (let s = 0; s < 120 + lv * 15; s++) {
          const d = Object.values(DIRS)[r() * 4 | 0], np = step(pl, d), behind = step(pl, [-d[0], -d[1]]);
          if (wall[np] || box.has(np)) continue;
          if (box.has(behind) && r() < .7) { box.delete(behind); box.add(pl) }
          pl = np;
        }
        if ([...box].filter(b => !goals.has(b)).length >= Math.min(k, 2)) break;
      }
      hist = []; moves = 0;
    };
    lay();
    return dt => {
      const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        const b = btns(I, ['↶ UNDO', '↻ RESTART'], K);
        if (b == 0 && hist.length) { [pl, box] = hist.pop(); moves++ } else if (b == 1) lay();
        const d = DIRS[b < 0 ? swipe(0) : ''];
        if (d) {
          const np = pl + d[0] + d[1] * C, nb = np + d[0] + d[1] * C;
          if (!wall[np] && (!box.has(np) || (!wall[nb] && !box.has(nb)))) {
            hist.push([pl, new Set(box)]); if (box.has(np)) { box.delete(np); box.add(nb); sfx(goals.has(nb) ? 900 : 300, .06, 'triangle') } else sfx(500, .02, 'triangle', .015);
            pl = np; moves++;
            if ([...box].every(x => goals.has(x))) { g.score += 1; wait = 1.2; sfx(1200, .4, 'triangle'); boom(W / 2, 300, K.d, 50, 260) }
          }
        }
      }
      for (let i = 0; i < C * R; i++) { const x = X0 + (i % C) * Z, y = Y0 + (i / C | 0) * Z; if (wall[i]) rc(x + 2, y + 2, Z - 4, Z - 4, K.e, 1, 2); if (goals.has(i)) ci(x + Z / 2, y + Z / 2, 8, K.d, 0, 2) }
      for (const i of box) { const x = X0 + (i % C) * Z, y = Y0 + (i / C | 0) * Z, on = goals.has(i); rc(x + 5, y + 5, Z - 10, Z - 10, on ? K.d : K.b, on ? 2 : 1, 3); ln(x + 5, y + 5, x + Z - 5, y + Z - 5, on ? '#fff' : K.b, 1); ln(x + Z - 5, y + 5, x + 5, y + Z - 5, on ? '#fff' : K.b, 1) }
      ci(X0 + (pl % C) * Z + Z / 2, Y0 + (pl / C | 0) * Z + Z / 2, 13, K.a, 1, 3);
      if (wait > 0) tx('LEVEL CLEAR!', W / 2, 80, 26, K.d);
      lvHud(g, lv, 'MOVES ' + moves);
    };
  }
};

E.picross = {
  t: 'Picross', c: 'puzzle', vs: 0, n: 1, lv: 1, v: [['NEON PICROSS', {}], ['PICROSS 7×7', { n: 2, pal: 'MINT' }], ['PICROSS 10×10', { n: 3, pal: 'ULTRA' }], ['PICROSS SUNSET', { pal: 'SUNSET' }], ['PICROSS ICE', { pal: 'ICE' }]],
  f(g) {
    const K = g.K, N = [5, 7, 10][g.n - 1] || 5, Z = Math.min(56, 260 / N), X0 = W - 20 - N * Z, Y0 = 200; let lv = g.lv0 || 0, sol, b, rows, cols, mode = 0, wait = 0, T = 0;
    const runs = a => { const o = []; let c = 0; for (const v of a) { if (v) c++; else if (c) { o.push(c); c = 0 } } if (c) o.push(c); return o.length ? o : [0] };
    const lay = () => { const r = srnd(lv * 613 + N); sol = Array.from({ length: N * N }, () => r() < .58 ? 1 : 0); b = new Array(N * N).fill(0); rows = []; cols = []; for (let i = 0; i < N; i++) { rows.push(runs(sol.slice(i * N, i * N + N))); cols.push(runs(sol.filter((_, j) => j % N == i))) } T = 0 };
    lay();
    return dt => {
      T += dt; const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        const t = btns(I, [mode ? '✕ MARK' : '■ FILL'], K); if (t == 0) mode ^= 1;
        if (I.ap && I.touch && I.ty < 570) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < N && r < N) { const i = r * N + c; b[i] = b[i] == (mode ? 2 : 1) ? 0 : mode ? 2 : 1; sfx(mode ? 300 : 600, .03, 'triangle') } }
        let ok = true; for (let i = 0; i < N && ok; i++) { if (String(runs(b.slice(i * N, i * N + N).map(v => v == 1))) != String(rows[i])) ok = false; if (String(runs(b.filter((_, j) => j % N == i).map(v => v == 1))) != String(cols[i])) ok = false }
        if (ok) { g.score++; wait = 1.4; sfx(1200, .4, 'triangle'); boom(W / 2, 330, K.d, 60, 300) }
      }
      for (let i = 0; i < N; i++) {
        const rowOk = String(runs(b.slice(i * N, i * N + N).map(v => v == 1))) == String(rows[i]), colOk = String(runs(b.filter((_, j) => j % N == i).map(v => v == 1))) == String(cols[i]);
        tx(rows[i].join(' '), X0 - 8, Y0 + i * Z + Z / 2, Math.min(14, Z * .45), rowOk ? K.d : K.e, 'right');
        cols[i].forEach((v, k) => tx(v, X0 + i * Z + Z / 2, Y0 - 10 - (cols[i].length - 1 - k) * 15, Math.min(14, Z * .45), colOk ? K.d : K.e));
      }
      for (let i = 0; i < N * N; i++) { const x = X0 + (i % N) * Z, y = Y0 + (i / N | 0) * Z; rc(x + 1, y + 1, Z - 2, Z - 2, K.e, 0, 1); if (b[i] == 1) rc(x + 3, y + 3, Z - 6, Z - 6, K.a, 2); if (b[i] == 2) { ln(x + 6, y + 6, x + Z - 6, y + Z - 6, K.c, 2); ln(x + Z - 6, y + 6, x + 6, y + Z - 6, K.c, 2) } }
      for (let i = 5; i < N; i += 5) { ln(X0 + i * Z, Y0, X0 + i * Z, Y0 + N * Z, K.b, 2); ln(X0, Y0 + i * Z, X0 + N * Z, Y0 + i * Z, K.b, 2) }
      if (wait > 0) tx('SOLVED!', W / 2, 90, 30, K.d);
      lvHud(g, lv, `${T | 0}s`);
    };
  }
};

E.sudoku = {
  t: 'Sudoku', c: 'puzzle', vs: 0, n: 3, lv: 1, v: [['NEON SUDOKU', {}], ['SUDOKU MINI 4×4', { n: 1, pal: 'MINT' }], ['SUDOKU 6×6', { n: 2, pal: 'ICE' }], ['SUDOKU EXPERT', { n: 3, hard: 1, pal: 'BLOOD' }], ['SUDOKU SUNSET', { pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, N = [4, 6, 9][g.n - 1] || 9, [BR, BC] = N == 4 ? [2, 2] : N == 6 ? [2, 3] : [3, 3], Z = 320 / N, X0 = 20, Y0 = 120;
    let lv = g.lv0 || 0, sol, fixed, b, sel = -1, wait = 0, T = 0;
    const box = i => ((i / N | 0) / BR | 0) * BR + ((i % N) / BC | 0);
    const ok = (a, i, v) => { for (let j = 0; j < N * N; j++) if (j != i && a[j] == v && ((j / N | 0) == (i / N | 0) || j % N == i % N || box(j) == box(i))) return false; return true };
    const lay = () => {
      const r = srnd(lv * 2741 + N * 7 + (g.hard ? 99 : 0)); sol = new Array(N * N).fill(0);
      const fill = i => { if (i == N * N) return true; for (const v of shuffle(Array.from({ length: N }, (_, k) => k + 1), r)) if (ok(sol, i, v)) { sol[i] = v; if (fill(i + 1)) return true; sol[i] = 0 } return false };
      fill(0);
      const keep = N == 4 ? .45 : N == 6 ? .5 : clamp(.48 - lv * .006 - (g.hard ? .1 : 0), .3, .5);
      fixed = sol.map(() => r() < keep); b = sol.map((v, i) => fixed[i] ? v : 0); sel = -1; T = 0;
    };
    lay();
    return dt => {
      T += dt; const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        if (I.dp) sel = sel < 0 ? 0 : clamp((sel / N | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, N - 1) * N + clamp(sel % N + (I.dp == 'r') - (I.dp == 'l'), 0, N - 1);
        let num = -1;
        if (I.ap && I.touch) {
          const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0;
          if (I.tx > X0 && I.ty > Y0 && c < N && r < N) sel = r * N + c;
          const pw = 320 / Math.min(N + 1, 10), py = Y0 + N * Z + 30;
          if (I.ty > py && I.ty < py + 50) { const k = (I.tx - X0) / pw | 0; if (k >= 0 && k <= N) num = k == N ? 0 : k + 1 }
        }
        for (let k = 0; k <= N; k++) if (KP['Digit' + k] || KP['Numpad' + k]) num = k;
        if (KP.Backspace || KP.Delete) num = 0;
        if (num >= 0 && sel >= 0 && !fixed[sel]) { b[sel] = num; sfx(num ? 500 + num * 40 : 200, .04, 'triangle'); if (b.every((v, i) => v && ok(b, i, v))) { g.score++; wait = 1.4; sfx(1200, .4, 'triangle'); boom(W / 2, 300, K.d, 60, 300) } }
      }
      for (let i = 0; i < N * N; i++) {
        const x = X0 + (i % N) * Z, y = Y0 + (i / N | 0) * Z, same = sel >= 0 && b[sel] && b[i] == b[sel];
        if (sel >= 0 && ((i / N | 0) == (sel / N | 0) || i % N == sel % N || box(i) == box(sel))) rc(x, y, Z, Z, K.e, .08, 0.01);
        if (i == sel) rc(x + 1, y + 1, Z - 2, Z - 2, K.a, 0, 2);
        if (b[i]) tx(b[i], x + Z / 2, y + Z / 2 + 1, Z * .55, fixed[i] ? '#fff' : !ok(b, i, b[i]) ? K.c : same ? K.d : K.b);
      }
      for (let k = 0; k <= N; k++) { const w = k % BC == 0 ? 3 : 1, h_ = k % BR == 0 ? 3 : 1; ln(X0 + k * Z, Y0, X0 + k * Z, Y0 + N * Z, K.e, w); ln(X0, Y0 + k * Z, X0 + N * Z, Y0 + k * Z, K.e, h_) }
      const pw = 320 / Math.min(N + 1, 10), py = Y0 + N * Z + 30;
      for (let k = 0; k <= N; k++) { const x = X0 + k * pw; rc(x + 2, py, pw - 4, 46, k == N ? K.c : K.a, .12, 2); tx(k == N ? '⌫' : k + 1, x + pw / 2, py + 23, 20, '#fff') }
      if (wait > 0) tx('SOLVED!', W / 2, 80, 30, K.d);
      lvHud(g, lv, `${T / 60 | 0}:${String(T % 60 | 0).padStart(2, '0')}`);
    };
  }
};

E.ballsort = {
  t: 'Ball Sort', c: 'puzzle', vs: 0, n: 2, lv: 1, v: [['NEON BALL SORT', {}], ['BALL SORT EASY', { n: 1, pal: 'MINT' }], ['BALL SORT HARD', { n: 3, pal: 'ULTRA' }], ['BALL SORT ICE', { pal: 'ICE' }], ['BALL SORT RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, cols = [K.a, K.b, K.c, K.d, K.e, '#ffffff', '#ff9f1a', '#4d7cff', '#c6ff2b']; let lv = g.lv0 || 0, T, sel = -1, hist, wait = 0, moves = 0;
    const lay = () => { const r = srnd(lv * 977 + g.n * 3), k = Math.min(9, 2 + g.n + (lv / 3 | 0)), all = shuffle([].concat(...Array.from({ length: k }, (_, c) => [c, c, c, c])), r); T = []; for (let i = 0; i < k; i++) T.push(all.slice(i * 4, i * 4 + 4)); T.push([], []); sel = -1; hist = []; moves = 0 };
    lay();
    const per = () => Math.min(7, T.length), tw = () => W / per();
    const pos = i => [tw() * (i % per()) + tw() / 2, i < per() ? 330 : 540];
    return dt => {
      const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        const b = btns(I, ['↶ UNDO', '↻ RESTART'], K, 612);
        if (b == 0 && hist.length) { T = hist.pop(); sel = -1 } else if (b == 1) lay();
        let hit = -1;
        if (I.ap && I.touch && I.ty < 585) T.forEach((_, i) => { const [x, y] = pos(i); if (abs(I.tx - x) < tw() / 2 && I.ty > y - 190 && I.ty < y + 20) hit = i });
        if (I.dp == 'l' || I.dp == 'r') sel = sel < 0 ? 0 : (sel + (I.dp == 'r' ? 1 : -1) + T.length) % T.length;
        if (hit >= 0) {
          if (sel < 0) { if (T[hit].length) sel = hit, sfx(600, .03, 'triangle') }
          else if (hit == sel) sel = -1;
          else { const a = T[sel], d = T[hit]; if (d.length < 4 && (!d.length || d[d.length - 1] == a[a.length - 1])) { hist.push(T.map(t => t.slice())); d.push(a.pop()); moves++; sfx(800, .05, 'triangle'); if (d.length == 4 && d.every(v => v == d[0])) boom(...pos(hit), cols[d[0]], 16); sel = -1; if (T.every(t => !t.length || (t.length == 4 && t.every(v => v == t[0])))) { g.score++; wait = 1.3; sfx(1200, .4, 'triangle') } } else { sfx(150, .05); sel = hit } }
        }
      }
      T.forEach((t, i) => {
        const [x, y] = pos(i); pg([x - 20, y - 170, x - 20, y, x + 20, y, x + 20, y - 170], i == sel ? K.a : K.e, 0, 0, 2);
        t.forEach((c, k) => ci(x, i == sel && k == t.length - 1 ? y - 200 : y - 20 - k * 38, 16, cols[c], 1, 3)); // the picked ball floats above its tube
      });
      if (wait > 0) tx('SORTED!', W / 2, 110, 30, K.d);
      lvHud(g, lv, 'MOVES ' + moves);
    };
  }
};

E.pipes = {
  t: 'Pipes', c: 'puzzle', vs: 0, n: 5, lv: 1, v: [['NEON PIPES', {}], ['PIPES SMALL', { n: 4, pal: 'MINT' }], ['PIPES BIG', { n: 7, pal: 'ULTRA' }], ['PIPES INFERNO', { pal: 'INFERNO' }], ['PIPES RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, N = g.n, Z = 320 / N, X0 = 20, Y0 = 150, B = { u: 1, r: 2, d: 4, l: 8 }; let lv = g.lv0 || 0, m, src, wait = 0, moves = 0, cur = 0;
    const rot = v => ((v << 1) | (v >> 3)) & 15;
    const lay = () => {
      const r = srnd(lv * 331 + N); m = new Array(N * N).fill(0); src = (N >> 1) * N + (N >> 1);
      const seen = new Set([src]), st = [src];
      while (st.length) { const c = st[st.length - 1], x = c % N, y = c / N | 0, nb = Object.entries(DIRS).filter(([, [dx, dy]]) => x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N && !seen.has((y + dy) * N + x + dx)); if (!nb.length || (r() < .25 && st.length > 1)) { st.pop(); continue } const [d, [dx, dy]] = nb[r() * nb.length | 0], n = (y + dy) * N + x + dx; m[c] |= B[d]; m[n] |= B[{ u: 'd', d: 'u', l: 'r', r: 'l' }[d]]; seen.add(n); st.push(n) }
      for (let i = 0; i < N * N; i++) for (let k = r() * 4 | 0; k > 0; k--) m[i] = rot(m[i]); moves = 0;
    };
    const powered = () => { const on = new Set([src]), q = [src]; while (q.length) { const c = q.pop(), x = c % N, y = c / N | 0; for (const [d, [dx, dy]] of Object.entries(DIRS)) { const n = (y + dy) * N + x + dx; if (x + dx < 0 || x + dx >= N || y + dy < 0 || y + dy >= N || on.has(n)) continue; if ((m[c] & B[d]) && (m[n] & B[{ u: 'd', d: 'u', l: 'r', r: 'l' }[d]])) { on.add(n); q.push(n) } } } return on };
    lay();
    return dt => {
      const I = P[0]; let hit = -1;
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else {
        if (I.dp) cur = clamp((cur / N | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, N - 1) * N + clamp(cur % N + (I.dp == 'r') - (I.dp == 'l'), 0, N - 1);
        if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < N && r < N) hit = r * N + c } else if (I.ap) hit = cur;
        if (hit >= 0) { m[hit] = rot(m[hit]); moves++; sfx(500, .03, 'triangle'); if (powered().size == N * N) { g.score++; wait = 1.3; sfx(1200, .4, 'triangle'); boom(W / 2, 330, K.d, 60, 300) } }
      }
      const on = powered();
      for (let i = 0; i < N * N; i++) {
        const x = X0 + (i % N) * Z + Z / 2, y = Y0 + (i / N | 0) * Z + Z / 2, c = on.has(i) ? K.a : K.e, w = on.has(i) ? 5 : 3;
        rc(x - Z / 2 + 2, y - Z / 2 + 2, Z - 4, Z - 4, K.e, 0, .5);
        for (const [d, [dx, dy]] of Object.entries(DIRS)) if (m[i] & B[d]) ln(x, y, x + dx * Z / 2, y + dy * Z / 2, c, w);
        if (i == src) ci(x, y, Z * .22, K.d, 2); else if ([1, 2, 4, 8].includes(m[i])) ci(x, y, Z * .14, c, 2);
        if (i == cur && !I.touch) rc(x - Z / 2 + 4, y - Z / 2 + 4, Z - 8, Z - 8, K.b, 0, 1);
      }
      if (wait > 0) tx('CONNECTED!', W / 2, 100, 30, K.d);
      lvHud(g, lv, 'TAP TO TURN · ' + moves);
    };
  }
};

E.tunnel = {
  t: 'Tunnel', c: 'arcade', vs: 0, n: 8, v: [['NEON TUNNEL', {}], ['TUNNEL HEX', { n: 6, pal: 'TOXIC' }], ['TUNNEL TWELVE', { n: 12, pal: 'ICE' }], ['TUNNEL WARP', { sp: 1.4, pal: 'ULTRA' }], ['TUNNEL DRUNK', { mods: ['drunk'], pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, N = g.n, cx = W / 2, cy = 300, R0 = 160; let pa = PI / 2, rings = [], t = 0, T = 0, spin = 0;
    return dt => {
      T += dt; g.score = T * 10 | 0; spin += dt * sin(T / 5) * .6;
      const I = P[0]; let d = I.x; if (I.tx != null) d = I.tx < cx ? -1 : 1; pa += d * 4.2 * dt;
      const v = (.55 + T / 80) * g.sp;
      if ((t -= dt) <= 0) { t = Math.max(.35, .9 - T / 90) / g.sp; const gap = ri(0, N - 1), w = T > 40 ? 1 : 2; rings.push({ z: 6, m: Array.from({ length: N }, (_, i) => { const k = (i - gap + N) % N; return k >= w && rnd() < .75 }) }) }
      const sec = ((Math.floor(((pa - spin) % TAU + TAU) % TAU / (TAU / N))) % N + N) % N;
      for (let z = (T * v * 2) % 1 + .4; z < 6; z += 1) { const r = R0 / z; pg(poly(cx, cy, r, N, spin), K.e, 1, 0, Math.max(.5, 2 / z)) }
      for (let i = 0; i < N; i++) { const a = spin + i * TAU / N; ln(cx + cos(a) * R0 / 6, cy + sin(a) * R0 / 6, cx + cos(a) * R0 / .4, cy + sin(a) * R0 / .4, K.e, .6) }
      for (const r of rings) {
        r.z -= v * dt * 2;
        if (r.z < 1.05 && r.z > .9 && r.m[sec] && !r.hit) { r.hit = 1; boom(cx + cos(pa) * R0 * .95, cy + sin(pa) * R0 * .95, K.a, 50, 260); buzz(150); lose(g) }
        if (r.z > .35) for (let i = 0; i < N; i++) if (r.m[i]) { const a = spin + i * TAU / N, b = a + TAU / N, ro = R0 / r.z, ri_ = ro * .78; pg([cx + cos(a) * ri_, cy + sin(a) * ri_, cx + cos(a) * ro, cy + sin(a) * ro, cx + cos(b) * ro, cy + sin(b) * ro, cx + cos(b) * ri_, cy + sin(b) * ri_], K.c, 1, r.z < 1.5 ? 1 : .5, Math.max(1, 3 / r.z)) }
      }
      rings = rings.filter(r => r.z > .3);
      const px = cx + cos(pa) * R0 * .9, py = cy + sin(pa) * R0 * .9; pg(poly(px, py, 12, 3, pa + PI), K.a, 1, 2);
      tx(g.score, W / 2, 560, 36, K.d);
    };
  }
};

E.sling = {
  t: 'Orbit Sling', c: 'puzzle', vs: 0, n: 1, lv: 1, v: [['NEON ORBIT SLING', {}], ['SLING HEAVY PLANETS', { n: 2, pal: 'INFERNO' }], ['SLING SMALL TARGET', { sz: .7, pal: 'BLOOD' }], ['SLING DRIFT', { sp: .7, pal: 'ICE' }], ['SLING RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, am = aimer(); let lv = g.lv0 || 0, pl, tg, pr, trail, wait = 0, shots = 0;
    const lay = () => {
      const r = srnd(lv * 1777 + g.n * 9); pl = [];
      for (let i = 0; i < Math.min(5, 1 + (lv / 2 | 0)); i++) { let p, ok = 0; for (let k = 0; k < 30 && !ok; k++) { p = { x: 50 + r() * 260, y: 170 + r() * 280, r: 14 + r() * 18 }; ok = pl.every(q => hyp(q.x - p.x, q.y - p.y) > q.r + p.r + 40) } p.m = p.r * p.r * 9 * g.n; pl.push(p) }
      tg = { x: 50 + r() * 260, y: 70 + r() * 60, r: 26 * g.sz }; reset(); shots = 0;
    };
    const reset = () => { pr = { x: W / 2, y: 570, vx: 0, vy: 0, fly: 0 }; trail = [] };
    lay();
    return dt => {
      const I = P[0];
      if (wait > 0) { if ((wait -= dt) <= 0) { lv++; lay() } }
      else if (!pr.fly) { const v = am.step(I, dt); if (v) { pr.vx = v[0] * 360; pr.vy = v[1] * 360; pr.fly = 1; shots++; sfx(400, .08) } }
      else {
        for (let s = 0; s < 6; s++) {
          const h = dt / 6;
          for (const p of pl) { const dx = p.x - pr.x, dy = p.y - pr.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2); if (d < p.r + 4) { boom(pr.x, pr.y, K.c, 30, 220); sfx(120, .3, 'sawtooth'); reset(); return } const a = p.m * g.sp / d2; pr.vx += dx / d * a * h; pr.vy += dy / d * a * h }
          pr.x += pr.vx * h; pr.y += pr.vy * h;
        }
        if (trail.length < 400) trail.push(pr.x, pr.y);
        if (hyp(pr.x - tg.x, pr.y - tg.y) < tg.r) { g.score++; wait = 1.2; pr.fly = 0; sfx(1200, .4, 'triangle'); boom(tg.x, tg.y, K.d, 50, 260) }
        else if (pr.x < -60 || pr.x > W + 60 || pr.y < -80 || pr.y > H + 40) reset();
      }
      for (const p of pl) { ci(p.x, p.y, p.r, K.b, 1, 3); ci(p.x, p.y, p.r * 1.8, K.b, 0, .5) }
      ci(tg.x, tg.y, tg.r, K.d, 0, 3); ci(tg.x, tg.y, tg.r * .45, K.d, 1, 2);
      if (trail.length > 2) pg(trail, K.a, 0, 0, 1.5);
      ci(pr.x, pr.y, 6, '#fff', 2);
      if (!pr.fly && !wait) am.draw(pr.x, pr.y, K.a);
      if (wait > 0) tx('ON TARGET!', W / 2, 300, 30, K.d);
      lvHud(g, lv, 'SHOTS ' + shots);
    };
  }
};

E.bowling = {
  t: 'Bowling', c: 'sport', vs: 0, n: 1, v: [['NEON BOWLING', {}], ['BOWLING HEAVY BALL', { sz: 1.3, pal: 'INFERNO' }], ['BOWLING SLICK LANE', { sp: 1.3, pal: 'ICE' }], ['BOWLING MOON', { sp: .7, pal: 'ULTRA' }], ['BOWLING RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, LX = 70, LW = 220, pinR = 9, am = aimer(), rolls = [], spots = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) spots.push([W / 2 + (i - row / 2) * 34, 150 - row * 30]);
    let pins, ball, frame = 0, roll = 0, settle = 0, standing, tenStart = 0;
    const rack = () => { pins = spots.map(([x, y]) => ({ x, y, sx: x, sy: y, vx: 0, vy: 0, down: 0 })) };
    const reBall = () => { ball = { x: W / 2, y: 570, vx: 0, vy: 0, r: 14 * g.sz, fly: 0 } };
    const scoreOf = () => { let s = 0, i = 0; for (let f = 0; f < 10 && i < rolls.length; f++) { if (rolls[i] == 10) { s += 10 + (rolls[i + 1] || 0) + (rolls[i + 2] || 0); i++ } else { s += (rolls[i] || 0) + (rolls[i + 1] || 0); if ((rolls[i] || 0) + (rolls[i + 1] || 0) == 10) s += rolls[i + 2] || 0; i += 2 } } return s };
    rack(); reBall(); standing = 10;
    return dt => {
      const I = P[0];
      if (!ball.fly && !settle) { const v = am.step(I, dt, 170); if (v && v[1] < -.1) { ball.vx = v[0] * 500; ball.vy = v[1] * 900 * g.sp; ball.fly = 1; sfx(120, .4, 'triangle', .06) } }
      if (ball.fly) {
        for (let s = 0; s < 4; s++) {
          const h = dt / 4; ball.x += ball.vx * h; ball.y += ball.vy * h;
          if (ball.x < LX + ball.r || ball.x > LX + LW - ball.r) { ball.vx = 0; ball.x = clamp(ball.x, LX + ball.r, LX + LW - ball.r) }
          for (const p of pins) { p.x += p.vx * h; p.y += p.vy * h; p.vx *= Math.pow(.2, h); p.vy *= Math.pow(.2, h) }
          const all = [ball, ...pins.filter(p => !p.gone)];
          for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const a = all[i], b = all[j], ra = a === ball ? ball.r : pinR, rb = pinR, dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
            if (d < ra + rb && d > 0) { const ma = a === ball ? 4 : 1, nx = dx / d, ny = dy / d, p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny, o = ra + rb - d; a.x -= nx * o * .5; a.y -= ny * o * .5; b.x += nx * o * .5; b.y += ny * o * .5; if (p > 0) { const k = 2 * p / (ma + 1); a.vx -= k * nx; a.vy -= k * ny; b.vx += k * ma * nx; b.vy += k * ma * ny; if (p > 60) sfx(900 + rnd(300), .03, 'square', .02) } }
          }
        }
        for (const p of pins) if (!p.down && hyp(p.x - p.sx, p.y - p.sy) > 5) { p.down = 1; boom(p.x, p.y, K.d, 6) }
        if (ball.y < 30 || abs(ball.vy) < 15) { ball.fly = 0; settle = 1 }
      }
      if (settle && (settle += dt) > 1.6) {
        settle = 0; const down = pins.filter(p => p.down && !p.gone).length; for (const p of pins) if (p.down) p.gone = 1;
        rolls.push(down); standing -= down;
        if (standing == 0) { sfx(1200, .3, 'triangle'); boom(W / 2, 120, K.a, 50, 260) }
        if (frame < 9) { if (roll == 0 && standing > 0) roll = 1; else { frame++; roll = 0; rack(); standing = 10; tenStart = rolls.length } }
        else { // 10th frame: a strike or spare earns a third ball
          roll++; const f = rolls.slice(tenStart);
          if (roll == 3 || (roll == 2 && f[0] + f[1] < 10)) frame = 10; else if (standing == 0) { rack(); standing = 10 }
        }
        g.score = scoreOf(); reBall();
        if (frame >= 10) return lose(g, 'FINAL SCORE ' + g.score);
      }
      rc(LX, 20, LW, 600, K.e, .05, 2); ln(LX + 4, 480, LX + LW - 4, 480, K.e, 1);
      for (let i = 1; i < 7; i++) pg(poly(LX + i * LW / 7, 420, 5, 3, -PI / 2), K.e, 1, 0, 1);
      for (const p of pins) if (!p.gone) ci(p.x, p.y, pinR, p.down ? K.c : '#fff', 1, 2);
      ci(ball.x, ball.y, ball.r, K.a, 1, 3);
      if (!ball.fly && !settle) am.draw(ball.x, ball.y, K.b, 170);
      let s = ''; for (let f = 0, i = 0; f < Math.min(10, frame + 1); f++) { const a = rolls[i], b = rolls[i + 1]; s += a == undefined ? '' : a == 10 ? 'X ' : b == undefined ? a + ' ' : a + b == 10 ? a + '/ ' : a + '' + b + ' '; i += a == 10 ? 1 : 2 }
      g.hud = `FRAME ${Math.min(10, frame + 1)} · ${g.score}`; tx(s.trim().slice(-30), W / 2, 34, 12, K.d);
    };
  }
};
