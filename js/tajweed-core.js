/* مصحف الشهباء — نواة ملاحظات التجويد.
   نقلٌ أمين إلى جافاسكربت لدالة explain_error من مكتبة quran-transcript (ترخيص MIT، obadx)،
   يقارن الرسم الصوتي المسموع (من نموذج HisnLabs/tajweed-v2) بالرسم الصوتي المرجعي للآية، ثم طبقة تصوغ الملاحظات بالعربية. */
'use strict';
const TJ = (() => {
  const CORE = 'ءبتثجحخدذرزسشصضطظعغفقكلمنهوياۥۦ۾ںـٲ', RESID = 'َُِڇؙ۪ۜ', HARAKAT = 'َُِ', QLQ = 'ڇ';
  const SYMBOLS = ['ء', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
    'ا', 'ۦ', 'ۥ', 'َ', 'ُ', 'ِ', '۪', 'ـ', 'ٲ', 'ڇ', 'ں', '۾', 'ۜ', 'ؙ'];                 // the model's classes 1…42 (0 is the CTC blank)
  const isCore = c => CORE.includes(c), isRes = c => RESID.includes(c);
  // quran-transcript chunck_phonemes: a run of one core letter, then at most one residual mark
  function spans(s) {                                    // [start, end) of every group
    const g = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (isCore(c)) { let j = i; while (j < s.length && s[j] === c) j++; if (j < s.length && isRes(s[j])) j++; g.push([i, j]); i = j; }
      else i++;
    }
    return g;
  }
  const chunk = s => spans(s).map(([a, b]) => s.slice(a, b));
  // Levenshtein opcodes as python-Levenshtein / rapidfuzz give them (common ends kept equal, same back-tracking order)
  function editops(a, b) {
    let pre = 0; while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0; while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    const s1 = a.slice(pre, a.length - suf), s2 = b.slice(pre, b.length - suf), n = s1.length, m = s2.length;
    const D = Array.from({ length: n + 1 }, (_, i) => { const r = new Int32Array(m + 1); r[0] = i; return r; });
    for (let j = 0; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1));
    const ops = []; let i = n, j = m;
    while (i && j) {
      if (D[i][j] - D[i - 1][j] === 1) { i--; ops.push(['delete', i + pre, j + pre]); }        // rapidfuzz: vertical +1 → delete
      else {
        j--;
        if (j && D[i][j] - D[i - 1][j] === -1) ops.push(['insert', i + pre, j + pre]);        // vertical −1 on the row above → insert
        else { i--; if (s1[i] !== s2[j]) ops.push(['replace', i + pre, j + pre]); }
      }
    }
    while (i) { i--; ops.push(['delete', i + pre, j + pre]); }
    while (j) { j--; ops.push(['insert', i + pre, j + pre]); }
    return ops.reverse();
  }
  function opcodes(a, b) {
    const ops = editops(a, b), out = []; let sp = 0, dp = 0, k = 0;
    while (k < ops.length) {
      const [t0, s0, d0] = ops[k];
      if (sp < s0 || dp < d0) { out.push(['equal', sp, s0, dp, d0]); sp = s0; dp = d0; }
      const sb = sp, db = dp, type = t0;
      while (k < ops.length && ops[k][0] === type && ops[k][1] === sp && ops[k][2] === dp) {
        if (type === 'replace') { sp++; dp++; } else if (type === 'insert') dp++; else sp++;
        k++;
      }
      out.push([type, sb, sp, db, dp]);
    }
    if (sp < a.length || dp < b.length) out.push(['equal', sp, a.length, dp, b.length]);
    return out;
  }
  function alignGroups(R, P) {
    const out = [];
    for (const [t, a1, a2, b1, b2] of opcodes(R.map(x => x[0]), P.map(x => x[0]))) {
      if (t === 'equal' || t === 'replace') for (let r = a1, p = b1; r < a2 && p < b2; r++, p++) out.push([t, r, p]);
      else if (t === 'insert') for (let p = b1; p < b2; p++) out.push(['insert', a1, p]);
      else for (let r = a1; r < a2; r++) out.push(['delete', r, b1]);
    }
    return out;
  }
  // the rules quran-transcript attaches to the reference (data/ph-hafs.json «rules»)
  const MADD_CH = { 'ا': 'alif', 'ۥ': 'waw', 'ۦ': 'yaa' }, LEEN_CH = { 'و': 'waw', 'ي': 'yaa' };
  function ruleOps(r) {
    if (r.k === 'q') return { rel: s => (s && s[s.length - 1] === QLQ ? r : null), match: (a, b) => a === b, count: () => 0 };
    if (r.k === 'i') return { rel: () => null, match: (a, b) => a === b, count: () => 0 };
    if (r.k === 'l') return { rel: s => (s && LEEN_CH[s[0]] ? r : null), match: () => true, count: (a, b) => (b[b.length - 1] !== b[0] ? cnt(b.slice(0, -1), a[0]) : cnt(b, a[0])) + 1 };
    return { rel: s => (s && MADD_CH[s[0]] ? r : null), match: () => true, count: (a, b) => (b[b.length - 1] !== b[0] ? cnt(b.slice(0, -1), a[0]) : cnt(b, a[0])) };
  }
  const cnt = (s, c) => { let n = 0; for (const x of s) if (x === c) n++; return n; };
  // explain_error(uthmani, ref_ph, pred_ph, mappings) — ref: { ph, u: ph index → uthmani index, rules: uthmani index → [rule] }
  function explain(ref, pred) {
    const R = chunk(ref.ph), P = chunk(pred);
    const RR = R.map(() => []); let st = 0;
    R.forEach((g, gi) => { const used = new Set(); for (let p = st; p < st + g.length; p++) { const u = ref.u[p]; if (!used.has(u)) { used.add(u); if (ref.rules[u]) RR[gi].push(...ref.rules[u]); } } st += g.length; });
    const errs = []; let rs = 0, ps = 0, re = 0, pe = 0;
    for (const [t, ri, pi] of alignGroups(R, P)) {
      const rp = ri < R.length ? R[ri] : '', pp = pi < P.length ? P[pi] : '';
      pe = ps + pp.length;
      let ph;
      if (t !== 'insert') { re = rs + rp.length; ph = [rs, re]; } else ph = [rs, rs];
      const E = o => errs.push(Object.assign({ ph, exp: rp, pred: pp, el: null, pl: null, rules: [], miss: [], repl: [], pi }, o));
      if (t === 'insert') E({ type: 'normal', sp: 'insert', exp: '' });
      else if (t === 'replace') {
        for (const r of RR[ri]) {
          const pr = ruleOps(r).rel(pp);
          if (pr) E({ type: 'tajweed', sp: 'replace', el: r.ct === 'count' ? r.g : null, pl: r.ct === 'count' ? ruleOps(pr).count(pp, pp) : null, rules: [r], repl: [pr] });
          else E({ type: 'tajweed', sp: 'replace', rules: [r] });
        }
        if (!RR[ri].length) E({ type: 'normal', sp: 'replace' });
      } else if (t === 'delete') {
        E({ type: ref.rules[ref.u[rs]] ? 'tajweed' : 'normal', sp: 'delete', pred: '' });
      } else if (rp !== pp) {
        if (RR[ri].length) {
          for (const r of RR[ri]) {
            const o = ruleOps(r);
            if (r.ct === 'count') E({ type: 'tajweed', sp: 'replace', el: r.g, pl: o.count(rp, pp), rules: [r] });
            else E({ type: 'tajweed', sp: 'replace', rules: [r], miss: o.match(rp, pp) ? [] : [r] });
            if (HARAKAT.includes(rp[rp.length - 1]) && pp[pp.length - 1] !== rp[rp.length - 1]) E(tashkeel(rp, pp));
          }
        } else if (HARAKAT.includes(rp[rp.length - 1])) E(tashkeel(rp, pp));
        else if (RESID.includes(rp[rp.length - 1])) { /* imala, sakt… not explained yet (as upstream) */ }
        else E({ type: HARAKAT.includes(pp[pp.length - 1]) ? 'tashkeel' : 'normal', sp: 'insert' });
      }
      ps = pe; rs = re;
    }
    return errs;
  }
  const tashkeel = (rp, pp) => ({ type: 'tashkeel', sp: pp.length > rp.length ? 'insert' : pp.length < rp.length ? 'delete' : 'replace' });

  /* ---------- reference for a run of mushaf words ---------- */
  const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function ayahRef(entry, table) {                       // one ayah → { ph, u, rules, words: [[phStart, phEnd]…] }
    const [ph, lens, starts, rl] = entry;
    const L = typeof lens === 'string' ? [...lens].map(c => B36.indexOf(c)) : lens;
    const u = new Int32Array(ph.length), pos = new Int32Array(L.length + 1);
    let p = 0; for (let i = 0; i < L.length; i++) { pos[i] = p; for (let k = 0; k < L[i]; k++) u[p++] = i; } pos[L.length] = p;
    const rules = {}; for (const [i, c] of rl) (rules[i] ||= []).push(table[c]);
    const words = starts.map((s, w) => { const e = w + 1 < starts.length ? starts[w + 1] - 1 : L.length; return [pos[s], pos[e]]; });
    return { ph, u, rules, words };
  }
  // the reference of words w0..w1 of one ayah (phonetic indices re-based to the slice)
  function slice(ar, w0, w1) {
    const a = ar.words[w0][0], b = ar.words[w1][1], u0 = ar.u[a] || 0;
    const u = Int32Array.from(ar.u.subarray(a, b), x => x - u0), rules = {};
    for (const k in ar.rules) if (+k >= u0 && +k - u0 <= (u.length ? u[u.length - 1] : 0)) rules[+k - u0] = ar.rules[k];
    return { ph: ar.ph.slice(a, b), u, rules, words: ar.words.slice(w0, w1 + 1).map(([x, y]) => [x - a, y - a]) };
  }
  function join(parts) {                                  // several ayah slices one after another
    let ph = '', U = [], rules = {}, words = [], uOff = 0;
    for (const r of parts) {
      const o = ph.length; ph += r.ph;
      for (const x of r.u) U.push(x + uOff);
      for (const k in r.rules) rules[+k + uOff] = r.rules[k];
      for (const [x, y] of r.words) words.push([x + o, y + o]);
      uOff += (r.u.length ? r.u[r.u.length - 1] + 1 : 0) + 1;
    }
    return { ph, u: Int32Array.from(U), rules, words };
  }

  /* ---------- CTC best path, as HisnLabs inference.py ---------- */
  function decode(lp, frames, classes, step, lead) {
    let prev = 0, ph = '', probs = [], times = [], last = -1;
    for (let t = 0; t < frames; t++) {
      let bi = 0, bv = -Infinity; const o = t * classes;
      for (let c = 0; c < classes; c++) { const v = lp[o + c]; if (v > bv) { bv = v; bi = c; } }
      if (bi !== prev && bi !== 0) { ph += SYMBOLS[bi - 1]; probs.push(Math.exp(bv)); times.push((t + 0.5) * step - lead); last = t; }
      prev = bi;
    }
    times.push(last >= 0 ? (last + 1) * step - lead : 0);
    return { ph, probs, times };
  }

  /* ---------- the remarks a reader sees, in Arabic ---------- */
  // what quran-transcript calls «golden» is one accepted length; readers of Hafs may choose among these
  const OKLEN = { 'المد الطبيعي': [2, 2], 'المد المنفصل': [4, 5], 'المد المتصل': [4, 5], 'المد المتصل وقفا': [4, 6], 'المد اللازم': [6, 6], 'المد العارض للسكون': [2, 6], 'مد اللين': [2, 6] };
  const GHN = 'نمں۾';
  const gen = n => (n === 1 ? 'حركة واحدة' : n === 2 ? 'حركتين' : n <= 10 ? `${n} حركات` : `${n} حركة`);
  const nom = (lo, hi) => (lo !== hi ? (hi - lo === 1 ? `${lo} أو ${hi} حركات` : `من ${lo} إلى ${hi} حركات`) : lo === 1 ? 'حركة واحدة' : lo === 2 ? 'حركتان' : `${lo} حركات`);
  const way = ar => (ar === 'المد المنفصل' ? ' من طريق الشاطبية' : '');
  function remarks(errs, ref, probAt, opts = {}) {
    const out = [], minP = opts.minProb ?? 0.3, minJ = opts.minProbJali ?? 0.7;
    const wordOf = p => { for (let w = 0; w < ref.words.length; w++) if (p >= ref.words[w][0] && p < ref.words[w][1]) return w; return ref.words.length - 1; };
    for (const e of errs) {
      const w = wordOf(e.ph[0]), conf = e.pred ? probAt(e) : 1;
      if (e.type === 'tajweed' && e.rules.length) {
        const r = e.rules[0];
        if (r.k === 'q') { if ((e.miss.length || e.sp === 'replace') && conf >= minP && !e.pred.endsWith(QLQ)) out.push({ w, kind: 'qalqala', text: 'لم تظهر القلقلة', conf }); continue; }
        if (r.k === 'm' || r.k === 'l') {
          const [lo, hi] = OKLEN[r.ar] || [r.g, r.g], pl = e.pl;
          if (pl == null) continue;
          if (pl === 0 && conf >= minJ) out.push({ w, kind: 'madd', text: `سقط ${r.ar}`, conf });
          else if (pl < lo - (lo > 2 ? 1 : 0) && conf >= minP) out.push({ w, kind: 'madd', text: `قصّرت ${r.ar}: نحو ${gen(pl)}، والمطلوب ${nom(lo, hi)}${way(r.ar)}`, conf });
          else if (pl > hi + 1 && conf >= minP) out.push({ w, kind: 'madd', text: `زدت في ${r.ar}: نحو ${gen(pl)}، والمطلوب ${nom(lo, hi)}`, conf });
          continue;
        }
        continue;
      }
      if (e.sp === 'delete' && e.exp && GHN.includes(e.exp[0]) && e.exp.length > 2) { if (conf >= minJ) out.push({ w, kind: 'ghonna', text: 'سقطت الغنة', conf }); continue; }
      if (e.exp && e.pred && GHN.includes(e.exp[0]) && e.exp[0] === e.pred[0] && cnt(e.exp, e.exp[0]) >= 3 && cnt(e.pred, e.exp[0]) < cnt(e.exp, e.exp[0]) - 1) {
        if (conf >= minP) out.push({ w, kind: 'ghonna', text: 'قصّرت الغنة', conf }); continue;
      }
      if (e.type === 'tashkeel' && e.exp && e.pred && conf >= minJ) {
        const h = x => ({ 'َ': 'الفتحة', 'ُ': 'الضمة', 'ِ': 'الكسرة' }[x[x.length - 1]]);
        if (h(e.exp) && h(e.pred)) out.push({ w, kind: 'haraka', text: `قرأت ${h(e.pred)} مكان ${h(e.exp)}`, conf });
        continue;
      }
      if (e.type === 'normal' && e.sp === 'replace' && e.exp && e.pred && e.exp[0] !== e.pred[0] && conf >= minJ) {
        out.push({ w, kind: 'letter', text: `نطقتَ «${e.pred[0]}» مكان «${e.exp[0]}»`, conf });
      }
    }
    return out;
  }
  /* ---------- Whisper log-mel, as faster-whisper FeatureExtractor(feature_size=80)(audio, padding=0) ---------- */
  const NFFT = 400, HOP = 160, NM = 80, NB = NFFT / 2 + 1;
  let MELF = null, WIN = null;
  function melFilters() {                                // get_mel_filters(16000, 400, 80): Slaney scale and norm
    const sr = 16000, f = new Float64Array(NB); for (let i = 0; i < NB; i++) f[i] = i * sr / NFFT;
    const maxMel = 45.245640471924965, mels = new Float64Array(NM + 2); for (let i = 0; i < NM + 2; i++) mels[i] = maxMel * i / (NM + 1);
    const fsp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fsp, logstep = Math.log(6.4) / 27;
    const fr = mels.map(m => (m >= minLogMel ? minLogHz * Math.exp(logstep * (m - minLogMel)) : fsp * m));
    const W = new Float32Array(NM * NB);
    for (let m = 0; m < NM; m++) {
      const en = 2 / (fr[m + 2] - fr[m]);
      for (let k = 0; k < NB; k++) {
        const lo = -(fr[m] - f[k]) / (fr[m + 1] - fr[m]), hi = (fr[m + 2] - f[k]) / (fr[m + 2] - fr[m + 1]);
        W[m * NB + k] = Math.max(0, Math.min(lo, hi)) * en;
      }
    }
    return W;
  }
  // a mixed-radix FFT for 400 = 2·2·2·2·5·5 points (twiddles computed once)
  const TWC = new Float64Array(NFFT), TWS = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) { TWC[i] = Math.cos(-2 * Math.PI * i / NFFT); TWS[i] = Math.sin(-2 * Math.PI * i / NFFT); }
  function fft(re, im, n, stride, off, oRe, oIm, oOff, tmpR, tmpI) {
    if (n === 1) { oRe[oOff] = re[off]; oIm[oOff] = im[off]; return; }
    const p = n % 2 === 0 ? 2 : 5, m = n / p, step = NFFT / n;
    for (let r = 0; r < p; r++) fft(re, im, m, stride * p, off + r * stride, oRe, oIm, oOff + r * m, tmpR, tmpI);
    for (let k = 0; k < n; k++) {
      let sr = 0, si = 0;
      for (let r = 0; r < p; r++) {
        const t = (r * k * step) % NFFT, c = TWC[t], s = TWS[t], x = oRe[oOff + r * m + (k % m)], y = oIm[oOff + r * m + (k % m)];
        sr += x * c - y * s; si += x * s + y * c;
      }
      tmpR[k] = sr; tmpI[k] = si;
    }
    for (let k = 0; k < n; k++) { oRe[oOff + k] = tmpR[k]; oIm[oOff + k] = tmpI[k]; }
  }
  function mel(x) {
    if (!MELF) { MELF = melFilters(); WIN = new Float64Array(NFFT); for (let i = 0; i < NFFT; i++) WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / NFFT); }
    const n = x.length, P = new Float32Array(n + NFFT);
    for (let i = 0; i < 200; i++) P[i] = x[Math.min(n - 1, 200 - i)];           // numpy «reflect» padding
    P.set(x, 200);
    for (let i = 0; i < 200; i++) P[n + 200 + i] = x[Math.max(0, n - 2 - i)];
    const F = Math.floor(n / HOP), out = new Float32Array(NM * F);              // the last STFT frame is dropped, as upstream
    const fr = new Float64Array(NFFT), fi = new Float64Array(NFFT), oR = new Float64Array(NFFT), oI = new Float64Array(NFFT);
    const tR = new Float64Array(NFFT), tI = new Float64Array(NFFT), pw = new Float64Array(NB);
    let top = -Infinity;
    for (let t = 0; t < F; t++) {
      for (let i = 0; i < NFFT; i++) { fr[i] = P[t * HOP + i] * WIN[i]; fi[i] = 0; }
      fft(fr, fi, NFFT, 1, 0, oR, oI, 0, tR, tI);
      for (let k = 0; k < NB; k++) pw[k] = oR[k] * oR[k] + oI[k] * oI[k];
      for (let m = 0; m < NM; m++) {
        let s = 0; const o = m * NB; for (let k = 0; k < NB; k++) s += MELF[o + k] * pw[k];
        const v = Math.log10(Math.max(s, 1e-10)); out[m * F + t] = v; if (v > top) top = v;
      }
    }
    const fl = top - 8; for (let i = 0; i < out.length; i++) out[i] = (Math.max(out[i], fl) + 4) / 4;
    return { data: out, frames: F };
  }
  function crop(M) {                                    // even frames, at most 3000, as the model expects
    const T = Math.min(3000, Math.floor(M.frames / 2) * 2), d = new Float32Array(NM * T);
    for (let m = 0; m < NM; m++) d.set(M.data.subarray(m * M.frames, m * M.frames + T), m * T);
    return { data: d, frames: T };
  }
  const LEAD = 6400;                                     // 0.4 s of silence on each side, as the model was trained
  function prepare(pcm) {
    const x = new Float32Array(pcm.length + 2 * LEAD); x.set(pcm, LEAD);
    const M = crop(mel(x));
    return { data: M.data, frames: M.frames, sec: x.length / 16000 };
  }
  // the remarks for one recited stretch: ref from slice/join, out = decode(...) of the model; skip = word indices not to judge
  function check(ref, out, opts = {}) {
    const errs = explain(ref, out.ph), sp = spans(out.ph);
    const probAt = e => { const s = sp[e.pi]; if (!s) return 0; let m = 1; for (let i = s[0]; i < s[1]; i++) m = Math.min(m, out.probs[i] ?? 0); return m; };
    const seen = new Set();
    return remarks(errs, ref, probAt, opts).filter(r => {
      if (opts.skip && opts.skip.has(r.w)) return false;
      const key = r.w + '|' + r.text; if (seen.has(key)) return false; seen.add(key); return true;
    });
  }
  // a phoneme error rate, for the self-test
  function per(a, b) {
    if (!a.length) return b.length ? 1 : 0;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length] / a.length;
  }
  /* ---------- the silent engine: following the reader by what he pronounced ---------- */
  // the skeleton of a phonetic string: letters and long vowels, harakat and marks dropped, a held sound counted once
  const SKM = { 'ۦ': 'ي', 'ۥ': 'و', 'ں': 'ن', '۾': 'م', 'ٲ': 'ء', 'ـ': 'ا' }, SKDROP = 'َُِڇؙ۪ۜ';
  function skel(ph, times) {
    let s = '', last = ''; const t = [];
    for (let i = 0; i < ph.length; i++) {
      const c = ph[i]; if (SKDROP.includes(c)) continue;
      const k = SKM[c] || c;
      if (k === last) { if (times) t[t.length - 1][1] = times[i]; continue; }
      s += k; last = k; if (times) t.push([times[i], times[i]]);
    }
    return times ? { s, t } : s;
  }
  // where each expected word lies in what was heard: H = heard skeleton, W = the words' skeletons,
  // the first ctx words were already counted (the reader may start anywhere inside them); a whole word may be skipped
  const SKIPW = 2.2;
  function follow(H, W, ctx = 0) {
    const E = W.join(''), m = H.length, n = E.length, wOf = new Int32Array(n), cl = [], st = new Int32Array(n + 1).fill(-1);
    let o = 0; W.forEach((w, k) => { st[o + w.length] = o; for (let i = 0; i < w.length; i++) wOf[o + i] = k; o += w.length; cl.push(o); });
    const ctxLen = ctx ? cl[ctx - 1] : 0, W1 = n + 1;
    const D = new Float32Array((m + 1) * W1), B = new Uint8Array((m + 1) * W1);
    for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) {
      if (!i && !j) continue;
      const x = i * W1 + j; let v = Infinity, bt = 0;
      if (i && j) { v = D[x - W1 - 1] + (H[i - 1] === E[j - 1] ? 0 : 1); bt = 0; }
      if (i) { const u = D[x - W1] + (j ? 1 : 0.6); if (u < v) { v = u; bt = 1; } }   // an extra sound (cheap before the first word)
      if (j) { const u = !i && j <= ctxLen ? 0 : D[x - 1] + 1; if (u < v) { v = u; bt = 2; } }
      if (j && st[j] >= 0 && st[j] < j) { const u = D[i * W1 + st[j]] + SKIPW; if (u < v) { v = u; bt = 3; } }   // a skipped word costs the same, long or short
      D[x] = v; B[x] = bt;
    }
    let jb = ctxLen; for (let j = ctxLen; j <= n; j++) if (D[m * W1 + j] <= D[m * W1 + jb]) jb = j;
    const R = W.map(w => ({ n: w.length, m: 0, a: -1, b: -1, skip: false }));
    const put = (k, i) => { const r = R[k]; if (r.a < 0 || i < r.a) r.a = i; if (i + 1 > r.b) r.b = i + 1; };
    let i = m, j = jb, lastK = -1;
    while (i > 0 || j > 0) {
      const t = B[i * W1 + j];
      if (t === 3) { R[wOf[j - 1]].skip = true; j = st[j]; }
      else if (i > 0 && j > 0 && t === 0) { const k = wOf[j - 1]; put(k, i - 1); if (H[i - 1] === E[j - 1]) R[k].m++; lastK = k; i--; j--; }
      else if (i > 0 && (t === 1 || j === 0)) { if (lastK >= 0) put(lastK, i - 1); else if (j > 0) put(wOf[j - 1], i - 1); i--; }   // an extra sound joins the word beside it
      else j--;
    }
    for (const r of R) { r.h = r.a < 0 ? 0 : r.b - r.a; r.sim = r.h ? r.m / Math.max(r.n, r.h) : 0; }
    return { R, end: jb ? wOf[jb - 1] : -1, cost: D[m * W1 + jb] };
  }
  // the verdict on one word: short words may differ by one sound, longer ones by up to 40%
  function judge(r) {
    if (!r.h) return r.n <= 2 ? 'soft' : 'miss';
    const ed = Math.max(r.n, r.h) - r.m;
    if (r.n <= 3 ? ed <= 1 : r.sim >= 0.6) return 'ok';
    if (r.n <= 3 ? ed <= 2 : r.sim >= 0.34) return 'soft';
    return 'bad';
  }
  // one look at what was heard: which words are finished and can be counted now.
  // out = decode() of the audio that starts at o.t0 (seconds into the phrase); o: { pos, ctxFrom, count, skelAt, K, tEnd, final, safe }
  function step(out, o) {
    const t0 = o.t0 || 0, H = skel(out.ph, out.times.map(t => t + t0)), W = [];
    for (let p = o.ctxFrom; p < Math.min(o.count, o.pos + (o.K || 14)); p++) W.push(o.skelAt(p));
    const ctx = o.pos - o.ctxFrom, safe = o.safe ?? 0.45, F = follow(H.s, W, ctx), R = F.R, words = [];
    const tEnd = r => H.t[r.b - 1][1], heard = r => !!r.h;
    let last = -1; for (let q = ctx; q < W.length; q++) if (heard(R[q])) last = q;
    let k = ctx, tCommit = null;
    for (; k < W.length; k++) {
      const r = R[k];
      if (o.final) { if (k > last) break; }
      else if (!heard(r)) {                              // nothing heard for this word: skipped only if a later one is surely done
        let nx = k + 1; while (nx < W.length && !heard(R[nx])) nx++;
        if (nx >= W.length || R[nx].sim < 0.6 || tEnd(R[nx]) > o.tEnd - safe) break;
      } else {
        if (tEnd(r) > o.tEnd - safe) break;            // still being said, or too near the edge of what was heard
        let nx = k + 1; while (nx < W.length && !heard(R[nx])) nx++;
        if (nx >= W.length) break;                       // the next word has not begun: this one may not be finished
      }
      words.push({ p: o.ctxFrom + k, kind: judge(r), heard: r.h ? H.s.slice(r.a, r.b) : '', sim: r.sim });
      if (r.h) tCommit = tEnd(r);
    }
    return { words, upto: o.ctxFrom + k, tCommit, F, H, ctxUsed: R.slice(0, ctx).some(heard) };
  }
  // where in the mushaf is this? five sounds in a row vote for a place
  function locIndex(count, skelAt) {
    const C = [], at = new Int32Array(count + 1); let o = 0;
    for (let p = 0; p < count; p++) { const s = skelAt(p); at[p] = o; C.push(s); o += s.length; } at[count] = o;
    const str = C.join(''), idx = new Map();
    for (let i = 0; i + 5 <= str.length; i++) { const g = str.substr(i, 5); let a = idx.get(g); if (!a) idx.set(g, (a = [])); if (a.length < 64) a.push(i); }
    const wordAt = off => { let lo = 0, hi = count - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (at[mid] <= off) lo = mid; else hi = mid - 1; } return lo; };
    return { idx, at, wordAt };
  }
  function locate(Hs, L, range = null, near = 0) {
    if (Hs.length < 10) return null;
    const votes = new Map(), lo = range ? L.at[range[0]] : 0, hi = range ? L.at[Math.min(range[1], L.at.length - 1)] : Infinity;
    for (let i = 0; i + 5 <= Hs.length; i++) {
      const a = L.idx.get(Hs.substr(i, 5)); if (!a || a.length >= 64) continue;
      for (const off of a) { if (off < lo || off > hi) continue; const d = Math.round((off - i) / 3); votes.set(d, (votes.get(d) || 0) + 1); }
    }
    let best = null, bv = 0;
    for (const [d, v] of votes) { const tot = v + (votes.get(d - 1) || 0) + (votes.get(d + 1) || 0); if (tot > bv || (tot === bv && best != null && Math.abs(d * 3 - L.at[near]) < Math.abs(best * 3 - L.at[near]))) { bv = tot; best = d; } }
    const need = Math.max(3, Math.floor((Hs.length - 4) * 0.25));
    return bv >= need ? { pos: L.wordAt(Math.max(0, best * 3)), votes: bv, need } : null;
  }
  return { SYMBOLS, spans, chunk, editops, opcodes, explain, ayahRef, slice, join, decode, remarks, OKLEN, mel, crop, prepare, check, per, LEAD, skel, follow, judge, step, locIndex, locate };
})();
if (typeof self !== 'undefined') self.TJ = TJ;          // the tajweed worker imports this file as a module
