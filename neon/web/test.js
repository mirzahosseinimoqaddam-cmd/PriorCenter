// Self-check: runs every catalog game in every local mode with random input; fails on exceptions or NaN draw values.
// Run: node neon/web/test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['engine.js', 'games1.js', 'games2.js', 'games3.js', 'games4.js', 'games5.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, performance, Math, JSON, setTimeout, localStorage: { getItem: () => null, setItem() { } } });
vm.runInContext(src, ctx);
if (!process.env.BOTS_ONLY) vm.runInContext(`
;(function(){
  const list = catalog().concat(Array.from({ length: 60 }, randomGame)); let runs = 0, fails = 0;
  for (const c of list) for (const mode of modesOf(c).filter(m => m != 'online')) {
    try {
      const diff = runs % 3; let r = makeRun(c, mode, diff), frames = 0, overs = 0;
      for (let f = 0; f < 1500; f++) {
        for (const I of P) {
          const touch = Math.random() < .5, a = Math.random() < .2;
          I.ap = a && !I.a; I.ar = !a && I.a; I.a = a; I.x = rnd(-1, 1); I.y = rnd(-1, 1); I.touch = touch && a;
          I.tx = I.touch ? rnd(W) : null; I.ty = I.touch ? rnd(H) : null; I.rx = rnd(-60, 60); I.ry = rnd(-60, 60);
          I.dp = Math.random() < .1 ? pick(['u', 'd', 'l', 'r']) : '';
          if (Math.random() < .03) KP.KeyX = 1; else delete KP.KeyX;
        }
        const dt = pick([1 / 60, 1 / 60, 1 / 60, 0, 1 / 30, .05, 1 / 120, .2]); DL = []; r.tick(dt); parts(1 / 60); frames++;
        for (const o of DL) for (const v of o.flat(2)) if (typeof v == 'number' && !isFinite(v)) throw new Error('bad draw value in op ' + JSON.stringify(o).slice(0, 80));
        if (r.g.over) { overs++; r = makeRun(c, mode, diff) }
      }
      runs++;
    } catch (e) { fails++; console.log('FAIL', c.name, mode, e.stack.split('\\n').slice(0, 3).join(' | ')) }
  }
  console.log((list.length - 60) + ' games + 60 random creations, ' + runs + ' game/mode runs ok, ' + fails + ' failed');
  if (fails || list.length - 60 < 100) throw new Error('self-check failed');
})();`, ctx);

// Bot check: against a player who does nothing, every real-time bot must win on its own within 3 minutes.
vm.runInContext(`;(function(){
  const bots = ['pong', 'hockey', 'tanks', 'sumo', 'volley', 'duel', 'tug', 'snake'], bad = [];
  for (const e of bots) for (const diff of [0, 1, 2]) {
    const c = e == 'snake' ? { name: 'LIGHT CYCLES', e, tron: 1, vs: 1 } : { name: E[e].v[0][0], e };
    const r = makeRun(c, 'cpu', diff); let f = 0;
    for (const I of P) Object.assign(I, { x: 0, y: 0, a: 0, ap: 0, ar: 0, tx: null, ty: null, touch: 0, rx: 0, ry: 0, dp: '' });
    let wx = W / 2, wy = 560; const clumsy = e == 'hockey' || e == 'volley'; // a slow, aimless human for games that wait for the player
    for (; f < 60 * 180 && !r.g.over; f++) { if (clumsy) { if (f % 90 == 0) { wx = rnd(40, W - 40); wy = rnd(H / 2 + 40, H - 40) } Object.assign(P[0], { touch: 1, a: 1, tx: wx, ty: wy, x: clamp((wx - 180) / 100, -1, 1) }) } DL = []; r.tick(1 / 60) }
    if (!r.g.over || r.g.win !== 1) bad.push(e + ' diff ' + diff + ': ' + (r.g.over ? r.g.msg : 'no result after 3 min'));
    else console.log('bot ok', e, 'diff', diff, 'won in', (f / 60).toFixed(0) + 's');
  }
  if (bad.length) { console.log('BOT FAIL', bad); throw new Error('bot check failed') }
})();`, ctx);
