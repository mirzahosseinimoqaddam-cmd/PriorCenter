'use strict';
// Arcade engines. Each f(g) returns tick(dt) which updates and draws one frame.
const follow = (I, x, sp, dt, lo = 0, hi = W) => clamp(I.tx != null ? x + (I.tx - x) * Math.min(1, dt * 18) : x + I.x * sp * dt, lo, hi);

E.pong = {
  t: 'Pong', c: 'sport', vs: 1, n: 1, v: [['NEON PONG', {}], ['PONG TRIBALL', { n: 3 }], ['HYPER PONG', { sp: 1.6 }], ['MICRO PONG', { sz: .55 }], ['PONG GHOST', { mods: ['ghost'], pal: 'ICE' }], ['DRUNK PONG', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, pw = 80 * g.sz, p = [W / 2, W / 2], s = [0, 0], B = [];
    const sv = d => ({ x: W / 2, y: H / 2, vx: rnd(-110, 110), vy: d * 230 * g.sp });
    for (let i = 0; i < g.n; i++) B.push(sv(i % 2 ? -1 : 1));
    return dt => {
      p[0] = follow(P[0], p[0], 420, dt, pw / 2, W - pw / 2);
      if (g.cpu) { const t = B.reduce((a, b) => b.vy < 0 && (!a || b.y < a.y) ? b : a, null), d = (t ? t.x : W / 2) - p[1], v = 250 * g.sp * dt; p[1] = clamp(p[1] + clamp(d, -v, v), pw / 2, W - pw / 2) }
      else p[1] = follow(P[1], p[1], 420, dt, pw / 2, W - pw / 2);
      for (const b of B) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 7 || b.x > W - 7) { b.vx = -b.vx; b.x = clamp(b.x, 7, W - 7); sfx(300, .03) }
        if (b.vy > 0 && b.y > 588 && b.y < 612 && abs(b.x - p[0]) < pw / 2 + 7) { b.vy = -Math.min(abs(b.vy) * 1.06, 760); b.vx += (b.x - p[0]) * 6; sfx(440); boom(b.x, 594, K.a, 6) }
        if (b.vy < 0 && b.y < 52 && b.y > 28 && abs(b.x - p[1]) < pw / 2 + 7) { b.vy = Math.min(abs(b.vy) * 1.06, 760); b.vx += (b.x - p[1]) * 6; sfx(520); boom(b.x, 46, K.b, 6) }
        b.vx = clamp(b.vx, -500, 500);
        if (b.y > H + 10) { s[1]++; boom(b.x, H, K.c, 30); Object.assign(b, sv(1)); sfx(150, .3) }
        if (b.y < -10) { s[0]++; boom(b.x, 0, K.c, 30); Object.assign(b, sv(-1)); sfx(150, .3) }
        ci(b.x, b.y, 7, K.c, 1);
      }
      for (let x = 0; x < W; x += 24) ln(x, H / 2, x + 12, H / 2, K.e, 1);
      tx(s[0], W / 2, H / 2 + 60, 56, K.a); tx(s[1], W / 2, H / 2 - 60, 56, K.b);
      rc(p[0] - pw / 2, 594, pw, 12, K.a, 1); rc(p[1] - pw / 2, 34, pw, 12, K.b, 1);
      g.score = s[0]; g.hud = 'FIRST TO 7';
      if (s[0] >= 7 || s[1] >= 7) win(g, s[0] >= 7 ? 0 : 1);
    };
  }
};

