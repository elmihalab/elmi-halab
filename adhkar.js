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
  var INITIAL_HASH = (location.hash || '').replace('#', '');
  var $ = function (id) { return document.getElementById(id); };
  var REGION_KEY = 'elmi_prayer_region';
  var DIG = '٠١٢٣٤٥٦٧٨٩';
  function ar(n) { return String(n).replace(/\d/g, function (d) { return DIG[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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
    return 'تُقال بعد السلام من الصلاة المكتوبة.';
  }

  /* ---------- بناء القائمة ---------- */
  var tab = 'sabah', mode = 'main', list = [], st = null;
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
  function buildList() {
    var g = D.groups[tab];
    if (mode === 'extra') return expand(g.extra || []);
    var items = expand(g.items);
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

  function quranHTML(q) {
    return q.map(function (s) {
      var verses = s[1].map(function (v, i) { return v + ' <span class="aya-n">﴿' + ar(s[2] + i) + '﴾</span>'; }).join(' ');
      return '<div class="ad-sura"><span class="ad-sura-name">' + esc(s[0]) + '</span>' +
        (s[2] === 1 ? '<p class="ad-basmala">' + D.BASMALA + '</p>' : '') +
        '<p class="ad-quran">' + verses + '</p></div>';
    }).join('');
  }

  function render() {
    var allDone = list.length && doneCount() === list.length;
    $('adDone').hidden = !allDone;
    $('adStage').hidden = allDone;
    $('adHeadTitle').textContent = mode === 'extra' ? 'أذكار أخرى واردة' : D.groups[tab].title;
    $('adWhen').textContent = mode === 'extra' ? 'ما ورد في هذا الباب زيادةً على الأذكار الأساسية.' : whenText(tab);
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
    $('adSrc').innerHTML = '<b>' + esc(it.src || '') + '</b>' + (it.note ? '<span>' + esc(it.note) + '</span>' : '');
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
    var hasExtra = mode === 'main' && g.extra && g.extra.length;
    $('adDoneTitle').textContent = mode === 'extra' ? 'أتممت الأذكار الأخرى' : 'أتممت ' + g.title;
    $('adDoneExtra').hidden = !hasExtra;
    if (hasExtra) $('adDoneExtra').textContent = 'أذكار أخرى واردة (' + ar(g.extra.length) + ')';
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

  function setTab(t, m) {
    tab = t; mode = m || 'main';
    list = buildList(); loadState(); render();
    if (history.replaceState) history.replaceState(null, '', '#' + t);
  }

  /* ---------- قائمة الأذكار ---------- */
  function openList() {
    $('adListBody').innerHTML = list.map(function (it, i) {
      var c = st.c[it.id] || 0, ok = c >= it.count;
      var label = it.title || (it.text || '').split(/[،؛]/)[0];
      return '<button type="button" class="ad-li' + (ok ? ' ok' : '') + (i === st.i ? ' cur' : '') + '" data-i="' + i + '">' +
        '<span class="ad-li-n">' + (ok ? '✓' : ar(i + 1)) + '</span><span class="ad-li-t">' + esc(label) + '</span>' +
        '<span class="ad-li-c">' + ar(Math.min(c, it.count)) + '/' + ar(it.count) + '</span></button>';
    }).join('');
    var d = $('adListSheet'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closeList() { var d = $('adListSheet'); if (d.close) d.close(); else d.removeAttribute('open'); }

  /* ---------- حجم الخط ---------- */
  var size = parseFloat(load('adhkar:size')) || 1;
  function applySize() { document.documentElement.style.setProperty('--ad-scale', size); }

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
    document.querySelectorAll('.ad-tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
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
    $('adBigger').addEventListener('click', function () { size = Math.min(1.6, +(size + 0.1).toFixed(2)); save('adhkar:size', size); applySize(); });
    $('adSmaller').addEventListener('click', function () { size = Math.max(0.8, +(size - 0.1).toFixed(2)); save('adhkar:size', size); applySize(); });
    $('adTasbih').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b || b.dataset.v === variant) return;
      variant = b.dataset.v; save('adhkar:tasbih', variant);
      paintVariants(); setTab('salah');
    });
    window.addEventListener('hashchange', function () { var h = location.hash.replace('#', ''); if (D.groups[h] && h !== tab) setTab(h); });
    paintVariants();
  }
  function paintVariants() {
    $('adTasbih').innerHTML = '<span>صيغة التسبيح:</span>' + Object.keys(D.TASBIH).map(function (k) {
      return '<button type="button" data-v="' + k + '" class="' + (k === variant ? 'on' : '') + '">' + esc(D.TASBIH[k].label) + '</button>';
    }).join('');
  }

  init();
  setTab(autoTab());                      // يعمل فورًا بلا مواقيت
  loadTimes().then(function (m) {         // ثم يحسّن التبويب والتنبيه بالمواقيت
    if (!m) return;
    MINS = m;
    var hadHash = D.groups[INITIAL_HASH];
    var anyProgress = st && Object.keys(st.c).length;
    if (!hadHash && !anyProgress) setTab(autoTab()); else render();
    setInterval(function () { if (!$('adStage').hidden || !$('adDone').hidden) $('adWhen').textContent = mode === 'extra' ? $('adWhen').textContent : whenText(tab); }, 30000);
  });
})();
