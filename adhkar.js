/* ============================================================
   صفحة الأذكار — العدّاد
   شعبة الشؤون العلمية في حلب
   ------------------------------------------------------------
   ذكر واحد في الشاشة؛ الضغط على البطاقة أو الدائرة يعدّ، وعند
   تمام العدد ينتقل إلى التالي. يُحفظ ما أُتمّ اليوم على الجهاز.
   ويختار التبويب المناسب للوقت من مواقيت الصلاة (times/).
   ============================================================ */
(function () {
  'use strict';

  var D = window.ADHKAR;
  var VQ = (function () { var s = document.currentScript && document.currentScript.src || ''; var i = s.indexOf('?'); return i > 0 ? s.slice(i) : ''; })();
  var INITIAL_HASH = (location.hash || '').replace('#', '');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  var $ = function (id) { return document.getElementById(id); };
  var REGION_KEY = 'elmi_prayer_region';
  var DIG = '٠١٢٣٤٥٦٧٨٩';
  function ar(n) { return String(n).replace(/\d/g, function (d) { return DIG[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // «لا» المشكولة (لَا، لًا، لِأ…) لا يضبطها خط الموقع (قمرة وتجوّل)، فيظهر الألف منفصلًا.
  // فنصوص المصدر والفضل وأقوال العلماء تُكتب بخط الأذكار النسخي دائمًا (في style.css)،
  // وما سواها من العناوين والأوقات يُنقل إليه وحده إن كان فيه «لا» مشكولة.
  var LA = /ل[ً-ْٰ]+[آأإا]/;
  var LA_SEL = '#adHeadTitle, #adWhen, #adTitle, .ax-tile b, .ax-time, .ax-grp, .ax-who, .ad-src > b';
  function fixLA() {
    Array.prototype.forEach.call(document.querySelectorAll(LA_SEL), function (el) { el.classList.toggle('lf', LA.test(el.textContent)); });
  }
  (function () {
    var pend = false;
    fixLA();
    if (window.MutationObserver) new MutationObserver(function () {
      if (pend) return; pend = true;
      (window.requestAnimationFrame || setTimeout)(function () { pend = false; fixLA(); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function syNow() { return new Date(Date.now() + 3 * 3600000); } // توقيت سورية
  function nowMin() { var n = syNow(); return n.getUTCHours() * 60 + n.getUTCMinutes(); }
  function dateKey() { var n = syNow(); return n.getUTCFullYear() + '-' + (n.getUTCMonth() + 1) + '-' + n.getUTCDate(); }

  /* ---------- مواقيت اليوم (اختيارية: إن تعذّرت يعمل العدّاد بلا تنبيهات الوقت) ---------- */
  var MINS = null; // [فجر، شروق، ظهر، عصر، مغرب، عشاء] بالدقائق
  function loadTimes() {
    var rid = parseInt(load(REGION_KEY), 10); if (isNaN(rid)) rid = 35;
    return fetch('times/index.json').then(function (r) { return r.json(); }).then(function (idx) {
      var reg = null;
      idx.regions.forEach(function (x) { if (x[0] === rid) reg = x; });
      if (!reg) reg = idx.regions.filter(function (x) { return x[0] === 35; })[0];
      return fetch('times/g' + reg[1] + '.json').then(function (r) { return r.json(); }).then(function (g) {
        var s = idx.start.split('-').map(Number), n = syNow();
        var i = Math.round((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(s[0], s[1] - 1, s[2])) / 86400000);
        var rec = g[String(reg[0])];
        if (!rec || i < 0 || i >= idx.days) return null;
        var t = rec.t.substr(i * 24, 24), m = [];
        for (var k = 0; k < 6; k++) m.push(+t.substr(k * 4, 2) * 60 + +t.substr(k * 4 + 2, 2));
        return m;
      });
    }).catch(function () { return null; });
  }

  function autoTab() {
    var h = (location.hash || '').replace('#', '');
    if (D.groups[h]) return h;
    var m = nowMin();
    if (MINS) {
      if (m >= MINS[0] && m < MINS[2]) return 'sabah';
      if (m >= MINS[3] && m < MINS[5]) return 'masa';
      return 'salah';
    }
    var hr = Math.floor(m / 60);
    return hr >= 4 && hr < 12 ? 'sabah' : (hr >= 15 && hr < 20 ? 'masa' : 'salah');
  }

  // آخر صلاة دخل وقتها، لتتجدد أذكار ما بعد الصلاة مع كل صلاة
  function prayerSlot() {
    var m = nowMin();
    if (!MINS) return 'h' + Math.floor(m / 60);
    var p = [0, 2, 3, 4, 5], slot = 'isha-prev';
    p.forEach(function (k) { if (m >= MINS[k]) slot = 'p' + k; });
    return slot;
  }

  function fmtLeft(min) {
    if (min < 60) return ar(min) + ' دقيقة';
    return ar(Math.floor(min / 60)) + ' س ' + ar(min % 60) + ' د';
  }
  function whenText(tab) {
    var m = nowMin();
    if (tab === 'sabah') {
      var base = 'وقتها من طلوع الفجر إلى طلوع الشمس، ويمتد إلى الظهر.';
      if (!MINS) return base;
      if (m >= MINS[0] && m < MINS[1]) return 'الوقت الأفضل الآن: بقي على الشروق ' + fmtLeft(MINS[1] - m) + '.';
      if (m >= MINS[1] && m < MINS[2]) return 'طلعت الشمس، ويبقى وقتها إلى الظهر (بعد ' + fmtLeft(MINS[2] - m) + ').';
      return base;
    }
    if (tab === 'masa') {
      var b2 = 'وقتها من بعد العصر إلى غروب الشمس.';
      if (!MINS) return b2;
      if (m >= MINS[3] && m < MINS[4]) return 'الوقت الأفضل الآن: بقي على المغرب ' + fmtLeft(MINS[4] - m) + '.';
      if (m >= MINS[4]) return 'غربت الشمس؛ وفي آخر القائمة ما يُقال بعد الغروب.';
      return b2;
    }
    var sl = MINS ? prayerSlot() : '';
    if (sl === 'p0') return 'تُقال بعد السلام من الصلاة المكتوبة، وفي آخرها ما يختص بصلاة الفجر.';
    if (sl === 'p4') return 'تُقال بعد السلام من الصلاة المكتوبة، وفي «المختلف في ثبوته» ما يختص بالمغرب.';
    return 'تُقال بعد السلام من الصلاة المكتوبة.';
  }

  /* ---------- بناء القائمة ---------- */
  var tab = 'sabah', mode = 'main', list = [], st = null;
  var peek = false; // فُتح ذكرٌ بعينه من البحث: يُعرض وإن اكتمل الباب
  var variant = load('adhkar:tasbih') || 'a';
  if (!D.TASBIH[variant]) variant = 'a';

  function expand(items) {
    var out = [];
    items.forEach(function (it) {
      if (it.type === 'tasbih') {
        var v = D.TASBIH[variant];
        v.steps.forEach(function (s, i) {
          out.push({ id: 'tasbih-' + variant + '-' + i, text: s[0], count: s[1], src: v.src, note: v.note, title: 'التسبيح بعد الصلاة', tasbih: true });
        });
      } else out.push(it);
    });
    return out;
  }
  // ما قُيِّد بصلوات بعينها (الفجر p0، المغرب p4) لا يظهر إلا بعدها
  function forSlot(items) {
    var sl = MINS ? prayerSlot() : '';
    return (items || []).filter(function (it) { return !it.only || it.only.indexOf(sl) >= 0; });
  }
  function extraOf(g) { return forSlot(g.extra); }
  function buildList() {
    var g = D.groups[tab];
    if (mode === 'extra') return expand(extraOf(g));
    var items = expand(forSlot(g.items));
    if (g.night) items = items.concat(g.night.map(function (x) { var y = Object.assign({}, x); y.badge = 'بعد غروب الشمس'; return y; }));
    return items;
  }
  function stKey() { return 'adhkar:' + tab + ':' + mode + ':' + dateKey() + (tab === 'salah' ? ':' + prayerSlot() : ''); }
  function loadState() {
    try { st = JSON.parse(load(stKey())) || null; } catch (e) { st = null; }
    if (!st || typeof st !== 'object') st = { i: 0, c: {} };
    if (st.i >= list.length) st.i = list.length - 1;
  }
  function saveState() { save(stKey(), JSON.stringify(st)); }
  function done(it) { return (st.c[it.id] || 0) >= it.count; }
  function doneCount() { return list.filter(done).length; }

  /* ---------- العرض ---------- */
  var R = 52, CIRC = 2 * Math.PI * R;

  var EXTRA_WHEN = 'أذكار اختلف أهل العلم في ثبوتها؛ جُعلت هنا على حدة، وتحت «المصدر» أقوال العلماء فيها.';
  // أقوال العلماء في المختلف في ثبوته: [القائل، المصدر، العبارة]
  function verdHTML(v) {
    if (!v || !v.length) return '';
    return '<div class="ad-verd"><i>أقوال العلماء في ثبوته</i><ul>' + v.map(function (x) {
      return '<li><b>' + esc(x[0]) + '</b>' + (x[1] ? ' <small>(' + esc(x[1]) + ')</small>' : '') + (x[2] ? ': «' + esc(x[2]) + '»' : '') + '</li>';
    }).join('') + '</ul></div>';
  }

  function quranHTML(q) {
    return q.map(function (s) {
      var verses = s[1].map(function (v, i) { return v + ' <span class="aya-n">﴿' + ar(s[2] + i) + '﴾</span>'; }).join(' ');
      return '<div class="ad-sura"><span class="ad-sura-name">' + esc(s[0]) + '</span>' +
        (s[2] === 1 ? '<p class="ad-basmala">' + D.BASMALA + '</p>' : '') +
        '<p class="ad-quran">' + verses + '</p></div>';
    }).join('');
  }

  function render() {
    view = 'counter'; $('adAll').hidden = true; $('adProg').hidden = false;
    var allDone = list.length && doneCount() === list.length && !peek;
    $('adDone').hidden = !allDone;
    $('adStage').hidden = allDone;
    $('adHeadTitle').textContent = mode === 'extra' ? 'المختلف في ثبوته' : D.groups[tab].title;
    $('adWhen').textContent = mode === 'extra' ? EXTRA_WHEN : whenText(tab);
    Array.prototype.forEach.call(document.querySelectorAll('.ad-tab'), function (b) {
      var on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var dc = doneCount();
    $('adBar').style.width = (list.length ? dc / list.length * 100 : 0) + '%';
    if (allDone) { renderDone(); return; }

    var it = list[st.i];
    var c = st.c[it.id] || 0;
    $('adStep').textContent = ar(st.i + 1) + ' من ' + ar(list.length);
    $('adTitle').innerHTML = (it.badge ? '<span class="ad-badge">' + esc(it.badge) + '</span>' : '') + (it.title ? esc(it.title) : '');
    $('adTitle').hidden = !(it.title || it.badge);
    $('adText').innerHTML = it.quran ? quranHTML(it.quran) : '<p>' + esc(it.text) + '</p>';
    var notes = it.note ? [].concat(it.note) : [];
    $('adSrc').innerHTML = '<b>' + esc(it.src || '') + '</b>' + notes.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + verdHTML(it.v);
    $('adSrcBtn').textContent = it.v ? 'المصدر وأقوال العلماء' : 'المصدر والفضل';
    $('adSrc').hidden = true; $('adSrcBtn').setAttribute('aria-expanded', 'false');
    $('adTasbih').hidden = !it.tasbih;

    var left = Math.max(0, it.count - c);
    $('adLeft').textContent = ar(left);
    $('adOf').textContent = it.count > 1 ? 'من ' + ar(it.count) : (left ? 'مرة' : 'تمّ');
    $('adRingFg').style.strokeDashoffset = (CIRC * (1 - Math.min(1, c / it.count))).toFixed(2);
    $('adRing').classList.toggle('full', left === 0);
    $('adCard').classList.toggle('is-done', left === 0);
    $('adPrev').disabled = st.i === 0;
    $('adNext').disabled = st.i >= list.length - 1;
  }

  function renderDone() {
    var g = D.groups[tab];
    var ex = extraOf(g), hasExtra = mode === 'main' && ex.length;
    $('adDoneTitle').textContent = mode === 'extra' ? 'أتممت المختلف في ثبوته' : 'أتممت ' + g.title;
    $('adDoneExtra').hidden = !hasExtra;
    if (hasExtra) $('adDoneExtra').textContent = 'المختلف في ثبوته (' + ar(ex.length) + ')';
    $('adDoneBack').hidden = mode !== 'extra';
  }

  var busy = false;
  function tap() {
    if (busy || $('adStage').hidden) return;
    var it = list[st.i];
    var c = st.c[it.id] || 0;
    if (c >= it.count) { next(); return; }
    st.c[it.id] = c + 1;
    saveState();
    var ring = $('adRing'); ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse');
    render();
    if (c + 1 >= it.count) {
      if (navigator.vibrate) { try { navigator.vibrate([25, 40, 25]); } catch (e) { } }
      busy = true;
      setTimeout(function () {
        busy = false;
        // ينتقل إلى أول ذكر لم يكتمل بعد هذا
        for (var k = st.i + 1; k < list.length; k++) { if (!done(list[k])) { st.i = k; saveState(); render(); return; } }
        for (k = 0; k < list.length; k++) { if (!done(list[k])) { st.i = k; saveState(); render(); return; } }
        render();
      }, 500);
    }
  }
  function next() { if (st.i < list.length - 1) { st.i++; saveState(); render(); } }
  function prev() { if (st.i > 0) { st.i--; saveState(); render(); } }

  /* ---------- الروابط المباشرة (من البحث): #sabah/<id>  و  #all/<باب>/<رقم> ---------- */
  function parseHash(h) {
    var p = decodeURIComponent(String(h || '').replace(/^#/, '')).split('/');
    return { tab: p[0] || '', a: p[1] || '', b: p[2] || '' };
  }
  function goItem(t, id) {
    var g = D.groups[t]; if (!g) return;
    var inExtra = (g.extra || []).some(function (x) { return x.id === id; });
    setTab(t, inExtra ? 'extra' : 'main');
    var k = -1;
    list.forEach(function (it, i) { if (k < 0 && (it.id === id || (id === 'tasbih' && it.tasbih))) k = i; });
    if (k >= 0) { st.i = k; peek = true; saveState(); render(); }
    window.scrollTo(0, 0);
  }
  function go(h) {
    var P = parseHash(h);
    if (P.tab === 'all') { openAll(P.a, P.b); return; }
    if (!D.groups[P.tab]) return;
    if (P.a) goItem(P.tab, P.a); else { setTab(P.tab); window.scrollTo(0, 0); }
  }
  window.adhkarGo = go; // يستعمله البحث (search.js)

  function setTab(t, m) {
    if (t !== tab || (m || 'main') !== mode) peek = false;
    tab = t; mode = m || 'main';
    list = buildList(); loadState(); render();
    if (history.replaceState) history.replaceState(null, '', '#' + t);
  }

  /* ---------- قائمة الأذكار ---------- */
  function openList() {
    $('adListBody').innerHTML = list.map(function (it, i) {
      var c = st.c[it.id] || 0, ok = c >= it.count;
      var label = it.label || it.title || (it.text || '').split(/[،؛]/)[0];
      return '<button type="button" class="ad-li' + (ok ? ' ok' : '') + (i === st.i ? ' cur' : '') + '" data-i="' + i + '">' +
        '<span class="ad-li-n">' + (ok ? '✓' : ar(i + 1)) + '</span><span class="ad-li-t">' + esc(label) + '</span>' +
        '<span class="ad-li-c">' + ar(Math.min(c, it.count)) + '/' + ar(it.count) + '</span></button>';
    }).join('');
    var d = $('adListSheet'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closeList() { var d = $('adListSheet'); if (d.close) d.close(); else d.removeAttribute('open'); }

  /* ---------- حجم الخط ---------- */
  var SIZE_MIN = 0.8, SIZE_MAX = 1.6;
  var size = parseFloat(load('adhkar:size')) || 1;
  size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, size));
  function applySize() {
    // على body لا على html: لأن .adhkar-page (وهي body) تعرّف المتغير، فكان يحجب القيمة الموروثة
    document.body.style.setProperty('--ad-scale', size);
    document.querySelectorAll('[data-size]').forEach(function (b) {
      var off = (b.dataset.size === '1' && size >= SIZE_MAX - 0.001) || (b.dataset.size === '-1' && size <= SIZE_MIN + 0.001);
      b.classList.toggle('is-off', off); b.setAttribute('aria-disabled', off ? 'true' : 'false');
    });
  }
  function pct() { return ar(Math.round(size * 100)) + '٪'; }
  function changeSize(d) {
    if (d > 0 && size >= SIZE_MAX - 0.001) { toast('هذا أكبر حجم للخط (' + pct() + ')'); return; }
    if (d < 0 && size <= SIZE_MIN + 0.001) { toast('هذا أصغر حجم للخط (' + pct() + ')'); return; }
    size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +(size + d * 0.1).toFixed(2)));
    save('adhkar:size', size); applySize();
    toast('حجم الخط: ' + pct() + (size >= SIZE_MAX - 0.001 ? ' — أكبر حجم' : size <= SIZE_MIN + 0.001 ? ' — أصغر حجم' : ''));
  }
  function toast(msg, ms) {
    var t = $('adToast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, ms || 1800);
  }

  /* ---------- الربط ---------- */
  function init() {
    applySize();
    $('adCard').addEventListener('click', function (e) { if (e.target.closest('.ad-src-btn, .ad-src')) return; tap(); });
    $('adCard').addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } });
    $('adRing').addEventListener('click', tap);
    $('adNext').addEventListener('click', next);
    $('adPrev').addEventListener('click', prev);
    $('adSrcBtn').addEventListener('click', function () {
      var s = $('adSrc'); s.hidden = !s.hidden; this.setAttribute('aria-expanded', s.hidden ? 'false' : 'true');
    });
    document.querySelectorAll('.ad-tab').forEach(function (b) {
      b.addEventListener('click', function () { peek = false; if (b.dataset.tab === 'all') { if (view !== 'all') location.hash = 'all'; } else setTab(b.dataset.tab); });
    });
    $('adAll').addEventListener('click', onAllClick);
    $('adListBtn').addEventListener('click', openList);
    $('adListClose').addEventListener('click', closeList);
    $('adListSheet').addEventListener('click', function (e) { if (e.target === this) closeList(); });
    $('adListBody').addEventListener('click', function (e) {
      var b = e.target.closest('.ad-li'); if (!b) return;
      st.i = Number(b.dataset.i); saveState(); closeList(); render();
    });
    $('adReset').addEventListener('click', function () { st = { i: 0, c: {} }; saveState(); render(); });
    $('adRestart').addEventListener('click', function () { st = { i: 0, c: {} }; saveState(); render(); });
    $('adDoneExtra').addEventListener('click', function () { setTab(tab, 'extra'); });
    $('adDoneBack').addEventListener('click', function () { setTab(tab, 'main'); });
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-size]'); if (b) changeSize(Number(b.dataset.size)); });
    $('adTasbih').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b || b.dataset.v === variant) return;
      variant = b.dataset.v; save('adhkar:tasbih', variant);
      paintVariants(); setTab('salah');
    });
    window.addEventListener('hashchange', function () {
      var P = parseHash(location.hash);
      if (P.tab === 'all') { openAll(P.a, P.b); return; }
      if (!D.groups[P.tab]) return;
      if (P.a) goItem(P.tab, P.a);
      else if (P.tab !== tab || view !== 'counter') setTab(P.tab);
    });
    paintVariants();
  }
  function paintVariants() {
    $('adTasbih').innerHTML = '<span>صيغة التسبيح:</span>' + Object.keys(D.TASBIH).map(function (k) {
      return '<button type="button" data-v="' + k + '" class="' + (k === variant ? 'on' : '') + '">' + esc(D.TASBIH[k].label) + '</button>';
    }).join('');
  }

  /* ---------- كل الأذكار: فهرس الأبواب وقراءة كل باب ---------- */
  var view = 'counter', MORE = null, moreP = null;
  function loadMore() {
    if (MORE) return Promise.resolve(MORE);
    if (!moreP) moreP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'adhkar-more.js' + VQ;
      s.onload = function () { MORE = window.ADHKAR_MORE || null; if (MORE) res(MORE); else { moreP = null; rej(); } };
      s.onerror = function () { moreP = null; rej(); };
      document.head.appendChild(s);
    });
    return moreP;
  }
  function paintTabs(t) {
    Array.prototype.forEach.call(document.querySelectorAll('.ad-tab'), function (b) {
      var on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function howMany(n) { return n === 1 ? 'ذكر واحد' : n === 2 ? 'ذكران' : n <= 10 ? ar(n) + ' أذكار' : ar(n) + ' ذكرًا'; }
  function openAll(sec, focus) {
    view = 'all';
    $('adProg').hidden = true; $('adStage').hidden = true; $('adDone').hidden = true; $('adAll').hidden = false;
    paintTabs('all');
    if (!MORE) { $('adHeadTitle').textContent = 'كل الأذكار'; $('adWhen').textContent = 'جارٍ التحميل…'; $('adAll').innerHTML = ''; }
    loadMore().then(function () {
      if (view !== 'all') return;
      if (sec && MORE.sections[sec]) renderSec(sec, focus); else renderIndex();
    }).catch(function () {
      $('adWhen').textContent = '';
      $('adAll').innerHTML = '<p class="ax-err">تعذّر تحميل الأذكار. تحقّق من الاتصال ثم اضغط «كل الأذكار» مرة أخرى.</p>';
    });
  }
  function setHash(h) { if (location.hash !== '#' + h && history.replaceState) history.replaceState(null, '', '#' + h); }
  function renderIndex() {
    setHash('all');
    $('adHeadTitle').textContent = 'كل الأذكار';
    $('adWhen').textContent = 'كتاب «الأذكار الثابتة» كله: أذكار اليوم والليلة على أوقاتها، ثم بقية الكتب.';
    var lastBook = null;
    $('adAll').innerHTML = MORE.groups.map(function (g) {
      var head = '';
      if (g[2] && g[2] !== lastBook) { lastBook = g[2]; head = '<h2 class="ax-book">' + esc(g[2]) + '</h2>'; }
      var sub = g[0] && g[0] !== g[2] ? '<h3>' + esc(g[0]) + '</h3>' : '';
      return head + '<div class="ax-group">' + sub + '<div class="ax-grid">' + g[1].map(function (id) {
        if (id.charAt(0) === '@') {
          var k = id.slice(1), G = D.groups[k]; if (!G) return '';
          return '<button type="button" class="ax-tile is-counter" data-go="' + k + '"><b>' + esc(G.title) + '</b><small>بالعدّاد</small></button>';
        }
        var s = MORE.sections[id]; if (!s) return '';
        return '<button type="button" class="ax-tile' + (s.kicker === 'ملحق' ? ' is-annex' : '') + '" data-sec="' + id + '"><b>' + esc(s.title) + '</b><small>' + howMany(s.items.length + s.extra.length) + '</small></button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function cardHTML(it, k) {
    var body;
    if (it.quran) body = quranHTML([[it.quran[0], MORE.Q[it.quran[1]] || D.Q[it.quran[1]], it.quran[2]]]);
    else body = [].concat(it.text).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    var cnt = !it.count ? '' : it.n
      ? '<button type="button" class="ax-cnt" data-n="' + it.n + '" data-c="0" data-l="' + esc(it.count) + '">' + esc(it.count) + '</button>'
      : '<span class="ax-cnt is-text">' + esc(it.count) + '</span>';
    return '<article class="ax-card"' + (k ? ' data-k="' + k + '"' : '') + '>' + (it.who ? '<div class="ax-who">' + esc(it.who) + '</div>' : '') + (it.time ? '<div class="ax-time">' + esc(it.time) + '</div>' : '') +
      '<div class="ad-text ax-text">' + body + '</div>' +
      '<div class="ax-foot">' + cnt + '<button type="button" class="ad-src-btn ax-src-btn" aria-expanded="false">' + (it.v ? 'المصدر وأقوال العلماء' : 'المصدر والفضل') + '</button></div>' +
      '<div class="ad-src ax-src" hidden><b>' + esc(it.src || '') + '</b>' + (it.fadl ? '<span>' + esc(it.fadl) + '</span>' : '') + verdHTML(it.v) + '</div></article>';
  }
  function renderSec(id, focus) {
    var s = MORE.sections[id];
    setHash('all/' + id);
    $('adHeadTitle').textContent = s.title;
    $('adWhen').textContent = s.intro || '';
    $('adAll').innerHTML = '<div class="ax-bar"><button type="button" class="ax-back" data-back="1">كل الأذكار</button>' +
      '<div class="ax-size"><button class="ad-mini" type="button" data-size="-1" aria-label="تصغير الخط">أ−</button><button class="ad-mini" type="button" data-size="1" aria-label="تكبير الخط">أ+</button></div></div>' +
      s.items.map(function (it, i) {
        var h = it.grp && (i === 0 || s.items[i - 1].grp !== it.grp) ? '<h3 class="ax-grp">' + esc(it.grp) + '</h3>' : '';
        return h + cardHTML(it, 'i' + i);
      }).join('') +
      (s.extra.length ? '<details class="ax-more"><summary>المختلف في ثبوته (' + ar(s.extra.length) + ')</summary>' + s.extra.map(function (it, i) { return cardHTML(it, 'x' + i); }).join('') + '</details>' : '');
    applySize();
    window.scrollTo(0, 0);
    if (focus) {
      var el = $('adAll').querySelector('[data-k="' + (/^x/.test(focus) ? focus : 'i' + focus) + '"]');
      if (el) {
        var det = el.closest('details'); if (det) det.open = true;
        setTimeout(function () {
          el.scrollIntoView({ block: 'center' });
          el.classList.add('srch-flash'); setTimeout(function () { el.classList.remove('srch-flash'); }, 2600);
        }, 80);
      }
    }
  }
  function onAllClick(e) {
    var b;
    if ((b = e.target.closest('[data-sec]'))) { location.hash = 'all/' + b.dataset.sec; return; }
    if ((b = e.target.closest('[data-go]'))) { setTab(b.dataset.go); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-back]')) { location.hash = 'all'; return; }
    if ((b = e.target.closest('.ax-src-btn'))) {
      var src = b.closest('.ax-card').querySelector('.ax-src'); src.hidden = !src.hidden;
      b.setAttribute('aria-expanded', src.hidden ? 'false' : 'true'); return;
    }
    if ((b = e.target.closest('.ax-cnt[data-n]'))) {
      var n = +b.dataset.n, c = +b.dataset.c;
      c = c >= n ? 0 : c + 1; b.dataset.c = c;
      b.classList.toggle('full', c >= n);
      b.textContent = c === 0 ? b.dataset.l : c >= n ? '✓ ' + b.dataset.l : ar(c) + ' من ' + ar(n);
      if (c >= n && navigator.vibrate) { try { navigator.vibrate(30); } catch (er) { } }
    }
  }

  /* ---------- التثبيت والعمل دون إنترنت ---------- */
  function setupApp() {
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var box = $('adInstall'), deferred = null;
    function show() { if (box && !standalone) box.hidden = false; }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(); });
    window.addEventListener('appinstalled', function () { if (box) box.hidden = true; toast('ثُبّتت الأذكار على جهازك', 3000); });
    if (isIOS) show();
    if ($('adInstallBtn')) $('adInstallBtn').addEventListener('click', function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted' && box) box.hidden = true; deferred = null; });
      } else if ($('adIosSheet') && $('adIosSheet').showModal) $('adIosSheet').showModal();
    });
    if ($('adIosClose')) $('adIosClose').addEventListener('click', function () { $('adIosSheet').close(); });
    // عامل الخدمة: يحفظ الصفحة وبياناتها، ونطاقه صفحة الأذكار وحدها
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    var first = !navigator.serviceWorker.controller;
    navigator.serviceWorker.register('adhkar-sw.js', { scope: './adhkar' }).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      var key = 'adhkar:offline' + VQ;
      if (first && load(key) !== '1') { save(key, '1'); toast('حُفظت الأذكار على جهازك؛ وصارت تعمل دون إنترنت', 4200); }
    }).catch(function () { });
  }

  init();
  setupApp();
  var P0 = parseHash(INITIAL_HASH);
  if (P0.tab === 'all') { setTab(autoTab()); openAll(P0.a, P0.b); }
  else if (D.groups[P0.tab] && P0.a) goItem(P0.tab, P0.a);
  else setTab(autoTab());                 // يعمل فورًا بلا مواقيت
  loadTimes().then(function (m) {         // ثم يحسّن التبويب والتنبيه بالمواقيت
    if (!m) return;
    MINS = m;
    if (view !== 'all') {
      var hadHash = D.groups[P0.tab];
      var anyProgress = st && Object.keys(st.c).length;
      if (!hadHash && !anyProgress) setTab(autoTab());
      else if (tab === 'salah') setTab('salah', mode);
      else render();
    }
    setInterval(function () { if (!$('adStage').hidden || !$('adDone').hidden) $('adWhen').textContent = mode === 'extra' ? $('adWhen').textContent : whenText(tab); }, 30000);
  });
})();