// snake (solo or versus) and light-cycles (tron: trails never shrink, no food)
E.snake = {
  t: 'Snake', c: 'arcade', vs: 2, n: 1, v: [['NEON SNAKE', {}], ['SNAKE RUSH', { sp: 1.6 }], ['SNAKE FEAST', { n: 5 }], ['SNAKE MIRROR', { mods: ['mirror'], pal: 'TOXIC' }],
  ['LIGHT CYCLES', { tron: 1, vs: 1 }], ['LIGHT CYCLES TURBO', { tron: 1, vs: 1, sp: 1.5 }], ['LIGHT CYCLES GHOST', { tron: 1, vs: 1, mods: ['ghost'], pal: 'ICE' }]],
  f(g) {
    const C = 18, R = 30, Z = 20, Y = 30, K = g.K, T = g.tron, s = [0, 0];
    let occ, S, food, acc = 0, pause = 0;
    const free = (x, y) => x >= 0 && y >= 0 && x < C && y < R && !occ[y * C + x];
    const spot = () => { let x, y; do { x = ri(0, C - 1); y = ri(0, R - 1) } while (!free(x, y) || food.some(f => f[0] == x && f[1] == y)); return [x, y] };
    const flood = (x, y, lim) => { const seen = new Set([y * C + x]), q = [[x, y]]; while (q.length && seen.size < lim) { const [a, b] = q.shift(); for (const [dx, dy] of Object.values(DIRS)) { const k = (b + dy) * C + a + dx; if (free(a + dx, b + dy) && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]) } } } return seen.size };
    const reset = () => {
      occ = new Uint8Array(C * R); food = [];
      S = [{ b: [[9, 24]], d: [0, -1], nd: [0, -1], grow: 3, col: K.a }, { b: [[8, 5]], d: [0, 1], nd: [0, 1], grow: 3, col: K.b }].slice(0, g.pl);
      for (const n of S) occ[n.b[0][1] * C + n.b[0][0]] = 1;
      if (!T) for (let i = 0; i < g.n; i++) food.push(spot());
    };
    reset();
    const ai = n => {
      const [x, y] = n.b[n.b.length - 1];
      let best = n.d, bv = -1e9;
      for (const d of Object.values(DIRS)) {
        if (d[0] == -n.d[0] && d[1] == -n.d[1]) continue;
        const nx = x + d[0], ny = y + d[1]; if (!free(nx, ny)) continue;
        const room = flood(nx, ny, 80);
        let v = room * (T ? 1 : .2) + rnd(2);
        if (!T && food.length) v -= Math.min(...food.map(f => abs(f[0] - nx) + abs(f[1] - ny)));
        if (T) { const o = S[0].b[S[0].b.length - 1]; v -= (abs(o[0] - nx) + abs(o[1] - ny)) * .3 }
        if (v > bv) { bv = v; best = d }
      }
      n.nd = best;
    };
    return dt => {
      S.forEach((n, i) => {
        if (i == 1 && g.cpu) return;
        const d = DIRS[swipe(i)];
        if (d && !(d[0] == -n.d[0] && d[1] == -n.d[1])) n.nd = d;
      });
      if (pause > 0) pause -= dt;
      else if ((acc += dt) > (T ? .075 : .11) / g.sp) {
        acc = 0;
        if (g.cpu) ai(S[1]);
        const heads = S.map(n => { n.d = n.nd; const h = n.b[n.b.length - 1]; return [h[0] + n.d[0], h[1] + n.d[1]] });
        const dead = S.map((n, i) => !free(...heads[i]) || (S.length == 2 && heads[0][0] == heads[1][0] && heads[0][1] == heads[1][1]));
        S.forEach((n, i) => {
          if (dead[i]) return;
          const h = heads[i]; n.b.push(h); occ[h[1] * C + h[0]] = 1;
          const fi = food.findIndex(f => f[0] == h[0] && f[1] == h[1]);
          if (fi >= 0) { n.grow += 2; if (i == 0) g.score++; boom(h[0] * Z + 10, h[1] * Z + Y + 10, K.d); sfx(660 + n.b.length * 8, .06); food[fi] = spot() }
          if (T) { if (i == 0 && S.length == 1) g.score++; return }
          if (n.grow > 0) n.grow--; else { const t = n.b.shift(); occ[t[1] * C + t[0]] = 0 }
        });
        if (dead.some(x => x)) {
          for (const [i, n] of S.entries()) if (dead[i]) { const h = n.b[n.b.length - 1]; boom(h[0] * Z + 10, h[1] * Z + Y + 10, n.col, 40, 260) }
          if (S.length == 1) lose(g);
          else {
            if (!dead[0]) s[0]++; if (!dead[1]) s[1]++;
            sfx(200, .4, 'sawtooth');
            if (s[0] >= 3 || s[1] >= 3) win(g, s[0] == s[1] ? -1 : s[0] > s[1] ? 0 : 1); else { reset(); pause = 1 }
          }
        }
      }
      rc(0, Y, C * Z, R * Z, K.e, 0, 1);
      for (const f of food) ci(f[0] * Z + 10, f[1] * Z + Y + 10, 6, K.d, 1);
      for (const n of S) {
        const p = n.b.flatMap(([x, y]) => [x * Z + 10, y * Z + Y + 10]);
        if (p.length == 2) p.push(p[0] + .1, p[1]);
        pg(p, n.col, 0, 0, T ? 5 : 12); const h = n.b[n.b.length - 1]; ci(h[0] * Z + 10, h[1] * Z + Y + 10, T ? 5 : 8, '#fff', 2);
      }
      g.score = S.length == 2 ? s[0] : g.score; g.hud = S.length == 2 ? `${s[0]} : ${s[1]} · FIRST TO 3` : '';
    };
  }
};

