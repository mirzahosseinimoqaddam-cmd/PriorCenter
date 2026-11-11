'use strict';
// Player progress, no DOM: per-game stats and play time, saved levels, streaks, XP levels, trophies, unlocks, reminder plan.
for (const k of ['breakout', 'rocks', 'maze', 'lander', 'lights', 'invaders', 'knife']) E[k].lv = 1; // games that save the level you reached

const BEST = ['jumper', 'shmup', 'rocks', 'runner', 'invaders']; // the player's favourites: first in Featured, open from the start
const FEATURED = [...BEST, 'pong', 'snake', 'blocks', 'pinball', 'slice', 'hockey', 'sudoku', 'ballsort', 'tunnel', 'pool', 'flap', 'crates'];
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }; // local date
const blank = () => ({ g: {}, days: {}, hours: [], xp: 0, plays: 0, time: 0, got: {}, made: 0, shared: 0, best: 0, hardWins: 0, vsWins: 0, dailies: 0, two: 0, mash: 0 });
let PR = Object.assign(blank(), load('neon.prog', {}));
const saveProg = () => save('neon.prog', PR);
const statOf = name => PR.g[name] || { p: 0, t: 0, b: 0, w: 0, l: 0, lv: 0, last: 0 };

// level L needs 60·L·(L−1)/2 XP in total
const lvlXP = L => 30 * L * (L - 1);
const lvlOf = xp => { let L = 1; while (xp >= lvlXP(L + 1)) L++; return L };
// days in a row with play, ending today (or yesterday: still alive until midnight)
function streak(now = Date.now()) { let s = 0, t = now; if (!PR.days[dayKey(t)]) t -= 864e5; while (PR.days[dayKey(t)]) { s++; t -= 864e5 } return s }

// unlocks: featured first, then the rest; 20 games at level 1 and 4 more each level
const ORDER = () => [...FEATURED, ...Object.keys(E).filter(k => !FEATURED.includes(k))];
const unlockLevel = k => k == 'mine' ? 1 : k == 'mix' ? 3 : Math.max(1, Math.ceil((ORDER().indexOf(k) - 19) / 4) + 1);
const isOpen = k => SET.all || lvlOf(PR.xp) >= unlockLevel(k);

const TROPHIES = [ // id, name, how, name (fa), how (fa), test
  ['first', 'First Glow', 'Play your first game', 'اولین درخشش', 'اولین بازی‌ات را انجام بده', () => PR.plays >= 1],
  ['p10', 'Warming Up', 'Play 10 games', 'گرم کردن', '۱۰ بازی انجام بده', () => PR.plays >= 10],
  ['p100', 'Regular', 'Play 100 games', 'همیشگی', '۱۰۰ بازی انجام بده', () => PR.plays >= 100],
  ['p500', 'Neon Legend', 'Play 500 games', 'افسانه نئون', '۵۰۰ بازی انجام بده', () => PR.plays >= 500],
  ['h1', 'One Hour', 'Play 1 hour in total', 'یک ساعت', 'در مجموع ۱ ساعت بازی کن', () => PR.time >= 3600],
  ['h5', 'Five Hours', 'Play 5 hours in total', 'پنج ساعت', 'در مجموع ۵ ساعت بازی کن', () => PR.time >= 18000],
  ['h20', 'Night Owl', 'Play 20 hours in total', 'جغد شب', 'در مجموع ۲۰ ساعت بازی کن', () => PR.time >= 72000],
  ['s3', 'On a Roll', '3-day streak', 'در جریان', '۳ روز پشت‌سرهم', () => streak() >= 3],
  ['s7', 'Week of Light', '7-day streak', 'هفتهٔ نور', '۷ روز پشت‌سرهم', () => streak() >= 7],
  ['s30', 'Unbreakable', '30-day streak', 'شکست‌ناپذیر', '۳۰ روز پشت‌سرهم', () => streak() >= 30],
  ['l5', 'Level 5', 'Reach level 5', 'سطح ۵', 'به سطح ۵ برس', () => lvlOf(PR.xp) >= 5],
  ['l10', 'Level 10', 'Reach level 10', 'سطح ۱۰', 'به سطح ۱۰ برس', () => lvlOf(PR.xp) >= 10],
  ['l20', 'Level 20', 'Reach level 20', 'سطح ۲۰', 'به سطح ۲۰ برس', () => lvlOf(PR.xp) >= 20],
  ['g10', 'Explorer', 'Try 10 different games', 'کاوشگر', '۱۰ بازی مختلف را امتحان کن', () => new Set(Object.values(PR.g).map(s => s.e)).size >= 10],
  ['g30', 'Collector', 'Try 30 different games', 'کلکسیونر', '۳۰ بازی مختلف را امتحان کن', () => new Set(Object.values(PR.g).map(s => s.e)).size >= 30],
  ['vs10', 'Bot Breaker', 'Beat the CPU 10 times', 'ربات‌شکن', '۱۰ بار کامپیوتر را ببر', () => PR.vsWins >= 10],
  ['hard', 'Hard Mode Hero', 'Beat the CPU on HARD', 'قهرمان سخت', 'کامپیوتر را در حالت سخت ببر', () => PR.hardWins >= 1],
  ['daily7', 'Daily Habit', 'Play 7 daily challenges', 'عادت روزانه', '۷ چالش روزانه بازی کن', () => PR.dailies >= 7],
  ['best25', 'Record Breaker', 'Set 25 new high scores', 'رکوردشکن', '۲۵ رکورد جدید بزن', () => PR.best >= 25],
  ['lv10', 'Climber', 'Reach level 10 in a level game', 'صعودکننده', 'در یک بازی مرحله‌ای به مرحله ۱۰ برس', () => Object.values(PR.g).some(s => s.lv >= 9)],
  ['make', 'Game Maker', 'Create your own game', 'سازنده', 'بازی خودت را بساز', () => PR.made >= 1],
  ['share', 'Sharer', 'Share a game code', 'اشتراک‌گذار', 'کد یک بازی را به اشتراک بگذار', () => PR.shared >= 1],
  ['two', 'Better Together', 'Play a 2-player game', 'با هم بهتر', 'یک بازی دونفره انجام بده', () => PR.two >= 1],
  ['mash', 'Mad Scientist', 'Play a mashup', 'دانشمند دیوانه', 'یک بازی ترکیبی انجام بده', () => PR.mash >= 1],
];
function checkTrophies() { const n = []; for (const t of TROPHIES) if (!PR.got[t[0]] && t[5]()) { PR.got[t[0]] = Date.now(); n.push(t) } return n }

