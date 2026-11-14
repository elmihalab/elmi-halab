/* مصحف الشهباء — التسميع (٠٫٥) وملاحظات التجويد (٠٫٦).
   محرّكان: «سريع» بخدمة الكلام في المتصفح، و«دقيق» بنموذج ترتيل المدرّب على القرآن يعمل في الجهاز نفسه،
   ومعه نموذج ثانٍ (HisnLabs/tajweed-v2) يسمع الصوت نفسه فيكتب ما نُطق بالرسم الصوتي ليُقارن بالرسم الصوتي المرجعي للآية.
   الكلمات المطابَقة من بيانات المصحف (QUL)، والرسم الصوتي المرجعي من quran-transcript (نص Tanzil)، ولا يُكتب هنا نص قرآني. */
'use strict';

const TSM_MODEL = { id: 'iqbalaesthetic/Basira', rev: '314f3d74186e1904b02d653868f6dd6870d5d744', size: 102, base: 'tarteel-ai/whisper-base-ar-quran' };
const TSO = Object.assign({ engine: 'auto', mode: 'hide', stopSurah: true, gpu: false, tj: true }, store.get('tsm', {}));
if (TSO.v !== 8) { TSO.engine = 'auto'; TSO.v = 8; store.set('tsm', TSO); }       // 0.8: the silent engine is chosen for phones
const saveTSO = () => store.set('tsm', TSO);
const SRC = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const hasWeb = () => !!SRC();
const hasAI = () => typeof WebAssembly === 'object' && 'AudioWorkletNode' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const isPhone = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// «تلقائي»: on phones the silent engine (Google's service rings with each start there); on computers Google's, else the silent one
const autoEngine = () => (isPhone() ? (hasAI() ? 'ph' : hasWeb() ? 'web' : null) : hasWeb() ? 'web' : hasAI() ? 'ph' : null);

/* ---------- the words being recited: every mushaf word except the ayah-number marks ---------- */
let EXPW = null, EXPP = null, TIDX = null;
function expBuild() {
  if (EXPW) return;
  const n = D.glyphs.length, num = new Uint8Array(n + 2);
  for (let k = 0; k < D.A; k++) num[ay(k).l] = 1;
  const a = []; for (let i = 1; i <= n; i++) if (!num[i]) a.push(i);
  EXPW = Int32Array.from(a); EXPP = new Int32Array(n + 2).fill(-1); EXPW.forEach((id, p) => (EXPP[id] = p));
}
const FCACHE = new Map();
const formsAt = p => {
  let f = FCACHE.get(p);
  if (!f) { const id = EXPW[p]; f = [...new Set([TZ.norm(D.iml[id - 1]), TZ.norm(D.words[id - 1])])].filter(Boolean); FCACHE.set(p, f); }
  return f;
};
const tIndex = () => (TIDX ||= TZ.buildIndex(EXPW.length, p => TZ.norm(D.iml[EXPW[p] - 1])));
const lastPosOfSurah = s => { const k = findAyah(s, D.surahs[s - 1].ayat); return EXPP[ay(k).l - 1]; };
const ayOfPos = p => D.wAyah[EXPW[p]];

const TS = { on: false, paused: false, sess: null, hold: null, engine: 'web', hideFrom: null, t0: 0, rec: null, lock: null,
  worker: null, ready: false, busy: false, queue: [], jobId: 0, mic: null, perf: [], device: '', tick: 0, lastP: -1,
  probe: new Map(), cur: null, tjOn: false, tjMsg: '', gen: 0, pre: null, dog: 0 };

/* ---------- painting the words ---------- */
const KC = { ok: 'tk-ok', bad: 'tk-bad', miss: 'tk-miss', soft: 'tk-soft', hint: 'tk-hint', fix: 'tk-fix' };
const ALLK = ['tk-h', 'tk-ok', 'tk-bad', 'tk-miss', 'tk-soft', 'tk-hint', 'tk-fix', 'tk-now', 'tk-tmp', 'tk-tj'];
function paintMark(p, kind) {
  const tj = kind === 'ok' && TS.sess && TS.sess.tj && TS.sess.tj.has(p);
  $$(`.w[data-i="${EXPW[p]}"]`).forEach(w => { w.classList.remove(...ALLK); w.classList.add(KC[kind]); if (tj) w.classList.add('tk-tj'); });
}
function paintNow() {
  $$('.w.tk-now').forEach(w => w.classList.remove('tk-now'));
  const s = TS.sess; if (!TS.on || !s || s.pos == null || s.pos >= EXPW.length) return;
  $$(`.w[data-i="${EXPW[s.pos]}"]`).forEach(w => w.classList.add('tk-now'));
}
function tsMark(root) {                               // app.js calls this whenever a page or a reading chunk is drawn
  const s = TS.sess || TS.hold; if (!s || !EXPP) return;
  for (const w of $$('.w', root)) {
    if (w.closest('.panel, .tsheet, .wcard')) continue;
    const p = EXPP[+w.dataset.i]; if (p < 0) continue;
    const m = s.marks.get(p);
    if (m) { w.classList.add(KC[m.kind]); if (s.tj && s.tj.has(p)) w.classList.add('tk-tj'); }
    else if (TS.on && TS.hideFrom != null && p >= TS.hideFrom) w.classList.add('tk-h');
  }
  paintNow();
}
function clearMarks() { $$('.w').forEach(w => w.classList.remove(...ALLK)); }
function peek(text) {                                 // words still being heard: shown faintly, not counted
  $$('.w.tk-tmp').forEach(w => w.classList.remove('tk-tmp'));
  const s = TS.sess; if (!s || s.pos == null || !text.trim()) return;
  const H = TZ.words(text); if (!H.length) return;
  const E = []; for (let p = s.pos; p < Math.min(EXPW.length, s.pos + H.length + 6); p++) E.push(formsAt(p));
  const r = TZ.align(H, E);
  for (const o of r.ops) if (o.t === 's' && o.s >= TZ.OK) $$(`.w[data-i="${EXPW[s.pos + o.e]}"]`).forEach(w => w.classList.add('tk-tmp'));
}

/* ---------- following the reader through the pages ---------- */
function tsFollow() {
  const s = TS.sess; if (!s || s.pos == null) return;
  const p = Math.min(s.pos, EXPW.length - 1), id = EXPW[p], pg = D.wPage[id];
  if (S.mode === 'page') { if (Math.floor((pg - 1) / PM.per) !== PM.idx) pmGo(pg, Math.abs(pg - S.page) <= 2); return; }
  if (S.mode === 'read') { const a = ay(D.wAyah[id]); if (a.s !== RM.s) { rmRender(a.s, D.wAyah[id]); return; } }
  const box = S.mode === 'read' ? RM.el : SM.el, w = $(`.w[data-i="${id}"]`, box);
  if (w) { const r = w.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top + 30 || r.bottom > b.bottom - 30) w.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  else if (S.mode === 'scroll') smGo(pg);
}

/* ---------- what was heard ---------- */
function heard(text) {
  const s = TS.sess; if (!TS.on || !s || TS.paused) return;
  const r = s.feed(text);
  peek('');
  if (r.status === 'waiting') setStatus('أبحث عن موضع قراءتك… تابع القراءة');
  else if (r.status === 'unclear') setStatus('لم أتبيّن ما قرأت، تابع أو أعد الجملة');
  else if (r.status === 'ok') setStatus(TS.engine === 'ai' ? 'أستمع… (تظهر الكلمات بعد كل وقفة)' : 'أستمع…');
  paintCounts(); paintNow(); tsFollow();
  if (s.pos != null && s.end !== Infinity && s.pos > s.end) { toast('تمّت السورة، بارك الله فيك', 3000); tsStop(true); }
  else if (s.pos != null && s.pos >= EXPW.length) tsStop(true);
}
function setStatus(t) { $('#tsTitle').textContent = t; }
function paintCounts() {
  const c = (TS.sess || TS.hold)?.stats() || { ok: 0, bad: 0, miss: 0, soft: 0, fix: 0, hint: 0 };
  $('#tsOk').textContent = AR(c.ok + c.fix); $('#tsBad').textContent = AR(c.bad + c.miss);
  $('#tsSoft').textContent = AR(c.soft + c.hint); $('#tsSoft').hidden = !(c.soft + c.hint);
  const n = tjCount(TS.sess || TS.hold); $('#tsTjN').textContent = AR(n); $('#tsTjN').hidden = !n;
}
function paintSub() {
  const s = TS.sess, eng = TS.engine === 'ph' ? (TS.tjOn ? 'الصوتي مع التجويد' : 'المحرّك الصوتي') : TS.engine !== 'ai' ? 'المحرّك السريع' : TS.tjOn ? 'الدقيق مع التجويد' : TS.tjMsg ? 'الدقيق · ' + TS.tjMsg : 'المحرّك الدقيق';
  let where = 'من أي مكان';
  if (s && s.pos != null && s.pos < EXPW.length) { const a = ay(ayOfPos(s.pos)); where = `سورة ${sName(a.s)} · الآية ${AR(a.a)}`; }
  const sec = TS.t0 ? Math.round((Date.now() - TS.t0) / 1000) : 0;
  $('#tsSub').textContent = `${where} — ${eng} · ${AR(Math.floor(sec / 60))}:${AR(String(sec % 60).padStart(2, '0'))}`;
  if (TS.on && TS.engine === 'web' && !TS.paused && TS.speechAt && !TS.lastResult && Date.now() - TS.speechAt > 15000 && !TS.warned) {
    TS.warned = 1; setStatus('أسمع صوتًا ولا تصلني كلمات من خدمة جوجل — قد تكون محجوبة أو بطيئة؛ جرّب المحرّك الدقيق');
  }
}