E.breakout = {
  t: 'Breakout', c: 'arcade', vs: 0, n: 1, v: [['NEON BREAKOUT', {}], ['BRICK WALL', { n: 4 }], ['BREAKOUT TURBO', { sp: 1.4 }], ['WIDE PADDLE', { sz: 1.5, pal: 'MINT' }], ['FLIP BREAKOUT', { mods: ['flip'] }]],
  f(g) {
    const K = g.K, pw = 80 * g.sz; let px = W / 2, lives = 3, lvl = 0, ball, bricks, st = 0;
    const cols = [K.a, K.b, K.c, K.d, K.e];
    const lay = () => { bricks = []; for (let r = 0; r < Math.min(12, 3 + g.n + lvl); r++)for (let c = 0; c < 8; c++)bricks.push({ x: 8 + c * 43.5, y: 70 + r * 22, w: 40, h: 16, hp: r < lvl ? 2 : 1, c: cols[r % 5] }) };
    const reset = () => { ball = { x: px, y: 580, vx: 0, vy: 0, stuck: 1 }; st = 0 };
    lay(); reset();
    return dt => {
      px = follow(P[0], px, 420, dt, pw / 2, W - pw / 2);
      const b = ball;
      if (b.stuck) { b.x = px; if (P[0].ap || (st += dt) > 1.2) { b.stuck = 0; b.vx = rnd(-120, 120); b.vy = -320 * g.sp * (1 + lvl * .07) } }
      else {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 7 || b.x > W - 7) { b.vx = -b.vx; b.x = clamp(b.x, 7, W - 7) }
        if (b.y < 7) { b.vy = abs(b.vy); b.y = 7 }
        if (b.vy > 0 && b.y > 588 && b.y < 606 && abs(b.x - px) < pw / 2 + 7) { b.vy = -abs(b.vy); b.vx = clamp(b.vx + (b.x - px) * 7, -420, 420); sfx(440) }
        for (const k of bricks) if (b.x > k.x - 6 && b.x < k.x + k.w + 6 && b.y > k.y - 6 && b.y < k.y + k.h + 6) {
          const ox = Math.min(b.x - k.x + 6, k.x + k.w + 6 - b.x), oy = Math.min(b.y - k.y + 6, k.y + k.h + 6 - b.y);
          if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
          if (--k.hp <= 0) { k.dead = 1; g.score += 10; boom(k.x + 20, k.y + 8, k.c) } sfx(700 + rnd(200), .05); break;
        }
        bricks = bricks.filter(k => !k.dead);
        if (b.y > H + 10) { if (--lives <= 0) lose(g); else { sfx(150, .4); reset() } }
        if (!bricks.length) { lvl++; g.score += 100; sfx(990, .3); lay(); reset() }
      }
      for (const k of bricks) rc(k.x, k.y, k.w, k.h, k.c, k.hp > 1 ? .6 : 1);
      rc(px - pw / 2, 594, pw, 12, K.a, 1); ci(b.x, b.y, 7, '#fff', 1);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = `LEVEL ${lvl + 1} · ${g.score}`;
    };
  }
};

