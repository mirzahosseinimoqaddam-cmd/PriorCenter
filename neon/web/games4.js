'use strict';
// More arcade engines.

E.juggle = {
  t: 'Juggle', c: 'arcade', vs: 0, n: 1, v: [['NEON JUGGLE', {}], ['JUGGLE TRIO', { n: 3 }], ['JUGGLE DUO', { n: 2, pal: 'MINT' }], ['JUGGLE MOON', { sp: .7, pal: 'ICE' }], ['JUGGLE TINY PADDLE', { sz: .6, pal: 'BLOOD' }], ['JUGGLE DRUNK', { mods: ['drunk'] }]],
  f(g) {
    const K = g.K, pw = 90 * g.sz; let x = W / 2, B = [], T = 0;
    const add = () => B.push({ x: rnd(60, W - 60), y: 90, vx: rnd(-60, 60), vy: 0 });
    add();
    return dt => {
      T += dt; x = follow(P[0], x, 460, dt, pw / 2, W - pw / 2);
      if (B.length < g.n && T > B.length * 6) add();
      for (const b of B) {
        b.vy += 520 * g.sp * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 12 || b.x > W - 12) { b.vx = -b.vx; b.x = clamp(b.x, 12, W - 12) }
        if (b.vy > 0 && b.y > 566 && b.y < 596 && abs(b.x - x) < pw / 2 + 12) { b.vy = -rnd(500, 580) * Math.sqrt(g.sp); b.vx = clamp(b.vx + (b.x - x) * 4, -260, 260); g.score++; sfx(500 + (g.score % 30) * 20, .05, 'triangle'); boom(b.x, 580, K.d, 6) }
        if (b.y > H + 20 && !g.over) { boom(b.x, H, K.c, 30); lose(g) }
        ci(b.x, b.y, 12, K.c, 1, 3);
      }
      rc(x - pw / 2, 580, pw, 10, K.a, 1); tx(g.score, W / 2, 70, 44, K.d);
    };
  }
};

E.cross = {
  t: 'Crossing', c: 'arcade', vs: 0, n: 1, v: [['NEON CROSSING', {}], ['CROSSING RIVERS', { n: 2, pal: 'ICE' }], ['CROSSING RUSH', { sp: 1.4, pal: 'INFERNO' }], ['CROSSING NIGHT', { mods: ['ghost'], pal: 'ULTRA' }], ['CROSSING MIRROR', { mods: ['mirror'], pal: 'TOXIC' }]],
  f(g) {
    const K = g.K, Z = 40, rows = new Map(); let px = 180, pr = 0, cam = 0, moved = 0, best = 0;
    const row = r => {
      if (rows.has(r)) return rows.get(r);
      let o;
      if (r < 2 || rnd() < .25) o = { t: 'safe' };
      else {
        const river = g.n > 1 && rnd() < .4, v = rnd(50, 120) * g.sp * (1 + r / 150) * (rnd() < .5 ? 1 : -1), items = [];
        for (let x = rnd(-60, 0); x < W + 100; x += river ? rnd(150, 200) : rnd(130, 220)) items.push({ x, w: river ? rnd(80, 120) : rnd(44, 80) });
        o = { t: river ? 'river' : 'road', v, items };
      }
      rows.set(r, o); return o;
    };
    const die = () => { boom(px, 560 - (pr - cam) * Z, K.a, 50, 250); lose(g) };
    return dt => {
      const I = P[0], s = swipe(0);
      let hop = s || (I.ar && hyp(I.rx, I.ry) < 15 && !s ? 'u' : '');
      if (hop) {
        moved = 1; sfx(700, .04, 'triangle');
        if (hop == 'u') pr++; else if (hop == 'd') pr = Math.max(Math.floor(cam), pr - 1); else px = clamp(px + (hop == 'r' ? Z : -Z), 20, W - 20);
        if (pr > best) { best = pr; g.score = best }
      }
      if (moved) cam += .45 * g.sp * (1 + best / 200) * dt;
      cam = Math.max(cam, pr - 9);
      if (pr < cam - .6) die();
      for (let r = Math.floor(cam) - 1; r < cam + 16; r++) {
        const o = row(r), y = 560 - (r - cam) * Z;
        if (o.t == 'safe') { ln(0, y + Z / 2, W, y + Z / 2, K.e, 1); continue }
        if (o.t == 'river') rc(0, y - Z / 2 + 2, W, Z - 4, K.b, .12, 1);
        for (const it of o.items) {
          it.x += o.v * dt; if (o.v > 0 && it.x > W + 60) it.x -= W + 200; if (o.v < 0 && it.x + it.w < -60) it.x += W + 200;
          if (o.t == 'road') { rc(it.x, y - 13, it.w, 26, K.c, 1); ci(it.x + (o.v > 0 ? it.w - 6 : 6), y, 3, '#fff', 2) } else rc(it.x, y - 15, it.w, 30, K.d, .35);
        }
      }
      const cur = row(pr), y = 560 - (pr - cam) * Z;
      if (!g.over && cur.t == 'road' && cur.items.some(it => px + 13 > it.x && px - 13 < it.x + it.w)) die();
      if (!g.over && cur.t == 'river') { const on = cur.items.find(it => px > it.x && px < it.x + it.w); if (!on) die(); else { px += cur.v * dt; if (px < 0 || px > W) die() } }
      for (const k of rows.keys()) if (k < cam - 3) rows.delete(k);
      rc(px - 13, y - 13, 26, 26, K.a, 1, 3); ci(px - 5, y - 4, 2, '#fff', 2); ci(px + 5, y - 4, 2, '#fff', 2);
      tx(g.score, W / 2, 60, 36, K.d); if (!moved) tx('TAP TO HOP · SWIPE TO SIDESTEP', W / 2, 480, 13, K.e);
    };
  }
};

