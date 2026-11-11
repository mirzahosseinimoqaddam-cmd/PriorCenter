'use strict';
// Skill and puzzle engines.

E.maze = {
  t: 'Maze', c: 'arcade', vs: 0, n: 2, v: [['NEON MAZE', {}], ['MAZE HUNTERS', { n: 4 }], ['MAZE CALM', { n: 1, sp: .8, pal: 'MINT' }], ['MAZE MIRROR', { mods: ['mirror'] }], ['MAZE DRUNK', { mods: ['drunk'], pal: 'ULTRA' }]],
  f(g) {
    const K = g.K, C = 9, R = 15, Z = 36, X0 = 18, Y0 = 60, BIT = { u: 1, r: 2, d: 4, l: 8 }, OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
    let wl, dots, pl, ch, lvl = 0;
    const build = () => {
      wl = new Array(C * R).fill(15); const seen = new Set([0]), st = [0];
      while (st.length) { const c = st[st.length - 1], x = c % C, y = c / C | 0; const nb = Object.entries(DIRS).filter(([, [dx, dy]]) => x + dx >= 0 && x + dx < C && y + dy >= 0 && y + dy < R && !seen.has((y + dy) * C + x + dx)); if (!nb.length) { st.pop(); continue } const [d, [dx, dy]] = pick(nb), n = (y + dy) * C + x + dx; wl[c] &= ~BIT[d]; wl[n] &= ~BIT[OPP[d]]; seen.add(n); st.push(n) }
      for (let i = 0; i < 25; i++) { const x = ri(1, C - 2), y = ri(1, R - 2), d = pick(['r', 'd']); wl[y * C + x] &= ~BIT[d]; const [dx, dy] = DIRS[d]; wl[(y + dy) * C + x + dx] &= ~BIT[OPP[d]] }
      dots = new Set(Array.from({ length: C * R }, (_, i) => i)); pl = { c: (R - 1) * C + 4, t: 0, d: '', nd: '', from: (R - 1) * C + 4 }; dots.delete(pl.c);
      ch = Array.from({ length: g.n + (lvl >> 1) }, (_, i) => ({ c: i % 2 ? C - 1 : 0, from: i % 2 ? C - 1 : 0, t: 0, d: '' }));
    };
    build();
    const can = (c, d) => d && !(wl[c] & BIT[d]);
    const step = (c, d) => c + DIRS[d][0] + DIRS[d][1] * C;
    const pos = o => { const a = o.from, b = o.c, k = o.t; return [X0 + ((a % C) * (1 - k) + (b % C) * k) * Z + Z / 2, Y0 + ((a / C | 0) * (1 - k) + (b / C | 0) * k) * Z + Z / 2] };
    const bfs = (s, t) => { const prev = new Map([[s, null]]), q = [s]; while (q.length) { const c = q.shift(); if (c == t) break; for (const d of 'urdl') if (can(c, d)) { const n = step(c, d); if (!prev.has(n)) { prev.set(n, [c, d]); q.push(n) } } } let c = t, d = ''; while (prev.get(c) && prev.get(c)[0] != s) c = prev.get(c)[0]; return prev.get(c) ? prev.get(c)[1] : d };
    const mv = (o, sp, dt, choose) => { o.t += sp * dt; if (o.t >= 1 || o.from == o.c) { o.from = o.c; o.t = 0; const d = choose(); if (d && can(o.c, d)) { o.c = step(o.c, d); o.d = d } } };
    return dt => {
      const s = swipe(0); if (s) pl.nd = s;
      mv(pl, 5 * g.sp, dt, () => can(pl.c, pl.nd) ? pl.nd : can(pl.c, pl.d) ? pl.d : '');
      if (pl.t > .5 && dots.delete(pl.c)) { g.score += 10; sfx(880 + (g.score % 50) * 4, .03, 'triangle', .02) }
      if (pl.from == pl.c && dots.delete(pl.c)) g.score += 10;
      for (const h of ch) mv(h, (3 + lvl * .3) * g.sp, dt, () => rnd() < .65 ? bfs(h.c, pl.c) : pick([...'urdl'].filter(d => can(h.c, d) && d != OPP[h.d]).concat([''])) || pick([...'urdl'].filter(d => can(h.c, d))));
      const [px, py] = pos(pl);
      for (const h of ch) { const [hx, hy] = pos(h); if (hyp(hx - px, hy - py) < Z * .55) { boom(px, py, K.a, 50, 250); lose(g) } }
      if (!dots.size) { lvl++; g.score += 500; sfx(1200, .4, 'triangle'); build() }
      for (let c = 0; c < C * R; c++) { const x = X0 + (c % C) * Z, y = Y0 + (c / C | 0) * Z, w = wl[c]; if (w & 1) ln(x, y, x + Z, y, K.e, 2); if (w & 8) ln(x, y, x, y + Z, K.e, 2); if ((w & 2) && c % C == C - 1) ln(x + Z, y, x + Z, y + Z, K.e, 2); if ((w & 4) && (c / C | 0) == R - 1) ln(x, y + Z, x + Z, y + Z, K.e, 2) }
      for (const c of dots) ci(X0 + (c % C) * Z + Z / 2, Y0 + (c / C | 0) * Z + Z / 2, 2.5, K.d, 2);
      ci(px, py, 11, K.a, 1, 3);
      for (const h of ch) { const [hx, hy] = pos(h); pg(poly(hx, hy, 13, 3, -PI / 2 + performance.now() / 300), K.c, 1, 1) }
      g.hud = `LEVEL ${lvl + 1} · ${g.score}`;
    };
  }
};