E.rocks = {
  t: 'Rocks', c: 'arcade', vs: 0, n: 1, v: [['NEON ROCKS', {}], ['ROCK STORM', { n: 3 }], ['ROCKS TURBO', { sp: 1.5 }], ['GIANT ROCKS', { mods: ['giant'], pal: 'INFERNO' }]],
  f(g) {
    const K = g.K, s = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -PI / 2, inv: 2 }; let rocks = [], bul = [], lives = 3, wave = 0, ft = 0;
    const rock = (x, y, r) => ({ x, y, r, vx: rnd(-60, 60) * g.sp, vy: rnd(-60, 60) * g.sp, a: 0, va: rnd(-1, 1), sh: Array.from({ length: 9 }, () => rnd(.75, 1.15)) });
    const next = () => { wave++; for (let i = 0; i < 2 + wave + g.n; i++) { const e = rnd(1) < .5; rocks.push(rock(e ? 0 : rnd(W), e ? rnd(H) : 0, 40 * g.sz)) } };
    const wr = o => { o.x = (o.x + W) % W; o.y = (o.y + H) % H };
    return dt => {
      const I = P[0];
      s.vx = (s.vx + I.x * 600 * dt) * Math.pow(.25, dt); s.vy = (s.vy + I.y * 600 * dt) * Math.pow(.25, dt);
      if (abs(I.x) + abs(I.y) > .1) s.a = atan2(I.y, I.x);
      s.x += s.vx * dt; s.y += s.vy * dt; wr(s); s.inv -= dt;
      if (!rocks.length) next();
      if ((ft -= dt) <= 0 && rocks.length) {
        const t = rocks.reduce((a, r) => hyp(r.x - s.x, r.y - s.y) < hyp(a.x - s.x, a.y - s.y) ? r : a), an = atan2(t.y - s.y, t.x - s.x);
        bul.push({ x: s.x, y: s.y, vx: cos(an) * 520, vy: sin(an) * 520, l: .8 }); ft = .2; sfx(900, .03, 'square', .02);
      }
      for (const b of bul) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; wr(b) }
      const born = [];
      for (const r of rocks) {
        r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt; wr(r);
        for (const b of bul) if (b.l > 0 && hyp(b.x - r.x, b.y - r.y) < r.r) {
          b.l = 0; r.dead = 1; g.score += r.r > 30 ? 20 : r.r > 15 ? 50 : 100; boom(r.x, r.y, K.c, 12); sfx(160, .1, 'sawtooth');
          if (r.r > 14) born.push(rock(r.x, r.y, r.r / 2), rock(r.x, r.y, r.r / 2)); break;
        }
        if (!r.dead && s.inv <= 0 && hyp(r.x - s.x, r.y - s.y) < r.r + 8) { s.inv = 2; boom(s.x, s.y, K.a, 40, 250); buzz(100); if (--lives <= 0) lose(g) }
      }
      rocks = rocks.filter(r => !r.dead).concat(born); bul = bul.filter(b => b.l > 0);
      for (const r of rocks) pg(r.sh.flatMap((k, i) => { const t = r.a + i * TAU / 9; return [r.x + cos(t) * r.r * k, r.y + sin(t) * r.r * k] }), K.c);
      for (const b of bul) ln(b.x, b.y, b.x - b.vx * .02, b.y - b.vy * .02, K.d, 3);
      if (s.inv <= 0 || (s.inv * 8 | 0) % 2) pg([s.x + cos(s.a) * 14, s.y + sin(s.a) * 14, s.x + cos(s.a + 2.5) * 10, s.y + sin(s.a + 2.5) * 10, s.x + cos(s.a - 2.5) * 10, s.y + sin(s.a - 2.5) * 10], K.a, 1, 1);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = `WAVE ${wave} · ${g.score}`;
    };
  }
};

E.flap = {
  t: 'Flap', c: 'arcade', vs: 0, n: 1, v: [['NEON FLAP', {}], ['FLAP WAVES', { n: 2 }], ['FLAP NARROW', { sz: .8, pal: 'BLOOD' }], ['FLAP UPSIDE', { mods: ['flip'] }], ['FLAP TURBO', { sp: 1.4 }]],
  f(g) {
    const K = g.K, gap = 175 * g.sz; let y = H / 2, vy = 0, gates = [], t = 1, on = 0, T = 0;
    return dt => {
      T += dt;
      if (P[0].ap) { vy = -310; on = 1; sfx(600, .05, 'triangle') }
      if (on) {
        vy += 950 * dt; y += vy * dt;
        if ((t -= dt) <= 0) { gates.push({ x: W + 30, gy: rnd(140, H - 140), ph: rnd(TAU) }); t = 1.6 / g.sp }
      } else tx('TAP TO FLAP', W / 2, H / 2 + 80, 18, K.e);
      for (const k of gates) {
        k.x -= 150 * g.sp * dt; const gy = k.gy + (g.n > 1 ? sin(T * 2 + k.ph) * 60 : 0);
        if (!k.p && k.x < 100) { k.p = 1; g.score++; sfx(880, .05) }
        if (abs(k.x - 100) < 38 && abs(y - gy) > gap / 2 - 11) { boom(100, y, K.a, 40); lose(g) }
        rc(k.x - 28, -10, 56, gy - gap / 2 + 10, K.b, 1); rc(k.x - 28, gy + gap / 2, 56, H, K.b, 1);
      }
      gates = gates.filter(k => k.x > -60);
      if (y > H - 10 || y < -40) { boom(100, y, K.a, 40); lose(g) }
      ci(100, y, 11, K.a, 1); ln(92, y, 82, y + clamp(vy / 30, -12, 12), K.a, 3); ci(104, y - 3, 2, '#fff', 2);
      tx(g.score, W / 2, 70, 44, K.d);
    };
  }
};