/* ---------- engine 1: the browser's speech service ---------- */
function webStart() {
  const R = SRC(); if (!R) throw new Error('nosr');
  const r = new R(); r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onstart = () => { TS.webOn = true; };
  r.onaudiostart = () => { TS.webAudio = true; if (TS.on && !TS.paused && !TS.lastResult) setStatus('أستمع… ابدأ القراءة'); };
  r.onspeechstart = () => { TS.speechAt ||= Date.now(); };
  r.onresult = e => {
    TS.lastResult = Date.now();
    let fin = '', tmp = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += ' ' + x[0].transcript; else tmp += ' ' + x[0].transcript; }
    if (fin.trim()) heard(fin); if (tmp.trim()) peek(tmp);
    $('#tsMic').classList.add('hear'); clearTimeout(TS.hearT); TS.hearT = setTimeout(() => $('#tsMic').classList.remove('hear'), 400);
  };
  r.onerror = e => {
    const m = WEB_ERR[e.error]; if (!m || !TS.on) return;
    if (e.error === 'network' && TS.lastResult) {                // it worked a moment ago: try again a few times before giving up
      TS.netErr = (TS.netErr || []).filter(t => Date.now() - t < 60000); TS.netErr.push(Date.now());
      if (TS.netErr.length <= 3) { setStatus('انقطعت خدمة جوجل لحظة… أعيد الاتصال'); return; }
    }
    tsFail(typeof m === 'function' ? m() : m);
  };
  r.onend = () => { if (TS.on && TS.engine === 'web' && !TS.paused) { try { r.start(); } catch (x) { setTimeout(() => { try { TS.on && r.start(); } catch (y) {} }, 300); } } };
  r.start(); TS.rec = r;
}
function webStop() { const r = TS.rec; TS.rec = null; if (r) { r.onend = null; r.onerror = null; try { r.abort(); } catch (e) {} } }
const WEB_ERR = {
  'not-allowed': () => micHelp('لم يُسمح لخدمة الكلام باستعمال الميكروفون.'),
  'service-not-allowed': 'خدمة الكلام غير مسموحة في هذا المتصفح، أو غير موجودة في هذا الجهاز (تحتاج خدمات جوجل). استعمل المحرّك الدقيق.',
  'network': 'لم تصل خدمة جوجل للكلام: قد يكون الإنترنت ضعيفًا، أو تكون الخدمة محجوبة في بلدك. استعمل المحرّك الدقيق، فهو يعمل في جهازك نفسه.',
  'language-not-supported': 'هذا المتصفح لا يدعم التعرّف على العربية. استعمل المحرّك الدقيق.',
  'audio-capture': 'لم تستطع خدمة الكلام فتح الميكروفون؛ قد يكون مشغولًا بتطبيق آخر (اتصال أو تسجيل). أغلقه ثم أعد المحاولة.',
};
function webTip() {                                   // Google's service sounds a tone at each start on many Android phones
  if (!/android/i.test(navigator.userAgent) || store.get('tipTone', 0) >= 2) return;
  store.set('tipTone', store.get('tipTone', 0) + 1);
  setTimeout(() => toast('إن سمعتَ نغمات مع كل وقفة: فهي من خدمة جوجل نفسها. اخفض «صوت الإشعارات» من أزرار الصوت في جوالك، أو اختر المحرّك «الصوتي» الصامت.', 7000), 1500);
}
function webWatch() {                                 // a service that never starts, or never hears, is said so plainly
  TS.webOn = TS.webAudio = false; TS.speechAt = 0; TS.lastResult = 0; TS.warned = 0;
  clearTimeout(TS.dog);
  TS.dog = setTimeout(() => {
    if (!TS.on || TS.engine !== 'web' || TS.paused) return;
    if (!TS.webOn) tsFail('لم تبدأ خدمة الكلام في هذا المتصفح. استعمل المحرّك الدقيق، أو اضغط «افحص الميكروفون والتسميع» لمعرفة السبب.');
    else if (!TS.webAudio && !TS.lastResult) setStatus('لم يصلني صوت بعد… تكلّم، وإن بقي هكذا فاضغط ■ ثم «افحص الميكروفون والتسميع»');
  }, 8000);
}

/* ---------- the microphone, asked for in the tap itself so the browser shows its question at once ---------- */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function micHelp(head) {
  const how = isIOS() ? 'في الآيفون: الإعدادات ← سفاري ← الميكروفون ← «سماح»، أو اضغط «ᴀA» بجانب العنوان ← إعدادات الموقع ← الميكروفون.'
    : /android/i.test(navigator.userAgent) ? 'في كروم على الجوال: اضغط الرمز الذي على يسار عنوان الموقع ← «الأذونات» ← «الميكروفون» ← «سماح». وإن كان المصحف مثبّتًا تطبيقًا: اضغط مطوّلًا على أيقونته ← «معلومات التطبيق» ← الأذونات ← الميكروفون.'
    : 'في كروم على الحاسوب: اضغط الرمز الذي على يسار عنوان الموقع ← «الميكروفون» ← «سماح»، ثم أعد تحميل الصفحة. وتأكد أن للحاسوب ميكروفونًا يعمل.';
  return head + ' ' + how;
}
const MIC_OPTS = { audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
function askMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(Object.assign(new Error('nomedia'), { name: 'NoMedia' }));
  return navigator.mediaDevices.getUserMedia(MIC_OPTS);
}
function micErrText(e) {
  const n = String((e && (e.name || e.message)) || e);
  if (/NotAllowed|Permission|Security/i.test(n)) return micHelp('لم يُسمح للموقع باستعمال الميكروفون.');
  if (/NotFound|DevicesNotFound|Overconstrained/i.test(n)) return 'لم أجد ميكروفونًا في هذا الجهاز. إن كان حاسوبًا فصِل سماعة فيها ميكروفون.';
  if (/NotReadable|TrackStart|Abort/i.test(n)) return 'الميكروفون مشغول بتطبيق آخر (اتصال أو تسجيل أو برنامج اجتماعات). أغلقه ثم أعد المحاولة.';
  if (/NoMedia/.test(n)) return 'هذا المتصفح لا يتيح الميكروفون للمواقع. افتح المصحف في كروم أو سفاري حديث.';
  return 'تعذّر فتح الميكروفون (' + n.slice(0, 60) + ').';
}
function dropPre() { const p = TS.pre; TS.pre = null; if (!p) return; try { p.stream && p.stream.getTracks().forEach(t => t.stop()); p.ctx && p.ctx.state !== 'closed' && p.ctx.close(); } catch (e) {} }
// files of this site that the engines need: a missing one is named, not a silent failure
const MISSING = L => `ملفات ناقصة في الموقع: ${L.map(f => '\u2066' + f + '\u2069').join('، ')}. ارفعها إلى المستودع ثم أعد المحاولة.`;   // each name kept left-to-right
async function missingOf(L) {
  const r = await Promise.all(L.map(u => fetch(u, { method: 'HEAD', cache: 'no-store' }).then(x => (x.status === 404 ? u : null)).catch(() => null)));
  return r.filter(Boolean);
}

/* ---------- engine 2: the Quran-trained model on this device ---------- */
async function modelCached() {
  try { const c = await caches.open('transformers-cache'); return (await c.keys()).some(r => r.url.includes(TSM_MODEL.id) && r.url.includes('decoder_model_merged')); } catch (e) { return false; }
}
async function modelDelete() {
  try { const c = await caches.open('transformers-cache'); for (const r of await c.keys()) if (r.url.includes(TSM_MODEL.id)) await c.delete(r); } catch (e) {}
}
async function pickDevice() {
  if (TSO.gpu && navigator.gpu) {
    try { const ad = await navigator.gpu.requestAdapter(); if (ad) return { device: 'webgpu', dtype: ad.features.has('shader-f16') ? 'fp16' : 'q4' }; } catch (e) {}
  }
  return { device: 'wasm', dtype: 'q8' };
}
function aiLoad(onProgress) {
  if (TS.ready) return Promise.resolve();
  if (TS.loadP) return TS.loadP;
  TS.loadP = (async () => {
    const miss = await missingOf(['js/tasmee-worker.js', 'js/vendor/transformers-4.3.2.min.js']); if (miss.length) throw new Error(MISSING(miss));
    const dv = await pickDevice(); TS.device = dv.device + '/' + dv.dtype;
    const w = new Worker('js/tasmee-worker.js', { type: 'module' }); TS.worker = w;
    const files = new Map();
    await new Promise((res, rej) => {
      w.onerror = e => rej(new Error(e.message || 'لم يعمل عامل المحرّك الدقيق في هذا المتصفح'));
      w.onmessage = e => {
        const m = e.data;
        if (m.type === 'progress') {
          if (m.file) files.set(m.file, [m.loaded, m.total || files.get(m.file)?.[1] || 0]);
          let a = 0, b = 0; for (const [l, t] of files.values()) { a += l; b += t; }
          onProgress && onProgress(a, b);
        } else if (m.type === 'ready') { TS.ready = true; TS.warm = m.warm; res(); }
        else if (m.type === 'error') rej(new Error(m.message));
      };
      w.postMessage({ type: 'load', model: TSM_MODEL.id, revision: TSM_MODEL.rev, device: dv.device, dtype: dv.dtype, ...(window.__TSM_TEST || {}) });
    });
    w.onmessage = e => {
      const m = e.data;
      if (TS.probe.has(m.id)) { const f = TS.probe.get(m.id); TS.probe.delete(m.id); f(m); return; }
      if (m.type === 'text') {
        TS.busy = false; TS.perf.push(m.ms / 1000 / Math.max(0.5, m.sec)); if (TS.perf.length > 8) TS.perf.shift();
        const J = TJS.jobs.get(m.id); TS.cur = J ? [] : null;
        heard(m.text);
        if (J) { J.marks = TS.cur; J.text = m.text; } TS.cur = null; tjTry(m.id);
        pump();
      } else if (m.type === 'error') { TS.busy = false; TJS.jobs.delete(m.id); pump(); }
    };
  })();
  TS.loadP.catch(() => { TS.loadP = null; try { TS.worker && TS.worker.terminate(); } catch (e) {} TS.worker = null; });
  return TS.loadP;
}
function pump() {
  if (TS.busy || !TS.queue.length || !TS.worker) return;
  TS.busy = true; const a = TS.queue.shift(), id = ++TS.jobId;
  setStatus('أتبيّن ما قرأت…');
  if (TS.tjOn && TJS.ready && TS.sess && !(a.gap >= 0.27)) tjSend(id, a, TS.sess);     // a phrase with a pause inside is not judged
  TS.worker.postMessage({ type: 'run', id, audio: a }, [a.buffer]);
}
/* ---------- the tajweed remarks: a second model hears the same phrase ---------- */
const TJ_MODEL = { id: 'HisnLabs/tajweed-v2', size: 23, cache: 'shahba-tajweed-v1',
  url: 'https://huggingface.co/HisnLabs/tajweed-v2/resolve/b3b0503d32b4d9a8a0447880b4564fd3e9d69c15/onnx/model-int8.onnx' };
