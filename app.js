/* ============================================================
   الصفحة الرئيسية — قراءة المحتوى وعرضه
   يقرأ من Supabase إن كان مربوطًا، وإلا من ملف content.js
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var DEF = window.DEFAULT_CONTENT;
  var CACHE_KEY = 'elmi-halab-cache-v1';
  var $ = function (id) { return document.getElementById(id); };
  var icon = window.iconSVG;

  /* ---------- أدوات مساعدة ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u) || /^(tel|mailto):/i.test(u)) return u;
    // ملفات مرفوعة مع الموقع نفسه، مثل files/book.pdf
    if (/^\/?files\/[\w\-.\/]+$/i.test(u) && u.indexOf('..') < 0) return u;
    // رابط داخل الصفحة نفسها، مثل #meeting
    if (/^#[\w-]+$/.test(u)) return u;
    return '';
  }
  function lines(s) {
    return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }
  function arNum(n) { return Number(n).toLocaleString('ar-SY', { useGrouping: false }); }
  function cacheGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; } }
  function cacheSet(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) { /* لا شيء */ } }

  /* ---------- قراءة المحتوى ---------- */
  function hasDb() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY); }

  function rest(table, query) {
    var h = { apikey: CFG.SUPABASE_KEY };
    if (!/^sb_/.test(CFG.SUPABASE_KEY)) h.Authorization = 'Bearer ' + CFG.SUPABASE_KEY;
    var url = CFG.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + table + '?' + query;
    return fetch(url, { headers: h }).then(function (r) {
      if (!r.ok) throw new Error(table + ' ' + r.status);
      return r.json();
    });
  }

  function fromDefaults() {
    return {
      settings: Object.assign({}, DEF.settings),
      sections: DEF.sections.slice(),
      items: DEF.items.slice(),
      meetings: DEF.meetings.slice()
    };
  }

  function load() {
    if (!hasDb()) return Promise.resolve(fromDefaults());
    return Promise.all([
      rest('sections', 'select=*&visible=eq.true&order=sort.asc'),
      rest('items', 'select=*&visible=eq.true&order=sort.asc'),
      rest('meetings', 'select=*&visible=eq.true&order=meeting_date.asc'),
      rest('settings', 'select=key,value')
    ]).then(function (r) {
      var settings = Object.assign({}, DEF.settings);
      r[3].forEach(function (row) { if (row.value != null) settings[row.key] = row.value; });
      var data = { settings: settings, sections: r[0], items: r[1], meetings: r[2] };
      // قبل استيراد المحتوى الأساسي تكون القاعدة فارغة، فنعرض المحتوى الأساسي
      if (!data.sections.length && !data.items.length && !data.meetings.length) data = fromDefaults();
      cacheSet(data);
      return data;
    }).catch(function () {
      return cacheGet() || fromDefaults();
    });
  }

  /* ---------- التاريخ والوقت ---------- */
  function parseWhen(m) {
    if (!m.meeting_date) return null;
    var p = m.meeting_date.split('-').map(Number);
    var t = String(m.meeting_time || '20:00').split(':').map(Number);
    return new Date(p[0], p[1] - 1, p[2], t[0] || 0, t[1] || 0);
  }
  function fmtDate(d) {
    try {
      return new Intl.DateTimeFormat('ar-SY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch (e) { return d.toLocaleDateString(); }
  }
  function fmtTime(d) {
    var h = d.getHours(), mi = d.getMinutes();
    var part = h < 12 ? 'صباحًا' : (h < 17 ? 'ظهرًا' : 'مساءً');
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return 'الساعة ' + arNum(h12) + ':' + (mi < 10 ? '٠' : '') + arNum(mi) + ' ' + part;
  }
  function statusOf(start) {
    var now = new Date();
    var end = new Date(start.getTime() + 2 * 3600 * 1000);
    if (now >= start && now <= end) return { cls: 'today', text: 'جارٍ الآن' };
    if (now > end) return { cls: 'past', text: 'انعقد' };
    var d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var d1 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var days = Math.round((d1 - d0) / 86400000);
    if (days === 0) return { cls: 'today', text: start.getHours() >= 17 ? 'الليلة' : 'اليوم' };
    if (days === 1) return { cls: '', text: 'غدًا' };
    if (days === 2) return { cls: '', text: 'بعد يومين' };
    if (days <= 10) return { cls: '', text: 'بعد ' + arNum(days) + ' أيام' };
    return { cls: '', text: 'بعد ' + arNum(days) + ' يومًا' };
  }
  var ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
  function ordinal(n) { return ORD[n] || ('رقم ' + arNum(n)); }

  /* ---------- عرض اللقاء الشهري ---------- */
  function renderMeeting(list) {
    var box = $('meetingBox');
    var all = list.filter(function (m) { return parseWhen(m); })
      .map(function (m) { return { m: m, at: parseWhen(m) }; })
      .sort(function (a, b) { return a.at - b.at; });

    if (!all.length) {
      box.innerHTML = '<div class="meet"><div class="meet-body"><p class="meet-note" style="margin:0">يُعلن موعد اللقاء القادم قريبًا بإذن الله.</p></div></div>';
      return;
    }

    var now = new Date();
    var current = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].at.getTime() + 2 * 3600 * 1000 >= now.getTime()) { current = all[i]; break; }
    }
    var isPastOnly = !current;
    if (!current) current = all[all.length - 1];
    var past = all.filter(function (x) { return x !== current && x.at < current.at; }).reverse();

    var m = current.m, st = statusOf(current.at);
    var html = '<article class="meet">';
    html += '<div class="meet-top"><span class="kicker">' + (m.number ? 'اللقاء ' + esc(ordinal(m.number)) : 'اللقاء القادم') + '</span>';
    html += '<span class="status ' + st.cls + '">' + esc(st.text) + '</span></div>';
    html += '<div class="meet-body"><h3>' + esc(m.title) + '</h3>';
    html += '<div class="meet-meta"><span>' + icon('calendar-days', 18) + esc(fmtDate(current.at)) + '</span>';
    html += '<span>' + icon('clock', 18) + esc(fmtTime(current.at)) + '</span>';
    if (m.duration) html += '<span>' + icon('mic', 18) + 'المدة: ' + esc(m.duration) + '</span>';
    html += '</div>';

    var ax = lines(m.axes);
    if (ax.length) html += '<ul class="sq-list">' + ax.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';

    var g = lines(m.guests), lec = lines(m.lecturer);
    if (g.length || lec.length) {
      html += '<div class="people">';
      if (g.length) html += '<div class="person"><b>' + (g.length === 1 ? 'ضيف الشرف' : g.length === 2 ? 'ضيفا الشرف' : 'ضيوف الشرف') + '</b><span>' + esc(g.join('\n')) + '</span></div>';
      if (lec.length) html += '<div class="person"><b>' + (lec.length > 1 ? 'المحاضرون' : 'المحاضر') + '</b><span>' + esc(lec.join('\n')) + '</span></div>';
      html += '</div>';
    }

    var join = safeUrl(m.join_url), form = safeUrl(m.form_url), rec = safeUrl(m.recording_url);
    html += '<div class="meet-actions">';
    if (!isPastOnly) {
      html += join
        ? '<a class="btn btn-forest" href="' + esc(join) + '" target="_blank" rel="noopener">' + icon('video', 18) + 'دخول اللقاء</a>'
        : '<span class="btn is-disabled">' + icon('clock', 18) + 'يُنشر رابط الدخول قبل الموعد</span>';
    }
    if (form) html += '<a class="btn btn-outline" href="' + esc(form) + '" target="_blank" rel="noopener">' + icon('file-check', 18) + 'استمارة الحضور</a>';
    if (rec) html += '<a class="btn btn-outline" href="' + esc(rec) + '" target="_blank" rel="noopener">' + icon('video', 18) + 'تسجيل اللقاء</a>';
    html += '</div>';
    if (isPastOnly) html += '<p class="meet-note">يُعلن موعد اللقاء القادم قريبًا بإذن الله.</p>';
    if (m.recommendations && isPastOnly) html += '<p class="meet-note" style="white-space:pre-line"><b>التوصيات:</b>\n' + esc(m.recommendations) + '</p>';
    html += '</div></article>';

    if (past.length) {
      html += '<details class="archive"><summary>اللقاءات السابقة (' + arNum(past.length) + ')' + icon('chevron-down', 20) + '</summary>';
      past.forEach(function (x) {
        var pm = x.m, pr = safeUrl(pm.recording_url);
        html += '<div class="past"><h4>' + (pm.number ? 'اللقاء ' + esc(ordinal(pm.number)) + ': ' : '') + esc(pm.title) + '</h4>';
        html += '<div class="when">' + esc(fmtDate(x.at)) + '</div>';
        if (pm.recommendations) html += '<p>' + esc(pm.recommendations) + '</p>';
        if (pr) html += '<div class="links"><a href="' + esc(pr) + '" target="_blank" rel="noopener">' + icon('video', 16) + 'تسجيل اللقاء</a></div>';
        html += '</div>';
      });
      html += '</details>';
    }
    box.innerHTML = html;
  }

  /* ---------- عرض الأقسام ---------- */
  function fileKind(name) {
    var ext = (String(name || '').split('.').pop() || '').toLowerCase();
    var map = { pdf: 'PDF', doc: 'Word', docx: 'Word', ppt: 'عرض', pptx: 'عرض', xls: 'جدول', xlsx: 'جدول', mp3: 'صوت', m4a: 'صوت', mp4: 'فيديو', jpg: 'صورة', jpeg: 'صورة', png: 'صورة', zip: 'ملف مضغوط' };
    return map[ext] || 'ملف';
  }

  // يمكن أن يحمل الرابط أكثر من عنوان بينها «|»: الأول للحاسوب،
  // ورابط Google Play للأندرويد، ورابط App Store للآيفون
  function pickUrl(u) {
    var list = String(u || '').split('|').map(function (x) { return safeUrl(x); }).filter(Boolean);
    if (list.length < 2) return list[0] || '';
    var ua = navigator.userAgent || '';
    var want = /android/i.test(ua) ? /play\.google\.com/i
      : (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) ? /apps\.apple\.com/i : null;
    if (want) for (var i = 0; i < list.length; i++) if (want.test(list[i])) return list[i];
    return list[0];
  }

  function itemHTML(it) {
    var href = safeUrl(it.file_url) || pickUrl(it.url);
    var ic = it.icon || 'link';
    var icCls = ic === 'whatsapp' ? ' wa' : ic === 'facebook' ? ' fb' : '';
    var badge = '';
    var b = String(it.badge || '').trim();
    if (href && b === 'قريبًا') b = ''; // صار الرابط متاحًا فلا معنى لكلمة قريبًا
    if (b) badge = '<span class="badge' + (b === 'جديد' ? ' new' : '') + '">' + esc(b) + '</span>';
    else if (safeUrl(it.file_url)) badge = '<span class="badge file">' + esc(fileKind(it.file_name || it.file_url)) + '</span>';

    var inner = '<span class="item-ic' + icCls + '">' + icon(ic, 24) + '</span>' +
      '<span class="item-body"><span class="item-title">' + esc(it.title) + badge + '</span>' +
      (it.description ? '<span class="item-desc">' + esc(it.description) + '</span>' : '') + '</span>';

    if (!href) return '<div class="item is-soon">' + inner + '</div>';
    var tgt = href.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"';
    return '<a class="item" href="' + esc(href) + '"' + tgt + '>' + inner +
      '<span class="item-go">' + icon('arrow-up-left', 20) + '</span></a>';
  }

  function renderSections(sections, items) {
    // القسم الأول في الترتيب يُعرض أعلى الصفحة قبل اللقاء الشهري، والباقي بعده
    var top = '', out = '', chips = [];
    var n = 0;
    sections.slice().sort(bySort).forEach(function (s, i) {
      var its = items.filter(function (it) { return it.section_id === s.id; }).sort(bySort);
      if (!its.length) return;
      var sid = 'sec-' + (i + 1);
      var html = '<section class="block" id="' + sid + '"><div class="block-head">';
      if (s.kicker) html += '<span class="kicker">' + esc(s.kicker) + '</span>';
      html += '<h2>' + esc(s.title) + '</h2>';
      if (s.description) html += '<p>' + esc(s.description) + '</p>';
      html += '</div><div class="items">' + its.map(itemHTML).join('') + '</div></section>';
      if (n === 0) { top = html; chips.push({ id: sid, t: s.title }, { id: 'meeting', t: 'اللقاء الشهري' }); }
      else { out += html; chips.push({ id: sid, t: s.title }); }
      n++;
    });
    if (!n) chips.push({ id: 'meeting', t: 'اللقاء الشهري' });
    chips.push({ id: 'about', t: 'عن الشعبة' });
    if ($('sectionsTop')) $('sectionsTop').innerHTML = top; else out = top + out;
    $('sections').innerHTML = out;
    renderNav(chips);
  }

  /* ---------- الشريط العلوي وقائمة الأقسام والتذييل ---------- */
  function renderNav(chips) {
    var a = function (c) { return '<a href="#' + c.id + '">' + esc(c.t) + '</a>'; };
    $('tbLinks').innerHTML = chips.slice(0, 4).map(a).join('');
    $('menuList').innerHTML = chips.map(function (c) {
      return '<a href="#' + c.id + '"><span>' + esc(c.t) + '</span>' + icon('arrow-up-left', 18) + '</a>';
    }).join('');
    $('footSections').innerHTML = chips.slice(0, 6).map(function (c) { return '<li>' + a(c) + '</li>'; }).join('');
  }

  // سطور «العنوان :: النص»
  function pairs(text) {
    return lines(text).map(function (l) {
      var i = l.indexOf('::');
      return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 2).trim()];
    });
  }
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  function arDigits(n) { return String(n).replace(/\d/g, function (d) { return AR_DIGITS[d]; }); }

  function renderExtras(s) {
    // نقاط رأس الصفحة والزر الرئيسي
    var FEAT_IC = ['file-check', 'mic', 'graduation-cap', 'calendar-days', 'book-open', 'users'];
    $('heroPoints').innerHTML = lines(s.hero_points).slice(0, 3).map(function (x, i) {
      return '<li><span class="feat-ic" aria-hidden="true">' + icon(FEAT_IC[i % FEAT_IC.length], 22) + '</span>' + esc(x) + '</li>';
    }).join('');
    var cta = pickUrl(s.cta_url);
    var ctaBtn = $('ctaBtn');
    if (cta && s.cta_label) {
      ctaBtn.href = cta;
      if (cta.charAt(0) !== '#') { ctaBtn.target = '_blank'; ctaBtn.rel = 'noopener'; }
      ctaBtn.innerHTML = icon('file-check', 18) + esc(s.cta_label);
      ctaBtn.hidden = false;
    } else ctaBtn.hidden = true;

    // كيف تستفيد
    var st = pairs(s.steps);
    $('steps').hidden = !st.length;
    $('stepsBox').innerHTML = st.map(function (x, i) {
      return '<li class="step"><span class="step-n">' + arDigits(i + 1) + '</span><b>' + esc(x[0]) + '</b>' + (x[1] ? '<p>' + esc(x[1]) + '</p>' : '') + '</li>';
    }).join('');

    // الأسئلة الشائعة
    var fq = pairs(s.faq);
    $('faq').hidden = !fq.length;
    $('faqBox').innerHTML = fq.map(function (x) {
      return '<details class="faq-item"><summary><span class="faq-q" aria-hidden="true">؟</span><span>' + esc(x[0]) + '</span>' + icon('chevron-down', 20) + '</summary><p>' + esc(x[1]) + '</p></details>';
    }).join('');

    // الدعوة الختامية وروابط التواصل
    var wa = safeUrl(s.whatsapp_channel), chat = waContact(s);
    var ext = ' target="_blank" rel="noopener"';
    var btns = '';
    if (wa) btns += '<a class="btn btn-gold" href="' + esc(wa) + '"' + ext + '>' + icon('megaphone', 18) + 'قناة الشعبة على واتساب</a>';
    if (chat) btns += '<a class="btn btn-ghost-light" href="' + esc(chat) + '"' + ext + '>' + icon('whatsapp', 18) + 'مراسلة الشعبة</a>';
    btns += '<button class="btn btn-ghost-light" type="button" data-share>' + icon('qr-code', 18) + 'باركود الموقع</button>';
    $('ctaActions').innerHTML = btns;

    var fc = '';
    if (wa) fc += '<li><a href="' + esc(wa) + '"' + ext + '>قناة الشعبة على واتساب</a></li>';
    if (chat) fc += '<li><a href="' + esc(chat) + '"' + ext + '>مراسلة الشعبة</a></li>';
    var phone = String(s.contact_phone || '').replace(/[^\d+]/g, '');
    if (phone) fc += '<li><a href="tel:' + esc(phone) + '">اتصال: <span dir="ltr">' + esc(s.contact_phone) + '</span></a></li>';
    fc += '<li><button type="button" data-share>باركود الموقع ومشاركته</button></li>';
    $('footContact').innerHTML = fc;

    $('footLinks').innerHTML = pairs(s.footer_links).map(function (x) {
      var u = pickUrl(x[1]); if (!u) return '';
      return '<li><a href="' + esc(u) + '"' + ext + '>' + esc(x[0]) + '</a></li>';
    }).join('');
    $('footTag').textContent = s.tagline || '';
  }

  function setupMenu() {
    var dlg = $('menuSheet');
    var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    $('menuBtn').addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
    $('menuClose').addEventListener('click', close);
    $('menuList').addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    $('menuShare').addEventListener('click', function () { close(); openShare(); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-share]')) openShare(); });
    var bar = $('topbar');
    var onScroll = function () { bar.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---------- عن الشعبة ---------- */
  function renderAbout(s) {
    var html = lines(s.about).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    var t = lines(s.tasks);
    if (t.length) html += '<h3>من مهام الشعبة</h3><ul class="sq-list">' + t.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    $('aboutBox').innerHTML = html;
  }

  /* ---------- المشاركة والباركود ---------- */
  function siteUrl() { return location.origin + location.pathname.replace(/index\.html$/, ''); }

  // رابط المراسلة المباشرة: رابط واتساب للأعمال إن وُجد، وإلا يُبنى من رقم الهاتف
  function waContact(s) {
    var link = safeUrl(s && s.whatsapp_contact);
    if (link) return link;
    var phone = String((s && s.contact_phone) || '').replace(/[^\d+]/g, '');
    if (!phone) return '';
    return 'https://wa.me/' + phone.replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '963');
  }
  var SETTINGS = DEF.settings;
  var openShare = function () { };

  function drawQR(text, px) {
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), quiet = 2, cell = Math.floor(px / (n + quiet * 2));
    var size = cell * (n + quiet * 2);
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#002623';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) {
      if (qr.isDark(r, k)) g.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
    return c;
  }

  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function setupShare() {
    var dlg = $('shareSheet');
    var mode = 'site';
    var TXT = {
      site: { h: 'شارك الموقع', p: 'امسح الباركود بكاميرا الهاتف، أو انسخ الرابط' },
      wa: { h: 'راسل الشعبة على واتساب', p: 'امسح الباركود لتبدأ محادثة مع الشعبة مباشرة' }
    };
    function target() { return mode === 'wa' ? waContact(SETTINGS) : siteUrl(); }
    function paint() {
      var url = target();
      var box = $('qrBox'); box.innerHTML = '';
      if (window.qrcode && url) box.appendChild(drawQR(url, 440));
      $('urlLine').textContent = url;
      $('shareHead').textContent = TXT[mode].h;
      $('shareNote').textContent = TXT[mode].p;
      var seg = $('qrSeg');
      seg.hidden = !waContact(SETTINGS);
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        var on = b.dataset.k === mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    $('qrSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]'); if (!b) return;
      mode = b.dataset.k; paint();
    });
    openShare = function () {
      mode = 'site'; paint();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    };
    $('shareBtn').innerHTML = icon('qr-code', 16) + 'باركود الموقع ومشاركته';
    $('shareBtn').addEventListener('click', function () { openShare(); });
    $('closeShare').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $('copyBtn').addEventListener('click', function () {
      var url = target();
      if (navigator.share) {
        navigator.share({ title: mode === 'wa' ? 'مراسلة شعبة الشؤون العلمية' : document.title, url: url }).catch(function () { /* أُلغيت */ });
        return;
      }
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(function () { toast('نُسخ الرابط'); })
        .catch(function () { prompt('انسخ الرابط:', url); });
    });
    if (navigator.share) $('copyBtn').textContent = 'مشاركة الرابط';
  }

  /* ---------- التشغيل ---------- */
  function render(d) {
    var s = d.settings;
    SETTINGS = s;
    $('siteTitle').textContent = s.site_title || DEF.settings.site_title;
    $('orgName').textContent = s.org_name || DEF.settings.org_name;
    $('tagline').textContent = s.tagline || '';
    $('ver').textContent = 'الإصدار ' + (s.version || '1.0');
    var wa = safeUrl(s.whatsapp_channel);
    var waBtn = $('waBtn');
    if (wa) { waBtn.href = wa; waBtn.innerHTML = icon('whatsapp', 18) + 'قناة الشعبة على واتساب'; }
    else waBtn.style.display = 'none';
    renderMeeting(d.meetings || []);
    renderSections(d.sections || [], d.items || []);
    renderAbout(s);
    renderExtras(s);
  }

  setupShare();
  setupMenu();
  var cached = hasDb() && cacheGet();
  if (cached) render(cached);       // عرض سريع من آخر نسخة محفوظة
  load().then(render);
})();
