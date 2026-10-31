/* ============================================================
   شريط مواقيت الصلاة — شعبة الشؤون العلمية في حلب
   ------------------------------------------------------------
   المواقيت من تقويم وزارة الأوقاف الرسمي، منقولة من «أطلس سوريا
   للصلاة» إلى مجلد times في هذا الموقع:
     times/index.json  فهرس المناطق والتاريخ الهجري
     times/gN.json     مواقيت مناطق كل محافظة (٢٤ حرفًا لكل يوم)
   خارج مدة التقويم يُحسب الوقت فلكيًّا ويُعايَر بمعايرة المنطقة،
   بالمعادلات نفسها التي في الأطلس.
   ============================================================ */
(function () {
  'use strict';

  var ATLAS = 'https://syria-prayer-atlas.vercel.app/';
  var DEFAULT_REGION = 35; // حلب — المدينة
  var KEY = 'elmi_prayer_region';
  var NAMES = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  var HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

  var bar = document.getElementById('pbar');
  if (!bar) return;
  var $ = function (id) { return document.getElementById(id); };

  var IDX = null, GOV = {}, regionId = DEFAULT_REGION, today = null, timer = null;

  function ar(s) { return String(s).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  // الوقت في سورية (UTC+3 طوال العام) مهما كان بلد الزائر
  function syNow() { return new Date(Date.now() + 3 * 3600000); }
  function dayKey(d) { return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }

  function region(id) {
    for (var i = 0; i < IDX.regions.length; i++) if (IDX.regions[i][0] === id) return IDX.regions[i];
    return null;
  }
  function regionLabel(r) {
    var gov = IDX.govs[r[1]];
    return r[2] === 'المدينة' ? gov : r[2];
  }
  function regionLong(r) {
    var gov = IDX.govs[r[1]];
    return r[2] === 'المدينة' ? 'مدينة ' + gov : r[2];
  }

  function getJSON(url) {
    return fetch(url).then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); });
  }
  function ensureGov(g) {
    if (GOV[g]) return Promise.resolve(GOV[g]);
    return getJSON('times/g' + g + '.json').then(function (d) { GOV[g] = d; return d; });
  }

  /* ---------- الحساب الفلكي الاحتياطي (من prayer-calculator.js في الأطلس) ---------- */
  function calcTimes(lat, lon, d) {
    var y = d.getUTCFullYear();
    var doy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    var rad = Math.PI / 180;
    var b = ((360 / 365.24) * (doy - 81)) * rad;
    var eqt = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    var decl = (23.45 * rad) * Math.sin((360 / 365 * (doy + 284)) * rad);
    var la = lat * rad;
    var noon = 12 + 3 - lon / 15 - eqt / 60;
    function H(angle) {
      var v = (Math.sin(angle) - Math.sin(la) * Math.sin(decl)) / (Math.cos(la) * Math.cos(decl));
      return Math.acos(Math.max(-1, Math.min(1, v))) / rad / 15;
    }
    var sun = H(-0.833 * rad);
    var asrAlt = Math.PI / 2 - Math.atan(1 + Math.tan(Math.abs(la - decl)));
    return [noon - H(-19.5 * rad), noon - sun, noon, noon + H(asrAlt), noon + sun, noon + H(-17.5 * rad)]
      .map(function (h) { return Math.round(((h % 24) + 24) % 24 * 60); });
  }
  function hijriCalc(d) {
    var jd = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + 2440588;
    var l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    var m = Math.floor((24 * l) / 709);
    return [l - Math.floor((709 * m) / 24), m, 30 * n + j - 30];
  }

  // مواقيت يوم بالدقائق من منتصف الليل + التاريخ الهجري
  function dayData(gd, r, d) {
    var s = IDX.start.split('-').map(Number);
    var idx = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(s[0], s[1] - 1, s[2])) / 86400000);
    var rec = gd[String(r[0])];
    if (rec && idx >= 0 && idx < IDX.days) {
      var t = rec.t.substr(idx * 24, 24), mins = [];
      for (var i = 0; i < 6; i++) mins.push(+t.substr(i * 4, 2) * 60 + +t.substr(i * 4 + 2, 2));
      return { mins: mins, hijri: IDX.hijri.split(',')[idx].split('/').map(Number) };
    }
    var raw = calcTimes(r[3], r[4], d);
    var cal = rec && rec.c && rec.c[String(d.getUTCMonth() + 1)];
    if (cal) raw = raw.map(function (m, i) { return (m + (cal[i] || 0) + 1440) % 1440; });
    return { mins: raw, hijri: hijriCalc(d) };
  }

  function fmt(m) {
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    var h12 = h % 12 || 12;
    return ar(h12 + ':' + (mm < 10 ? '0' : '') + mm);
  }
  function left(diff) {
    if (diff < 60) return 'بعد ' + ar(diff) + ' د';
    return 'بعد ' + ar(Math.floor(diff / 60) + ':' + ('0' + diff % 60).slice(-2));
  }

  /* ---------- العرض ---------- */
  function render() {
    var r = region(regionId) || region(DEFAULT_REGION);
    var now = syNow();
    var gd = GOV[r[1]];
    var d = dayData(gd, r, now);
    var tomorrow = dayData(gd, r, new Date(now.getTime() + 86400000));
    var friday = now.getUTCDay() === 5;
    var nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

    // الصلاة القادمة (الشروق ليس صلاة)
    var next = -1;
    for (var i = 0; i < 6; i++) if (i !== 1 && d.mins[i] > nowMin) { next = i; break; }
    var diff = next >= 0 ? d.mins[next] - nowMin : tomorrow.mins[0] + 1440 - nowMin;

    $('pCityName').textContent = regionLabel(r);
    $('pDate').textContent = DAYS[now.getUTCDay()] + ' ' + ar(d.hijri[0]) + ' ' + (HMONTHS[d.hijri[1] - 1] || '') + ' ' + ar(d.hijri[2]) + 'هـ';

    $('pTimes').innerHTML = NAMES.map(function (n, i) {
      var label = (i === 2 && friday) ? 'الجمعة' : n;
      var isNext = i === next || (next < 0 && i === 0);
      var val = (next < 0 && i === 0) ? tomorrow.mins[0] : d.mins[i];
      return '<div class="pt' + (i === 1 ? ' sun' : '') + (isNext ? ' next' : '') + '">' +
        '<small>' + label + '</small><b>' + fmt(val) + '</b>' +
        (isNext ? '<i>' + left(diff) + '</i>' : '') + '</div>';
    }).join('');
    bar.classList.add('ready');
    today = dayKey(now);

    // رأس البطاقة: الصلاة القادمة ووقتها والمتبقي
    var ni0 = next >= 0 ? next : 0;
    if ($('pNextName')) {
      $('pNextName').textContent = (ni0 === 2 && friday) ? 'الجمعة' : NAMES[ni0];
      $('pNextTime').textContent = fmt(next >= 0 ? d.mins[ni0] : tomorrow.mins[0]);
      $('pNextLeft').textContent = left(diff);
    }

    // الصلاة القادمة في الشريط العلوي الثابت
    var tb = $('tbNext');
    if (tb) {
      var ni = next >= 0 ? next : 0;
      var nlabel = (ni === 2 && friday) ? 'الجمعة' : NAMES[ni];
      tb.innerHTML = '<small>' + nlabel + '</small><b>' + fmt(next >= 0 ? d.mins[ni] : tomorrow.mins[0]) + '</b>';
      tb.title = nlabel + ' ' + left(diff) + ' — ' + regionLabel(r);
    }
  }

  function tick() {
    if (!IDX || !GOV[(region(regionId) || {})[1]]) return;
    render();
  }

  function setRegion(id) {
    var r = region(id);
    if (!r) return;
    regionId = id;
    save(KEY, String(id));
    return ensureGov(r[1]).then(render);
  }

  /* ---------- قائمة المدن ---------- */
  function norm(s) {
    return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  }
  function buildList(q) {
    q = norm(q);
    var html = '';
    IDX.govs.forEach(function (g, gi) {
      var rs = IDX.regions.filter(function (r) { return r[1] === gi; });
      rs.sort(function (a, b) { return (a[2] === 'المدينة' ? -1 : 0) - (b[2] === 'المدينة' ? -1 : 0) || a[2].localeCompare(b[2], 'ar'); });
      if (q) rs = rs.filter(function (r) { return norm(g + ' ' + r[2]).indexOf(q) >= 0; });
      if (!rs.length) return;
      html += '<h4>محافظة ' + esc(g) + '</h4>' + rs.map(function (r) {
        var on = r[0] === regionId;
        return '<button type="button" class="city-opt' + (on ? ' on' : '') + '" data-id="' + r[0] + '">' +
          '<span>' + esc(regionLong(r)) + '</span>' + (on ? '<span aria-hidden="true">✓</span>' : '') + '</button>';
      }).join('');
    });
    $('cityList').innerHTML = html || '<div class="city-empty">لا نتائج. جرّب اسمًا آخر</div>';
  }
  function openSheet() {
    if (!IDX) return;
    $('citySearch').value = '';
    buildList('');
    var dlg = $('citySheet');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var on = $('cityList').querySelector('.on');
    if (on) on.scrollIntoView({ block: 'center' });
  }
  function closeSheet() { var dlg = $('citySheet'); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  $('pCity').addEventListener('click', openSheet);
  $('cityClose').addEventListener('click', closeSheet);
  $('citySearch').addEventListener('input', function () { buildList(this.value); });
  $('cityList').addEventListener('click', function (e) {
    var b = e.target.closest('.city-opt'); if (!b) return;
    setRegion(Number(b.dataset.id));
    closeSheet();
  });
  $('citySheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
  document.querySelectorAll('[data-atlas]').forEach(function (a) { a.href = ATLAS + (a.getAttribute('data-atlas') || ''); });

  // رابط «مسجدك» يفتح متجر الجهاز
  var mk = $('masjidakLink');
  if (mk) {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) mk.href = 'https://play.google.com/store/apps/details?id=mobile.masjidak.app';
    else if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) mk.href = 'https://apps.apple.com/us/app/masjidak-your-mosques-way/id6768942028';
  }

  // تظهر الصلاة القادمة في الشريط العلوي حين يختفي شريط المواقيت عن الشاشة
  var tbn = $('tbNext');
  if (tbn) {
    tbn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        tbn.hidden = en[0].isIntersecting || !bar.classList.contains('ready');
      }, { rootMargin: '-60px 0px 0px 0px' }).observe(bar);
    }
  }

  /* ---------- البدء ---------- */
  var saved = parseInt(load(KEY), 10);
  getJSON('times/index.json').then(function (idx) {
    IDX = idx;
    regionId = region(saved) ? saved : DEFAULT_REGION;
    return ensureGov(region(regionId)[1]);
  }).then(function () {
    render();
    timer = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  }).catch(function () {
    bar.classList.add('failed'); // يختفي الشريط بهدوء إن تعذّر التحميل
  });
})();