E.simon = {
  t: 'Echo', c: 'puzzle', vs: 0, n: 1, v: [['NEON ECHO', {}], ['ECHO FAST', { sp: 1.6, pal: 'ICE' }], ['ECHO REVERSE', { n: 2, pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, PADS = [[180, 220], [280, 330], [180, 440], [80, 330]], col = [K.a, K.b, K.c, K.d], tone = [330, 440, 550, 660], key = { u: 0, r: 1, d: 2, l: 3 };
    let seq = [ri(0, 3)], ph = 'show', i = 0, t = .8, lit = -1, lt = 0, inp = [];
    const flash = p => { lit = p; lt = .3 / g.sp; sfx(tone[p], .25 / g.sp, 'triangle', .06); boom(...PADS[p], col[p], 8) };
    return dt => {
      lt -= dt; if (lt <= 0) lit = -1;
      if (ph == 'show') { if ((t -= dt) <= 0) { if (i < seq.length) { flash(seq[i++]); t = .55 / g.sp } else { ph = 'in'; inp = [] } } }
      else {
        const I = P[0]; let p = -1;
        if (I.dp) p = key[I.dp];
        else if (I.ap && I.tx != null) PADS.forEach(([x, y], k) => { if (hyp(I.tx - x, I.ty - y) < 60) p = k });
        if (p >= 0) {
          flash(p); inp.push(p); const want = g.n > 1 ? seq[seq.length - inp.length] : seq[inp.length - 1];
          if (p != want) { buzz(150); lose(g, 'SEQUENCE ' + (seq.length - 1)) }
          else if (inp.length == seq.length) { g.score = seq.length; seq.push(ri(0, 3)); ph = 'show'; i = 0; t = .9 }
        }
      }
      PADS.forEach(([x, y], k) => pg(poly(x, y, 62, 4, PI / 4 + k * 0), col[k], 1, lit == k ? 2 : .12, lit == k ? 5 : 3));
      tx(ph == 'show' ? 'WATCH' : g.n > 1 ? 'REPEAT BACKWARDS' : 'REPEAT', W / 2, 560, 22, K.e);
      tx(g.score, W / 2, 330, 36, '#fff');
    };
  }
};

E.tapper = {
  t: 'Target', c: 'arcade', vs: 0, n: 1, v: [['NEON TARGETS', {}], ['TARGET FRENZY', { n: 3 }], ['TARGET TRAPS', { n: 2, traps: 1, pal: 'BLOOD' }], ['TARGET TINY', { mods: ['tiny'], pal: 'ICE' }]],
  f(g) {
    const K = g.K; let ts = [], t = 0, lives = 3, T = 0;
    return dt => {
      T += dt;
      if ((t -= dt) <= 0) { t = Math.max(.3, 1.1 - T / 60) / g.n; ts.push({ x: rnd(40, W - 40), y: rnd(90, H - 40), l: 0, life: Math.max(1, 2.2 - T / 50) / g.sp, bad: g.traps && rnd() < .25 }) }
      const I = P[0];
      if (I.ap && I.tx != null) {
        const h = ts.find(o => hyp(o.x - I.tx, o.y - I.ty) < 40 * g.sz);
        if (h) { h.d = 1; if (h.bad) { boom(h.x, h.y, K.c, 30); buzz(100); if (--lives <= 0) lose(g) } else { g.score++; boom(h.x, h.y, K.d, 16); sfx(800 + rnd(400), .05) } }
      }
      for (const o of ts) {
        o.l += dt; const k = o.l / o.life, r = 36 * g.sz * sin(Math.min(1, k) * PI);
        if (k >= 1) { o.d = 1; if (!o.bad) { sfx(150, .2); if (--lives <= 0) lose(g) } }
        if (o.bad) { ln(o.x - r * .7, o.y - r * .7, o.x + r * .7, o.y + r * .7, K.c, 4); ln(o.x + r * .7, o.y - r * .7, o.x - r * .7, o.y + r * .7, K.c, 4) }
        else { ci(o.x, o.y, r, K.d, 1, 3); ci(o.x, o.y, r * .5, K.a, 0, 2) }
      }
      ts = ts.filter(o => !o.d);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      tx(g.score, W / 2, 60, 36, K.e);
    };
  }
};

E.ring = {
  t: 'Orbit', c: 'arcade', vs: 0, n: 6, v: [['NEON ORBIT', {}], ['ORBIT SQUARE', { n: 4, pal: 'TOXIC' }], ['ORBIT OCTO', { n: 8, sp: 1.2 }], ['ORBIT DRUNK', { mods: ['drunk'], pal: 'ULTRA' }], ['ORBIT RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, cx = W / 2, cy = H / 2, N = g.n, PR = 70; let pa = PI / 2, rot = 0, ws = [], t = 0, T = 0;
    return dt => {
      T += dt; g.score = T * 10 | 0; rot += dt * (.6 + T / 60) * (sin(T / 4) > 0 ? 1 : -1);
      const I = P[0]; let d = I.x; if (I.tx != null) d = I.tx < cx ? -1 : 1; pa += d * 5.5 * dt;
      if ((t -= dt) <= 0) { t = Math.max(.55, 1.2 - T / 70) / g.sp; const gap = ri(0, N - 1); ws.push({ r: 420, m: Array.from({ length: N }, (_, i) => i != gap && (rnd() < .8 || i == (gap + 2) % N)) }) }
      const sec = ((Math.floor(((pa - rot) % TAU + TAU) % TAU / (TAU / N))) % N + N) % N;
      for (const w of ws) {
        w.r -= 170 * g.sp * (1 + T / 90) * dt;
        if (w.r < PR + 8 && w.r > PR - 8 && w.m[sec]) { boom(cx + cos(pa) * PR, cy + sin(pa) * PR, K.a, 50, 250); lose(g) }
        for (let i = 0; i < N; i++) if (w.m[i]) { const a = rot + i * TAU / N, b = a + TAU / N; ln(cx + cos(a) * w.r, cy + sin(a) * w.r, cx + cos(b) * w.r, cy + sin(b) * w.r, K.c, 7) }
      }
      ws = ws.filter(w => w.r > 20);
      pg(poly(cx, cy, 34, N, rot), K.e, 1, 1, 3);
      for (let i = 0; i < N; i++) { const a = rot + i * TAU / N; ln(cx + cos(a) * 34, cy + sin(a) * 34, cx + cos(a) * 460, cy + sin(a) * 460, K.e, 1) }
      pg(poly(cx + cos(pa) * PR, cy + sin(pa) * PR, 9, 3, pa), K.a, 1, 2);
      tx(g.score, W / 2, 50, 36, K.d);
    };
  }
};

E.lander = {
  t: 'Lander', c: 'arcade', vs: 0, n: 1, v: [['NEON LANDER', {}], ['LANDER HEAVY', { sp: 1.4, pal: 'INFERNO' }], ['LANDER MOON', { sp: .7, pal: 'ICE' }], ['LANDER MIRROR', { mods: ['mirror'] }]],
  f(g) {
    const K = g.K; let s, ter, pad, lvl = 0, fuel, done = 0;
    const lay = () => {
      ter = []; const pi = ri(1, 6); let y = 520;
      for (let i = 0; i <= 8; i++) { if (i != pi + 1) y = clamp(y + rnd(-70, 70), 380, 610); ter.push(i * 45, y) }
      pad = pi * 45; s = { x: rnd(60, 300), y: 70, vx: rnd(-30, 30), vy: 0, a: -PI / 2 }; fuel = 100;
    };
    lay();
    const gy = x => { const i = clamp(x / 45 | 0, 0, 7), k = (x - i * 45) / 45; return ter[i * 2 + 1] * (1 - k) + ter[i * 2 + 3] * k };
    return dt => {
      const I = P[0], gr = 60 * g.sp * (1 + lvl * .12);
      if (done > 0) { if ((done -= dt) <= 0) { lvl++; lay() } }
      else {
        s.a = clamp(s.a + I.x * 2.6 * dt, -PI, 0);
        const th = (I.a || I.y < -.5) && fuel > 0;
        if (th) { s.vx += cos(s.a) * 150 * dt; s.vy += sin(s.a) * 150 * dt; fuel -= 14 * dt; if (rnd() < .3) sfx(80, .05, 'sawtooth', .02) }
        s.vy += gr * dt; s.x = (s.x + s.vx * dt + W) % W; s.y += s.vy * dt;
        if (th) ln(s.x - cos(s.a) * 10, s.y - sin(s.a) * 10, s.x - cos(s.a) * (22 + rnd(10)), s.y - sin(s.a) * (22 + rnd(10)), K.c, 3);
        if (s.y + 9 >= gy(s.x)) {
          const onPad = s.x > pad + 4 && s.x < pad + 41, soft = abs(s.vy) < 55 && abs(s.vx) < 35 && abs(s.a + PI / 2) < .35;
          if (onPad && soft) { g.score += 100 + (fuel | 0) * 2; done = 1.2; s.vy = s.vx = 0; s.y = gy(s.x) - 9; sfx(880, .4, 'triangle'); boom(s.x, s.y, K.d, 30) }
          else { boom(s.x, s.y, K.a, 60, 260); lose(g) }
        }
      }
      pg(ter, K.e, 0, 0, 2); ln(pad, ter[(pad / 45) * 2 + 1], pad + 45, ter[(pad / 45) * 2 + 1], K.d, 6);
      const sa = s.a; pg([s.x + cos(sa) * 12, s.y + sin(sa) * 12, s.x + cos(sa + 2.4) * 10, s.y + sin(sa + 2.4) * 10, s.x + cos(sa - 2.4) * 10, s.y + sin(sa - 2.4) * 10], K.a, 1, 1);
      const ok = abs(s.vy) < 55 && abs(s.vx) < 35;
      rc(14, 34, 100, 8, K.e); rc(14, 34, fuel, 8, K.c, 2);
      tx(`V ${s.vy | 0} H ${s.vx | 0}`, W - 14, 38, 14, ok ? K.d : K.c, 'right');
      g.hud = `LEVEL ${lvl + 1} · ${g.score}`;
      if (done > 0) tx('LANDED!', W / 2, 200, 36, K.d);
    };
  }
};

E.golf = {
  t: 'Golf', c: 'sport', vs: 0, n: 1, v: [['NEON GOLF', {}], ['ICE GOLF', { sp: .6, pal: 'ICE' }], ['GOLF BIG CUP', { sz: 1.5, pal: 'MINT' }], ['GOLF DRUNK', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, cr = 12 * g.sz; let b, cup, walls, hole = 0, strokes = 0, aim = null, ka = -PI / 2, kp = 0, kc = 0, sink = 0;
    const lay = () => {
      b = { x: W / 2, y: 560, vx: 0, vy: 0 }; cup = { x: rnd(60, 300), y: rnd(90, 160) }; strokes = 0;
      walls = [{ x: 0, y: 0, w: 14, h: H }, { x: W - 14, y: 0, w: 14, h: H }, { x: 0, y: 40, w: W, h: 14 }, { x: 0, y: H - 14, w: W, h: 14 }];
      for (let i = 0; i < 2 + Math.min(hole, 3); i++) { const w = rnd(60, 160), h = rnd(14, 26); walls.push({ x: rnd(20, W - 20 - w), y: rnd(220, 470), w, h }) }
    };
    lay();
    return dt => {
      const I = P[0], still = hyp(b.vx, b.vy) < 6;
      if (sink > 0) { if ((sink -= dt) <= 0) { if (++hole >= 9) lose(g, 'COURSE SCORE ' + g.score); else lay() } }
      else if (still) {
        b.vx = b.vy = 0;
        if (I.touch) { aim = [-I.rx, -I.ry] }
        else if (I.ar && aim) { const m = Math.min(hyp(...aim), 150); if (m > 10) { const k = m / hyp(...aim); b.vx = aim[0] * k * 6; b.vy = aim[1] * k * 6; strokes++; sfx(300, .08) } aim = null }
        else if (!I.touch) {
          aim = null; ka += I.x * 2.5 * dt;
          if (I.a) { kc += dt; kp = 75 + 75 * sin(kc * 4 - PI / 2) } else if (kp > 0) { b.vx = cos(ka) * kp * 6; b.vy = sin(ka) * kp * 6; strokes++; kp = 0; kc = 0; sfx(300, .08) }
        }
      }
      const f = Math.pow(g.sp < 1 ? .55 : .3, dt); b.vx *= f; b.vy *= f;
      b.x += b.vx * dt; if (walls.some(w => inRect(b.x, b.y, w) || hyp(clamp(b.x, w.x, w.x + w.w) - b.x, clamp(b.y, w.y, w.y + w.h) - b.y) < 8)) { b.x -= b.vx * dt; b.vx = -b.vx * .8; sfx(600, .03) }
      b.y += b.vy * dt; if (walls.some(w => inRect(b.x, b.y, w) || hyp(clamp(b.x, w.x, w.x + w.w) - b.x, clamp(b.y, w.y, w.y + w.h) - b.y) < 8)) { b.y -= b.vy * dt; b.vy = -b.vy * .8; sfx(600, .03) }
      if (!sink && hyp(b.x - cup.x, b.y - cup.y) < cr && hyp(b.vx, b.vy) < 420) { sink = 1; g.score += Math.max(0, 6 - strokes) * 100; b.vx = b.vy = 0; b.x = cup.x; b.y = cup.y; sfx(1000, .4, 'triangle'); boom(cup.x, cup.y, K.d, 40) }
      for (const w of walls) rc(w.x, w.y, w.w, w.h, K.e, 1);
      ci(cup.x, cup.y, cr, K.d, 2); ln(cup.x, cup.y, cup.x, cup.y - 40, K.d, 2); pg([cup.x, cup.y - 40, cup.x + 20, cup.y - 33, cup.x, cup.y - 26], K.c, 1, 2);
      ci(b.x, b.y, 7, '#fff', 2);
      if (aim && hyp(...aim) > 10) { const m = Math.min(hyp(...aim), 150) / hyp(...aim); ln(b.x, b.y, b.x + aim[0] * m, b.y + aim[1] * m, K.a, 3) }
      else if (still && !I.touch && !sink) { ln(b.x, b.y, b.x + cos(ka) * (30 + kp * .6), b.y + sin(ka) * (30 + kp * .6), K.a, 3) }
      g.hud = `HOLE ${Math.min(hole + 1, 9)}/9 · STROKES ${strokes} · ${g.score}`;
    };
  }
};

E.jumper = {
  t: 'Jumper', c: 'arcade', vs: 0, n: 1, v: [['NEON JUMPER', {}], ['JUMPER MOVING', { n: 2 }], ['JUMPER TINY', { mods: ['tiny'], pal: 'TOXIC' }], ['JUMPER RAINBOW', { mods: ['rainbow'] }], ['JUMPER MIRROR', { mods: ['mirror'], pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, pw = 60 * g.sz; let p = { x: W / 2, y: 500, vy: -600 }, pl = [], top = 600, h = 0;
    const add = y => pl.push({ x: rnd(0, W - pw), y, v: g.n > 1 && rnd() < .35 ? rnd(40, 90) * (rnd() < .5 ? 1 : -1) : 0, br: rnd() < Math.min(.3, h / 20000) });
    for (let y = 600; y > -40; y -= 70) add(y); pl[0].x = W / 2 - pw / 2;
    return dt => {
      const I = P[0];
      p.x = I.tx != null ? p.x + (I.tx - p.x) * Math.min(1, dt * 10) : p.x + I.x * 330 * dt; p.x = (p.x + W) % W;
      p.vy += 1150 * g.sp * dt; p.y += p.vy * dt;
      for (const q of pl) {
        q.x += q.v * dt; if (q.x < 0 || q.x > W - pw) q.v = -q.v;
        if (p.vy > 0 && p.x > q.x - 6 && p.x < q.x + pw + 6 && p.y > q.y - 4 && p.y - p.vy * dt <= q.y + 2) { if (q.br) { q.dead = 1; boom(q.x + pw / 2, q.y, K.c, 12) } p.vy = -620 * Math.sqrt(g.sp); sfx(500, .06, 'triangle') }
      }
      if (p.y < 260) { const d = 260 - p.y; p.y = 260; h += d; for (const q of pl) q.y += d; top += d }
      pl = pl.filter(q => !q.dead && q.y < H + 20); while (pl.length < 12 || Math.min(...pl.map(q => q.y)) > 0) add(Math.min(...pl.map(q => q.y)) - rnd(55, 95));
      if (p.y > H + 30) lose(g);
      g.score = h / 10 | 0;
      for (const q of pl) rc(q.x, q.y, pw, 8, q.br ? K.c : q.v ? K.b : K.d, 1);
      ci(p.x, p.y - 12, 12, K.a, 1, 3); ci(p.x - 4, p.y - 15, 2, '#fff', 2); ci(p.x + 4, p.y - 15, 2, '#fff', 2);
      tx(g.score, W / 2, 60, 36, K.e);
    };
  }
};

E.racer = {
  t: 'Racer', c: 'sport', vs: 0, n: 3, v: [['NEON RACER', {}], ['RACER HIGHWAY', { n: 5 }], ['RACER NIGHT', { mods: ['ghost'], pal: 'ULTRA' }], ['RACER TURBO', { sp: 1.5, pal: 'INFERNO' }], ['RACER UPSIDE', { mods: ['flip'] }]],
  f(g) {
    const K = g.K, N = g.n, LW = 300 / N, X0 = 30; let x = W / 2, cars = [], d = 0, spd = 300 * g.sp, t = 0;
    return dt => {
      spd += 6 * dt; d += spd * dt; g.score = d / 20 | 0;
      x = follow(P[0], x, 380, dt, X0 + 14, X0 + 286);
      if ((t -= dt) <= 0) { t = rnd(.4, 1) * 300 / spd; cars.push({ x: X0 + ri(0, N - 1) * LW + LW / 2, y: -60, v: rnd(.3, .6), c: pick([K.b, K.c, K.d]) }) }
      for (const c of cars) {
        c.y += spd * c.v * dt;
        if (abs(c.x - x) < 26 && abs(c.y - 560) < 50) { boom(x, 560, K.a, 60, 260); lose(g) }
        rc(c.x - 14, c.y - 24, 28, 48, c.c, 1); ln(c.x - 8, c.y + 24, c.x + 8, c.y + 24, K.c, 3);
      }
      cars = cars.filter(c => c.y < H + 60);
      ln(X0, 0, X0, H, K.e, 3); ln(X0 + 300, 0, X0 + 300, H, K.e, 3);
      for (let i = 1; i < N; i++) for (let y = (d % 60) - 60; y < H; y += 60) ln(X0 + i * LW, y, X0 + i * LW, y + 30, K.e, 2);
      rc(x - 14, 536, 28, 48, K.a, 1); ln(x - 9, 536, x - 9, 520 - rnd(20), K.d, 2); ln(x + 9, 536, x + 9, 520 - rnd(20), K.d, 2);
      tx(g.score, W / 2, 50, 36, K.d);
    };
  }
};

E.mines = {
  t: 'Mines', c: 'puzzle', vs: 0, n: 2, v: [['NEON MINES', {}], ['MINES EASY', { n: 1, pal: 'MINT' }], ['MINES EXPERT', { n: 3, pal: 'BLOOD' }]],
  f(g) {
    const K = g.K, C = 9, R = 13, Z = 36, X0 = 18, Y0 = 70, M = [12, 18, 26][g.n - 1] || 18;
    let mine = null, rev = new Uint8Array(C * R), flag = new Uint8Array(C * R), cur = 0, mode = 0, T = 0, done = 0;
    const nb = i => { const x = i % C, y = i / C | 0, o = []; for (let dy = -1; dy <= 1; dy++)for (let dx = -1; dx <= 1; dx++)if ((dx || dy) && x + dx >= 0 && x + dx < C && y + dy >= 0 && y + dy < R) o.push((y + dy) * C + x + dx); return o };
    const cnt = i => nb(i).filter(j => mine[j]).length;
    const open = i => {
      if (!mine) { mine = new Uint8Array(C * R); const safe = new Set([i, ...nb(i)]); let k = 0; while (k < M) { const j = ri(0, C * R - 1); if (!mine[j] && !safe.has(j)) { mine[j] = 1; k++ } } }
      if (rev[i] || flag[i]) return;
      if (mine[i]) { rev.fill(1); done = 1; boom(X0 + (i % C) * Z + 18, Y0 + (i / C | 0) * Z + 18, K.c, 60, 300); buzz(200); sfx(90, .6, 'sawtooth', .07); setT = 1.2; return }
      const q = [i]; while (q.length) { const c = q.pop(); if (rev[c]) continue; rev[c] = 1; if (!cnt(c)) for (const j of nb(c)) if (!rev[j] && !flag[j]) q.push(j) }
      sfx(600, .04, 'triangle');
      if ([...rev].filter((v, j) => v && !mine[j]).length == C * R - M) { done = 2; g.score = Math.max(100, 3000 - (T | 0) * 10); sfx(1200, .4, 'triangle'); setT = 1.2 }
    };
    let setT = 0;
    return dt => {
      if (done) { if ((setT -= dt) <= 0) lose(g, done == 2 ? 'CLEARED! ' + g.score : 'BOOM') }
      else {
        T += dt; const I = P[0];
        if (I.dp) cur = clamp((cur / C | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, R - 1) * C + clamp(cur % C + (I.dp == 'r') - (I.dp == 'l'), 0, C - 1);
        if (I.ap && I.touch) {
          if (I.ty > 560) mode ^= 1;
          else { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < C && r < R) { cur = r * C + c; if (mode && !rev[cur]) flag[cur] ^= 1; else open(cur) } }
        } else if (I.ap) open(cur);
        if (KP.KeyX && !rev[cur]) flag[cur] ^= 1;
      }
      for (let i = 0; i < C * R; i++) {
        const x = X0 + (i % C) * Z, y = Y0 + (i / C | 0) * Z;
        if (rev[i]) { if (mine && mine[i]) pg(poly(x + 18, y + 18, 11, 6, 0, 5), K.c, 1, 2); else { const n = mine ? cnt(i) : 0; rc(x + 2, y + 2, Z - 4, Z - 4, K.e, .08, 1); if (n) tx(n, x + 18, y + 19, 18, [K.b, K.d, K.a, K.c][Math.min(3, n - 1)]) } }
        else { rc(x + 2, y + 2, Z - 4, Z - 4, K.e, 1, 2); if (flag[i]) pg([x + 12, y + 28, x + 12, y + 8, x + 26, y + 13, x + 12, y + 18], K.c, 0, 0, 3) }
        if (i == cur && !done) rc(x, y, Z, Z, K.a, 0, 2);
      }
      rc(60, 575, 240, 44, mode ? K.c : K.d, 1, 3); tx(mode ? 'MODE: FLAG ⚑' : 'MODE: DIG ⛏', W / 2, 597, 18, '#fff');
      g.hud = `MINES ${M - flag.reduce((a, b) => a + b, 0)} · ${T | 0}s`;
    };
  }
};

E.merge = {
  t: 'Merge', c: 'puzzle', vs: 0, n: 4, v: [['NEON 2048', {}], ['MERGE 5×5', { n: 5, pal: 'ICE' }], ['MERGE 3×3', { n: 3, pal: 'INFERNO' }], ['MERGE RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, N = g.n, Z = 320 / N, X0 = 20, Y0 = 170, b = new Array(N * N).fill(0), cols = [K.a, K.b, K.c, K.d, K.e];
    const add = () => { const e = b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) b[pick(e)] = rnd() < .9 ? 2 : 4 };
    add(); add();
    const slide = d => {
      let moved = 0;
      for (let k = 0; k < N; k++) {
        const idx = Array.from({ length: N }, (_, j) => d == 'l' ? k * N + j : d == 'r' ? k * N + N - 1 - j : d == 'u' ? j * N + k : (N - 1 - j) * N + k);
        const v = idx.map(i => b[i]).filter(x => x), o = [];
        for (let j = 0; j < v.length; j++) { if (v[j] == v[j + 1]) { o.push(v[j] * 2); g.score += v[j] * 2; j++; boom(W / 2, Y0 - 30, cols[Math.log2(v[j] * 2) % 5], 4) } else o.push(v[j]) }
        idx.forEach((i, j) => { const nv = o[j] || 0; if (b[i] != nv) moved = 1; b[i] = nv });
      }
      return moved;
    };
    const stuck = () => b.every((v, i) => v && (i % N == N - 1 || b[i + 1] != v) && (i + N >= N * N || b[i + N] != v));
    return dt => {
      const d = swipe(0);
      if (d && slide(d)) { add(); sfx(400 + Math.log2(Math.max(...b)) * 60, .06, 'triangle'); if (stuck()) lose(g) }
      for (let i = 0; i < N * N; i++) {
        const x = X0 + (i % N) * Z, y = Y0 + (i / N | 0) * Z, v = b[i];
        rc(x + 4, y + 4, Z - 8, Z - 8, v ? cols[Math.log2(v) % 5] : K.e, v ? Math.min(1, .1 + Math.log2(v) * .08) : 0, v ? 3 : 1);
        if (v) tx(v, x + Z / 2, y + Z / 2, Math.min(Z * .4, 140 / String(v).length), '#fff');
      }
      tx('SWIPE TO MERGE', W / 2, 560, 16, K.e);
      g.hud = 'SCORE ' + g.score;
    };
  }
};

E.blocks = {
  t: 'Blocks', c: 'puzzle', vs: 0, n: 1, v: [['NEON BLOCKS', {}], ['BLOCKS TURBO', { sp: 1.6, pal: 'INFERNO' }], ['BLOCKS RAINBOW', { mods: ['rainbow'] }], ['BLOCKS GHOST', { mods: ['ghost'], pal: 'ICE' }]],
  f(g) {
    const K = g.K, C = 10, R = 20, Z = 26, X0 = 50, Y0 = 72, b = new Array(C * R).fill(0);
    const SH = [[[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]]];
    const cols = [K.a, K.b, K.c, K.d, K.e, K.a, K.b];
    let p, nxt = ri(0, 6), t = 0, lines = 0, kt = 0, moved = 0, lt = 0;
    const cells = (q = p) => q.c.map(([x, y]) => [q.x + x, q.y + y]);
    const ok = q => cells(q).every(([x, y]) => x >= 0 && x < C && y < R && (y < 0 || !b[y * C + x]));
    const spawn = () => { p = { k: nxt, c: SH[nxt].map(c => [...c]), x: 3, y: -1 }; nxt = ri(0, 6); if (!ok(p)) lose(g) };
    const tryM = (dx, dy, rot) => { const q = { ...p, x: p.x + dx, y: p.y + dy, c: rot ? p.c.map(([x, y]) => [p.k == 1 ? x : 2 - y, p.k == 1 ? y : x]) : p.c }; if (ok(q)) { p = q; return 1 } if (rot) for (const k of [1, -1]) { q.x = p.x + k; if (ok(q)) { p = q; return 1 } } return 0 };
    const lock = () => {
      for (const [x, y] of cells()) if (y >= 0) b[y * C + x] = p.k + 1; else return lose(g);
      let n = 0; for (let y = R - 1; y >= 0; y--) if (b.slice(y * C, y * C + C).every(v => v)) { b.splice(y * C, C); b.unshift(...new Array(C).fill(0)); n++; y++; boom(W / 2, Y0 + y * Z, K.d, 20, 300) }
      if (n) { lines += n; g.score += [0, 100, 300, 500, 800][n] * (1 + (lines / 10 | 0)); sfx(800 + n * 150, .2, 'triangle') } else sfx(200, .04);
      spawn();
    };
    spawn();
    return dt => {
      if (g.over) return;
      const I = P[0];
      if (I.touch) {
        if (abs(I.rx) > Z) { const k = sgn(I.rx); tryM(k, 0); reOrigin(0, k * Z, 0); moved = 1 }
        if (I.ry > 70) { while (tryM(0, 1)); lock(); reOrigin(0); moved = 1 }
      } else {
        if (I.dp == 'l') tryM(-1, 0); if (I.dp == 'r') tryM(1, 0); if (I.dp == 'u' || I.ap) tryM(0, 0, 1);
        if (I.x && (kt += dt) > .16) { kt = .1; tryM(sgn(I.x), 0) } if (!I.x) kt = 0;
      }
      if (I.ap && I.touch) moved = 0;
      if (I.ar && lt && !moved) tryM(0, 0, 1); // a tap without a drag rotates
      lt = I.touch;
      if ((t += dt * (I.y > .5 && !I.touch ? 8 : 1)) > Math.max(.08, .7 - lines * .02) / g.sp) { t = 0; if (!tryM(0, 1)) lock() }
      if (g.over) return;
      rc(X0 - 3, Y0 - 3, C * Z + 6, R * Z + 6, K.e, 0, 2);
      for (let i = 0; i < C * R; i++) if (b[i]) rc(X0 + (i % C) * Z + 2, Y0 + (i / C | 0) * Z + 2, Z - 4, Z - 4, cols[b[i] - 1], 1);
      let gq = { ...p }; while (ok({ ...gq, y: gq.y + 1 })) gq.y++;
      for (const [x, y] of cells(gq)) if (y >= 0) rc(X0 + x * Z + 4, Y0 + y * Z + 4, Z - 8, Z - 8, cols[p.k], 0, 1);
      for (const [x, y] of cells()) if (y >= 0) rc(X0 + x * Z + 2, Y0 + y * Z + 2, Z - 4, Z - 4, cols[p.k], 2);
      for (const [x, y] of SH[nxt]) rc(W - 44 + x * 9, 34 + y * 9, 8, 8, cols[nxt], 1, 1);
      g.hud = `LINES ${lines} · ${g.score}`;
    };
  }
};

E.lights = {
  t: 'Lights Out', c: 'puzzle', vs: 0, n: 5, v: [['NEON LIGHTS OUT', {}], ['LIGHTS OUT 4×4', { n: 4, pal: 'MINT' }], ['LIGHTS OUT 6×6', { n: 6, pal: 'ULTRA' }]],
  f(g) {
    const K = g.K, N = g.n, Z = 320 / N, X0 = 20, Y0 = 160; let b, lvl = 0, moves = 0, cur = 0, wait = 0;
    const tog = i => { const x = i % N, y = i / N | 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N) b[(y + dy) * N + x + dx] ^= 1 };
    const lay = () => { b = new Array(N * N).fill(0); for (let i = 0; i < 3 + lvl * 2; i++) tog(ri(0, N * N - 1)); if (b.every(v => !v)) tog(0); moves = 0 };
    lay();
    return dt => {
      if (wait > 0) { if ((wait -= dt) <= 0) lay() }
      else {
        const I = P[0];
        if (I.dp) cur = clamp((cur / N | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, N - 1) * N + clamp(cur % N + (I.dp == 'r') - (I.dp == 'l'), 0, N - 1);
        let hit = -1;
        if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < N && r < N) hit = r * N + c } else if (I.ap) hit = cur;
        if (hit >= 0) { cur = hit; tog(hit); moves++; sfx(500 + b.reduce((a, v) => a + v, 0) * 30, .05, 'triangle'); if (b.every(v => !v)) { lvl++; g.score += Math.max(10, 100 - moves * 3); wait = 1; sfx(1200, .4, 'triangle'); boom(W / 2, 320, K.d, 50, 300) } }
      }
      for (let i = 0; i < N * N; i++) { const x = X0 + (i % N) * Z, y = Y0 + (i / N | 0) * Z; rc(x + 5, y + 5, Z - 10, Z - 10, b[i] ? K.d : K.e, b[i] ? 1 : 0, b[i] ? 3 : 1); if (i == cur) rc(x + 1, y + 1, Z - 2, Z - 2, K.a, 0, 1) }
      tx('TURN EVERY LIGHT OFF', W / 2, 560, 16, K.e); if (wait > 0) tx('SOLVED!', W / 2, 120, 30, K.d);
      g.hud = `LEVEL ${lvl + 1} · MOVES ${moves} · ${g.score}`;
      if (lvl >= 15) lose(g, 'ALL SOLVED · ' + g.score);
    };
  }
};

E.slide = {
  t: 'Slide', c: 'puzzle', vs: 0, n: 4, v: [['NEON SLIDE 15', {}], ['SLIDE 8', { n: 3, pal: 'MINT' }], ['SLIDE 24', { n: 5, pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, N = g.n, Z = 320 / N, X0 = 20, Y0 = 170, b = Array.from({ length: N * N }, (_, i) => (i + 1) % (N * N)); let moves = 0, T = 0, done = 0;
    const mv = i => { const e = b.indexOf(0), ex = e % N, ey = e / N | 0, x = i % N, y = i / N | 0; if (abs(ex - x) + abs(ey - y) != 1) return 0;[b[e], b[i]] = [b[i], b[e]]; return 1 };
    for (let k = 0; k < N * N * 30; k++) { const e = b.indexOf(0); const nb = [e - 1, e + 1, e - N, e + N].filter(i => i >= 0 && i < N * N && (i % N == e % N || (i / N | 0) == (e / N | 0))); mv(pick(nb)) }
    return dt => {
      if (done) { if ((done -= dt) <= 0) lose(g, 'SOLVED · ' + g.score); }
      else {
        T += dt; const I = P[0], e = b.indexOf(0); let hit = -1;
        if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < N && r < N) hit = r * N + c }
        else if (I.dp) { const [dx, dy] = DIRS[I.dp], x = e % N - dx, y = (e / N | 0) - dy; if (x >= 0 && x < N && y >= 0 && y < N) hit = y * N + x }
        if (hit >= 0 && mv(hit)) { moves++; sfx(500, .04, 'triangle'); if (b.every((v, i) => v == (i + 1) % (N * N))) { done = 1.2; g.score = Math.max(100, 5000 - moves * 10 - (T | 0) * 5); sfx(1200, .4, 'triangle'); boom(W / 2, 330, K.d, 60, 300) } }
      }
      for (let i = 0; i < N * N; i++) if (b[i]) { const x = X0 + (i % N) * Z, y = Y0 + (i / N | 0) * Z, ok = b[i] == i + 1; rc(x + 4, y + 4, Z - 8, Z - 8, ok ? K.d : K.a, 1, 3); tx(b[i], x + Z / 2, y + Z / 2, Z * .38, '#fff') }
      g.hud = `MOVES ${moves} · ${T | 0}s`;
    };
  }
};