const TJS = { worker: null, ready: false, loadP: null, jobs: new Map(), probe: new Map(), jobId: 1e6 };
let PH = null, PHP = null;
const getPH = () => PH ? Promise.resolve(PH) : (PHP ||= fetch('data/ph-hafs.json').then(r => { if (!r.ok) throw new Error('ph ' + r.status); return r.json(); })
  .then(j => (PH = j)).catch(e => { PHP = null; throw e; }));
const TJA = new Map();
function tjAyah(k) {                                   // the reference phonetic script of one ayah, with its rules
  let r = TJA.get(k);
  if (!r) { const e = PH && PH.ayat[k]; if (!e) return null; r = TJ.ayahRef(e, PH.rules); if (TJA.size > 300) TJA.clear(); TJA.set(k, r); }
  return r;
}
async function tjCached() { try { return !!(await (await caches.open(TJ_MODEL.cache)).match(TJ_MODEL.url)); } catch (e) { return false; } }
function tjDrop() { try { TJS.worker && TJS.worker.terminate(); } catch (e) {} TJS.worker = null; TJS.ready = false; TJS.loadP = null; TJS.jobs.clear(); }
async function tjDelete() { tjDrop(); try { await caches.delete(TJ_MODEL.cache); } catch (e) {} }
function tjLoad(onProgress) {
  if (TJS.ready) return Promise.resolve();
  if (TJS.loadP) return TJS.loadP;
  TJS.loadP = (async () => {
    const miss = await missingOf(['js/tajweed-worker.js', 'js/tajweed-core.js', 'js/vendor/ort.wasm.bundle.min.mjs', 'js/vendor/ort-wasm-simd-threaded.wasm']); if (miss.length) throw new Error(MISSING(miss));
    const w = new Worker('js/tajweed-worker.js', { type: 'module' }); TJS.worker = w;
    await new Promise((res, rej) => {
      w.onerror = e => rej(new Error(e.message || 'worker'));
      w.onmessage = e => {
        const m = e.data;
        if (m.type === 'progress') onProgress && onProgress(m.loaded, m.total || 1);
        else if (m.type === 'ready') { TJS.ready = true; res(); }
        else if (m.type === 'error') rej(new Error(m.message));
      };
      w.postMessage({ type: 'load', ...(window.__TJ_TEST ? { test: window.__TJ_TEST } : {}) });
    });
    w.onmessage = e => {
      const m = e.data;
      if (TJS.probe.has(m.id)) { const f = TJS.probe.get(m.id); TJS.probe.delete(m.id); f(m); return; }
      if (m.type === 'phon' || (m.type === 'error' && m.id)) tjGot(m.id, m.type === 'phon' ? m : null);
    };
  })();
  TJS.loadP.catch(() => tjDrop());
  return TJS.loadP;
}
async function tjStart() {
  if (!TSO.tj || TS.engine !== 'ai') return;
  TS.tjMsg = 'أجهّز التجويد'; paintSub();
  try {
    await getPH();
    await tjLoad((a, b) => { TS.tjMsg = `التجويد ${AR(Math.min(99, Math.round(a / b * 100)))}٪`; });
    if (!TS.on) return;
    TS.tjOn = true; TS.tjMsg = '';
  } catch (e) {
    TS.tjOn = false; TS.tjMsg = ''; if (TS.sess && !TS.sess.tjSeen) TS.sess.tjSeen = undefined;
    if (TS.on) toast('تعذّر تجهيز ملاحظات التجويد (' + String((e && e.message) || e).slice(0, 60) + ')، فيستمر التسميع على الكلمات وحدها', 5000);
  }
  paintSub();
}
function tjSend(id, a, sess) {
  const c = a.slice();
  TJS.jobs.set(id, { sess }); if (TJS.jobs.size > 12) TJS.jobs.delete(TJS.jobs.keys().next().value);
  TJS.worker.postMessage({ type: 'run', id, audio: c, riwaya: 0 }, [c.buffer]);       // 0 = Hafs
}
function tjGot(id, m) { const J = TJS.jobs.get(id); if (!J) return; J.out = m; tjTry(id); }
function tjTry(id) {
  const J = TJS.jobs.get(id); if (!J || J.marks === undefined || J.out === undefined) return;
  TJS.jobs.delete(id);
  if (J.out && J.marks && J.marks.length) { try { tjJudge(J); } catch (e) { console.warn('tajweed', e); } }
}
// only a clean phrase is judged: every word in it heard right, no word repeated or added, no pause inside;
// the words at a stop or a start (waqf and ibtida') and at joined ayat (wasl) are left out, as their sound changes there
function tjJudge(J) {
  const s = J.sess, ps = [...new Set(J.marks.map(x => x[0]))].sort((a, b) => a - b);
  const n = ps.length, p0 = ps[0], p1 = ps[n - 1];
  if (p1 - p0 + 1 !== n || n > 60) return;
  if (J.marks.some(([, k]) => k !== 'ok')) return;
  if (TZ.words(J.text).length !== n) return;
  const parts = [], skip = new Set();
  for (let p = p0, w = 0; p <= p1;) {
    const k = ayOfPos(p), A = ay(k), cnt = A.l - A.f, wi0 = p - EXPP[A.f], wi1 = Math.min(cnt - 1, wi0 + (p1 - p)), len = wi1 - wi0 + 1;
    const ar = tjAyah(k); if (!ar || ar.words.length !== cnt) return;
    parts.push(TJ.slice(ar, wi0, wi1));
    if (p > p0 || wi0 > 0) skip.add(w);
    if (p + len - 1 < p1 || wi1 < cnt - 1) skip.add(w + len - 1);
    p += len; w += len;
  }
  const R = TJ.check(TJ.join(parts), J.out, { skip });
  s.tjSeen = (s.tjSeen || 0) + n - skip.size;
  if (R.length) {
    s.tj ||= new Map();
    for (const r of R) {
      const p = p0 + r.w; if (!s.tj.has(p)) s.tj.set(p, []); s.tj.get(p).push(r);
      $$(`.w[data-i="${EXPW[p]}"]`).forEach(x => { if (!x.closest('.panel, .tsheet, .wcard')) x.classList.add('tk-tj'); });
    }
  }
  paintCounts();
  if (!$('#pTsm').hidden && !$('#tsSum').hidden && (TS.hold === s || TS.sess === s)) paintTjSum(s);
}
const tjCount = s => { let n = 0; if (s && s.tj) for (const L of s.tj.values()) n += L.length; return n; };

/* ---------- engine 3: the silent engine — the phoneme model hears every second, and the words follow ---------- */
let PHSK = null, PHLOC = null;
function phSkel(p) {                                   // the sound skeleton of mushaf word p, from its ayah's phonetic reference
  if (!PHSK) PHSK = new Array(EXPW.length);
  let v = PHSK[p];
  if (v == null) {
    const k = ayOfPos(p), A = ay(k), ar = tjAyah(k), wi = p - EXPP[A.f];
    v = ar && ar.words[wi] ? TJ.skel(ar.ph.slice(ar.words[wi][0], ar.words[wi][1])) : TZ.norm(D.iml[EXPW[p] - 1]);
    PHSK[p] = v;
  }
  return v;
}
const phLoc = () => (PHLOC ||= TJ.locIndex(EXPW.length, phSkel));
const PHS = { seg: 0, segs: new Map(), busy: false, queued: null, look: 0.7, last: 0 };
function phReset() { PHS.seg = 0; PHS.segs.clear(); PHS.busy = false; PHS.queued = null; PHS.look = 0.7; }
function phSegStart(V) {
  V.segId = ++PHS.seg;
  PHS.segs.set(V.segId, { first: TS.sess ? TS.sess.pos : null, T0: 0, lastLook: 0, marks: [], heard: [], done: false });
  if (PHS.segs.size > 6) PHS.segs.delete(PHS.segs.keys().next().value);
}
function phSegDrop(V) { PHS.segs.delete(V.segId); }
const framesPCM = (fr, from) => { const L = fr.slice(from), out = new Float32Array(L.length * 480); L.forEach((f, j) => out.set(f, j * 480)); return out; };
function phMaybeLook(V) {                              // a look every ~0.7 s while the phrase goes on, never two at once
  const G = PHS.segs.get(V.segId); if (!G || PHS.busy || !TJS.ready) return;
  const now = V.seg.length * 0.03; if (now < 1 || now - G.lastLook < PHS.look) return;
  G.lastLook = now;
  const from = Math.max(0, Math.floor(G.T0 / 0.03), V.seg.length - 270);           // at most the last 8 s
  phLook(V.segId, framesPCM(V.seg, from), from * 0.03, false);
}
function phFinal(V, pcm) {
  const G = PHS.segs.get(V.segId); if (!G) return;
  const args = [V.segId, pcm, 0, true, pcm.gap];
  if (PHS.busy) PHS.queued = args; else phLook(...args);
}
async function phLook(id, pcm, t0, final, gap) {
  PHS.busy = true; const t = performance.now();
  try {
    const out = await askWorker(TJS.worker, TJS.probe, { type: 'run', audio: pcm, riwaya: 0 });
    const ms = performance.now() - t;
    PHS.look = Math.min(2, Math.max(0.7, ms / 1000 * 1.6));                       // a slow phone looks less often
    if (TS.on && !TS.paused) phApply(id, out, t0, final, gap);
  } catch (e) { console.warn('silent engine', e); }
  finally {
    PHS.busy = false;
    if (PHS.queued) { const q = PHS.queued; PHS.queued = null; phLook(...q); }
  }
}
function phApply(id, out, t0, final, gap) {
  const s = TS.sess, G = PHS.segs.get(id); if (!s || !G || G.done) return;
  const N = EXPW.length;
  if (s.pos == null) {                                  // «من أي مكان»: find the place by its sounds
    const loc = TJ.locate(TJ.skel(out.ph), phLoc(), null, s.near || 0);
    if (!loc) { setStatus('أبحث عن موضع قراءتك… تابع القراءة'); return; }
    s.pos = loc.pos; G.first = loc.pos; s.onLocate && s.onLocate(loc.pos);
  }
  if (G.first == null) G.first = s.pos;
  const o = p => ({ pos: s.pos, ctxFrom: Math.max(0, p - 3), count: N, skelAt: phSkel, tEnd: t0 + out.sec, final, t0 });
  let base = final ? G.first : s.pos, r = TJ.step(out, o(base));
  if (final && r.words.length >= 4 && r.words.filter(w => w.kind === 'ok').length / r.words.length < 0.3) {   // read elsewhere: a skip or a return
    const loc = TJ.locate(r.H.s, phLoc(), [Math.max(0, s.pos - 80), Math.min(N - 1, s.pos + 400)], s.pos);
    if (loc && Math.abs(loc.pos - s.pos) > 2) {
      if (loc.pos > s.pos && loc.pos - s.pos <= 40) for (let p = s.pos; p < loc.pos; p++) s.mark(p, 'miss');
      else if (loc.pos > s.pos) s.onJump && s.onJump(s.pos, loc.pos);
      s.pos = loc.pos; G.first = base = loc.pos; r = TJ.step(out, o(base));
    }
  }
  for (const w of r.words) { if (w.p < s.pos) continue; s.mark(w.p, w.kind, w.kind === 'ok' ? '' : w.heard); G.marks.push([w.p, w.kind]); G.heard.push(w.heard || 'x'); }
  s.pos = Math.max(s.pos, r.upto);
  if (r.tCommit != null && !final) G.T0 = Math.max(G.T0, r.tCommit - 0.35);
  // the word being said shows faintly
  $$('.w.tk-tmp').forEach(w => w.classList.remove('tk-tmp'));
  if (!final) { const q = r.upto - Math.max(0, base - 3), R = r.F.R[q]; if (R && R.h && r.upto < N) $$(`.w[data-i="${EXPW[r.upto]}"]`).forEach(w => w.classList.add('tk-tmp')); }
  setStatus(TS.tjOn ? 'أستمع… (الصوتي يتابعك، والتجويد بعد كل وقفة)' : 'أستمع…');
  paintCounts(); paintNow(); tsFollow();
  if (final) {
    G.done = true;
    if (TSO.tj && !(gap >= 0.27) && !r.ctxUsed && G.marks.length) { try { tjJudge({ sess: s, marks: G.marks, text: G.heard.join(' '), out }); } catch (e) { console.warn('tajweed', e); } }
    PHS.segs.delete(id);
  }
  if (s.pos != null && s.end !== Infinity && s.pos > s.end) { toast('تمّت السورة، بارك الله فيك', 3000); tsStop(true); }
  else if (s.pos >= N) tsStop(true);
}

