// EinsteLab key service (Cloudflare Worker). Each key works once: the first phone that uses it
// gets 3 days from that moment; any other phone is refused, and the same phone gets the same end date back.
// Needs a KV namespace bound as KEYS.
const VALID = ["99653fd816691d94b05a21d962aad762", "ffa365f7683eb69b579713110193798f", "89f448168754596c9ddf1aded5230d13", "1b8c6469e1f1051447e8bce241833bc5", "ade8e4a339c4fbb1d6fff696debd3fda", "6e12464d0b2c7251eace90930a3cbaaf", "a68192cd5cec9d0aa1487026faeac43e", "424e0fecaae5c525282941096b9136e8", "f6622336d6c6d773ccd65078380493b9", "9ff485e07366e487e581ebdaf22ba2e9", "572ea1919aa279004e252dbc252e86a7", "37f7c53dec5be3cca67a58db074209dd", "0cccf718a0cd4bfb18d88ce5bc4b0eba", "da494216b083a4cc30a3dd48cc196888"]; // SHA-256 (first 32 hex) of each key, uppercased, A-Z and 0-9 only
const LIFE = 3 * 864e5;
const FINAL = Date.UTC(2026, 11, 31, 23, 59, 59);
const HEAD = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: HEAD });

async function sha(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function answer(rec, now) {
  const end = Math.min(rec.start + LIFE, FINAL);
  return out(end > now ? { ok: true, end, now } : { ok: false, reason: 'expired', now });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: HEAD });
    if (req.method !== 'POST') return out({ ok: false, reason: 'method' }, 405);
    let body;
    try { body = await req.json(); } catch (e) { return out({ ok: false, reason: 'bad' }, 400); }
    const now = Date.now();
    const device = String(body.device || '').slice(0, 100);
    if (device.length < 8) return out({ ok: false, reason: 'bad' }, 400);
    const path = new URL(req.url).pathname;

    // what this phone already has (after a reinstall, or to refresh the end date)
    if (path === '/status') {
      const id = await env.KEYS.get('d:' + device);
      const rec = id && JSON.parse((await env.KEYS.get('k:' + id)) || 'null');
      return rec ? answer(rec, now) : out({ ok: false, reason: 'none', now });
    }

    if (path === '/redeem') {
      if (now >= FINAL) return out({ ok: false, reason: 'over', now });
      const id = await sha(String(body.key || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
      if (!VALID.includes(id)) return out({ ok: false, reason: 'invalid', now });
      let rec = JSON.parse((await env.KEYS.get('k:' + id)) || 'null');
      if (rec && rec.device !== device) return out({ ok: false, reason: 'used', now });
      if (!rec) {
        rec = { device, start: now };
        await env.KEYS.put('k:' + id, JSON.stringify(rec));
        await env.KEYS.put('d:' + device, id);
      }
      return answer(rec, now);
    }
    return out({ ok: false, reason: 'path' }, 404);
  },
};