E.runner = {
  t: 'Runner', c: 'arcade', vs: 0, n: 1, v: [['NEON RUNNER', {}], ['RUNNER FLYERS', { n: 2 }], ['RUNNER BLITZ', { sp: 1.4, pal: 'TOXIC' }], ['RUNNER DRUNK', { mods: ['drunk'] }], ['RUNNER NIGHT', { mods: ['ghost'], pal: 'ULTRA' }]],
  f(g) {
    const K = g.K, gy = 500; let py = gy, vy = 0, j = 0, obs = [], spd = 230 * g.sp, t = .8, d = 0;
    return dt => {
      spd += 7 * dt; d += spd * dt; g.score = d / 10 | 0;
      if (P[0].ap && j < 2) { vy = -470; j++; sfx(500 + j * 200, .07, 'triangle') }
      vy += 1400 * dt; py += vy * dt; if (py >= gy) { py = gy; vy = 0; j = 0 }
      if ((t -= dt) <= 0) {
        t = rnd(.65, 1.5) * 240 / spd + .25;
        if (g.n > 1 && rnd() < .35) obs.push({ x: W + 20, y: gy - rnd(55, 80), w: 30, h: 14, f: 1 });
        else { const h = rnd(22, 52) * g.sz; obs.push({ x: W + 20, y: gy - h, w: rnd(16, 30), h }) }
      }
      for (const o of obs) {
        o.x -= spd * dt;
        if (o.x < 84 && o.x + o.w > 62 && o.y < py && o.y + o.h > py - 30) { boom(72, py - 15, K.a, 40); lose(g) }
        rc(o.x, o.y, o.w, o.h, o.f ? K.c : K.b, 1);
      }
      obs = obs.filter(o => o.x > -50);
      ln(0, gy, W, gy, K.e, 2); for (let x = -(d % 40); x < W; x += 40) ln(x, gy + 14, x + 16, gy + 14, K.e, 1);
      rc(62, py - 30, 22, 30, K.a, 1); ci(78, py - 22, 2, '#fff', 2);
      tx(g.score, W / 2, 80, 40, K.d);
    };
  }
};

E.dodge = {
  t: 'Dodge', c: 'arcade', vs: 0, n: 1, v: [['NEON DODGE', {}], ['DODGE HAIL', { n: 2.5 }], ['DODGE GIANT', { mods: ['giant'], pal: 'SUNSET' }], ['DODGE MIRROR', { mods: ['mirror'] }], ['DODGE SLOWMO', { mods: ['slowmo'], n: 3 }]],
  f(g) {
    const K = g.K; let x = W / 2, T = 0, ob = [], acc = 0;
    return dt => {
      T += dt; g.score = T * 10 | 0; x = follow(P[0], x, 380, dt, 12, W - 12);
      acc += dt * (1.2 + T / 12) * g.n * 1.3;
      while (acc > 1) { acc--; ob.push({ x: rnd(W), y: -30, r: rnd(8, 20) * g.sz, vy: rnd(150, 300) * g.sp * (1 + T / 60), vx: rnd(-40, 40), a: rnd(TAU), s: ri(3, 6) }) }
      for (const o of ob) {
        o.y += o.vy * dt; o.x += o.vx * dt; o.a += dt * 2;
        if (hyp(o.x - x, o.y - 590) < o.r + 10) { boom(x, 590, K.a, 40, 250); lose(g) }
        pg(poly(o.x, o.y, o.r, o.s, o.a), K.c, 1, 1);
      }
      ob = ob.filter(o => o.y < H + 40);
      pg([x, 576, x + 13, 602, x - 13, 602], K.a, 1, 1);
      tx(g.score, W / 2, 70, 40, K.d);
    };
  }
};