const CAPTURE = `class C extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(2048);this.n=0}
process(i){const c=i[0]&&i[0][0];if(c){for(let k=0;k<c.length;k++){this.b[this.n++]=c[k];if(this.n===2048){this.port.postMessage(this.b.slice(0));this.n=0}}}return true}}
registerProcessor('tsm-cap',C);`;
async function micStart(pre) {
  const stream = (pre && pre.stream && pre.stream.active) ? pre.stream : await askMic();
  let ctx = pre && pre.ctx && pre.ctx.state !== 'closed' ? pre.ctx : null;
  if (!ctx) { try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); } }
  if (TS.pre === pre) TS.pre = null;                    // the microphone now belongs to the session
  try { await ctx.resume(); } catch (e) {}
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([CAPTURE], { type: 'application/javascript' })));
  const src = ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(ctx, 'tsm-cap'), mute = ctx.createGain(); mute.gain.value = 0;
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);
  const V = { rate: ctx.sampleRate, buf: [], pre: [], seg: null, sil: 0, loud: 0, nf: 0.004, frame: new Float32Array(480), fn: 0 };
  node.port.onmessage = e => vad(V, resample(e.data, V.rate));
  TS.mic = { stream, ctx, node };
  return ctx.state === 'running';
}
function micStop() { const m = TS.mic; TS.mic = null; if (!m) return; try { m.node.port.onmessage = null; m.stream.getTracks().forEach(t => t.stop()); m.ctx.close(); } catch (e) {} }
function resample(x, rate) {
  if (rate === 16000) return x;
  const r = rate / 16000, n = Math.floor(x.length / r), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i * r, j = Math.floor(t), f = t - j; y[i] = x[j] * (1 - f) + (x[j + 1] ?? x[j]) * f; }
  return y;
}
// a simple voice detector: a phrase ends at a pause (waqf) of about 0.7 s
function vad(V, x) {
  for (let i = 0; i < x.length; i++) {
    V.frame[V.fn++] = x[i];
    if (V.fn < 480) continue;
    V.fn = 0; const f = V.frame.slice(0);
    let e = 0; for (let k = 0; k < 480; k++) e += f[k] * f[k]; const rms = Math.sqrt(e / 480);
    const thr = Math.max(0.006, V.nf * 2.6), voiced = rms > thr;
    $('#tsMic').style.setProperty('--lvl', Math.min(1, rms * 12).toFixed(2));
    if (!V.seg) {
      V.pre.push(f); if (V.pre.length > 10) V.pre.shift();
      if (voiced) { if (++V.loud >= 3) { V.seg = V.pre.slice(); V.pre = []; V.sil = 0; V.gap = 0; if (TS.engine === 'ph') phSegStart(V); } }
      else { V.loud = 0; V.nf = V.nf * 0.97 + rms * 0.03; }
      continue;
    }
    V.seg.push(f);
    if (TS.engine === 'ph' && !TS.paused) phMaybeLook(V);
    if (voiced && V.sil) V.gap = Math.max(V.gap, V.sil);
    V.sil = voiced ? 0 : V.sil + 1;
    const len = V.seg.length * 0.03;
    if (V.sil >= 24 || len >= 18) {
      const cut = V.sil < 24;                             // cut by the length limit, not by a pause
      let frames = V.seg; if (V.sil >= 24) frames = frames.slice(0, frames.length - 17);
      V.seg = null; V.sil = 0; V.loud = 0;
      if (frames.length * 0.03 < 0.45 || TS.paused) { if (TS.engine === 'ph') phSegDrop(V); continue; }
      const out = new Float32Array(frames.length * 480); frames.forEach((fr, j) => out.set(fr, j * 480));
      out.gap = cut ? 99 : (V.gap || 0) * 0.03;
      if (TS.engine === 'ph') { phFinal(V, out); continue; }
      TS.queue.push(out); if (TS.queue.length > 6) TS.queue.shift();
      pump();
    }
  }
}

