/* ============================================================
   البحث في الموقع والأذكار ومواقيت الصلاة
   شعبة الشؤون العلمية في حلب
   ------------------------------------------------------------
   ملف مستقل: يقرأ محتوى الموقع (content.js أو قاعدة البيانات)
   وبيانات الأذكار (adhkar-data.js و adhkar-more.js) ومناطق
   المواقيت (times/index.json) كما هي، فكل ما يُضاف إليها يدخل
   البحث وحده دون تعديل هذا الملف.
   يُفتح بأي زر عليه data-search (و data-scope="adhkar" لصفحة
   الأذكار)، أو بالمفتاح «/» أو Ctrl+K من لوحة المفاتيح.
   ============================================================ */
(function () {
  'use strict';

  var VQ = (function () { var s = document.currentScript && document.currentScript.src || ''; var i = s.indexOf('?'); return i > 0 ? s.slice(i) : ''; })();
  var PAGE = document.body.classList.contains('adhkar-page') ? 'adhkar' : 'home';
  var REGION_KEY = 'elmi_prayer_region';
  var DIG = '٠١٢٣٤٥٦٧٨٩';
  function ar(n) { return String(n).replace(/\d/g, function (d) { return DIG[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- تطبيع النص العربي للمقارنة ----------
     يحذف التشكيل والتطويل، ويوحّد الألف والياء والتاء المربوطة
     والهمزات، ويحوّل الأرقام العربية، ويجعل علامات الترقيم مسافات. */
  var MARK = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
  var SAME = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي' };
  function normCh(c) {
    if (MARK.test(c)) return '';
    if (c in SAME) return SAME[c];
    var d = DIG.indexOf(c); if (d >= 0) return String(d);
    if (/[a-z0-9ء-يٱ-ۓ]/i.test(c)) return c.toLowerCase();
    return ' ';
  }
  // يعيد النص المطبَّع مع موضع كل حرف منه في النص الأصلي (للتظليل)
  function normMap(s) {
    s = String(s == null ? '' : s);
    var n = '', m = [], sp = true;
    for (var i = 0; i < s.length; i++) {
      var c = normCh(s[i]); if (!c) continue;
      if (c === ' ') { if (sp) continue; sp = true; } else sp = false;
      n += c; m.push(i);
    }
    return { n: n, m: m };
  }
  function norm(s) { return normMap(s).n.trim(); }
  // صيغ الكلمة المقبولة: «الاستغفار» تطابق «استغفار» أيضًا
  function forms(t) {
    var f = [t];
    var r = t.replace(/^(ال|وال|بال|فال)/, '');
    if (r !== t && r.length >= 4) f.push(r);
    return f;
  }
  function has(hay, t) { var f = forms(t); for (var i = 0; i < f.length; i++) if (hay.indexOf(f[i]) >= 0) return f[i]; return ''; }

  function marks(orig, toks) {
    var r = normMap(orig), rg = [];
    toks.forEach(function (t) {
      forms(t).forEach(function (f) {
        var p = 0;
        while (f && (p = r.n.indexOf(f, p)) >= 0) {
          var s = r.m[p], e = r.m[p + f.length - 1] + 1;
          while (e < orig.length && MARK.test(orig[e])) e++;
          rg.push([s, e]); p += f.length;
        }
      });
    });
    rg.sort(function (a, b) { return a[0] - b[0]; });
    var out = [], cur = null;
    rg.forEach(function (x) { if (cur && x[0] <= cur[1]) cur[1] = Math.max(cur[1], x[1]); else { cur = [x[0], x[1]]; out.push(cur); } });
    return out;
  }
  function hl(orig, toks) {
    orig = String(orig || ''); var rg = marks(orig, toks), h = '', p = 0;
    rg.forEach(function (x) { h += esc(orig.slice(p, x[0])) + '<mark>' + esc(orig.slice(x[0], x[1])) + '</mark>'; p = x[1]; });
    return h + esc(orig.slice(p));
  }
  // مقتطف حول أول موضع مطابق
  function snippet(orig, toks, len) {
    orig = String(orig || '').replace(/\s+/g, ' ').trim(); len = len || 150;
    if (orig.length <= len) return hl(orig, toks);
    var rg = marks(orig, toks), at = rg.length ? rg[0][0] : 0;
    var s = Math.max(0, at - 45);
    if (s > 0) { var sp = orig.lastIndexOf(' ', s); s = sp > 0 ? sp + 1 : s; }
    var e = Math.min(orig.length, s + len);
    if (e < orig.length) { var sp2 = orig.indexOf(' ', e); e = sp2 > 0 ? sp2 : e; }
    return (s > 0 ? '… ' : '') + hl(orig.slice(s, e), toks) + (e < orig.length ? ' …' : '');
  }
  function firstPhrase(t) { t = String(t || ''); var p = t.split(/[،؛.:]/)[0]; return p.length > 70 ? p.slice(0, 70) + '…' : p; }

  /* ---------- تحميل البيانات عند أول فتح ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src + VQ;
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  var dataP = null;
  function loadData() {
    if (dataP) return dataP;
    var jobs = [];
    if (!window.ADHKAR) jobs.push(loadScript('adhkar-data.js').catch(function () { }));
    jobs.push((window.ADHKAR_MORE ? Promise.resolve() : loadScript('adhkar-more.js')).catch(function () { }));
    if (!window.SITE_DATA && !window.DEFAULT_CONTENT) jobs.push(loadScript('content.js').catch(function () { }));
    jobs.push(fetch('times/index.json').then(function (r) { return r.json(); }).then(function (j) { TIMES = j; }).catch(function () { }));
    dataP = Promise.all(jobs).then(function () { INDEX = null; });
    return dataP;
  }
  var TIMES = null, INDEX = null;

  /* ---------- بناء الفهرس ---------- */
  // e: { g: المجموعة، t: العنوان، s: المسار، b: النص، w: وزن إضافي، go: الفعل }
  function build() {
    var L = [];
    function add(e) { e.nt = norm(e.t); e.nb = norm(e.b || ''); e.ns = norm(e.s || ''); L.push(e); }

    /* الأذكار بالعدّاد */
    var D = window.ADHKAR;
    function qText(q, M) {
      return (q || []).map(function (s) {
        var v = Array.isArray(s[1]) ? s[1] : ((M && M.Q && M.Q[s[1]]) || (D && D.Q && D.Q[s[1]]) || []);
        return s[0] + ': ' + v.join(' ');
      }).join(' ');
    }
    if (D && D.groups) {
      ['sabah', 'masa', 'salah'].forEach(function (t) {
        var g = D.groups[t]; if (!g) return;
        add({ g: 'adhkar', ic: 'counter', t: g.title, s: 'الأذكار بالعدّاد', b: '', w: 6, go: { adhkar: t } });
        function one(it, where) {
          var text, title;
          if (it.type === 'tasbih') {
            title = 'التسبيح بعد الصلاة';
            text = Object.keys(D.TASBIH || {}).map(function (k) { return D.TASBIH[k].steps.map(function (x) { return x[0]; }).join('، '); }).join(' — ');
          } else {
            text = it.quran ? qText(it.quran) : [].concat(it.text || '').join(' ');
            title = it.label || it.title || firstPhrase(text);
          }
          var notes = [].concat(it.note || []).join(' ');
          add({ g: 'adhkar', ic: 'dhikr', t: title, s: where, b: text, x: notes, quran: !!it.quran, go: { adhkar: t + '/' + (it.type === 'tasbih' ? 'tasbih' : it.id) } });
        }
        (g.items || []).forEach(function (it) { one(it, g.title); });
        (g.night || []).forEach(function (it) { one(it, g.title + ' — بعد غروب الشمس'); });
        (g.extra || []).forEach(function (it) { one(it, g.title + ' — المختلف في ثبوته'); });
      });
    }

    /* كل الأذكار: الأبواب */
    var M = window.ADHKAR_MORE;
    if (M && M.sections) {
      var order = [];
      (M.groups || []).forEach(function (gr) { (gr[1] || []).forEach(function (id) { if (id.charAt(0) !== '@') order.push([id, gr[0]]); }); });
      Object.keys(M.sections).forEach(function (id) { if (!order.some(function (o) { return o[0] === id; })) order.push([id, '']); });
      order.forEach(function (o) {
        var id = o[0], s = M.sections[id]; if (!s) return;
        add({ g: 'adhkar', ic: 'door', t: s.title, s: 'كل الأذكار' + (o[1] ? ' — ' + o[1] : ''), b: s.intro || '', w: 5, go: { adhkar: 'all/' + id } });
        function one(it, k, extra) {
          var text = it.quran ? qText([it.quran], M) : [].concat(it.text || '').join(' ');
          add({
            g: 'adhkar', ic: 'dhikr', t: it.label || firstPhrase(text), s: s.title + (extra ? ' — المختلف في ثبوته' : '') + (it.time ? ' — ' + it.time : ''),
            b: text, x: it.fadl || '', quran: !!it.quran, go: { adhkar: 'all/' + id + '/' + k }
          });
        }
        (s.items || []).forEach(function (it, i) { one(it, String(i), false); });
        (s.extra || []).forEach(function (it, i) { one(it, 'x' + i, true); });
      });
    }

    /* محتوى الموقع */
    var C = window.SITE_DATA || (window.DEFAULT_CONTENT && {
      settings: window.DEFAULT_CONTENT.settings, sections: window.DEFAULT_CONTENT.sections,
      items: window.DEFAULT_CONTENT.items, meetings: window.DEFAULT_CONTENT.meetings
    });
    if (C) {
      var bySort = function (a, b) { return (a.sort || 0) - (b.sort || 0); };
      var secs = (C.sections || []).slice().sort(bySort);
      var secName = {};
      secs.forEach(function (s, i) {
        secName[s.id] = s.title;
        var its = (C.items || []).filter(function (it) { return it.section_id === s.id; });
        if (!its.length) return;
        // يطابق ترقيم app.js لأقسام الصفحة (sec-1، sec-2 …)
        add({ g: 'site', ic: 'section', t: s.title, s: 'قسم في الموقع' + (s.kicker ? ' — ' + s.kicker : ''), b: s.description || '', w: 4, go: { anchor: 'sec-' + (i + 1), sid: s.id } });
      });
      (C.items || []).forEach(function (it) {
        if (it.visible === false) return;
        var u = String(it.file_url || '').trim() || String(it.url || '').split('|')[0].trim();
        add({
          g: 'site', ic: it.icon || 'link', t: it.title, s: secName[it.section_id] || 'الموقع',
          b: [it.description, it.badge, it.file_name].filter(Boolean).join(' — '), w: 2,
          go: { iid: it.id, href: u }
        });
      });
      (C.meetings || []).forEach(function (m) {
        var b = Object.keys(m).filter(function (k) { return typeof m[k] === 'string' && !/^(id|meeting_date|meeting_time|url|link|join_url|image|file_url)$/.test(k) && !/^https?:/.test(m[k]); })
          .map(function (k) { return m[k]; }).join(' — ');
        add({ g: 'site', ic: 'mic', t: 'اللقاء التطويري الشهري' + (m.number ? ' ' + ar(m.number) : '') + (m.title ? ': ' + m.title : ''), s: 'اللقاء الشهري للأئمة والخطباء', b: b, w: 2, go: { anchor: 'meeting' } });
      });
      var S = C.settings || {};
      var pairs = function (t) { return String(t || '').split(/\n+/).map(function (l) { var p = l.split('::'); return [(p[0] || '').trim(), (p.slice(1).join('::') || '').trim()]; }).filter(function (x) { return x[0]; }); };
      pairs(S.faq).forEach(function (x) { add({ g: 'site', ic: 'faq', t: x[0], s: 'قبل أن تسأل', b: x[1], w: 1, go: { faq: x[0] } }); });
      pairs(S.steps).forEach(function (x) { add({ g: 'site', ic: 'step', t: x[0], s: 'كيف تستفيد من الشعبة؟', b: x[1], w: 0, go: { anchor: 'steps' } }); });
      if (S.about || S.tasks) add({ g: 'site', ic: 'about', t: 'عن الشعبة', s: 'التعريف بالشعبة ومهامها', b: [S.about, S.tasks].filter(Boolean).join(' '), w: 1, go: { anchor: 'about' } });
      pairs(S.footer_links).forEach(function (x) {
        var u = x[1].split('|')[0].trim(); if (!u) return;
        add({ g: 'site', ic: 'link', t: x[0], s: 'روابط مفيدة', b: '', w: 0, go: { href: u } });
      });
    }

    /* مواقيت الصلاة: المحافظات ومناطقها */
    if (TIMES && TIMES.regions) {
      TIMES.regions.forEach(function (r) {
        var gov = TIMES.govs[r[1]], name = r[2] === 'المدينة' ? 'مدينة ' + gov : r[2];
        add({ g: 'times', ic: 'clock', t: 'مواقيت الصلاة في ' + name, s: 'محافظة ' + gov, b: '', k: name + ' ' + gov, w: r[2] === 'المدينة' ? 3 : 0, go: { region: r[0] } });
      });
    }
    L.forEach(function (e) { if (e.k) e.nk = norm(e.k); if (e.x) e.nx = norm(e.x); });
    INDEX = L;
  }

  /* ---------- البحث والترتيب ---------- */
  function find(q) {
    if (!INDEX) build();
    var toks = norm(q).split(' ').filter(Boolean);
    if (!toks.length) return { toks: toks, list: [] };
    var out = [];
    INDEX.forEach(function (e) {
      var sc = 0, ok = true;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], f;
        if (e.g === 'times') {          // المناطق: بالاسم وحده
          if ((f = has(e.nk || '', t))) { sc += 10 + ((e.nk || '').indexOf(f) === 0 ? 6 : 0); continue; }
          ok = false; break;
        }
        if ((f = has(e.nt, t))) { sc += 10 + (e.nt.indexOf(f) === 0 ? 4 : 0) + (f.length === e.nt.length ? 6 : 0); continue; }
        if ((f = has(e.nb, t))) { sc += 4; continue; }
        if ((f = has(e.ns, t))) { sc += 3; continue; }
        if (e.nx && (f = has(e.nx, t))) { sc += 1; continue; }
        ok = false; break;
      }
      if (!ok) return;
      // العبارة كاملة متصلة أعلى درجة
      var whole = toks.join(' ');
      if (toks.length > 1 && (e.nt.indexOf(whole) >= 0 || e.nb.indexOf(whole) >= 0)) sc += 8;
      if (e.g === 'times' && toks.join('').length < 3) return; // لا مناطق لحرفين
      out.push({ e: e, sc: sc + (e.w || 0) });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return { toks: toks, list: out };
  }

  /* ---------- الواجهة ---------- */
  var GROUPS = [
    { k: 'all', t: 'الكل' },
    { k: 'adhkar', t: 'الأذكار' },
    { k: 'site', t: 'الموقع' },
    { k: 'times', t: 'المواقيت' }
  ];
  var GNAME = { adhkar: 'الأذكار', site: 'الموقع', times: 'مواقيت الصلاة' };
  var SUGG = {
    home: ['طلب إذن درس', 'اللقاء الشهري', 'فقه الخلاف', 'آية الكرسي', 'منبج', 'الإصدارات'],
    adhkar: ['آية الكرسي', 'سيد الاستغفار', 'النوم', 'الوضوء', 'المسجد', 'الاستيقاظ']
  };
  var SVG = {
    search: '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m21 21-4.3-4.3"/>',
    dhikr: '<path d="M12 3l1.9 4.6L19 8l-3.8 3.4L16.2 17 12 14.3 7.8 17l1-5.6L5 8l5.1-.4z"/>',
    counter: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    door: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    section: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  function svg(name, size) {
    var body = SVG[name];
    if (!body && window.ICONS && window.ICONS[name]) {
      var I = window.ICONS[name];
      return I.type === 'f'
        ? '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" aria-hidden="true">' + I.body + '</svg>'
        : '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I.body + '</svg>';
    }
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (body || SVG.link) + '</svg>';
  }

  var STYLE = '' +
    '.srch{width:100%;max-width:720px;height:100%;max-height:100%;margin:0 auto;padding:0;border:0;background:var(--bg,#f5f4ee);color:var(--text,#3d3a3b);font-family:var(--font,system-ui)}' +
    '.srch::backdrop{background:rgba(0,38,35,.55)}' +
    '@media (min-width:760px){.srch{margin-top:6vh;height:84vh;border-radius:22px;box-shadow:0 30px 80px rgba(0,38,35,.35)}}' +
    '.srch-in{display:flex;flex-direction:column;height:100%}' +
    '.srch-top{background:var(--forest-900,#002623);padding:14px 14px 12px;color:#fff}' +
    '.srch-bar{display:flex;gap:10px;align-items:center}' +
    '.srch-field{flex:1;display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:0 12px;border:2px solid transparent}' +
    '.srch-field:focus-within{border-color:var(--gold-500,#b9a779)}' +
    '.srch-field svg{color:var(--gold-700,#988561);flex:none}' +
    '.srch-field input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:17px;padding:12px 0;color:var(--ink,#161616)}' +
    '.srch-field input::-webkit-search-cancel-button{display:none}' +
    '.srch-clr{border:0;background:transparent;color:var(--muted,#6f6a66);padding:6px;cursor:pointer;display:grid;place-items:center}' +
    '.srch-x{border:1px solid rgba(185,167,121,.6);background:transparent;color:#fff;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;cursor:pointer}' +
    '.srch-chips{display:flex;gap:8px;margin-top:12px;overflow-x:auto;scrollbar-width:none}' +
    '.srch-chips button{flex:none;border:1px solid rgba(185,167,121,.45);background:transparent;color:#edebe0;border-radius:999px;padding:6px 14px;font:inherit;font-size:14px;cursor:pointer}' +
    '.srch-chips button.on{background:var(--gold-700,#988561);border-color:var(--gold-700,#988561);color:#fff}' +
    '.srch-chips button span{opacity:.75;margin-inline-start:4px}' +
    '.srch-res{flex:1;overflow-y:auto;padding:6px 14px 28px;-webkit-overflow-scrolling:touch}' +
    '.srch-g h4{margin:18px 4px 8px;font-size:14px;color:var(--gold-700,#988561);font-weight:700;display:flex;align-items:center;gap:8px}' +
    '.srch-g h4::after{content:"";flex:1;height:1px;background:var(--line,rgba(5,66,57,.12))}' +
    '.srch-r{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:start;background:var(--card,#fff);border:1px solid var(--line,rgba(5,66,57,.12));border-radius:16px;padding:12px 14px;margin:0 0 8px;font:inherit;color:inherit;cursor:pointer}' +
    '.srch-r:hover,.srch-r:focus-visible{border-color:var(--gold-500,#b9a779);outline:0;box-shadow:0 0 0 3px rgba(185,167,121,.25)}' +
    '.srch-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--cream,#edebe0);color:var(--forest-700,#054239)}' +
    '.srch-b{flex:1;min-width:0}' +
    '.srch-b b{display:block;font-size:16px;color:var(--forest-700,#054239);line-height:1.5}' +
    '.srch-b small{display:block;font-size:12.5px;color:var(--gold-700,#988561);margin-top:1px}' +
    '.srch-s{display:block;font-size:14.5px;line-height:1.9;margin-top:4px;color:var(--text,#3d3a3b);overflow-wrap:anywhere}' +
    '.srch-s.ar{font-family:"AdhkarFont",var(--font,serif);font-size:16px;line-height:2}' +
    '.srch mark{background:rgba(185,167,121,.38);color:inherit;border-radius:3px;padding:0 1px}' +
    '.srch-more{display:block;width:100%;border:1px dashed var(--gold-500,#b9a779);background:transparent;color:var(--forest-700,#054239);border-radius:14px;padding:10px;font:inherit;font-size:14px;cursor:pointer;margin-bottom:6px}' +
    '.srch-empty{text-align:center;padding:36px 12px;color:var(--muted,#6f6a66);line-height:1.9}' +
    '.srch-empty b{color:var(--forest-700,#054239)}' +
    '.srch-sugg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}' +
    '.srch-sugg button{border:1px solid var(--line,rgba(5,66,57,.12));background:var(--card,#fff);border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;color:var(--forest-700,#054239);cursor:pointer}' +
    '.srch-trigger{display:flex;align-items:center;gap:10px;width:100%;margin-top:14px;background:var(--card,#fff);border:1px solid var(--line,rgba(5,66,57,.12));border-radius:14px;padding:11px 14px;font:inherit;font-size:15px;color:var(--muted,#6f6a66);cursor:pointer;text-align:start}' +
    '.srch-trigger svg{color:var(--gold-700,#988561)}' +
    '.srch-flash{animation:srchFlash 2.4s ease}' +
    '@keyframes srchFlash{0%,35%{box-shadow:0 0 0 4px rgba(185,167,121,.85)}100%{box-shadow:0 0 0 0 rgba(185,167,121,0)}}';

  var dlg, inp, res, chipsBox, scope = 'all', limitOff = {}, lastQ = '';
  function ensureUI() {
    if (dlg) return;
    var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    dlg = document.createElement('dialog'); dlg.className = 'srch'; dlg.setAttribute('aria-label', 'البحث');
    dlg.innerHTML =
      '<div class="srch-in"><div class="srch-top">' +
      '<div class="srch-bar"><label class="srch-field">' + svg('search', 20) +
      '<input type="search" id="srchQ" autocomplete="off" enterkeyhint="search" aria-label="كلمة البحث">' +
      '<button type="button" class="srch-clr" id="srchClr" aria-label="مسح" hidden>' + svg('close', 18) + '</button></label>' +
      '<button type="button" class="srch-x" id="srchClose">إغلاق</button></div>' +
      '<div class="srch-chips" id="srchChips" role="tablist"></div></div>' +
      '<div class="srch-res" id="srchRes" aria-live="polite"></div></div>';
    document.body.appendChild(dlg);
    inp = dlg.querySelector('#srchQ'); res = dlg.querySelector('#srchRes'); chipsBox = dlg.querySelector('#srchChips');
    var t = null;
    inp.addEventListener('input', function () {
      dlg.querySelector('#srchClr').hidden = !inp.value;
      clearTimeout(t); t = setTimeout(run, 120);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Enter') { e.preventDefault(); var f = res.querySelector('.srch-r'); if (f) f.click(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); var g = res.querySelector('.srch-r'); if (g) g.focus(); }
    });
    res.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var all = Array.prototype.slice.call(res.querySelectorAll('.srch-r')), i = all.indexOf(document.activeElement);
      if (i < 0) return; e.preventDefault();
      if (e.key === 'ArrowDown' && all[i + 1]) all[i + 1].focus();
      if (e.key === 'ArrowUp') { if (i === 0) inp.focus(); else all[i - 1].focus(); }
    });
    dlg.querySelector('#srchClr').addEventListener('click', function () { inp.value = ''; this.hidden = true; run(); inp.focus(); });
    dlg.querySelector('#srchClose').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { document.documentElement.style.overflow = ''; });
    chipsBox.addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (!b) return; scope = b.dataset.g; run(); });
    res.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-sugg]'))) { inp.value = b.dataset.sugg; dlg.querySelector('#srchClr').hidden = false; run(); return; }
      if ((b = e.target.closest('[data-more]'))) { limitOff[b.dataset.more] = true; scope = b.dataset.more; run(); return; }
      if ((b = e.target.closest('.srch-r'))) act(CUR[Number(b.dataset.i)]);
    });
  }

  var CUR = [];
  function run() {
    var q = inp.value.trim();
    if (q !== lastQ) { limitOff = {}; lastQ = q; }
    var r = find(q), cnt = { all: r.list.length, adhkar: 0, site: 0, times: 0 };
    r.list.forEach(function (x) { cnt[x.e.g]++; });
    chipsBox.innerHTML = GROUPS.map(function (g) {
      return '<button type="button" role="tab" data-g="' + g.k + '" class="' + (g.k === scope ? 'on' : '') + '" aria-selected="' + (g.k === scope) + '">' + g.t +
        (q && cnt[g.k] ? '<span>' + ar(cnt[g.k]) + '</span>' : '') + '</button>';
    }).join('');
    if (!q) {
      res.innerHTML = '<div class="srch-empty">' + (PAGE === 'adhkar' ? 'ابحث بأي كلمة من الذكر، أو باسم الباب.' : 'ابحث في أقسام الموقع وروابطه، وفي الأذكار كلها، وفي مواقيت مدن سورية.') +
        '<br>لا يلزم التشكيل، ولا الهمزات.<div class="srch-sugg">' + SUGG[PAGE].map(function (s) { return '<button type="button" data-sugg="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></div>';
      CUR = []; return;
    }
    var list = r.list.filter(function (x) { return scope === 'all' || x.e.g === scope; });
    if (!list.length) {
      res.innerHTML = '<div class="srch-empty">لا نتائج لـ<b>«' + esc(q) + '»</b>' + (scope !== 'all' && cnt.all ? ' هنا. <button type="button" class="srch-more" data-more="all" style="margin-top:12px">اعرض نتائج الأقسام الأخرى (' + ar(cnt.all) + ')</button>' : '.<br>جرّب كلمة أقصر، أو كلمة أخرى من الذكر.') + '</div>';
      CUR = []; return;
    }
    CUR = []; var html = '';
    var order = PAGE === 'adhkar' ? ['adhkar', 'site', 'times'] : (r.list[0].e.g === 'times' ? ['times', 'site', 'adhkar'] : ['site', 'adhkar', 'times']);
    if (PAGE !== 'adhkar' && r.list[0].e.g === 'adhkar') order = ['adhkar', 'site', 'times'];
    order.forEach(function (g) {
      var part = list.filter(function (x) { return x.e.g === g; }); if (!part.length) return;
      var lim = scope === g || limitOff[g] ? 200 : (g === 'times' ? 4 : 6);
      html += '<section class="srch-g"><h4>' + GNAME[g] + ' (' + ar(part.length) + ')</h4>';
      part.slice(0, lim).forEach(function (x) {
        var e = x.e, i = CUR.push(e) - 1;
        var sn = e.b ? '<span class="srch-s' + (e.g === 'adhkar' ? ' ar' : '') + '">' + snippet(e.b, r.toks, e.g === 'adhkar' ? 170 : 130) + '</span>' : '';
        html += '<button type="button" class="srch-r" data-i="' + i + '"><span class="srch-ic">' + svg(e.ic, 20) + '</span><span class="srch-b"><b>' + hl(e.t, r.toks) + '</b>' +
          (e.s ? '<small>' + esc(e.s) + '</small>' : '') + sn + '</span></button>';
      });
      if (part.length > lim) html += '<button type="button" class="srch-more" data-more="' + g + '">عرض كل نتائج ' + GNAME[g] + ' (' + ar(part.length) + ')</button>';
      html += '</section>';
    });
    res.innerHTML = html;
    res.scrollTop = 0;
  }

  /* ---------- تنفيذ النتيجة ---------- */
  function flash(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('srch-flash'); void el.offsetWidth; el.classList.add('srch-flash');
    setTimeout(function () { el.classList.remove('srch-flash'); }, 2600);
  }
  function act(e) {
    if (!e) return;
    var g = e.go;
    if (g.adhkar) {
      close();
      if (PAGE === 'adhkar' && window.adhkarGo) window.adhkarGo(g.adhkar);
      else location.href = 'adhkar.html#' + g.adhkar;
      return;
    }
    if (g.region != null) {
      close();
      if (window.prayerSetRegion) { window.prayerSetRegion(g.region); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else { try { localStorage.setItem(REGION_KEY, String(g.region)); } catch (er) { } location.href = './'; }
      return;
    }
    if (PAGE === 'home') {
      if (g.iid) {
        var it = document.querySelector('[data-iid="' + (window.CSS && window.CSS.escape ? window.CSS.escape(g.iid) : g.iid) + '"]');
        if (it) { close(); if (it.tagName === 'A') it.click(); else flash(it); return; }
      }
      if (g.sid || g.anchor) {
        var sec = (g.sid && document.querySelector('[data-sid="' + g.sid + '"]')) || document.getElementById(g.anchor);
        if (sec && !sec.hidden) { close(); flash(sec); return; }
      }
      if (g.faq) {
        var d = Array.prototype.filter.call(document.querySelectorAll('#faqBox details'), function (x) { return norm(x.textContent).indexOf(norm(g.faq)) >= 0; })[0];
        if (d) { close(); d.open = true; flash(d); return; }
      }
    }
    close();
    if (g.href) {
      if (/^https?:/i.test(g.href)) window.open(g.href, '_blank', 'noopener');
      else location.href = g.href;
      return;
    }
    location.href = './' + (g.anchor ? '#' + g.anchor : g.faq ? '#faq' : '');
  }

  /* ---------- الفتح والإغلاق ---------- */
  function open(sc) {
    ensureUI();
    Array.prototype.forEach.call(document.querySelectorAll('dialog[open]'), function (d) { if (d !== dlg && d.close) d.close(); });
    scope = sc || (PAGE === 'adhkar' ? 'adhkar' : 'all');
    inp.placeholder = PAGE === 'adhkar' ? 'ابحث في الأذكار…' : 'ابحث في الموقع والأذكار والمواقيت…';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { inp.focus(); inp.select(); }, 30);
    run();
    loadData().then(function () { if (dlg.open) run(); });
  }
  function close() {
    if (!dlg) return;
    if (dlg.close) { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
    document.documentElement.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-search]'); if (!b) return;
    e.preventDefault(); open(b.getAttribute('data-scope') || '');
  });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
      if (dlg && dlg.open) return;
      e.preventDefault(); open();
    }
  });
  if (document.readyState !== 'loading') setTimeout(function () { if (dlg == null) ensureUI(); }, 0);
  else document.addEventListener('DOMContentLoaded', function () { ensureUI(); });
  window.siteSearch = { open: open, find: function (q) { return find(q).list.map(function (x) { return x.e; }); } };
})();