E.shmup = {
  t: 'Shooter', c: 'arcade', vs: 0, n: 1, v: [['NEON STRIKER', {}], ['STRIKER SWARM', { n: 3 }], ['STRIKER HELL', { sp: 1.4, n: 2, pal: 'BLOOD' }], ['STRIKER GHOST', { mods: ['ghost'], pal: 'ULTRA' }], ['STRIKER RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, s = { x: W / 2, y: 560, inv: 1.5 }; let bul = [], eb = [], en = [], ft = 0, wt = 1, wave = 0, lives = 3;
    return dt => {
      const I = P[0];
      if (I.tx != null) { s.x += (I.tx - s.x) * Math.min(1, dt * 14); s.y += (I.ty - 60 - s.y) * Math.min(1, dt * 14) } else { s.x += I.x * 330 * dt; s.y += I.y * 330 * dt }
      s.x = clamp(s.x, 14, W - 14); s.y = clamp(s.y, 200, H - 20); s.inv -= dt;
      if ((ft -= dt) <= 0) { ft = .14; bul.push({ x: s.x - 6, y: s.y - 14 }, { x: s.x + 6, y: s.y - 14 }); sfx(1200, .02, 'square', .015) }
      if ((wt -= dt) <= 0 || (!en.length && wt > 1)) {
        wave++; wt = 6 / g.sp; const n = 4 + g.n + (wave >> 1), bx = rnd(60, W - 60), kind = wave % 3;
        for (let i = 0; i < n; i++) en.push({ bx: kind == 2 ? 30 + i * (W - 60) / (n - 1 || 1) : bx, x: 0, y: -30 - i * 34, vy: rnd(70, 95) * g.sp, ph: i * .7, hp: 1 + (wave / 4 | 0), kind, t: rnd(1, 3) });
      }
      for (const b of bul) b.y -= 620 * dt;
      for (const e of en) {
        e.y += e.vy * dt; e.ph += dt * 2; e.x = e.bx + (e.kind == 2 ? 0 : sin(e.ph) * (e.kind ? 110 : 60));
        if ((e.t -= dt) <= 0 && e.y > 0) { e.t = rnd(1.4, 3) / g.sp; const a = atan2(s.y - e.y, s.x - e.x); eb.push({ x: e.x, y: e.y, vx: cos(a) * 190 * g.sp, vy: sin(a) * 190 * g.sp }) }
        for (const b of bul) if (!b.d && abs(b.x - e.x) < 15 && abs(b.y - e.y) < 15) { b.d = 1; if (--e.hp <= 0) { e.dead = 1; g.score += 25; boom(e.x, e.y, K.c, 14); sfx(200, .08, 'sawtooth') } }
        if (!e.dead && s.inv <= 0 && hyp(e.x - s.x, e.y - s.y) < 22) { e.dead = 1; hurt() }
        pg(poly(e.x, e.y, 14, 3, PI / 2), K.c, 1, e.hp > 1 ? .6 : 1);
      }
      function hurt() { s.inv = 1.5; boom(s.x, s.y, K.a, 40, 250); buzz(100); if (--lives <= 0) lose(g) }
      for (const b of eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (s.inv <= 0 && hyp(b.x - s.x, b.y - s.y) < 10) { b.y = 1e4; hurt() } ci(b.x, b.y, 4, K.d, 1) }
      en = en.filter(e => !e.dead && e.y < H + 40); bul = bul.filter(b => !b.d && b.y > -20); eb = eb.filter(b => b.y < H + 10 && b.y > -10 && b.x > -10 && b.x < W + 10);
      for (const b of bul) ln(b.x, b.y, b.x, b.y + 10, K.b, 3);
      if (s.inv <= 0 || (s.inv * 8 | 0) % 2) { pg([s.x, s.y - 16, s.x + 13, s.y + 12, s.x, s.y + 5, s.x - 13, s.y + 12], K.a, 1, 1); ln(s.x, s.y + 8, s.x, s.y + 16 + rnd(8), K.e, 3) }
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = `WAVE ${wave} · ${g.score}`;
    };
  }
};

E.catch = {
  t: 'Catch', c: 'arcade', vs: 0, n: 1, v: [['NEON CATCH', {}], ['CATCH STORM', { n: 2, sp: 1.2 }], ['CATCH TINY', { mods: ['tiny'], pal: 'MINT' }], ['CATCH RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, bw = 80 * g.sz; let x = W / 2, it = [], t = 0, lives = 3, T = 0;
    return dt => {
      T += dt; x = follow(P[0], x, 420, dt, bw / 2, W - bw / 2);
      if ((t -= dt) <= 0) { t = Math.max(.25, .9 - T / 80) / g.n; it.push({ x: rnd(20, W - 20), y: -20, vy: rnd(140, 220) * g.sp * (1 + T / 70), bad: rnd() < .3, a: 0 }) }
      for (const o of it) {
        o.y += o.vy * dt; o.a += dt * 3;
        if (o.y > 580 && o.y < 600 && abs(o.x - x) < bw / 2) { o.d = 1; if (o.bad) { boom(o.x, o.y, K.c, 30); buzz(80); if (--lives <= 0) lose(g) } else { g.score++; boom(o.x, o.y, K.d, 10); sfx(700 + g.score * 5, .06) } }
        else if (o.y > H + 10) { o.d = 1; if (!o.bad) { sfx(160, .2); if (--lives <= 0) lose(g) } }
        if (o.bad) pg(poly(o.x, o.y, 14, 5, o.a, 6), K.c, 1, 1); else ci(o.x, o.y, 10, K.d, 1);
      }
      it = it.filter(o => !o.d);
      pg([x - bw / 2, 585, x - bw / 2 + 8, 605, x + bw / 2 - 8, 605, x + bw / 2, 585], K.a, 0, 0, 4);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      tx(g.score, W / 2, 70, 40, K.d);
    };
  }
};

E.stack = {
  t: 'Stack', c: 'arcade', vs: 0, n: 1, v: [['NEON STACK', {}], ['STACK RUSH', { sp: 1.6 }], ['STACK WIDE', { sz: 1.4, pal: 'SUNSET' }], ['STACK DRUNK', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, bh = 26, cols = [K.a, K.b, K.c, K.d, K.e]; let st = [{ x: W / 2 - 100 * g.sz, w: 200 * g.sz }], cur, cam = 0;
    const nx = () => { const l = st[st.length - 1]; cur = { x: st.length % 2 ? -l.w : W, w: l.w, v: (130 + st.length * 6) * g.sp * (st.length % 2 ? 1 : -1) } };
    nx();
    return dt => {
      cur.x += cur.v * dt; if (cur.x < -cur.w || cur.x > W) cur.v = -cur.v;
      if (P[0].ap) {
        const l = st[st.length - 1], a = Math.max(cur.x, l.x), b = Math.min(cur.x + cur.w, l.x + l.w);
        if (b - a <= 0) { boom(cur.x + cur.w / 2, 600 - st.length * bh + cam, K.c, 40); lose(g) }
        else {
          if (abs(cur.x - l.x) < 5) { cur.x = l.x; sfx(1000, .15, 'triangle'); boom(cur.x + cur.w / 2, 600 - st.length * bh + cam, '#fff', 20) }
          else { sfx(500 + st.length * 15, .06); const x = cur.x; cur.x = a; cur.w = b - a; if (x < a) boom(a, 600 - st.length * bh + cam, K.c, 8); else boom(b, 600 - st.length * bh + cam, K.c, 8) }
          st.push({ x: cur.x, w: cur.w }); g.score = st.length - 1; nx();
        }
      }
      cam += (Math.max(0, st.length * bh - 380) - cam) * Math.min(1, dt * 5);
      st.forEach((s, i) => { const y = 600 - i * bh + cam; if (y < H + 30) rc(s.x, y, s.w, bh - 2, cols[i % 5], 1) });
      rc(cur.x, 600 - st.length * bh + cam, cur.w, bh - 2, cols[st.length % 5], 1);
      tx(g.score, W / 2, 70, 44, K.d);
    };
  }
};