/* ---------- start, pause, finish ---------- */
const pickEngine = () => {
  const e = TSO.engine;
  if (e === 'auto') return autoEngine();
  if ((e === 'ai' || e === 'ph') && hasAI()) return e;
  return e === 'web' && hasWeb() ? 'web' : autoEngine();
};
async function tsStart(fromK, pre) {
  if (TS.on) tsStop(false);
  if (typeof PL !== 'undefined' && PL.on) closePlayer();
  TS.pre = pre || null; TS.setupK ??= fromK ?? startLabelK(); const gen = ++TS.gen;
  const eng = pickEngine();
  if (!eng) return tsFail('هذا المتصفح لا يدعم التسميع. افتح المصحف في كروم أو سفاري حديث.');
  if (typeof TZ === 'undefined') return tsFail(MISSING(['js/tasmee-core.js']));
  TS.hold = null; clearMarks(); showTsBar(true); $('#tsBar').classList.remove('done', 'paused');   // the bar shows at once
  setStatus('أجهّز كلمات المصحف…'); $('#tsSub').textContent = ''; paintCounts();
  try { await Promise.all([getWords(), getIml()]); }
  catch (e) { if (gen === TS.gen) tsFail('تعذّر تحميل كلمات المصحف (data/words.json و data/imlaei.json). تحقق من الاتصال ثم أعد المحاولة.'); return; }
  if (gen !== TS.gen) { dropPre(); return; }            // stopped while the words were loading
  expBuild(); clearMarks(); TS.hold = null; FCACHE.size > 20000 && FCACHE.clear();
  const pos = fromK == null ? null : EXPP[ay(fromK).f];
  TS.engine = eng; TS.paused = false; TS.queue = []; TS.perf = []; TS.tjOn = false; TS.tjMsg = ''; TJS.jobs.clear();
  TS.hideFrom = TSO.mode === 'hide' && pos != null ? pos : null;
  TS.sess = new TZ.Session({
    count: EXPW.length, formsAt: eng === 'ph' ? (p => [phSkel(p)]) : formsAt, index: tIndex, pos, strict: eng === 'ai',
    end: pos != null && TSO.stopSurah ? lastPosOfSurah(ay(fromK).s) : Infinity,
    near: EXPP[firstWord(S.page)],
    onMark: (p, kind) => { paintMark(p, kind); if (TS.cur) TS.cur.push([p, kind]); },
    onJump: (a, b) => { const k = ayOfPos(b); toast(`انتقلتَ إلى سورة ${sName(ay(k).s)} الآية ${AR(ay(k).a)}؛ لم تُحسب الآيات بينهما`, 3500); },
    onLocate: p => {
      const k = ayOfPos(p); toast(`وجدتُ موضعك: سورة ${sName(ay(k).s)} الآية ${AR(ay(k).a)}`, 3000);
      if (TSO.stopSurah) TS.sess.end = lastPosOfSurah(ay(k).s);
    },
  });
  if ((eng === 'ai' || eng === 'ph') && TSO.tj) TS.sess.tjSeen = 0;
  setStatus(eng === 'ai' ? 'أجهّز المحرّك الدقيق…' : eng === 'ph' ? 'أجهّز المحرّك الصوتي…' : 'أفتح الميكروفون…');
  TS.on = true; TS.t0 = Date.now(); paintCounts(); paintSub();
  clearInterval(TS.tick); TS.tick = setInterval(paintSub, 1000);
  tsMark(document); tsFollow();
  try {
    if (eng === 'web') { webWatch(); webStart(); setStatus('أستمع… ابدأ القراءة'); webTip(); }
    else if (eng === 'ph') {
      await Promise.all([getPH(), tjLoad((a, b) => setStatus(`أنزّل المحرّك الصوتي ${AR(Math.min(99, Math.round(a / b * 100)))}٪ — مرة واحدة فقط`))]);
      if (!TS.on) return;
      phReset(); TS.tjOn = !!TSO.tj;
      const live = await micStart(TS.pre);
      setStatus(live ? 'أستمع… ابدأ القراءة' : 'اضغط زر الميكروفون الأحمر ليبدأ السماع');
    } else {
      await aiLoad((a, b) => setStatus(b ? `أنزّل نموذج التسميع ${AR(Math.round(a / b * 100))}٪ — مرة واحدة فقط` : 'أجهّز المحرّك الدقيق…'));
      if (!TS.on) return;
      const live = await micStart(TS.pre);
      setStatus(live ? 'أستمع… ابدأ القراءة' : 'اضغط زر الميكروفون الأحمر ليبدأ السماع');
      tjStart();                                           // the tajweed model gets ready alongside, without holding the reader
    }
  } catch (e) {
    const msg = String(e && (e.name || e.message) || e);
    if (/NotAllowed|Permission|NotFound|NotReadable|TrackStart|NoMedia|Security/i.test(msg)) tsFail(micErrText(e));
    else if (/ملفات ناقصة/.test(e.message || '')) tsFail(e.message);
    else if (eng === 'ai' || eng === 'ph') tsFail(aiErrText(e));
    else tsFail('تعذّر بدء التسميع (' + msg.slice(0, 80) + '). اضغط «افحص الميكروفون والتسميع» لمعرفة السبب.');
    return;
  }
  wakeOn();
}
// a failure stays on the screen: the setup panel opens with the reason and the way to check
function tsFail(msg) {
  if (TS.failing) return; TS.failing = true;
  const k = TS.setupK;
  if (TS.on || TS.sess) tsStop(false); else tsClear();
  dropPre(); clearTimeout(TS.dog);
  openSetup(k); showErr(msg);
  TS.failing = false;
}
function showErr(msg) {
  const b = $('#tsErr'); b.hidden = false;
  b.innerHTML = `<b>لم يعمل التسميع</b><p>${esc(msg)}</p><button class="btn ghost2" data-diag="1">افحص الميكروفون والتسميع</button>`;
  b.scrollIntoView({ block: 'nearest' });
}
function aiErrText(e) {
  const m = String((e && e.message) || e);
  if (/Could not locate|Failed to fetch|NetworkError|Load failed|huggingface|http 4|http 5/i.test(m)) return `تعذّر تنزيل نموذج المحرّك الدقيق من موقع huggingface (${m.slice(0, 70)}). قد يكون الاتصال ضعيفًا أو الموقع محجوبًا في بلدك. اضغط «افحص الميكروفون والتسميع» لمعرفة ذلك.`;
  if (/backend|wasm|WebAssembly|jsdelivr/i.test(m)) return `تعذّر تشغيل مكتبة المحرّك الدقيق (${m.slice(0, 70)}). قد يكون موقع cdn.jsdelivr.net محجوبًا أو المتصفح قديمًا.`;
  return `تعذّر تجهيز المحرّك الدقيق (${m.slice(0, 80)}).`;
}
function tsPause() {
  if (!TS.on) return;
  TS.paused = !TS.paused; $('#tsBar').classList.toggle('paused', TS.paused);
  $('#tsPause use').setAttribute('href', TS.paused ? '#i-mic' : '#i-pause');
  if (TS.engine === 'web') { if (TS.paused) webStop(); else webStart(); }
  setStatus(TS.paused ? 'متوقف مؤقتًا — اضغط الميكروفون لتتابع' : 'أستمع…');
}
function tsStop(summary) {
  if (!TS.on && !TS.sess) return;
  webStop(); micStop(); dropPre(); wakeOff(); clearInterval(TS.tick); clearTimeout(TS.dog); TS.gen++;
  TS.on = false; TS.queue = []; TS.busy = false;
  const s = TS.sess; TS.sess = null; TS.hold = s;
  $$('.w.tk-h, .w.tk-now, .w.tk-tmp').forEach(w => w.classList.remove('tk-h', 'tk-now', 'tk-tmp'));
  const any = s && s.marks.size;
  if (!any) { tsClear(); return; }
  $('#tsBar').classList.add('done'); paintCounts();
  const c = s.stats(); setStatus(`انتهى التسميع — صحيح ${AR(c.ok + c.fix)}، أخطاء ${AR(c.bad + c.miss)}`);
  if (summary) openSummary();
}
function tsClear() {
  webStop(); micStop(); dropPre(); wakeOff(); clearInterval(TS.tick); clearTimeout(TS.dog); TS.gen++;
  TS.on = false; TS.sess = null; TS.hold = null; clearMarks(); showTsBar(false);
}
function tsYield() { if (!$('#tsBar').hidden) { if (TS.on) tsStop(false); $('#tsBar').hidden = true; } }   // the audio player takes the place
function showTsBar(on) {
  $('#tsBar').hidden = !on;
  const playing = on || (typeof PL !== 'undefined' && PL.on);
  if (document.body.classList.contains('playing') !== playing) { document.body.classList.toggle('playing', playing); if (S.mode !== 'read') setMode(S.mode, { page: S.page }); }
}
async function wakeOn() { try { TS.lock = await navigator.wakeLock?.request('screen'); } catch (e) {} }
function wakeOff() { try { TS.lock && TS.lock.release(); } catch (e) {} TS.lock = null; }
document.addEventListener('visibilitychange', () => { if (TS.on && document.visibilityState === 'visible' && !TS.lock) wakeOn(); });

/* ---------- the bar ---------- */
$('#tsPause').onclick = () => tsPause();
$('#tsMic').onclick = () => {
  if (TS.paused) return tsPause();
  if (TS.mic && TS.mic.ctx.state !== 'running') { TS.mic.ctx.resume().then(() => { if (TS.mic && TS.mic.ctx.state === 'running') setStatus('أستمع… ابدأ القراءة'); }).catch(() => {}); return; }
  if (TS.on && TS.engine === 'web' && !TS.webAudio && !TS.lastResult) { webStop(); try { webWatch(); webStart(); setStatus('أعدتُ فتح الميكروفون… ابدأ القراءة'); } catch (e) {} }   // a fresh tap may be what the browser waits for
};
$('#tsHint').onclick = () => {
  const s = TS.sess; if (!s || s.pos == null) return toast('ابدأ القراءة أولًا حتى أعرف موضعك');
  const p = s.hint(); paintCounts(); paintNow(); tsFollow();
  if (p != null) { const k = ayOfPos(p); toast(`تلميح: الكلمة التالية في سورة ${sName(ay(k).s)} الآية ${AR(ay(k).a)} ظهرت لك`); }
};
$('#tsStop').onclick = () => { if (TS.on) tsStop(true); else tsClear(); };
$('#tsRes').onclick = () => openSummary();
$('#tsInfo').onclick = () => { const s = TS.sess || TS.hold; if (s && s.pos != null) goAyah(ayOfPos(Math.min(s.pos, EXPW.length - 1))); };

