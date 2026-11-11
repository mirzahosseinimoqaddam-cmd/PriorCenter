// Self-check: runs every catalog game in every local mode with random input; fails on exceptions or NaN draw values.
// Run: node neon/web/test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['engine.js', 'games1.js', 'games2.js', 'games3.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, performance, Math, JSON, setTimeout, localStorage: { getItem: () => null, setItem() { } } });
vm.runInContext(src + `
;(function(){
  const list = catalog().concat(Array.from({ length: 60 }, randomGame)); let runs = 0, fails = 0;
  for (const c of list) for (const mode of modesOf(c).filter(m => m != 'online')) {
    try {
      let r = makeRun(c, mode), frames = 0, overs = 0;
      for (let f = 0; f < 1500; f++) {
        for (const I of P) {
          const touch = Math.random() < .5, a = Math.random() < .2;
          I.ap = a && !I.a; I.ar = !a && I.a; I.a = a; I.x = rnd(-1, 1); I.y = rnd(-1, 1); I.touch = touch && a;
          I.tx = I.touch ? rnd(W) : null; I.ty = I.touch ? rnd(H) : null; I.rx = rnd(-60, 60); I.ry = rnd(-60, 60);
          I.dp = Math.random() < .1 ? pick(['u', 'd', 'l', 'r']) : '';
        }
        DL = []; r.tick(1 / 60); parts(1 / 60); frames++;
        for (const o of DL) for (const v of o.flat(2)) if (typeof v == 'number' && !isFinite(v)) throw new Error('bad draw value in op ' + JSON.stringify(o).slice(0, 80));
        if (r.g.over) { overs++; r = makeRun(c, mode) }
      }
      runs++;
    } catch (e) { fails++; console.log('FAIL', c.name, mode, e.stack.split('\\n').slice(0, 3).join(' | ')) }
  }
  console.log((list.length - 60) + ' games + 60 random creations, ' + runs + ' game/mode runs ok, ' + fails + ' failed');
  if (fails || list.length - 60 < 100) throw new Error('self-check failed');
})();`, ctx);
