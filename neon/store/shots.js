// Makes Play Store screenshots (1080x1920) and the feature graphic (1024x500) from the real app.
// Run from the repo root: node neon/store/shots.js   (serves neon/web itself; needs Playwright + Chromium)
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '../web'), OUT = path.join(__dirname, 'screens');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((q, s) => { const f = path.join(WEB, decodeURIComponent(q.url.split('?')[0]) == '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(WEB) || !fs.existsSync(f)) { s.writeHead(404); return s.end() } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s) });
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = `http://localhost:${srv.address().port}/`;
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  // a believable week of play so the profile screens show what they look like in use (demo data, screenshots only)
  await p.addInitScript(() => { if (localStorage.getItem('neon.demo')) return; const d = Date.now(), k = t => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }, days = {}; [22, 35, 18, 41, 27, 33, 15].forEach((m, i) => days[k(d - (6 - i) * 864e5)] = m * 60);
    localStorage.setItem('neon.prog', JSON.stringify({ g: { 'NEON SUDOKU': { p: 14, t: 5400, b: 9, w: 0, l: 0, lv: 8, last: d - 4e6, e: 'sudoku' }, 'NEON PINBALL': { p: 22, t: 3900, b: 48250, w: 0, l: 0, lv: 0, last: d - 2e6, e: 'pinball' }, 'NEON HOCKEY': { p: 9, t: 2100, b: 0, w: 6, l: 3, lv: 0, last: d - 9e6, e: 'hockey' }, 'NEON BALL SORT': { p: 11, t: 1800, b: 12, w: 0, l: 0, lv: 11, last: d - 1e6, e: 'ballsort' } }, days, hours: [19, 20, 19, 21], xp: 2400, plays: 56, time: 13200, got: { first: 1, p10: 1, h1: 1, s3: 1, s7: 1, l5: 1, g10: 1, vs10: 0 }, made: 1, best: 9, vsWins: 6, dailies: 5 }));
    localStorage.setItem('neon.seen', '1'); localStorage.setItem('neon.demo', '1') });
  const shot = async n => { await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, n + '.png') }) };
  await p.goto(url); await shot('1-home');
  await p.evaluate(() => { const c = CAT.find(x => x.e == 'pinball'); openGroup(groupOf(c), c.name) }); await shot('2-game');
  await p.evaluate(() => { closeSheet(); startGame(CAT.find(x => x.name == 'NEON PINBALL'), 'solo') }); await p.waitForTimeout(2500); await shot('3-pinball');
  await p.evaluate(() => { R = null; startGame(CAT.find(x => x.name == 'NEON SUDOKU'), 'solo', 0, 3) }); await shot('4-sudoku');
  await p.evaluate(() => { R = null; startGame(CAT.find(x => x.name == 'NEON TUNNEL'), 'solo') }); await p.waitForTimeout(1800); await shot('5-tunnel');
  await p.evaluate(() => { R = null; startGame(CAT.find(x => x.name == 'NEON HOCKEY'), 'cpu') }); await p.mouse.move(180, 560); await p.mouse.down(); await p.mouse.move(150, 420, { steps: 20 }); await p.mouse.up(); await shot('6-hockey');
  await p.evaluate(() => { R = null; document.querySelector('#game').classList.remove('on'); go_('me') }); await shot('7-profile');
  await p.evaluate(() => go_('make')); await shot('8-create');
  // feature graphic
  const f = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await f.setContent(`<body style="margin:0;background:#06010f;width:1024px;height:500px;overflow:hidden;font-family:ui-monospace,Menlo,monospace;display:grid;place-items:center;position:relative">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,#ffffff08 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,#ffffff08 0 1px,transparent 1px 40px),radial-gradient(ellipse at 50% 120%,#ff2bd640,transparent 60%)"></div>
    <svg width="1024" height="500" style="position:absolute;inset:0" fill="none" stroke-width="5" stroke-linecap="round">
      <circle cx="120" cy="130" r="40" stroke="#00f0ff" style="filter:drop-shadow(0 0 8px #00f0ff)"/><rect x="860" y="70" width="90" height="90" stroke="#fff01f" style="filter:drop-shadow(0 0 8px #fff01f)"/>
      <path d="M80 400 L180 330 L260 420" stroke="#39ff14" style="filter:drop-shadow(0 0 8px #39ff14)"/><path d="M820 420 l50 -80 l50 80 z" stroke="#ff2bd6" style="filter:drop-shadow(0 0 8px #ff2bd6)"/></svg>
    <div style="position:relative;text-align:center"><div style="font-size:150px;font-weight:800;letter-spacing:30px;color:#fff;text-shadow:0 0 10px #ff2bd6,0 0 40px #ff2bd6,0 0 80px #ff2bd6">NEON</div>
    <div style="font-size:30px;color:#00f0ff;text-shadow:0 0 12px #00f0ff;letter-spacing:4px">370 GAMES · FULLY OFFLINE</div></div></body>`);
  await f.screenshot({ path: path.join(OUT, 'feature-graphic.png') });
  await b.close(); srv.close(); console.log('saved to', OUT);
})();