/* ---------- setup and summary panel ---------- */
function startLabelK() { return SEL != null ? SEL : D.wAyah[firstWord(S.page)]; }
function openSetup(k) {
  TS.setupK = k != null ? k : startLabelK();
  $('#tsErr').hidden = true;
  if (typeof getWords === 'function') Promise.all([getWords(), getIml()]).catch(() => {});   // ready before «ابدأ»
  $('#tsSetup').hidden = false; $('#tsSum').hidden = true; $('#tsmTitle').textContent = 'التسميع';
  showPanel('pTsm'); paintSetup();
}
async function paintSetup() {
  const a = ay(TS.setupK);
  segOn('#tsEng', TSO.engine); segOn('#tsMode', TSO.mode); segOn('#tsFrom', TS.from || 'here');
  $('#tsHere').textContent = `من سورة ${sName(a.s)} الآية ${AR(a.a)}`;
  $('#tsEng [data-v="web"] small').textContent = hasWeb() ? 'خدمة جوجل في المتصفح. سريع، ويحتاج إنترنت، ويتسامح في الحروف' + (/android/i.test(navigator.userAgent) ? '، وقد تُصدر نغمة مع كل وقفة.' : '.') : 'غير متاح في هذا المتصفح (يعمل في كروم وسفاري).';
  $('#tsEng [data-v="web"]').disabled = !hasWeb();
  $('#tsEng [data-v="ai"]').disabled = !hasAI(); $('#tsEng [data-v="ph"]').disabled = !hasAI();
  const ae = autoEngine();
  $('#tsAutoNote').textContent = ae === 'ph' ? 'على هذا الجهاز: المحرّك الصوتي — صامت وسريع ويعمل دون إنترنت بعد تنزيله.' : ae === 'web' ? 'على هذا الجهاز: المحرّك السريع (جوجل)، وعلى الجوال: المحرّك الصوتي الصامت.' : 'لا يدعم هذا المتصفح التسميع.';
  swOn('#tsStopS', TSO.stopSurah); swOn('#tsGpu', TSO.gpu);
  const E = pickEngine();
  $('#tsGpuRow').hidden = E !== 'ai' || !navigator.gpu;
  $('#tsModelRow').hidden = E !== 'ai';
  $('#tsAnyNote').hidden = !(TS.from === 'any' && TSO.mode === 'hide');
  const ai = E === 'ai', ph = E === 'ph';
  $('#tsTjRow').hidden = !(ai || ph); $('#tsProbeRow').hidden = !(ai || ph); swOn('#tsTj', TSO.tj);
  const [cached, tjc] = await Promise.all([modelCached(), tjCached()]);
  $('#tsModel').textContent = cached ? 'النموذج محفوظ في جهازك ✓ ويعمل دون إنترنت' : `لم يُنزَّل بعد — يُنزَّل مرة واحدة (نحو ${AR(TSM_MODEL.size)} ميغا)، ثم يعمل دون إنترنت ولا يخرج صوتك من جهازك`;
  $('#tsModelDel').hidden = !cached;
  $('#tsTjModel').textContent = ph ? (tjc ? 'نموذج المحرّك الصوتي محفوظ في جهازك ✓، ومنه تأتي ملاحظات التجويد أيضًا' : `يُنزَّل نموذج المحرّك الصوتي مرة واحدة (نحو ${AR(TJ_MODEL.size)} ميغا)، ومنه تأتي ملاحظات التجويد أيضًا`)
    : !TSO.tj ? 'متوقفة: يُحكم على الكلمات وحدها' : tjc ? 'نموذج التجويد محفوظ في جهازك ✓' : `يُنزَّل نموذج التجويد مرة واحدة (نحو ${AR(TJ_MODEL.size)} ميغا) حين تبدأ، ولا ينتظره التسميع`;
  $('#tsTjDel').hidden = !tjc;
  const need = ai ? (cached ? 0 : TSM_MODEL.size) + (TSO.tj && !tjc ? TJ_MODEL.size : 0) : ph && !tjc ? TJ_MODEL.size : 0;
  $('#tsGo').textContent = need ? `نزّل ${ai && !cached && TSO.tj && !tjc ? 'النموذجين' : 'النموذج'} (${AR(need)} ميغا) وابدأ التسميع` : 'ابدأ التسميع';
}
$('#pTsm').addEventListener('click', e => {
  const v = e.target.closest('[data-v]'), host = v?.parentElement?.id;
  if (v && host === 'tsEng' && !v.disabled) { TSO.engine = v.dataset.v; saveTSO(); return paintSetup(); }
  if (v && host === 'tsMode') { TSO.mode = v.dataset.v; saveTSO(); return paintSetup(); }
  if (v && host === 'tsFrom') { TS.from = v.dataset.v; return paintSetup(); }
});
$('#tsStopS').onclick = () => { TSO.stopSurah = !TSO.stopSurah; saveTSO(); paintSetup(); };
$('#tsGpu').onclick = () => { TSO.gpu = !TSO.gpu; saveTSO(); if (TS.worker) { TS.worker.terminate(); TS.worker = null; TS.ready = false; TS.loadP = null; } paintSetup(); };
$('#tsTj').onclick = () => { TSO.tj = !TSO.tj; saveTSO(); paintSetup(); };
$('#tsTjDel').onclick = async () => { await tjDelete(); toast('حُذف نموذج التجويد من جهازك'); paintSetup(); };
$('#tsProbe').onclick = () => probe();
$('#tsModelDel').onclick = async () => { await modelDelete(); if (TS.worker) { TS.worker.terminate(); TS.worker = null; TS.ready = false; TS.loadP = null; } toast('حُذف نموذج التسميع من جهازك'); paintSetup(); };
$('#tsGo').onclick = async () => {
  if (TS.from === 'any' && TSO.mode === 'hide') { TSO.mode = 'follow'; saveTSO(); toast('«من أي مكان» يعمل مع وضع المتابعة؛ فاخترتُه لك'); }
  const k = TS.from === 'any' ? null : TS.setupK, eng = pickEngine();
  if (!eng) return showErr('هذا المتصفح لا يدعم التسميع. افتح المصحف في كروم أو سفاري حديث.');
  if (typeof TZ === 'undefined') return showErr(MISSING(['js/tasmee-core.js']));
  $('#tsErr').hidden = true;
  let ctx = null;                                       // made inside the tap, so the browser lets it play
  if (eng === 'ai' || eng === 'ph') { try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { try { ctx = new AudioContext(); } catch (x) {} } }
  const b = $('#tsGo'), t = b.textContent; b.disabled = true; b.textContent = 'أطلب إذن الميكروفون… اضغط «سماح»';
  let stream = null;
  try { stream = await askMic(); }
  catch (e) { b.disabled = false; b.textContent = t; try { ctx && ctx.close(); } catch (x) {} return showErr(micErrText(e)); }
  b.disabled = false; b.textContent = t;
  if (eng === 'web') { stream.getTracks().forEach(x => x.stop()); stream = null; }   // the speech service opens the microphone itself
  closePanels(); tsStart(k, eng === 'web' ? null : { stream, ctx });
};
$('#tsErr').onclick = e => { if (e.target.closest('[data-diag]')) runDiag(); };
function openSummary() {
  const s = TS.hold || TS.sess; if (!s) return;
  const c = s.stats(), done = c.ok + c.fix, wrong = c.bad + c.miss, total = done + wrong;
  const sec = Math.round((Date.now() - TS.t0) / 1000);
  const groups = new Map();
  [...s.marks].filter(([, m]) => m.kind !== 'ok').sort((a, b) => a[0] - b[0]).forEach(([p, m]) => {
    const k = ayOfPos(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([p, m]);
  });
  const LBL = { bad: ['خطأ', 'bad'], miss: ['كلمة متروكة', 'bad'], soft: ['للمراجعة', 'soft'], hint: ['بتلميح', 'soft'], fix: ['صحّحها القارئ', 'fix'] };
  const items = [...groups].map(([k, L]) => {
    const a = ay(k);
    const ws = L.map(([p, m]) => {
      const id = EXPW[p], pg = D.wPage[id];
      return `<span class="tsw ${LBL[m.kind][1]}"><span class="g" style="font-family:${fam(pg)}" data-pg="${pg}">${D.glyphs[id - 1]}</span><small>${LBL[m.kind][0]}${m.heard ? ' · سمعتُ: «' + esc(m.heard) + '»' : ''}</small></span>`;
    }).join('');
    return `<li><div class="tsref"><button data-goto="${k}">سورة ${sName(a.s)} — الآية ${AR(a.a)}</button><button class="aplay" data-listen="${k}"><svg><use href="#i-play"/></svg>استمع</button></div><div class="tsws">${ws}</div></li>`;
  }).join('');
  $('#tsSum').innerHTML = `
    <div class="tscards"><div class="ok"><b>${AR(done)}</b><small>كلمة صحيحة</small></div><div class="bad"><b>${AR(wrong)}</b><small>خطأ أو متروكة</small></div><div class="soft"><b>${AR(c.soft + c.hint)}</b><small>للمراجعة وبتلميح</small></div></div>
    <p class="tsacc">${total ? `نسبة الصواب ${AR(Math.round(done / total * 100))}٪، ` : ''}المدة ${AR(Math.floor(sec / 60))} د ${AR(sec % 60)} ث</p>
    ${items ? `<ol class="tslist">${items}</ol>` : '<p class="note">لا أخطاء، ما شاء الله تبارك الله.</p>'}
    <div id="tsTjSec"></div>
    <div class="row"><button class="btn" id="tsAgain">أعد التسميع من البداية</button><button class="btn ghost2" id="tsClearB">مسح العلامات</button></div>
    <p class="note">${s.tjSeen != null ? 'يحكم البرنامج على الكلمات، وملاحظات التجويد تجريبية لا تظهر إلا إذا كان النموذج واثقًا، وقد يخطئ السماع؛ فالمعلّم هو الحَكَم.' : 'البرنامج يحكم على الكلمات فقط، ولا يحكم على الحركات وأحكام التجويد، وقد يخطئ في السماع؛ فالمعلّم هو الحَكَم.'}</p>`;
  paintTjSum(s);
  $('#tsSetup').hidden = true; $('#tsSum').hidden = false; $('#tsmTitle').textContent = 'نتيجة التسميع';
  showPanel('pTsm');
  $$('#tsSum .g').forEach(g => loadFont(+g.dataset.pg).catch(() => {}));
}
function paintTjSum(s) {
  const box = $('#tsTjSec'); if (!box) return;
  if (s.tjSeen == null && !tjCount(s)) { box.innerHTML = ''; return; }
  const groups = new Map();
  [...(s.tj || [])].sort((a, b) => a[0] - b[0]).forEach(([p, L]) => { const k = ayOfPos(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([p, L]); });
  const items = [...groups].map(([k, L]) => {
    const a = ay(k);
    const ws = L.map(([p, R]) => {
      const id = EXPW[p], pg = D.wPage[id];
      return `<span class="tsw tj"><span class="g" style="font-family:${fam(pg)}" data-pg="${pg}">${D.glyphs[id - 1]}</span><small>${R.map(r => esc(AR(r.text))).join('<br>')}</small></span>`;
    }).join('');
    return `<li><div class="tsref"><button data-goto="${k}">سورة ${sName(a.s)} — الآية ${AR(a.a)}</button><button class="aplay" data-listen="${k}"><svg><use href="#i-play"/></svg>استمع</button></div><div class="tsws">${ws}</div></li>`;
  }).join('');
  const c = s.stats();
  box.innerHTML = `<div class="tjsec"><h4 class="sh">ملاحظات التجويد <em class="beta">تجريبي</em></h4>
    <p class="tjcov">نظرتُ في تجويد ${AR(s.tjSeen || 0)} كلمة من ${AR(c.ok + c.fix)} قرأتها صحيحة؛ وأترك مواضع الوقف والابتداء ووصل الآيات، والمقاطع التي فيها تكرار أو سكتة أو خطأ.</p>
    ${items ? `<ol class="tslist">${items}</ol>` : `<p class="note">${s.tjSeen ? 'لم يظهر لي فيما نظرتُ فيه ما أنبّه عليه.' : 'لم يكتمل بعدُ مقطعٌ صالح للنظر في تجويده.'}</p>`}</div>`;
  $$('#tsTjSec .g').forEach(g => loadFont(+g.dataset.pg).catch(() => {}));
}
$('#tsSum').addEventListener('click', e => {
  const g = e.target.closest('[data-goto]'); if (g) { closePanels(); goAyah(+g.dataset.goto); return; }
  const l = e.target.closest('[data-listen]'); if (l) { closePanels(); listen(+l.dataset.listen); return; }
  if (e.target.closest('#tsAgain')) { const s = TS.hold; const k = s && s.marks.size ? ayOfPos(Math.min(...s.marks.keys())) : TS.setupK; closePanels(); setTimeout(() => tsStart(k), 60); return; }
  if (e.target.closest('#tsClearB')) { closePanels(); tsClear(); }
});
$('#aTsm').onclick = () => { const k = SEL; clearSel(); openSetup(k); };
$('#mTsm').onclick = () => openSetup();
$('#mTsm2').onclick = () => openSetup();

/* ---------- the self-test: both models hear al-Husary reciting al-Ikhlas, on this very device ---------- */
const askWorker = (w, map, msg) => new Promise((res, rej) => {
  const id = ++TJS.jobId, t = setTimeout(() => { map.delete(id); rej(new Error('timeout')); }, 120000);
  map.set(id, m => { clearTimeout(t); m.type === 'error' ? rej(new Error(m.message)) : res(m); });
  w.postMessage({ ...msg, id }, [msg.audio.buffer]);
});
async function probeAudio(s, a) {
  const u = eaURL(recOf('husary'), s, a);
  let res = null;
  try { res = await caches.match(u, { cacheName: ACACHE }); } catch (e) {}
  if (!res) { try { res = await fetch(u, { mode: 'cors' }); } catch (e) { throw new Error('cors'); } }
  if (!res.ok) throw new Error('http ' + res.status);
  const ab = await new OfflineAudioContext(1, 16000, 16000).decodeAudioData(await res.arrayBuffer());
  const x = new Float32Array(ab.length);
  for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] += d[i] / ab.numberOfChannels; }
  return x;
}
async function probe() {
  if (TS.on) return toast('أنهِ التسميع أولًا ثم افحص');
  const out = $('#tsProbeOut'), btn = $('#tsProbe'), say = h => (out.innerHTML = h);
  btn.disabled = true;
  try {
    const big = pickEngine() === 'ai';                   // the silent engine is tested alone; the big model only when chosen
    say('أجهّز المحرّك…');
    await Promise.all([getWords(), getIml()]); expBuild();
    if (big) await aiLoad((a, b) => say(b ? `أنزّل نموذج التسميع ${AR(Math.round(a / b * 100))}٪ — مرة واحدة فقط` : 'أجهّز المحرّك الدقيق…'));
    let tjErr = '';
    try { await getPH(); await tjLoad((a, b) => say(`أنزّل نموذج المحرّك الصوتي ${AR(Math.min(99, Math.round(a / b * 100)))}٪ — مرة واحدة فقط`)); } catch (e) { tjErr = String(e.message || e); if (!big) throw e; }
    const tjOk = !tjErr && TJS.ready, rows = [], falses = [];
    let wSum = 0, wOk = 0, secs = 0, wMs = 0, tMs = 0, perSum = 0;
    const n = D.surahs[111].ayat;
    for (let a = 1; a <= n; a++) {
      say(`أُسمِع النموذجين الآية ${AR(a)} من ${AR(n)}…`);
      const k = findAyah(112, a), A = ay(k), pcm = await probeAudio(112, a), sec = pcm.length / 16000;
      const nW = A.l - A.f; let good = 0, wms = 0;
      if (big) {
        const wr = await askWorker(TS.worker, TS.probe, { type: 'run', audio: pcm.slice() });
        const E = []; for (let i = A.f; i < A.l; i++) E.push(formsAt(EXPP[i]));
        const r = TZ.align(TZ.words(wr.text), E); good = new Set(r.ops.filter(o => o.t === 's' && o.s >= TZ.OK).map(o => o.e)).size; wms = wr.ms;
      }
      let tr = null;
      if (tjOk) {
        tr = await askWorker(TJS.worker, TJS.probe, { type: 'run', audio: pcm.slice(), riwaya: 0 });
        if (!big) { const W = []; for (let i = 0; i < nW; i++) W.push(phSkel(EXPP[A.f] + i)); good = TJ.follow(TJ.skel(tr.ph), W, 0).R.filter(x => TJ.judge(x) === 'ok').length; }
      }
      wSum += nW; wOk += good; secs += sec; wMs += wms;
      const row = { a, words: `${AR(good)}/${AR(nW)}`, wcls: good === nW ? 'good' : 'badv', ph: '—', rem: '—', t: wms / 1000 };
      if (tr) {
        const ref = tjAyah(k), per = TJ.per(ref.ph, tr.ph), R = TJ.check(ref, tr, {});
        perSum += per; tMs += tr.ms;
        row.ph = `${AR(Math.max(0, Math.round((1 - per) * 100)))}٪`; row.pcls = per <= 0.08 ? 'good' : per <= 0.2 ? 'warn' : 'badv';
        row.rem = R.length ? AR(R.length) : 'لا شيء'; row.rcls = R.length ? 'warn' : 'good'; row.t += tr.ms / 1000;
        R.forEach(x => falses.push(`الآية ${AR(a)}: ${esc(AR(x.text))}`));
      }
      rows.push(row);
    }
    const f1 = x => AR(x.toFixed(1)).replace('.', '٫');
    const rtf = (wMs + tMs) / 1000 / secs;
    say(`<table><tr><th>الآية</th><th>الكلمات</th><th>الرسم الصوتي</th><th>ملاحظات</th><th>الزمن</th></tr>
      ${rows.map(r => `<tr><td>${AR(r.a)}</td><td class="${r.wcls}">${r.words}</td><td class="${r.pcls || ''}">${r.ph}</td><td class="${r.rcls || ''}">${r.rem}</td><td>${f1(r.t)} ث</td></tr>`).join('')}</table>
      <div>${wOk === wSum ? `<b class="good">✓</b> سمع ${big ? 'المحرّك الدقيق' : 'المحرّك الصوتي'} الكلمات كلها صحيحة.` : `<b class="badv">!</b> سمع ${big ? 'المحرّك الدقيق' : 'المحرّك الصوتي'} ${AR(wOk)} كلمة من ${AR(wSum)} صحيحة.`}</div>
      ${tjOk ? `<div>تطابق الرسم الصوتي في المتوسط ${AR(Math.round((1 - perSum / n) * 100))}٪. ${falses.length ? `<b class="warn">ظهرت ${AR(falses.length)} ملاحظة على تلاوة صحيحة، فقد يخطئ النموذج هنا:</b><br>${falses.join('<br>')}` : '<b class="good">✓</b> لم تظهر ملاحظة تجويد على تلاوة الحصري.'}</div>`
        : TSO.tj ? `<div class="warn">تعذّر تشغيل نموذج التجويد: ${esc(tjErr.slice(0, 80))}</div>` : '<div>ملاحظات التجويد متوقفة في الإعدادات.</div>'}
      <div>السرعة: نحو ${f1(rtf)} ثانية عمل لكل ثانية تلاوة ${rtf <= 0.6 ? '<b class="good">— جيدة</b>' : rtf <= 1.2 ? '<b class="warn">— مقبولة، تتأخر النتيجة قليلًا بعد الوقف</b>' : '<b class="badv">— بطيئة على هذا الجهاز</b>'} (${esc(TS.device || 'wasm')}).</div>`);
  } catch (e) {
    const m = String((e && e.message) || e);
    say(m === 'cors' || /^http/.test(m) ? 'تعذّر جلب تلاوة الفحص من EveryAyah. تحقق من الاتصال ثم أعد المحاولة.'
      : `<b class="badv">تعذّر الفحص.</b> ${esc(/ملفات ناقصة/.test(m) ? m : aiErrText(e))}<br><button class="btn ghost2" data-diag="1">افحص الميكروفون والتسميع</button>`);
  } finally { btn.disabled = false; }
}