// one finished game → stats, XP and what changed (for the results screen)
function record(c, r) {
  const s = PR.g[c.name] = Object.assign(statOf(c.name), { e: c.e });
  s.p++; s.t += r.secs; s.last = Date.now();
  const newBest = !vsOf(c) && r.score > s.b && s.p > 1; if (!vsOf(c)) s.b = Math.max(s.b, r.score);
  if (r.win === 0) s.w++; else if (r.win === 1) s.l++;
  if (r.level != null) s.lv = Math.max(s.lv, r.level);
  PR.plays++; PR.time += r.secs; const d = dayKey(); PR.days[d] = (PR.days[d] || 0) + r.secs;
  PR.hours = [...PR.hours, new Date().getHours()].slice(-30);
  if (r.mode == 'cpu' && r.win === 0) { PR.vsWins++; if (r.diff == 2) PR.hardWins++ }
  if (r.daily) PR.dailies++; if (r.mode == 'local' || r.mode == 'hot') PR.two++; if (c.mix) PR.mash++; if (newBest) PR.best++;
  const before = lvlOf(PR.xp), xp = Math.round(10 + Math.min(60, r.secs / 3) + (newBest ? 15 : 0) + (r.win === 0 ? 20 : 0) + (r.daily ? 25 : 0));
  PR.xp += xp; const after = lvlOf(PR.xp);
  const trophies = checkTrophies(); saveProg();
  const unlocked = after > before ? ORDER().filter(k => unlockLevel(k) > before && unlockLevel(k) <= after) : [];
  return { xp, newBest, levelUp: after > before ? after : 0, trophies, unlocked };
}

// ---- smart reminders: at most one a day, at the hour you usually play, about what matters to you right now
function usualHour() { const h = PR.hours.slice(-20); if (!h.length) return 19; const s = [...h].sort((a, b) => a - b); return clamp(s[s.length >> 1], 9, 21) }
function topGame() { let b = null; for (const [n, s] of Object.entries(PR.g)) if (!b || s.t > b[1].t) b = [n, s]; return b }
function planReminders(now = Date.now(), fa = false) {
  if (!PR.plays) return [];
  const out = [], st = streak(now), today = !!PR.days[dayKey(now)], H = usualHour(), L = lvlOf(PR.xp), need = lvlXP(L + 1) - PR.xp, top = topGame();
  const at = (off, hour, min = 0) => { const d = new Date(now); d.setDate(d.getDate() + off); d.setHours(hour, min, 0, 0); return d.getTime() };
  const m = (en, f) => fa ? f : en;
  if (!today && st > 0) { const t = at(0, Math.max(H, 20), 30); if (t > now + 30 * 60e3) out.push({ at: t, title: m(`🔥 ${st}-day streak`, `🔥 زنجیرهٔ ${st} روزه`), body: m('Play one quick game before midnight to keep it alive.', 'یک بازی کوتاه تا قبل از نیمه‌شب انجام بده تا زنجیره نشکند.') }) }
  for (let d = 1; d <= 7; d++) {
    const t = at(d, H, 5); let msg = null;
    if (d == 1) msg = st > 0 || today ? [m(`🔥 Day ${st + (today ? 1 : 0)} is waiting`, `🔥 روز ${st + (today ? 1 : 0)} منتظر توست`), m('Keep your streak going with today’s daily challenge.', 'با چالش روزانهٔ امروز زنجیره‌ات را ادامه بده.')] : [m('☀ New daily challenge', '☀ چالش روزانهٔ جدید'), m('A fresh game is ready for you today.', 'یک بازی تازه برای امروز آماده است.')];
    else if (d == 2) msg = [m(`⭐ ${need} XP to level ${L + 1}`, `⭐ ${need} امتیاز تا سطح ${L + 1}`), m('A couple of games and new ones unlock.', 'با چند بازی، بازی‌های جدید باز می‌شوند.')];
    else if (d == 3 && top) msg = [m(`🏆 Beat your best in ${top[0]}`, `🏆 رکوردت را در ${top[0]} بشکن`), top[1].b ? m(`Your record is ${top[1].b}. Today could be the day.`, `رکوردت ${top[1].b} است. شاید امروز روزش باشد.`) : m('Your favourite game misses you.', 'بازی محبوبت دلش برایت تنگ شده.')];
    else if (d == 5) msg = [m('🎮 New games to try', '🎮 بازی‌های جدید برای امتحان'), m('There are games you haven’t played yet.', 'هنوز بازی‌هایی هست که امتحان نکرده‌ای.')];
    else if (d == 7) msg = [m('✨ NEON misses you', '✨ نئون دلش برایت تنگ شده'), m('Your games, scores and levels are right where you left them.', 'بازی‌ها، رکوردها و مرحله‌هایت همان‌جا منتظرند.')];
    if (msg) out.push({ at: t, title: msg[0], body: msg[1] });
  }
  return out;
}
