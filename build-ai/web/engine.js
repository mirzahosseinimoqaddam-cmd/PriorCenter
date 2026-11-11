/* Build AI phone engine: runs model.bin on the CPU, no internet, no libraries.
 * Mirrors trainer/model.py (PixelModel.forward) with a key/value cache, so each new
 * pixel costs one small step instead of re-reading the whole picture.
 * Works in a Web Worker (the app) and in Node (tests).
 */
var BuildAIEngine = (function () {
  'use strict';

  function loadModel(buf) {
    var u8 = new Uint8Array(buf);
    var magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (magic !== 'BAI1') throw new Error('Not a Build AI model file');
    var n = new DataView(buf).getUint32(4, true);
    var header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n)));
    var base = 8 + n, w = {};
    header.tensors.forEach(function (t) {
      var size = t.shape.reduce(function (a, b) { return a * b; }, 1);
      var out = new Float32Array(size);
      if (t.dtype === 'q8') {
        var q = new Int8Array(buf, base + t.data, size);
        var sc = new Float32Array(buf.slice(base + t.scale, base + t.scale + 4 * t.shape[0]));
        var cols = t.shape[1];
        for (var r = 0; r < t.shape[0]; r++) {
          var s = sc[r], o = r * cols;
          for (var c = 0; c < cols; c++) out[o + c] = q[o + c] * s;
        }
      } else {
        out.set(new Float32Array(buf.slice(base + t.data, base + t.data + 4 * size)));
      }
      w[t.name] = out;
    });
    var c = header.config;
    var index = {};
    header.vocab.forEach(function (word, i) { index[word] = i; });
    return {
      name: header.name, cfg: c, vocab: header.vocab, index: index, palette: header.palette, w: w,
      transparent: c.palette, bos: c.palette + 1, nOut: c.palette + 1,
      seqLen: c.text_len + c.size * c.size, step: header.step || 0, aliases: header.aliases || {}
    };
  }

  // word -> id: exact, plural, or through the alias map (synonyms and Persian words, from make_aliases.py)
  function wordId(m, w) {
    var forms = [w];
    if (/ies$/.test(w)) forms.push(w.slice(0, -3) + 'y');
    if (/es$/.test(w)) forms.push(w.slice(0, -2));
    if (/s$/.test(w)) forms.push(w.slice(0, -1));
    var i, a;
    for (i = 0; i < forms.length; i++) if (m.index[forms[i]] !== undefined) return m.index[forms[i]]; // real words first
    for (i = 0; i < forms.length; i++) { a = m.aliases[forms[i]]; if (a && m.index[a] !== undefined) return m.index[a]; }
    return undefined;
  }

  function tokenize(m, prompt) {
    var mapped = [];
    var parts = String(prompt).toLowerCase().replace(/\u200c/g, '\u200c').split(/[\s,.!?،؛]+/), words = [];
    parts.forEach(function (p) {
      if (!p) return;
      if (/[a-z0-9]/.test(p)) { words = words.concat(p.match(/[a-z0-9]+/g)); return; }
      var bare = p.replace(/\u200c?(های|ها|ی)$/, '').replace(/\u200c/g, ''); // plural / -i ending, half-space
      var en = m.aliases[p] || m.aliases[p.replace(/\u200c/g, '')] || m.aliases[bare];
      if (en) mapped.push(p + ' → ' + en);
      words = words.concat(en ? en.split(' ') : ['\u0000' + p]); // keep unknown Persian words for the message
    });
    var ids = [], unknown = [];
    for (var i = 0; i < words.length && ids.length < m.cfg.text_len; i++) {
      var w = words[i], id = w.charAt(0) === '\u0000' ? undefined : wordId(m, w);
      if (id === undefined) { id = 1; unknown.push(w.replace('\u0000', '')); }
      else if (m.vocab[id] !== w && !m.vocab[id].startsWith(w.replace(/s$/, ''))) mapped.push(w + ' → ' + m.vocab[id]);
      ids.push(id);
    }
    while (ids.length < m.cfg.text_len) ids.push(0);
    return { ids: ids, unknown: unknown, mapped: mapped };
  }

  function layerNorm(x, g, b, y, d) {
    var mean = 0, v = 0, i;
    for (i = 0; i < d; i++) mean += x[i];
    mean /= d;
    for (i = 0; i < d; i++) { var t = x[i] - mean; v += t * t; }
    var inv = 1 / Math.sqrt(v / d + 1e-5);
    for (i = 0; i < d; i++) y[i] = (x[i] - mean) * inv * g[i] + b[i];
  }

  var GC = Math.sqrt(2 / Math.PI);
  function gelu(x) { return 0.5 * x * (1 + Math.tanh(GC * (x + 0.044715 * x * x * x))); }

  // One sequence's running state: cached keys/values per layer, and which positions may be looked at.
  function Seq(m) {
    var c = m.cfg, T = m.seqLen;
    this.k = []; this.v = [];
    for (var l = 0; l < c.layers; l++) { this.k.push(new Float32Array(T * c.dim)); this.v.push(new Float32Array(T * c.dim)); }
    this.keep = new Uint8Array(T);
    this.t = 0;
  }

  // Y[b*nOut + o] = bias[o] + W[o, :] . X[b*nIn : ...]  for every sequence b.
  // Each weight row is read once and used for all sequences, which is what makes batching fast.
  function linearB(W, bias, X, Y, nIn, nOut, B) {
    for (var o = 0; o < nOut; o++) {
      var r = o * nIn, bo = bias ? bias[o] : 0;
      for (var b = 0; b < B; b++) {
        var xo = b * nIn, s0 = 0, s1 = 0, s2 = 0, s3 = 0, i = 0;
        for (; i + 3 < nIn; i += 4) {
          s0 += W[r + i] * X[xo + i]; s1 += W[r + i + 1] * X[xo + i + 1];
          s2 += W[r + i + 2] * X[xo + i + 2]; s3 += W[r + i + 3] * X[xo + i + 3];
        }
        for (; i < nIn; i++) s0 += W[r + i] * X[xo + i];
        Y[b * nOut + o] = bo + ((s0 + s1) + (s2 + s3));
      }
    }
  }

  function layerNormB(X, g, bias, Y, d, B) {
    for (var b = 0; b < B; b++) layerNorm(X.subarray(b * d, b * d + d), g, bias, Y.subarray(b * d, b * d + d), d);
  }

  /* Feed one token to each sequence (all at the same position); returns logits for
   * the next pixel of each sequence, or null while still reading the prompt. */
  function stepBatch(m, seqs, tokens, isText, scratch) {
    var c = m.cfg, D = c.dim, H = c.heads, hd = D / H, w = m.w, B = seqs.length, t = seqs[0].t;
    var X = scratch.x, Hn = scratch.h, QKV = scratch.qkv, A = scratch.a, F = scratch.f, TMP = scratch.tmp, sc = scratch.att;
    var emb = isText ? w['text_emb.weight'] : w['pix_emb.weight'], pos = w['pos'], i, b;
    for (b = 0; b < B; b++) {
      var tok = tokens[b];
      for (i = 0; i < D; i++) X[b * D + i] = emb[tok * D + i] + pos[t * D + i];
      seqs[b].keep[t] = isText ? (tok !== 0 ? 1 : 0) : 1;
    }
    var scale = 1 / Math.sqrt(hd);
    for (var l = 0; l < c.layers; l++) {
      var p = 'blocks.' + l + '.';
      layerNormB(X, w[p + 'ln1.weight'], w[p + 'ln1.bias'], Hn, D, B);
      linearB(w[p + 'qkv.weight'], w[p + 'qkv.bias'], Hn, QKV, D, 3 * D, B);
      for (b = 0; b < B; b++) {
        var seq = seqs[b], K = seq.k[l], V = seq.v[l], q = b * 3 * D, ao = b * D;
        for (i = 0; i < D; i++) { K[t * D + i] = QKV[q + D + i]; V[t * D + i] = QKV[q + 2 * D + i]; }
        for (var hh = 0; hh < H; hh++) {
          var qo = hh * hd, mx = -Infinity, j, e;
          for (j = 0; j <= t; j++) {
            if (!seq.keep[j] && j !== t) { sc[j] = -Infinity; continue; }
            var s = 0, ko = j * D + qo;
            for (e = 0; e < hd; e++) s += QKV[q + qo + e] * K[ko + e];
            s *= scale; sc[j] = s; if (s > mx) mx = s;
          }
          var sum = 0;
          for (j = 0; j <= t; j++) { var ex = sc[j] === -Infinity ? 0 : Math.exp(sc[j] - mx); sc[j] = ex; sum += ex; }
          for (e = 0; e < hd; e++) A[ao + qo + e] = 0;
          for (j = 0; j <= t; j++) {
            if (sc[j] === 0) continue;
            var wt = sc[j] / sum, vo = j * D + qo;
            for (e = 0; e < hd; e++) A[ao + qo + e] += wt * V[vo + e];
          }
        }
      }
      linearB(w[p + 'proj.weight'], w[p + 'proj.bias'], A, TMP, D, D, B);
      for (i = 0; i < B * D; i++) X[i] += TMP[i];
      layerNormB(X, w[p + 'ln2.weight'], w[p + 'ln2.bias'], Hn, D, B);
      linearB(w[p + 'fc1.weight'], w[p + 'fc1.bias'], Hn, F, D, 4 * D, B);
      for (i = 0; i < B * 4 * D; i++) F[i] = gelu(F[i]);
      linearB(w[p + 'fc2.weight'], w[p + 'fc2.bias'], F, TMP, 4 * D, D, B);
      for (i = 0; i < B * D; i++) X[i] += TMP[i];
    }
    for (b = 0; b < B; b++) seqs[b].t = t + 1;
    if (t < c.text_len) return null; // prompt positions predict nothing
    layerNormB(X, w['ln_f.weight'], w['ln_f.bias'], Hn, D, B);
    var out = new Float32Array(B * m.nOut), res = [];
    linearB(w['head.weight'], w['head.bias'], Hn, out, D, m.nOut, B);
    for (b = 0; b < B; b++) res.push(out.subarray(b * m.nOut, (b + 1) * m.nOut));
    return res;
  }

  function makeScratch(m, B) {
    var D = m.cfg.dim;
    return { x: new Float32Array(B * D), h: new Float32Array(B * D), qkv: new Float32Array(B * 3 * D), a: new Float32Array(B * D),
      f: new Float32Array(B * 4 * D), tmp: new Float32Array(B * D), att: new Float32Array(m.seqLen) };
  }

  // small seeded random numbers so a seed always gives the same picture
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sample(logits, temperature, topK, rand) {
    var n = logits.length, i, idx = [];
    for (i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return logits[b] - logits[a]; });
    var k = topK > 0 ? Math.min(topK, n) : n;
    var T = Math.max(temperature, 1e-5), mx = logits[idx[0]], p = [], sum = 0;
    for (i = 0; i < k; i++) { var e = Math.exp((logits[idx[i]] - mx) / T); p.push(e); sum += e; }
    var r = rand() * sum;
    for (i = 0; i < k; i++) { r -= p[i]; if (r <= 0) return idx[i]; }
    return idx[k - 1];
  }

  /* Make `count` pictures for a prompt.
   * opts: count, temperature (0.7), topK (10), guidance (2.0), seed, mirror (false),
   *       fixed (array of size*size: palette id to keep that pixel, -1 to let the AI draw it)
   * onProgress(done, total) is called as rows finish.
   * Returns { images: [Uint8Array(size*size) of palette ids], unknown: [words not known] }
   */
  function generate(m, prompt, opts, onProgress) {
    opts = opts || {};
    var count = opts.count || 1, g = opts.guidance === undefined ? 2.0 : opts.guidance;
    var temperature = opts.temperature === undefined ? 0.7 : opts.temperature;
    var topK = opts.topK === undefined ? 10 : opts.topK;
    var fixed = opts.fixed || null;
    var rand = rng(opts.seed === undefined ? (Math.random() * 4294967296) >>> 0 : opts.seed);
    var c = m.cfg, N = c.size * c.size, L = c.text_len;
    var tok = tokenize(m, prompt), empty = [];
    for (var i = 0; i < L; i++) empty.push(0);
    var useG = g !== 1 && tok.ids.some(function (x) { return x !== 0; });
    // all pictures (and their prompt-free twins used for guidance) go through the model together
    var seqs = [], images = [], j, b, nb = useG ? 2 * count : count;
    for (b = 0; b < nb; b++) seqs.push(new Seq(m));
    for (b = 0; b < count; b++) images.push(new Uint8Array(N));
    var scratch = makeScratch(m, nb), toks = new Array(nb);
    for (j = 0; j < L; j++) {
      for (b = 0; b < nb; b++) toks[b] = b < count ? tok.ids[j] : 0;
      stepBatch(m, seqs, toks, true, scratch);
    }
    for (b = 0; b < nb; b++) toks[b] = m.bos;
    var lg = stepBatch(m, seqs, toks, false, scratch);
    for (var p = 0; p < N; p++) {
      for (b = 0; b < count; b++) {
        var lc = lg[b];
        if (useG) { var u = lg[b + count]; for (j = 0; j < lc.length; j++) lc[j] = u[j] + g * (lc[j] - u[j]); }
        var x = p % c.size, px;
        if (fixed && fixed[p] >= 0) px = fixed[p]; // a pixel the user locked
        else if (opts.mirror && x >= c.size >> 1) px = images[b][p - x + c.size - 1 - x]; // copy the left half while drawing
        else px = sample(lc, temperature, topK, rand);
        images[b][p] = px;
        toks[b] = px; if (useG) toks[b + count] = px;
      }
      if (p < N - 1) lg = stepBatch(m, seqs, toks, false, scratch);
      if (onProgress && (p + 1) % c.size === 0) onProgress(p + 1, N);
    }
    return { images: images, unknown: tok.unknown, mapped: tok.mapped };
  }

  // Logits for a given prompt + pixels at every pixel position (used by tests only).
  function allLogits(m, prompt, pixels) {
    var c = m.cfg, L = c.text_len, seqs = [new Seq(m)], sc = makeScratch(m, 1), out = [];
    var ids = Array.isArray(prompt) ? prompt : tokenize(m, prompt).ids;
    for (var j = 0; j < L; j++) stepBatch(m, seqs, [ids[j]], true, sc);
    out.push(stepBatch(m, seqs, [m.bos], false, sc)[0]);
    for (var p = 0; p < pixels.length - 1; p++) out.push(stepBatch(m, seqs, [pixels[p]], false, sc)[0]);
    return out;
  }

  // Worker protocol: {type:'load', buffer} / {type:'generate', id, prompt, opts}
  function serveWorker(self) {
    var model = null;
    self.onmessage = function (ev) {
      var d = ev.data;
      try {
        if (d.type === 'load') {
          model = loadModel(d.buffer);
          self.postMessage({ type: 'loaded', name: model.name, size: model.cfg.size, palette: model.palette,
            transparent: model.transparent, words: model.vocab.length, vocab: model.vocab, step: model.step,
            params: Object.keys(model.w).reduce(function (a, k) { return a + model.w[k].length; }, 0) });
        } else if (d.type === 'generate') {
          var t0 = Date.now();
          var r = generate(model, d.prompt, d.opts, function (done, total) {
            self.postMessage({ type: 'progress', id: d.id, part: d.part, done: done, total: total });
          });
          self.postMessage({ type: 'done', id: d.id, part: d.part, images: r.images, unknown: r.unknown, mapped: r.mapped, ms: Date.now() - t0 });
        }
      } catch (e) {
        self.postMessage({ type: 'error', id: d.id, part: d.part, message: String(e && e.message || e) });
      }
    };
  }

  return { loadModel: loadModel, tokenize: tokenize, generate: generate, allLogits: allLogits, serveWorker: serveWorker };
})();

if (typeof module !== 'undefined') module.exports = BuildAIEngine;