/* ---------- «افحص الميكروفون والتسميع»: every link of the chain, tested on this device, with a report to send ---------- */
const NEED = ['index.html', 'sw.js', 'css/app.css', 'js/app.js', 'js/tafsir.js', 'js/audio.js', 'js/tasmee-core.js', 'js/tasmee.js', 'js/tasmee-worker.js',
  'js/tajweed-core.js', 'js/tajweed-worker.js', 'js/store.js', 'js/vendor/transformers-4.3.2.min.js', 'js/vendor/ort.wasm.bundle.min.mjs', 'js/vendor/ort-wasm-simd-threaded.wasm',
  'data/words.json', 'data/imlaei.json', 'data/ph-hafs.json', 'data/t/muyassar.json'];
function speechTest(SR, ms) {                          // started straight from the tap
  return new Promise(res => {
    const ev = [], t0 = performance.now(); let text = '', err = '', done = false, r;
    const log = n => ev.push(n);
    const fin = () => { if (done) return; done = true; clearTimeout(T); try { r && r.abort(); } catch (e) {} res({ ev, text, err }); };
    const T = setTimeout(fin, ms);
    try {
      r = new SR(); r.lang = 'ar-SA'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onstart = () => log('start'); r.onaudiostart = () => log('audio'); r.onspeechstart = () => log('speech');
      r.onresult = e => { log('result'); text = [...e.results].map(x => x[0].transcript).join(' '); if (e.results[e.results.length - 1].isFinal) fin(); };
      r.onerror = e => { log('error:' + e.error); err = e.error; };
      r.onend = () => { log('end'); fin(); };
      r.start();
    } catch (e) { err = 'start-' + (e.name || 'error'); fin(); }
    void t0;
  });
}
async function micLevel(ms, onLvl) {
  const st = await askMic(); let ctx;
  try {
    ctx = new AudioContext(); try { await ctx.resume(); } catch (e) {}
    const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(st).connect(an);
    const buf = new Float32Array(an.fftSize); let peak = 0; const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      await new Promise(r => setTimeout(r, 60)); an.getFloatTimeDomainData(buf);
      let e = 0; for (const v of buf) e += v * v; const rms = Math.sqrt(e / buf.length); peak = Math.max(peak, rms); onLvl && onLvl(rms);
    }
    return { peak, rate: ctx.sampleRate, state: ctx.state, label: (st.getAudioTracks()[0] || {}).label || '' };
  } finally { st.getTracks().forEach(t => t.stop()); try { ctx && ctx.close(); } catch (e) {} }
}
async function reach(url, ms = 12000) {                // can this device read from that server?
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms), t0 = performance.now();
  try { const r = await fetch(url, { mode: 'cors', cache: 'no-store', signal: ac.signal }); const d = Math.round(performance.now() - t0); clearTimeout(t); try { ac.abort(); } catch (e) {} return { ok: r.ok, st: r.status, ms: d }; }
  catch (e) {
    clearTimeout(t);
    const ac2 = new AbortController(), t2 = setTimeout(() => ac2.abort(), ms);
    try { await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ac2.signal }); clearTimeout(t2); try { ac2.abort(); } catch (x) {} return { ok: false, cors: true }; }
    catch (e2) { clearTimeout(t2); return { ok: false, down: true, why: e.name === 'AbortError' ? 'timeout' : e.name }; }
  }
}
async function runDiag() {
  const box = $('#tsDiagOut'), btn = $('#tsDiag'); if (TS.on) return toast('أنهِ التسميع أولًا ثم افحص');
  if (TS.diag) return; TS.diag = true; btn.disabled = true;
  $('#tsDiagRow').scrollIntoView({ block: 'start', behavior: 'smooth' });
  const rows = [], rep = [];
  const ICON = { 1: '✓', 0: '✗', 2: '!' }, CL = { 1: 'good', 0: 'badv', 2: 'warn' };
  const paint = (live = '') => {
    box.innerHTML = `<ul class="dg">${rows.map(r => `<li class="${CL[r.v]}"><b>${ICON[r.v]}</b><span><em>${r.k}</em>${esc(r.t)}</span></li>`).join('')}</ul>${live}`;
  };
  const add = (k, v, t, tech) => { rows.push({ k, v, t }); rep.push(`${ICON[v]} ${k}: ${t}${tech ? ' [' + tech + ']' : ''}`); paint(); };
  const ua = navigator.userAgent, std = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  rep.push('مصحف الشهباء ' + VERSION + ' — ' + new Date().toISOString().slice(0, 16), ua);
  // 1) the speech service, started in the tap itself
  const SR = SRC(); let srP = null;
  if (SR) srP = speechTest(SR, 9000);
  paint(`<p class="dglive"><b>قل الآن بصوت واضح: «بسم الله الرحمن الرحيم»</b></p>`);
  add('الجهاز والمتصفح', 1, `${/android/i.test(ua) ? 'أندرويد' : isIOS() ? 'آيفون/آيباد' : /windows/i.test(ua) ? 'ويندوز' : /mac/i.test(ua) ? 'ماك' : 'غير ذلك'} — ${/edg\//i.test(ua) ? 'إيدج' : /samsungbrowser/i.test(ua) ? 'متصفح سامسونج' : /firefox|fxios/i.test(ua) ? 'فايرفوكس' : /crios|chrome/i.test(ua) ? 'كروم' : /safari/i.test(ua) ? 'سفاري' : 'متصفح آخر'}${std ? '، مثبّت تطبيقًا' : ''}${navigator.onLine === false ? '، دون إنترنت' : ''}`);
  try {
    const sr = srP ? await srP : null;
    if (!SR) add('خدمة الكلام (المحرّك السريع)', 0, 'غير موجودة في هذا المتصفح؛ تعمل في كروم وسفاري. استعمل المحرّك الدقيق.');
    else {
      const E = sr.ev.join(','), has = x => sr.ev.includes(x);
      if (sr.text) add('خدمة الكلام (المحرّك السريع)', 1, `تعمل: سمعتُ «${sr.text.slice(0, 60)}»`, E);
      else if (sr.err === 'network') add('خدمة الكلام (المحرّك السريع)', 0, 'لا تصل إلى خدمة جوجل للكلام: الإنترنت ضعيف، أو الخدمة محجوبة في بلدك. استعمل المحرّك الدقيق.', E);
      else if (sr.err === 'not-allowed') add('خدمة الكلام (المحرّك السريع)', 0, micHelp('رُفض إذن الميكروفون.'), E);
      else if (sr.err === 'service-not-allowed') add('خدمة الكلام (المحرّك السريع)', 0, 'الخدمة غير متاحة في هذا الجهاز أو المتصفح (تحتاج خدمات جوجل أو تطبيق Google). استعمل المحرّك الدقيق.', E);
      else if (sr.err === 'no-speech') add('خدمة الكلام (المحرّك السريع)', 2, has('audio') ? 'فتحت الخدمة الميكروفون ولم تسمع كلامًا. أعد الفحص وتكلّم بصوت أوضح.' : 'لم تسمع الخدمة شيئًا.', E);
      else if (sr.err === 'audio-capture') add('خدمة الكلام (المحرّك السريع)', 0, 'لم تستطع الخدمة فتح الميكروفون (قد يكون مشغولًا بتطبيق آخر).', E);
      else if (sr.err === 'language-not-supported') add('خدمة الكلام (المحرّك السريع)', 0, 'لا تدعم العربية في هذا المتصفح.', E);
      else if (!sr.ev.length || sr.err.startsWith('start-')) add('خدمة الكلام (المحرّك السريع)', 0, 'لم تبدأ إطلاقًا. هذا يحدث في الأجهزة التي لا تحوي خدمات جوجل، أو إذا كانت محجوبة. استعمل المحرّك الدقيق.', E || sr.err);
      else add('خدمة الكلام (المحرّك السريع)', 2, has('speech') ? 'سمعت صوتًا ولم تُرجع كلمات: قد تكون خدمة جوجل محجوبة أو بطيئة.' : 'بدأت ولم تُرجع شيئًا خلال ٩ ثوانٍ.', E + (sr.err ? ',' + sr.err : ''));
    }
    // 2) the microphone itself, with a level meter
    let perm = '';
    try { perm = (await navigator.permissions.query({ name: 'microphone' })).state; } catch (e) {}
    paint('<p class="dglive">أختبر الميكروفون… تكلّم ثلاث ثوانٍ</p><div class="prog dgm"><i></i></div>');
    try {
      const m = await micLevel(3000, l => { const i = $('#tsDiagOut .dgm i'); if (i) i.style.width = Math.min(100, l * 900) + '%'; });
      add('الميكروفون', m.peak > 0.015 ? 1 : 2, m.peak > 0.015 ? `يعمل وسمعتُ صوتك (أعلى مستوى ${AR(Math.round(m.peak * 100))}٪)` : 'يعمل، لكن لم أسمع صوتًا يُذكر. قرّب الجوال من فمك، أو تأكد أن الميكروفون غير مكتوم.', `perm=${perm} rate=${m.rate} ctx=${m.state} ${m.label}`.trim());
    } catch (e) { add('الميكروفون', 0, micErrText(e), `perm=${perm} ${e.name || ''}`); }
    // 3) the site's own files
    paint('<p class="dglive">أتأكد من ملفات الموقع…</p>');
    const miss = await missingOf(NEED);
    add('ملفات الموقع', miss.length ? 0 : 1, miss.length ? MISSING(miss) : `كلها موجودة (${AR(NEED.length)} ملفًا)`);
    // 4) the servers the engines and recitations come from
    paint('<p class="dglive">أتأكد من الوصول إلى خوادم النماذج والتلاوات…</p>');
    const T = [
      ['huggingface.co (نموذج التسميع الدقيق)', `https://huggingface.co/${TSM_MODEL.id}/resolve/${TSM_MODEL.rev}/config.json`],
      ['huggingface.co (نموذج التجويد)', 'https://huggingface.co/HisnLabs/tajweed-v2/resolve/b3b0503d32b4d9a8a0447880b4564fd3e9d69c15/config.json'],
      ['cdn.jsdelivr.net (مكتبة المحرّك الدقيق)', 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm'],
      ['everyayah.com (التلاوات وحفظها)', eaURL(recOf('husary'), 1, 1)],
      ['mp3quran.net (توقيت السور الكاملة)', `${MQT}?surah=1&read=80`],
    ];
    const RS = await Promise.all(T.map(([, u]) => reach(u)));
    RS.forEach((r, i) => add(T[i][0], r.ok ? 1 : 0, r.ok ? `متاح (${AR(r.ms)} مللي ثانية)` : r.cors ? 'الخادم موجود لكنه لا يسمح للموقع بالقراءة منه' : r.why === 'timeout' ? 'لم يردّ خلال ١٢ ثانية: الاتصال ضعيف أو الموقع محجوب' : 'لا يصل: الموقع محجوب أو لا إنترنت', r.ok ? r.st : r.cors ? 'cors' : r.why));
    // 5) what this browser can do, and what is already saved
    const [mc, tc] = await Promise.all([modelCached(), tjCached()]);
    let est = null; try { est = await navigator.storage.estimate(); } catch (e) {}
    const feats = [typeof WebAssembly === 'object' ? 'wasm' : 'no-wasm', 'AudioWorkletNode' in window ? 'worklet' : 'no-worklet', navigator.gpu ? 'webgpu' : 'no-webgpu', 'cores=' + (navigator.hardwareConcurrency || '?'), 'mem=' + (navigator.deviceMemory || '?'), self.crossOriginIsolated ? 'isolated' : 'not-isolated', isSecureContext ? 'https' : 'insecure'];
    add('قدرات المتصفح للمحرّك الدقيق', hasAI() ? 1 : 0, hasAI() ? 'متوفرة' : 'ناقصة: افتح المصحف في كروم أو سفاري حديث', feats.join(' '));
    add('النماذج في الجهاز', mc || tc ? 1 : 2, `${mc ? 'نموذج التسميع محفوظ' : 'نموذج التسميع غير محفوظ'}، ${tc ? 'ونموذج التجويد محفوظ' : 'ونموذج التجويد غير محفوظ'}${est ? `، ويستعمل المصحف ${AR(Math.round((est.usage || 0) / 1e6))} ميغا من ${AR(Math.round((est.quota || 0) / 1e6))}` : ''}`);
    // the verdict
    const bad = rows.filter(r => r.v === 0).map(r => r.k);
    const hf = RS[0].ok, sw = rows.find(r => r.k.startsWith('خدمة الكلام'));
    const tip = miss.length ? 'السبب: ملفات ناقصة في الموقع؛ ارفعها ثم أعد الفحص.'
      : sw && sw.v === 1 ? 'المحرّك السريع يعمل على هذا الجهاز.'
      : hf ? 'المحرّك السريع لا يعمل هنا، فاستعمل المحرّك الدقيق.'
      : 'لا المحرّك السريع ولا تنزيل المحرّك الدقيق يعملان من هذا الاتصال؛ أرسل هذا التقرير لنجد الحل.';
    rep.push('— ' + tip);
    const text = rep.join('\n');
    box.insertAdjacentHTML('beforeend', `<p class="dgtip"><b>${esc(tip)}</b></p><div class="row"><button class="btn" id="dgCopy">انسخ التقرير</button>${navigator.share ? '<button class="btn ghost2" id="dgShare">أرسل التقرير</button>' : ''}</div>`);
    $('#dgCopy').onclick = () => copyText(text);
    if ($('#dgShare')) $('#dgShare').onclick = () => navigator.share({ title: 'تقرير فحص التسميع', text }).catch(() => {});
    void bad;
  } catch (e) {
    box.insertAdjacentHTML('beforeend', `<p class="badv">توقف الفحص: ${esc(String(e && e.message || e).slice(0, 100))}</p>`);
  } finally { TS.diag = false; btn.disabled = false; }
}
$('#tsDiag').onclick = () => runDiag();
$('#tsProbeOut').addEventListener('click', e => { if (e.target.closest('[data-diag]')) runDiag(); });