E.invaders = {
  t: 'Invaders', c: 'arcade', vs: 0, n: 1, v: [['NEON INVADERS', {}], ['INVADERS ARMADA', { n: 3 }], ['INVADERS FAST', { sp: 1.5, pal: 'TOXIC' }], ['INVADERS GHOST', { mods: ['ghost'], pal: 'ICE' }], ['INVADERS RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, cols = [K.a, K.b, K.c, K.d, K.e]; let x = W / 2, en, dir = 1, bul = null, eb = [], lives = 3, wave = g.lv0 || 0, shield, ft = 0, inv = 0, T = 0;
    const lay = () => {
      g.level = wave; en = []; const R = Math.min(7, 3 + g.n + (wave >> 1));
      for (let r = 0; r < R; r++)for (let c = 0; c < 7; c++)en.push({ x: 40 + c * 40, y: 80 + r * 32 + Math.min(wave, 5) * 12, r });
      shield = []; for (const sx of [50, 150, 250]) for (let i = 0; i < 6; i++)for (let j = 0; j < 3; j++)shield.push({ x: sx + i * 10, y: 500 + j * 10 });
    };
    lay();
    return dt => {
      T += dt; x = follow(P[0], x, 330, dt, 16, W - 16); inv -= dt;
      if (!bul && ((ft -= dt) <= 0 || P[0].ap)) { bul = { x, y: 560 }; ft = .35; sfx(1100, .04) }
      if (bul) { bul.y -= 620 * dt; if (bul.y < 0) bul = null }
      const sp = (24 + (1 - en.length / 35) * 120) * g.sp * (1 + wave * .1);
      let edge = 0; for (const e of en) { e.x += dir * sp * dt; if (e.x < 16 || e.x > W - 16) edge = 1 }
      if (edge) { dir = -dir; for (const e of en) { e.y += 14; e.x = clamp(e.x, 16, W - 16) } }
      if (en.length && rnd() < dt * (1 + wave * .3) * g.sp) { const e = pick(en); eb.push({ x: e.x, y: e.y }) }
      for (const e of en) {
        if (bul && abs(bul.x - e.x) < 14 && abs(bul.y - e.y) < 12) { e.d = 1; bul = null; g.score += 10 * (5 - Math.min(4, e.r)); boom(e.x, e.y, cols[e.r % 5], 12); sfx(200, .07, 'sawtooth') }
        if (e.y > 540) { lives = 0; lose(g) }
      }
      en = en.filter(e => !e.d);
      for (const b of eb) {
        b.y += 230 * g.sp * dt;
        const s = shield.find(q => !q.d && b.x > q.x && b.x < q.x + 10 && b.y > q.y && b.y < q.y + 10); if (s) { s.d = 1; b.y = 1e4 }
        if (inv <= 0 && abs(b.x - x) < 15 && abs(b.y - 568) < 10) { b.y = 1e4; inv = 1.5; boom(x, 568, K.a, 40); buzz(100); if (--lives <= 0) lose(g) }
      }
      if (bul) { const s = shield.find(q => !q.d && bul.x > q.x && bul.x < q.x + 10 && bul.y > q.y && bul.y < q.y + 10); if (s) { s.d = 1; bul = null } }
      eb = eb.filter(b => b.y < H);
      if (!en.length) { wave++; g.score += 200; sfx(1200, .3, 'triangle'); lay(); eb = [] }
      const fr = (T * 3 | 0) % 2;
      for (const e of en) { const c = cols[e.r % 5]; rc(e.x - 11, e.y - 7, 22, 14, c, 1); ln(e.x - 11, e.y + 7, e.x - 15 + fr * 6, e.y + 12, c, 2); ln(e.x + 11, e.y + 7, e.x + 15 - fr * 6, e.y + 12, c, 2) }
      for (const q of shield) if (!q.d) rc(q.x, q.y, 9, 9, K.d, 1, 1);
      for (const b of eb) ln(b.x, b.y, b.x, b.y + 10, K.c, 3);
      if (bul) ln(bul.x, bul.y, bul.x, bul.y + 12, '#fff', 3);
      if (inv <= 0 || (inv * 8 | 0) % 2) pg([x - 16, 576, x - 16, 566, x - 4, 562, x, 554, x + 4, 562, x + 16, 566, x + 16, 576], K.a, 1, 1);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      g.hud = `WAVE ${wave + 1} · ${g.score}`;
    };
  }
};

E.defend = {
  t: 'Defender', c: 'arcade', vs: 0, n: 1, v: [['NEON DEFENDER', {}], ['DEFENDER BARRAGE', { n: 2, pal: 'INFERNO' }], ['DEFENDER BIG BLAST', { sz: 1.4, pal: 'MINT' }], ['DEFENDER SLOWMO', { mods: ['slowmo'], n: 3 }], ['DEFENDER RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, cities = [30, 80, 130, 230, 280, 330].map(x => ({ x, ok: 1 })); let ms = [], shots = [], ex = [], wave = 0, left = 0, t = 0, cd = 0, cx = W / 2, cy = 300;
    const next = () => { wave++; left = 6 + wave * 3 * g.n };
    next();
    return dt => {
      const I = P[0]; cd -= dt;
      if (!I.touch) { cx = clamp(cx + I.x * 300 * dt, 0, W); cy = clamp(cy + I.y * 300 * dt, 40, 540) }
      let fire = null; if (I.ap && I.touch && I.ty < 560) fire = [I.tx, I.ty]; else if (I.ap && !I.touch) fire = [cx, cy];
      if (fire && cd <= 0) { cd = .2; shots.push({ x: W / 2, y: 590, tx: fire[0], ty: fire[1] }); sfx(900, .05) }
      if (left > 0 && (t -= dt) <= 0) { t = rnd(.4, 1.4) / (1 + wave * .15) / g.n; left--; const tg = pick(cities.filter(c => c.ok).concat([{ x: W / 2 }])); ms.push({ sx: rnd(W), sy: 0, x: 0, y: 0, tx: tg.x, ty: 600, k: 0, v: rnd(.07, .12) * g.sp * (1 + wave * .1) }) }
      for (const s of shots) { const d = hyp(s.tx - s.x, s.ty - s.y), st = 650 * dt; if (d <= st) { s.d = 1; ex.push({ x: s.tx, y: s.ty, r: 0, t: 0 }); sfx(200, .2, 'sawtooth') } else { s.x += (s.tx - s.x) / d * st; s.y += (s.ty - s.y) / d * st } ln(W / 2, 590, s.x, s.y, K.a, 1); ci(s.x, s.y, 3, K.a, 2) }
      shots = shots.filter(s => !s.d);
      for (const e of ex) { e.t += dt; e.r = 42 * g.sz * sin(Math.min(1, e.t / .9) * PI); ci(e.x, e.y, e.r, K.d, 1, 2) }
      ex = ex.filter(e => e.t < .9);
      for (const m of ms) {
        m.k += m.v * dt; m.x = m.sx + (m.tx - m.sx) * m.k; m.y = m.sy + (m.ty - m.sy) * m.k;
        if (ex.some(e => hyp(e.x - m.x, e.y - m.y) < e.r)) { m.d = 1; g.score += 25; boom(m.x, m.y, K.c, 10) }
        else if (m.k >= 1) { m.d = 1; const c = cities.find(c => abs(c.x - m.tx) < 5 && c.ok); if (c) { c.ok = 0; boom(c.x, 590, K.b, 40, 250); buzz(120); sfx(90, .5, 'sawtooth', .07) } }
        ln(m.sx, m.sy, m.x, m.y, K.c, 1.5); ci(m.x, m.y, 2.5, '#fff', 2);
      }
      ms = ms.filter(m => !m.d);
      if (!cities.some(c => c.ok)) lose(g);
      else if (!left && !ms.length) { g.score += cities.filter(c => c.ok).length * 100; sfx(1200, .4, 'triangle'); next() }
      ln(0, 600, W, 600, K.e, 2); pg([W / 2 - 20, 600, W / 2, 580, W / 2 + 20, 600], K.a, 1, 1);
      for (const c of cities) if (c.ok) pg([c.x - 16, 600, c.x - 16, 588, c.x - 8, 588, c.x - 8, 580, c.x + 2, 580, c.x + 2, 586, c.x + 16, 586, c.x + 16, 600], K.b, 1, 1); else ln(c.x - 16, 598, c.x + 16, 598, K.c, 2);
      if (!P[0].touch) { ln(cx - 8, cy, cx + 8, cy, K.e, 1); ln(cx, cy - 8, cx, cy + 8, K.e, 1) }
      g.hud = `WAVE ${wave} · ${g.score}`;
    };
  }
};

E.slice = {
  t: 'Slice', c: 'arcade', vs: 0, n: 1, v: [['NEON SLICE', {}], ['SLICE FRENZY', { n: 2, pal: 'TOXIC' }], ['SLICE BOMBS', { bombs: .35, pal: 'BLOOD' }], ['SLICE SLOWMO', { mods: ['slowmo'] }], ['SLICE GIANT', { mods: ['giant'], pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, cols = [K.a, K.b, K.d, K.e]; let ob = [], bits = [], trail = [], t = .5, lives = 3, T = 0;
    const segD = (ax, ay, bx, by, px, py) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, k = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1); return hyp(ax + dx * k - px, ay + dy * k - py) };
    return dt => {
      T += dt; const I = P[0];
      if (I.touch) trail.push([I.tx, I.ty, .15]); for (const p of trail) p[2] -= dt; trail = trail.filter(p => p[2] > 0); if (!I.touch && trail.length) trail = [];
      if ((t -= dt) <= 0) { t = rnd(.5, 1.2) / g.n / (1 + T / 90); for (let i = 0; i < ri(1, 2 + (T > 30)); i++) ob.push({ x: rnd(60, W - 60), y: H + 20, vx: rnd(-70, 70), vy: -rnd(560, 700) * Math.sqrt(g.sp), a: 0, va: rnd(-3, 3), r: rnd(18, 26) * g.sz, s: ri(3, 7), c: pick(cols), bomb: rnd() < (g.bombs || .15) }) }
      const gr = 520 * g.sp;
      for (const o of ob) {
        o.vy += gr * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.a += o.va * dt;
        if (trail.length > 1) { const [a, b] = [trail[trail.length - 2], trail[trail.length - 1]]; if (hyp(b[0] - a[0], b[1] - a[1]) > 4 && segD(a[0], a[1], b[0], b[1], o.x, o.y) < o.r) { o.d = 1; if (o.bomb) { boom(o.x, o.y, K.c, 80, 350); buzz(250); lose(g, 'BOOM · ' + g.score) } else { g.score++; sfx(600 + rnd(400), .06); boom(o.x, o.y, o.c, 10); const n = atan2(b[1] - a[1], b[0] - a[0]) + PI / 2; for (const k of [-1, 1]) bits.push({ ...o, vx: o.vx + cos(n) * 120 * k, vy: o.vy + sin(n) * 120 * k, half: k, l: 1 }) } } }
        if (o.y > H + 40 && o.vy > 0) { o.d = 1; if (!o.bomb) { sfx(150, .2); if (--lives <= 0) lose(g) } }
        if (o.bomb) { pg(poly(o.x, o.y, o.r, 6, o.a, o.r * .5), K.c, 1, 1); ci(o.x, o.y, 4, '#fff', 2) } else pg(poly(o.x, o.y, o.r, o.s, o.a), o.c, 1, 1, 3);
      }
      ob = ob.filter(o => !o.d);
      for (const b of bits) { b.vy += gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; const p = poly(b.x, b.y, b.r, b.s, b.a); pg(p.slice(0, p.length / 2 + 2), b.c, 0, 0, 2) }
      bits = bits.filter(b => b.l > 0);
      if (trail.length > 1) pg(trail.flatMap(p => [p[0], p[1]]), '#fff', 0, 0, 4);
      for (let i = 0; i < lives; i++) ci(W - 14 - i * 16, 40, 5, K.a, 1);
      tx(g.score, W / 2, 60, 40, K.d);
    };
  }
};

E.cave = {
  t: 'Cave Flyer', c: 'arcade', vs: 0, n: 1, v: [['NEON CAVE', {}], ['CAVE NARROW', { sz: .75, pal: 'BLOOD' }], ['CAVE BLOCKS', { n: 2, pal: 'TOXIC' }], ['CAVE TURBO', { sp: 1.4 }], ['CAVE UPSIDE', { mods: ['flip'], pal: 'ICE' }]],
  f(g) {
    const K = g.K, X = 90, SW = 12; let y = H / 2, vy = 0, cols = [], d = 0, mid = H / 2, gap = 380, on = 0, blocks = [];
    for (let x = 0; x <= W + SW; x += SW) cols.push([mid - gap / 2, mid + gap / 2]);
    return dt => {
      const I = P[0]; if (I.a) on = 1;
      if (on) {
        const sp = 170 * g.sp * (1 + d / 8000); d += sp * dt; g.score = d / 10 | 0;
        vy += (I.a ? -900 : 700) * dt; vy = clamp(vy, -320, 360); y += vy * dt;
        for (const b of blocks) b.x -= sp * dt; blocks = blocks.filter(b => b.x > -30);
        const shift = Math.floor(d / SW) - (cols.off || 0);
        for (let i = 0; i < shift; i++) {
          cols.shift(); gap = Math.max(170 * g.sz, gap - .5); mid = clamp(mid + rnd(-22, 22), 60 + gap / 2, H - 60 - gap / 2); cols.push([mid - gap / 2, mid + gap / 2]);
          if (g.n > 1 && rnd() < .04) blocks.push({ x: W + 20, y: mid + rnd(-gap / 4, gap / 4) - 30, h: 60 });
        }
        cols.off = Math.floor(d / SW);
      } else tx('HOLD TO RISE', W / 2, H / 2 + 80, 18, K.e);
      const o = (d % SW), c = cols[Math.floor((X + o) / SW)] || cols[0];
      if (on && (y - 9 < c[0] || y + 9 > c[1] || blocks.some(b => X + 9 > b.x && X - 9 < b.x + 18 && y + 9 > b.y && y - 9 < b.y + b.h))) { boom(X, y, K.a, 50, 250); lose(g) }
      pg(cols.flatMap((c, i) => [i * SW - o, c[0]]), K.b, 0, 0, 3); pg(cols.flatMap((c, i) => [i * SW - o, c[1]]), K.b, 0, 0, 3);
      for (const b of blocks) rc(b.x, b.y, 18, b.h, K.c, 1);
      pg([X + 12, y, X - 10, y - 8, X - 6, y, X - 10, y + 8], K.a, 1, 1); if (I.a && on) ln(X - 10, y, X - 22 - rnd(8), y, K.d, 3);
      tx(g.score, W / 2, 40, 30, K.d);
    };
  }
};

E.moles = {
  t: 'Whack', c: 'party', vs: 0, n: 3, v: [['NEON WHACK', {}], ['WHACK 4×4', { n: 4, pal: 'TOXIC' }], ['WHACK BOMBS', { bombs: 1, pal: 'BLOOD' }], ['WHACK TURBO', { sp: 1.5, pal: 'INFERNO' }], ['WHACK TINY', { n: 5, mods: ['tiny'] }]],
  f(g) {
    const K = g.K, N = g.n, Z = 300 / N, X0 = 30, Y0 = 170, m = new Array(N * N).fill(null); let T = 45, t = 0, cur = (N * N) >> 1;
    return dt => {
      T -= dt; if (T <= 0) return lose(g, 'TIME! SCORE ' + g.score);
      if ((t -= dt) <= 0) { t = rnd(.35, .8) / g.sp * (.6 + T / 110); const e = m.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) m[pick(e)] = { l: 0, life: rnd(.8, 1.4) / g.sp, bomb: g.bombs && rnd() < .25 } }
      const I = P[0]; let hit = -1;
      if (I.dp) cur = clamp((cur / N | 0) + (I.dp == 'd') - (I.dp == 'u'), 0, N - 1) * N + clamp(cur % N + (I.dp == 'r') - (I.dp == 'l'), 0, N - 1);
      if (I.ap && I.touch) { const c = (I.tx - X0) / Z | 0, r = (I.ty - Y0) / Z | 0; if (I.tx > X0 && I.ty > Y0 && c < N && r < N) hit = r * N + c } else if (I.ap) hit = cur;
      if (hit >= 0) { const o = m[hit], x = X0 + (hit % N) * Z + Z / 2, y = Y0 + (hit / N | 0) * Z + Z / 2; if (o) { m[hit] = null; if (o.bomb) { g.score = Math.max(0, g.score - 5); boom(x, y, K.c, 30); buzz(120); sfx(120, .3, 'sawtooth') } else { g.score++; boom(x, y, K.d, 14); sfx(700 + rnd(300), .05) } } else sfx(200, .03) }
      m.forEach((o, i) => {
        const x = X0 + (i % N) * Z + Z / 2, y = Y0 + (i / N | 0) * Z + Z / 2;
        pg(poly(x, y + Z * .25, Z * .38, 12).map((v, k) => k % 2 ? y + Z * .25 + (v - y - Z * .25) * .35 : v), K.e, 1, 0, 2);
        if (o) { o.l += dt; if (o.l > o.life) { m[i] = null; return } const k = sin(Math.min(1, o.l / o.life) * PI), r = Z * .3 * k; if (o.bomb) pg(poly(x, y + Z * .2 - r, r, 8, 0, r * .5), K.c, 1, 1); else { ci(x, y + Z * .2 - r, r, K.a, 1, 3); ci(x - r * .35, y + Z * .1 - r, r * .12, '#fff', 2); ci(x + r * .35, y + Z * .1 - r, r * .12, '#fff', 2) } }
        if (i == cur && !P[0].touch) rc(x - Z / 2 + 4, y - Z / 2 + 4, Z - 8, Z - 8, K.b, 0, 1);
      });
      rc(30, 130, 300, 8, K.e); rc(30, 130, 300 * T / 45, 8, K.d, 2);
      tx(g.score, W / 2, 80, 40, K.d);
    };
  }
};

E.beat = {
  t: 'Beat', c: 'party', vs: 0, n: 1, v: [['NEON BEAT', {}], ['BEAT FAST', { sp: 1.35, pal: 'ULTRA' }], ['BEAT DENSE', { n: 2, pal: 'INFERNO' }], ['BEAT SLOW JAM', { sp: .75, pal: 'MINT' }], ['BEAT RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, LW = 80, X0 = 20, HY = 560, cols = [K.a, K.b, K.d, K.e], tones = [262, 330, 392, 523], key = { l: 0, d: 1, u: 2, r: 3 };
    const bpm = 110 * g.sp, step = 60 / bpm / 2; let notes = [], t = 1, beat = 0, energy = 1, combo = 0, flash = [0, 0, 0, 0], msg = '', mt = 0, T = 0, last = -1;
    return dt => {
      T += dt; const v = 340 * g.sp;
      if ((t -= dt) <= 0) { t += step; beat++; const p = beat % 8 == 0 ? .9 : beat % 2 == 0 ? .55 : .2 * g.n; if (rnd() < Math.min(.95, p * (1 + T / 120))) { let l = ri(0, 3); if (l == last && rnd() < .5) l = (l + 1) % 4; last = l; notes.push({ l, y: -20 }) } }
      const I = P[0]; let lane = -1;
      if (I.dp) lane = key[I.dp]; else if (I.ap && I.touch) lane = clamp((I.tx - X0) / LW | 0, 0, 3); else if (I.ap) lane = notes.length ? notes.reduce((a, b) => b.y > a.y ? b : a).l : -1;
      if (lane >= 0) {
        flash[lane] = .15; const n = notes.filter(n => n.l == lane && abs(n.y - HY) < 46).sort((a, b) => abs(a.y - HY) - abs(b.y - HY))[0];
        if (n) { n.d = 1; const e = abs(n.y - HY); combo++; g.score += (e < 16 ? 100 : 50) * (1 + Math.min(4, combo / 10 | 0)); msg = e < 16 ? 'PERFECT' : 'GOOD'; mt = .4; energy = Math.min(1, energy + .03); play(tones[lane] * (combo % 16 > 7 ? 1.5 : 1), .18, 'triangle', .06); SQ.push([tones[lane], .18, 'triangle', .06]); boom(X0 + lane * LW + LW / 2, HY, cols[lane], 10) }
        else { combo = 0; energy -= .05; sfx(110, .08, 'sawtooth', .03) }
      }
      for (const n of notes) { n.y += v * dt; if (!n.d && n.y > HY + 50) { n.d = 1; combo = 0; energy -= .1; msg = 'MISS'; mt = .4 } }
      notes = notes.filter(n => !n.d);
      if (energy <= 0) lose(g);
      for (let i = 0; i < 4; i++) { flash[i] -= dt; const x = X0 + i * LW; ln(x, 0, x, H, K.e, 1); rc(x + 6, HY - 14, LW - 12, 28, cols[i], flash[i] > 0 ? 1 : 0, 3) }
      ln(X0 + 4 * LW, 0, X0 + 4 * LW, H, K.e, 1);
      for (const n of notes) rc(X0 + n.l * LW + 12, n.y - 10, LW - 24, 20, cols[n.l], 2);
      if ((mt -= dt) > 0) tx(msg, W / 2, 300, 28, msg == 'MISS' ? K.c : K.d);
      if (combo > 4) tx(combo + ' COMBO', W / 2, 340, 16, K.e);
      rc(20, 34, 320, 6, K.e); rc(20, 34, 320 * Math.max(0, energy), 6, energy > .3 ? K.d : K.c, 2);
      g.hud = 'SCORE ' + g.score;
    };
  }
};

E.knife = {
  t: 'Knife Throw', c: 'arcade', vs: 0, n: 1, v: [['NEON KNIVES', {}], ['KNIVES CRAZY SPIN', { sp: 1.4, pal: 'BLOOD' }], ['KNIVES CROWDED', { n: 2, pal: 'TOXIC' }], ['KNIVES DRUNK', { mods: ['drunk'] }], ['KNIVES RAINBOW', { mods: ['rainbow'] }]],
  f(g) {
    const K = g.K, cx = W / 2, cy = 220, R = 70; let rot = 0, st, fly = null, lvl = g.lv0 || 0, need, T = 0, wait = 0;
    const lay = () => { g.level = lvl; st = []; for (let i = 0; i < Math.min(5, lvl + g.n - 1); i++) st.push(rnd(TAU)); need = 5 + lvl; T = 0 };
    lay();
    return dt => {
      T += dt; const sp = (1.4 + lvl * .25) * g.sp * (lvl % 3 == 2 ? sin(T * 1.3) * 1.6 : lvl % 3 == 1 ? (T % 4 < 2 ? 1 : -1.3) : 1);
      rot += sp * dt;
      if (wait > 0) { if ((wait -= dt) <= 0) { lvl++; lay() } }
      else if (!fly && P[0].ap) { fly = { y: 560 }; sfx(800, .04) }
      if (fly) {
        fly.y -= 1700 * dt;
        if (fly.y <= cy + R) {
          const a = ((PI / 2 - rot) % TAU + TAU) % TAU;
          if (st.some(s => abs(angDiff(s, a)) < .2)) { fly = null; boom(cx, cy + R, K.c, 40, 250); buzz(150); lose(g) }
          else { st.push(a); fly = null; g.score++; need--; sfx(300, .08, 'square'); boom(cx, cy + R, K.d, 8); if (!need) { wait = 1; sfx(1200, .4, 'triangle'); boom(cx, cy, K.a, 60, 300) } }
        }
      }
      ci(cx, cy, R, K.a, 1, 4); ci(cx, cy, R * .5, K.a, 0, 1);
      for (const s of st) { const a = s + rot; ln(cx + cos(a) * R, cy + sin(a) * R, cx + cos(a) * (R + 46), cy + sin(a) * (R + 46), K.b, 4) }
      if (fly) ln(cx, fly.y, cx, fly.y + 46, K.b, 4);
      else if (!wait && !g.over) ln(cx, 560, cx, 606, K.b, 4);
      for (let i = 0; i < need; i++) ln(30, 600 - i * 18, 44, 600 - i * 18, K.e, 3);
      g.hud = `STAGE ${lvl + 1} · ${g.score}`; if (wait > 0) tx('STAGE CLEAR', W / 2, 400, 28, K.d);
    };
  }
};

E.stick = {
  t: 'Bridge', c: 'arcade', vs: 0, n: 1, v: [['NEON BRIDGE', {}], ['BRIDGE NARROW', { sz: .6, pal: 'BLOOD' }], ['BRIDGE FAST GROW', { sp: 1.6, pal: 'TOXIC' }], ['BRIDGE GHOST', { mods: ['ghost'], pal: 'ULTRA' }], ['BRIDGE UPSIDE', { mods: ['flip'], pal: 'SUNSET' }]],
  f(g) {
    const K = g.K, GY = 480; let pil = [{ x: 0, w: 90 }], len = 0, st = 'idle', ang = -PI / 2, px = 70, cam = 0, t = 0;
    const add = () => { const l = pil[pil.length - 1]; pil.push({ x: l.x + l.w + rnd(40, 170), w: rnd(30, 80) * g.sz }) };
    add();
    return dt => {
      const I = P[0], a = pil[pil.length - 2], b = pil[pil.length - 1], ex = a.x + a.w;
      if (st == 'idle' && I.a) st = 'grow';
      if (st == 'grow') { len += 300 * g.sp * dt; if (!I.a || len > 500) { st = 'fall'; sfx(400, .1) } }
      if (st == 'fall') { ang += 4 * dt; if (ang >= 0) { ang = 0; st = 'walk'; sfx(250, .06) } }
      if (st == 'walk') {
        const end = ex + len, ok = end >= b.x && end <= b.x + b.w, target = ok ? b.x + b.w - 20 : end + 10;
        px += 260 * dt;
        if (px >= target) { px = target; if (ok) { g.score++; if (abs(end - (b.x + b.w / 2)) < 6) { g.score++; boom(end, GY, '#fff', 20); sfx(1300, .2, 'triangle') } else sfx(800, .08); st = 'scroll'; t = 0 } else { st = 'drop'; t = 0 } }
      }
      if (st == 'drop') { t += dt; ang += 4 * dt; if (t > .6 && !g.over) { boom(px - cam, GY + 100, K.a, 50, 250); lose(g) } }
      if (st == 'scroll') { cam += (b.x + b.w - 90 - cam) * Math.min(1, dt * 6); if (abs(b.x + b.w - 90 - cam) < 2) { add(); len = 0; ang = -PI / 2; st = 'idle' } }
      for (const p of pil) rc(p.x - cam, GY, p.w, H - GY, K.e, 1, 2);
      ln(b.x + b.w / 2 - 3 - cam, GY + 2, b.x + b.w / 2 + 3 - cam, GY + 2, K.c, 4);
      if (len > 0) ln(ex - cam, GY, ex - cam + cos(ang) * len, GY + sin(ang) * len, K.d, 4);
      const py = st == 'drop' ? GY - 14 + t * t * 900 : GY - 14; rc(px - cam - 9, py - 12, 18, 24, K.a, 1);
      tx(g.score, W / 2, 120, 44, K.d); if (st == 'idle' && !g.score) tx('HOLD TO BUILD A BRIDGE', W / 2, 300, 15, K.e);
    };
  }
};
