/* ============================================================
   لوحة الإدارة — شعبة الشؤون العلمية
   الدخول والتعديل ورفع الملفات عبر Supabase
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var DEF = window.DEFAULT_CONTENT;
  var BUCKET = CFG.BUCKET || 'files';
  var icon = window.iconSVG;
  var $ = function (id) { return document.getElementById(id); };
  var sb = null;
  var me = null;
  var isAdmin = false;
  var S = { sections: [], items: [], meetings: [], settings: {} };

  /* ---------- أدوات ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, bad) {
    var t = $('toast');
    t.textContent = msg;
    t.style.background = bad ? 'var(--umber-500)' : 'var(--forest-900)';
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, bad ? 5000 : 2400);
  }
  function errMsg(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/row-level security|permission denied|not authorized/i.test(m)) return 'لا تملك صلاحية الحفظ — تأكد أن بريدك مضاف في جدول المشرفين';
    if (/bucket not found/i.test(m)) return 'مخزن الملفات غير موجود — شغّل ملف setup.sql كاملًا';
    if (/does not exist|schema cache/i.test(m)) return 'الجداول غير موجودة — شغّل ملف setup.sql في Supabase أولًا';
    if (/failed to fetch|network/i.test(m)) return 'تعذّر الاتصال — تحقق من الإنترنت';
    if (/payload too large|exceeded the maximum/i.test(m)) return 'الملف أكبر من الحد المسموح';
    return m;
  }
  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }
  function siteUrl() { return location.origin + location.pathname.replace(/admin(\.html)?$/, ''); }
  function arNum(n) { return Number(n).toLocaleString('ar-SY', { useGrouping: false }); }
  var ORD = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
  function ordinal(n) { return ORD[n] || ('رقم ' + arNum(n)); }
  function lines(s) { return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function when(m) {
    if (!m.meeting_date) return null;
    var p = m.meeting_date.split('-').map(Number), t = String(m.meeting_time || '20:00').split(':').map(Number);
    return new Date(p[0], p[1] - 1, p[2], t[0] || 0, t[1] || 0);
  }
  function fmtDate(d) {
    try { return new Intl.DateTimeFormat('ar-SY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
    catch (e) { return d.toLocaleDateString(); }
  }
  function fmtTime(d) {
    var h = d.getHours(), mi = d.getMinutes();
    var part = h < 12 ? 'صباحًا' : (h < 17 ? 'ظهرًا' : 'مساءً');
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return 'الساعة ' + arNum(h12) + ':' + (mi < 10 ? '٠' : '') + arNum(mi) + ' ' + part;
  }
  function show(id, on) { $(id).hidden = !on; }

  /* ---------- البدء ---------- */
  function start() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) { show('setupView', true); return; }
    if (!window.supabase) {
      show('setupView', true);
      $('setupView').querySelector('h2').textContent = 'تعذّر تحميل مكتبة Supabase';
      return;
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL.replace(/\/+$/, ''), CFG.SUPABASE_KEY);
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) enter(r.data.session); else showLogin();
    });
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') showLogin(); });
  }

  function showLogin() {
    show('appView', false); show('logoutBtn', false); show('loginView', true);
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('loginBtn'); btn.disabled = true; $('loginMsg').textContent = '';
    sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value })
      .then(function (r) {
        btn.disabled = false;
        if (r.error) {
          var m = r.error.message || '';
          $('loginMsg').textContent = /invalid login/i.test(m) ? 'البريد أو كلمة السر غير صحيحة'
            : /not confirmed/i.test(m) ? 'البريد غير مؤكَّد — أنشئ المستخدم مع تفعيل Auto Confirm User'
            : errMsg(r.error);
          return;
        }
        enter(r.data.session);
      });
  });

  $('logoutBtn').addEventListener('click', function () { sb.auth.signOut(); });

  function enter(session) {
    me = session.user;
    show('loginView', false); show('appView', true); show('logoutBtn', true);
    sb.rpc('is_admin').then(function (r) {
      isAdmin = r.data === true;
      show('notAdmin', !isAdmin && !r.error);
      $('adminSql').textContent = "insert into public.admins (email) values ('" + (me.email || '') + "');";
      if (r.error) toast(errMsg(r.error), true);
      loadAll();
    });
  }

  /* ---------- قراءة كل البيانات ---------- */
  function loadAll() {
    return Promise.all([
      sb.from('sections').select('*').order('sort'),
      sb.from('items').select('*').order('sort'),
      sb.from('meetings').select('*').order('meeting_date', { ascending: false }),
      sb.from('settings').select('*')
    ]).then(function (r) {
      var bad = r.filter(function (x) { return x.error; })[0];
      if (bad) { toast(errMsg(bad.error), true); return; }
      S.sections = r[0].data; S.items = r[1].data; S.meetings = r[2].data;
      S.settings = Object.assign({}, DEF.settings);
      r[3].data.forEach(function (row) { if (row.value != null) S.settings[row.key] = row.value; });
      show('seedBox', isAdmin && !S.sections.length && !S.meetings.length);
      renderMeetings(); renderSections(); renderSettings(); renderQR();
    });
  }

  /* ---------- التبويبات ---------- */
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.adm-tab'); if (!b) return;
    document.querySelectorAll('.adm-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
    document.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== b.getAttribute('data-tab'); });
  });

  /* ============================================================
     المحرّر العام (نافذة تعديل لأي عنصر)
     ============================================================ */
  var editorSave = null;

  function fieldHTML(f, v) {
    var id = 'f_' + f.key, help = f.help ? '<small>' + esc(f.help) + '</small>' : '';
    if (f.type === 'check') {
      return '<label class="check"><input type="checkbox" id="' + id + '"' + (v !== false ? ' checked' : '') + '>' + esc(f.label) + '</label>';
    }
    if (f.type === 'textarea') {
      return '<label class="field"><span>' + esc(f.label) + '</span><textarea class="inp" id="' + id + '" rows="' + (f.rows || 4) + '">' + esc(v) + '</textarea>' + help + '</label>';
    }
    if (f.type === 'icon') {
      var keys = Object.keys(window.ICONS).filter(function (k) { return ['chevron-down', 'arrow-up-left', 'share-2', 'qr-code'].indexOf(k) < 0; });
      return '<div class="field"><span>الأيقونة</span><div class="icon-pick">' + keys.map(function (k) {
        return '<input type="radio" name="iconPick" id="ip_' + k + '" value="' + k + '"' + ((v || 'link') === k ? ' checked' : '') + '>' +
          '<label for="ip_' + k + '">' + icon(k, 22) + esc(window.ICONS[k].label) + '</label>';
      }).join('') + '</div></div>';
    }
    if (f.type === 'file') {
      var cur = v && v.url ? '<div class="current" id="f_file_cur">الملف الحالي: <a href="' + esc(v.url) + '" target="_blank" rel="noopener">' + esc(v.name || 'فتح الملف') + '</a>' +
        '<label class="check" style="margin:8px 0 0;font-weight:500"><input type="checkbox" id="f_file_remove">حذف هذا الملف</label></div>' : '';
      return '<div class="field"><span>' + esc(f.label) + '</span><div class="upload-box">' +
        '<input type="file" id="f_file" style="width:100%">' + cur +
        '<div class="progress" id="f_prog"><i></i></div></div>' + help + '</div>';
    }
    var t = f.type || 'text';
    var ltr = (t === 'url' || t === 'tel' || f.ltr) ? ' ltr' : '';
    var list = f.list ? ' list="dl_' + f.key + '"' : '';
    var dl = f.list ? '<datalist id="dl_' + f.key + '">' + f.list.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>' : '';
    return '<label class="field"><span>' + esc(f.label) + '</span><input class="inp' + ltr + '" type="' + (t === 'url' ? 'text' : t) + '" id="' + id + '" value="' + esc(v) + '"' + list +
      (t === 'url' ? ' inputmode="url" placeholder="https://"' : '') + (f.required ? ' required' : '') + '>' + dl + help + '</label>';
  }

  function openEditor(title, fields, values, onSave) {
    $('editorTitle').textContent = title;
    $('editorFields').innerHTML = fields.map(function (f) {
      var v = f.type === 'file' ? values.__file : values[f.key];
      if (f.type === 'icon') v = values.icon;
      return fieldHTML(f, v == null ? (f.def != null ? f.def : '') : v);
    }).join('');
    $('editorSave').textContent = 'حفظ';
    editorSave = function () {
      var out = {};
      fields.forEach(function (f) {
        if (f.type === 'check') out[f.key] = $('f_' + f.key).checked;
        else if (f.type === 'icon') { var c = document.querySelector('input[name="iconPick"]:checked'); out.icon = c ? c.value : 'link'; }
        else if (f.type === 'file') {
          var inp = $('f_file'); out.__file = { file: inp.files[0] || null, remove: !!($('f_file_remove') && $('f_file_remove').checked) };
        } else if (f.type === 'number') out[f.key] = $('f_' + f.key).value === '' ? null : Number($('f_' + f.key).value);
        else {
          var val = $('f_' + f.key).value.trim();
          out[f.key] = (f.type === 'date' || f.type === 'time') && !val ? null : val;
        }
      });
      return onSave(out);
    };
    var d = $('editor');
    d.showModal();
    setTimeout(function () { var first = $('editorFields').querySelector('input.inp, textarea'); if (first && window.innerWidth > 700) first.focus(); }, 50);
  }

  $('editorCancel').addEventListener('click', function () { $('editor').close(); });
  $('editorForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editorSave) return;
    var btn = $('editorSave'); btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
    Promise.resolve().then(editorSave).then(function (ok) {
      btn.disabled = false; btn.textContent = 'حفظ';
      if (ok !== false) { $('editor').close(); toast('حُفظ'); loadAll(); }
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = 'حفظ';
      var p = $('f_prog'); if (p) p.style.display = 'none';
      toast(errMsg(err), true);
    });
  });

  function check(r) { if (r.error) throw r.error; return r.data; }

  function saveRow(table, id, row) {
    return id
      ? sb.from(table).update(row).eq('id', id).then(check)
      : sb.from(table).insert(row).then(check);
  }

  function delRow(table, id) { return sb.from(table).delete().eq('id', id).then(check); }

  /* ---------- رفع الملفات ---------- */
  function uploadFile(file) {
    if (file.size > 50 * 1024 * 1024) return Promise.reject(new Error('حجم الملف أكبر من ٥٠ ميغابايت — قسّمه أو اضغطه'));
    var ext = (String(file.name).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    var path = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var p = $('f_prog'); if (p) p.style.display = 'block';
    return sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
      .then(function (r) {
        if (r.error) throw r.error;
        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      });
  }
  function pathFromUrl(u) {
    var parts = String(u || '').split('/storage/v1/object/public/' + BUCKET + '/');
    return parts[1] ? decodeURIComponent(parts[1].split('?')[0]) : null;
  }
  function removeFile(u) {
    var p = pathFromUrl(u);
    if (!p) return Promise.resolve();
    return sb.storage.from(BUCKET).remove([p]).then(function () { /* لا يهم الخطأ هنا */ });
  }

  /* ---------- إعادة الترتيب ---------- */
  function move(table, list, id, dir) {
    var arr = list.slice().sort(bySort);
    var i = arr.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    var jobs = [];
    arr.forEach(function (x, k) {
      var ns = (k + 1) * 10;
      if (x.sort !== ns) jobs.push(sb.from(table).update({ sort: ns }).eq('id', x.id).then(check));
    });
    Promise.all(jobs).then(loadAll).catch(function (e) { toast(errMsg(e), true); });
  }

  /* ============================================================
     اللقاءات
     ============================================================ */
  var MEET_FIELDS = [
    { key: 'number', label: 'رقم اللقاء', type: 'number', help: 'يظهر في الموقع «اللقاء الأول، الثاني…»' },
    { key: 'title', label: 'عنوان اللقاء', required: true },
    { key: 'meeting_date', label: 'التاريخ', type: 'date', required: true },
    { key: 'meeting_time', label: 'الوقت', type: 'time', def: '20:30' },
    { key: 'duration', label: 'المدة', def: 'ساعة ونصف' },
    { key: 'axes', label: 'المحاور', type: 'textarea', help: 'كل محور في سطر' },
    { key: 'guests', label: 'ضيوف الشرف', type: 'textarea', rows: 2, help: 'كل ضيف في سطر مع لقبه، مثل: فضيلة الشيخ فلان' },
    { key: 'lecturer', label: 'المحاضر', type: 'textarea', rows: 2 },
    { key: 'join_url', label: 'رابط الدخول إلى اللقاء', type: 'url', help: 'ضعه قبل الموعد، فيظهر في الموقع زر «دخول اللقاء»' },
    { key: 'form_url', label: 'رابط استمارة الحضور (منصة الوزارة)', type: 'url' },
    { key: 'recording_url', label: 'رابط تسجيل اللقاء', type: 'url', help: 'بعد انتهاء اللقاء' },
    { key: 'recommendations', label: 'التوصيات', type: 'textarea', help: 'تظهر في أرشيف اللقاءات السابقة' },
    { key: 'visible', label: 'ظاهر في الموقع', type: 'check' }
  ];

  function renderMeetings() {
    var box = $('meetList');
    if (!S.meetings.length) { box.innerHTML = '<div class="empty">لا لقاءات بعد</div>'; return; }
    box.innerHTML = S.meetings.map(function (m) {
      var d = when(m);
      return '<div class="list-row' + (m.visible === false ? ' hidden-row' : '') + '">' +
        '<span class="item-ic">' + icon('calendar-days', 20) + '</span>' +
        '<div class="grow"><b>' + (m.number ? 'اللقاء ' + esc(ordinal(m.number)) + ': ' : '') + esc(m.title) + '</b>' +
        '<small>' + (d ? esc(fmtDate(d)) : 'بلا تاريخ') + (m.join_url ? ' · رابط الدخول جاهز' : '') + (m.visible === false ? ' · مخفي' : '') + '</small></div>' +
        '<div class="mini">' +
        '<button type="button" title="نص الإعلان" data-act="ann" data-id="' + m.id + '">' + icon('megaphone', 18) + '</button>' +
        '<button type="button" title="تعديل" data-act="edit" data-id="' + m.id + '">' + icon('pen-line', 18) + '</button>' +
        '<button type="button" class="del" title="حذف" data-act="del" data-id="' + m.id + '">✕</button>' +
        '</div></div>';
    }).join('');
  }

  $('meetList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var m = S.meetings.find(function (x) { return x.id === b.dataset.id; }); if (!m) return;
    if (b.dataset.act === 'edit') editMeeting(m);
    if (b.dataset.act === 'ann') announce(m);
    if (b.dataset.act === 'del' && confirm('حذف «' + m.title + '» نهائيًا؟')) delRow('meetings', m.id).then(function () { toast('حُذف'); loadAll(); }).catch(function (er) { toast(errMsg(er), true); });
  });

  $('addMeet').addEventListener('click', function () {
    var max = S.meetings.reduce(function (a, m) { return Math.max(a, m.number || 0); }, 0);
    editMeeting({ number: max + 1, meeting_time: '20:30', duration: 'ساعة ونصف', visible: true });
  });

  function editMeeting(m) {
    openEditor(m.id ? 'تعديل اللقاء' : 'لقاء جديد', MEET_FIELDS, m, function (v) {
      return saveRow('meetings', m.id, v);
    });
  }

  /* نص إعلان جاهز للصق في مجموعات واتساب */
  function announce(m) {
    var d = when(m), g = lines(m.guests), lec = lines(m.lecturer), ax = lines(m.axes);
    var t = (m.number ? 'اللقاء ' + ordinal(m.number) + ' من برنامج ' : '') + '*«اللقاء التطويري الشهري»*\nلأئمة وخطباء مدينة حلب\n\n*«' + m.title + '»*\n';
    if (ax.length) t += '\n' + ax.map(function (a) { return '🕌 ' + a; }).join('\n') + '\n';
    if (g.length) t += '\n*' + (g.length === 1 ? 'ضيف الشرف' : g.length === 2 ? 'ضيفا الشرف' : 'ضيوف الشرف') + ':*\n' + g.join('\n') + '\n';
    if (lec.length) t += '\n*المحاضر:*\n' + lec.join('\n') + '\n';
    if (d) t += '\n📅 ' + fmtDate(d) + '\n🕗 ' + fmtTime(d);
    if (m.duration) t += '\n⏳ مدة اللقاء: ' + m.duration;
    t += m.join_url ? '\n🔗 رابط اللقاء:\n' + m.join_url : '\n🔗 سيصلكم رابط اللقاء قبل الموعد بإذن الله';
    t += '\n\n🌐 صفحة الشعبة:\n' + siteUrl() + '\n\nشعبة الشؤون العلمية\nمديرية أوقاف حلب';

    $('editorTitle').textContent = 'نص الإعلان';
    $('editorFields').innerHTML = '<label class="field"><span>انسخه والصقه في مجموعة واتساب</span><textarea class="inp" id="annText" rows="16">' + esc(t) + '</textarea></label>';
    editorSave = function () {
      var txt = $('annText').value;
      return (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(function () { toast('نُسخ النص'); $('editor').close(); return false; })
        .catch(function () { $('annText').select(); document.execCommand('copy'); toast('نُسخ النص'); $('editor').close(); return false; });
    };
    $('editorSave').textContent = 'نسخ';
    $('editor').showModal();
    $('editor').addEventListener('close', function once() { $('editorSave').textContent = 'حفظ'; $('editor').removeEventListener('close', once); });
  }

  /* ============================================================
     الأقسام والروابط
     ============================================================ */
  var SEC_FIELDS = [
    { key: 'title', label: 'عنوان القسم', required: true, help: 'مثل: دورة فقه الخلاف، إصدارات الشعبة' },
    { key: 'kicker', label: 'الشارة الصغيرة فوق العنوان', help: 'مثل: الدورات العلمية — اختيارية' },
    { key: 'description', label: 'وصف مختصر', type: 'textarea', rows: 2 },
    { key: 'visible', label: 'ظاهر في الموقع', type: 'check' }
  ];
  var ITEM_FIELDS = [
    { key: 'title', label: 'العنوان', required: true },
    { key: 'description', label: 'سطر وصف قصير' },
    { key: 'icon', type: 'icon' },
    { key: 'url', label: 'الرابط', type: 'url', help: 'رابط نموذج أو صفحة أو فيديو. اتركه فارغًا إن كنت سترفع ملفًا. ولتطبيق له متجران ضع الروابط بينها | فيفتح كل جهاز متجره' },
    { key: '__file', label: 'أو ارفع ملفًا (PDF أو Word أو صورة…)', type: 'file', help: 'إن رفعت ملفًا يفتحه الزر بدل الرابط. وإن تركت الرابط والملف فارغين يظهر العنصر بعلامة «قريبًا». الحد الأقصى ٥٠ ميغابايت' },
    { key: 'badge', label: 'علامة صغيرة بجانب العنوان (اختيارية)', list: ['جديد', 'قريبًا', 'مهم', 'محدَّث'] },
    { key: 'visible', label: 'ظاهر في الموقع', type: 'check' }
  ];

  function renderSections() {
    var box = $('secList');
    var secs = S.sections.slice().sort(bySort);
    if (!secs.length) { box.innerHTML = '<div class="empty">لا أقسام بعد</div>'; return; }
    box.innerHTML = secs.map(function (s) {
      var its = S.items.filter(function (i) { return i.section_id === s.id; }).sort(bySort);
      return '<div class="sec-card' + (s.visible === false ? ' hidden-row' : '') + '">' +
        '<div class="sec-head"><div class="grow">' + (s.kicker ? '<small>' + esc(s.kicker) + '</small>' : '') + '<b>' + esc(s.title) + (s.visible === false ? ' (مخفي)' : '') + '</b></div>' +
        '<div class="mini">' +
        '<button type="button" title="أعلى" data-act="sup" data-id="' + s.id + '">▲</button>' +
        '<button type="button" title="أسفل" data-act="sdown" data-id="' + s.id + '">▼</button>' +
        '<button type="button" title="تعديل القسم" data-act="sedit" data-id="' + s.id + '">' + icon('pen-line', 18) + '</button>' +
        '<button type="button" class="del" title="حذف القسم" data-act="sdel" data-id="' + s.id + '">✕</button>' +
        '</div></div>' +
        (its.length ? its.map(function (it) {
          var sub = it.file_url ? 'ملف: ' + (it.file_name || 'مرفوع') : (it.url || 'بلا رابط — يظهر «قريبًا»');
          return '<div class="list-row' + (it.visible === false ? ' hidden-row' : '') + '">' +
            '<span class="item-ic">' + icon(it.icon || 'link', 20) + '</span>' +
            '<div class="grow"><b>' + esc(it.title) + (it.badge ? ' <span class="badge">' + esc(it.badge) + '</span>' : '') + '</b><small>' + esc(sub) + '</small></div>' +
            '<div class="mini">' +
            '<button type="button" title="أعلى" data-act="iup" data-id="' + it.id + '">▲</button>' +
            '<button type="button" title="أسفل" data-act="idown" data-id="' + it.id + '">▼</button>' +
            '<button type="button" title="تعديل" data-act="iedit" data-id="' + it.id + '">' + icon('pen-line', 18) + '</button>' +
            '<button type="button" class="del" title="حذف" data-act="idel" data-id="' + it.id + '">✕</button>' +
            '</div></div>';
        }).join('') : '<div class="empty">لا عناصر في هذا القسم — لن يظهر في الموقع حتى تضيف عنصرًا</div>') +
        '<button type="button" class="btn btn-outline" data-act="iadd" data-id="' + s.id + '" style="width:100%;min-height:40px;margin-top:4px">+ رابط أو ملف</button>' +
        '</div>';
    }).join('');
  }

  $('secList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, id = b.dataset.id;
    var s = S.sections.find(function (x) { return x.id === id; });
    var it = S.items.find(function (x) { return x.id === id; });
    if (act === 'sup' || act === 'sdown') move('sections', S.sections, id, act === 'sup' ? -1 : 1);
    if (act === 'sedit') editSection(s);
    if (act === 'sdel' && confirm('حذف قسم «' + s.title + '» وكل ما فيه من روابط وملفات؟')) {
      var files = S.items.filter(function (x) { return x.section_id === id && x.file_url; });
      Promise.all(files.map(function (x) { return removeFile(x.file_url); }))
        .then(function () { return delRow('sections', id); })
        .then(function () { toast('حُذف القسم'); loadAll(); })
        .catch(function (er) { toast(errMsg(er), true); });
    }
    if (act === 'iadd') editItem({ section_id: id, icon: 'link', visible: true });
    if (it) {
      var sib = S.items.filter(function (x) { return x.section_id === it.section_id; });
      if (act === 'iup' || act === 'idown') move('items', sib, id, act === 'iup' ? -1 : 1);
      if (act === 'iedit') editItem(it);
      if (act === 'idel' && confirm('حذف «' + it.title + '»؟')) {
        removeFile(it.file_url).then(function () { return delRow('items', id); })
          .then(function () { toast('حُذف'); loadAll(); })
          .catch(function (er) { toast(errMsg(er), true); });
      }
    }
  });

  $('addSec').addEventListener('click', function () { editSection({ visible: true }); });

  function editSection(s) {
    openEditor(s.id ? 'تعديل القسم' : 'قسم جديد', SEC_FIELDS, s, function (v) {
      if (!s.id) v.sort = S.sections.reduce(function (a, x) { return Math.max(a, x.sort || 0); }, 0) + 10;
      return saveRow('sections', s.id, v);
    });
  }

  function editItem(it) {
    var vals = Object.assign({}, it, { __file: it.file_url ? { url: it.file_url, name: it.file_name } : null });
    openEditor(it.id ? 'تعديل العنصر' : 'عنصر جديد', ITEM_FIELDS, vals, function (v) {
      var f = v.__file; delete v.__file;
      v.section_id = it.section_id;
      if (!it.id) {
        v.sort = S.items.filter(function (x) { return x.section_id === it.section_id; })
          .reduce(function (a, x) { return Math.max(a, x.sort || 0); }, 0) + 10;
      }
      var job = Promise.resolve();
      if (f && f.file) {
        job = uploadFile(f.file).then(function (url) {
          var old = it.file_url;
          v.file_url = url; v.file_name = f.file.name;
          if (v.badge === 'قريبًا') v.badge = '';
          return old ? removeFile(old) : null;
        });
      } else if (f && f.remove) {
        job = removeFile(it.file_url).then(function () { v.file_url = ''; v.file_name = ''; });
      }
      return job.then(function () { return saveRow('items', it.id, v); });
    });
  }

  /* ============================================================
     بيانات الموقع
     ============================================================ */
  var SET_FIELDS = [
    { key: 'site_title', label: 'اسم الشعبة' },
    { key: 'org_name', label: 'الجهة (فوق الاسم)' },
    { key: 'tagline', label: 'السطر التعريفي تحت الاسم', type: 'textarea', rows: 2 },
    { key: 'about', label: 'نبذة عن الشعبة', type: 'textarea', rows: 6, help: 'كل فقرة في سطر مستقل' },
    { key: 'tasks', label: 'مهام الشعبة', type: 'textarea', rows: 6, help: 'كل مهمة في سطر' },
    { key: 'hero_points', label: 'النقاط الثلاث تحت السطر التعريفي', type: 'textarea', rows: 3, help: 'كل نقطة في سطر — تظهر أول ثلاث' },
    { key: 'cta_label', label: 'نص الزر الرئيسي في أعلى الموقع', help: 'مثل: طلب إذن درس' },
    { key: 'cta_url', label: 'رابط الزر الرئيسي', type: 'url' },
    { key: 'steps', label: 'خطوات «كيف تستفيد من الشعبة؟»', type: 'textarea', rows: 5, help: 'كل خطوة في سطر: العنوان :: الوصف — اتركه فارغًا لإخفاء القسم' },
    { key: 'faq', label: 'الأسئلة الشائعة', type: 'textarea', rows: 7, help: 'كل سؤال في سطر: السؤال :: الجواب — اتركه فارغًا لإخفاء القسم' },
    { key: 'footer_links', label: 'روابط التذييل', type: 'textarea', rows: 4, help: 'كل رابط في سطر: العنوان :: الرابط' },
    { key: 'whatsapp_channel', label: 'رابط قناة واتساب', type: 'url' },
    { key: 'whatsapp_contact', label: 'رابط مراسلة الشعبة على واتساب', type: 'url', help: 'رابط واتساب للأعمال، مثل https://wa.me/message/… — منه زر «مراسلة الشعبة» وباركود واتساب' },
    { key: 'contact_phone', label: 'رقم هاتف للاتصال (اختياري)', type: 'tel', help: 'مثل 0944123456 — يظهر زر «اتصال». وإن تركت رابط واتساب فارغًا تُبنى المراسلة من هذا الرقم' },
    { key: 'version', label: 'رقم الإصدار في التذييل', ltr: true }
  ];

  function renderSettings() {
    $('setFields').innerHTML = SET_FIELDS.map(function (f) { return fieldHTML(f, S.settings[f.key]); }).join('');
  }

  $('setForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var rows = SET_FIELDS.map(function (f) { return { key: f.key, value: $('f_' + f.key).value.trim() }; });
    sb.from('settings').upsert(rows).then(check)
      .then(function () { toast('حُفظت بيانات الموقع'); loadAll(); })
      .catch(function (er) { toast(errMsg(er), true); });
  });

  /* ============================================================
     استيراد المحتوى الأساسي (مرة واحدة)
     ============================================================ */
  $('seedBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true; btn.textContent = 'جارٍ الاستيراد…';
    var map = {};
    var chain = Promise.resolve();
    DEF.sections.forEach(function (s) {
      chain = chain.then(function () {
        return sb.from('sections').insert({ title: s.title, kicker: s.kicker, description: s.description, sort: s.sort, visible: s.visible })
          .select().single().then(check).then(function (row) { map[s.id] = row.id; });
      });
    });
    chain.then(function () {
      var items = DEF.items.map(function (it) {
        var o = Object.assign({}, it); delete o.id; o.section_id = map[it.section_id]; return o;
      });
      var meets = DEF.meetings.map(function (m) { var o = Object.assign({}, m); delete o.id; return o; });
      var sets = Object.keys(DEF.settings).map(function (k) { return { key: k, value: DEF.settings[k] }; });
      return Promise.all([
        sb.from('items').insert(items).then(check),
        sb.from('meetings').insert(meets).then(check),
        sb.from('settings').upsert(sets).then(check)
      ]);
    }).then(function () {
      toast('تم الاستيراد'); loadAll();
    }).catch(function (er) {
      btn.disabled = false; btn.textContent = 'استيراد المحتوى الأساسي';
      toast(errMsg(er), true);
    });
  });

  /* ============================================================
     الباركود
     ============================================================ */
  var eagleImg = new Image();
  eagleImg.src = 'images/eagle.svg';

  function qrCanvas(text, px, withLogo) {
    var qr = window.qrcode(0, withLogo ? 'H' : 'M');
    qr.addData(text); qr.make();
    var n = qr.getModuleCount(), quiet = 3, cell = Math.max(1, Math.floor(px / (n + quiet * 2)));
    var size = cell * (n + quiet * 2);
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#002623';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    if (withLogo && eagleImg.complete && eagleImg.naturalWidth) {
      var box = Math.round(size * 0.22), x = Math.round((size - box) / 2);
      g.fillStyle = '#ffffff';
      roundRect(g, x - cell, x - cell, box + 2 * cell, box + 2 * cell, cell * 2); g.fill();
      g.fillStyle = '#002623';
      roundRect(g, x, x, box, box, cell * 2); g.fill();
      var w = box * 0.8, h = w * 168.086 / 221.166;
      g.drawImage(eagleImg, x + (box - w) / 2, x + (box - h) / 2, w, h);
    }
    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function download(canvas, name) {
    canvas.toBlob(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, 'image/png');
  }

  // رابط المراسلة المباشرة على واتساب
  function waContact() {
    var link = String(S.settings.whatsapp_contact || '').trim();
    if (/^https?:\/\//i.test(link)) return link;
    var phone = String(S.settings.contact_phone || '').replace(/[^\d+]/g, '');
    return phone ? 'https://wa.me/' + phone.replace(/^\+/, '').replace(/^00/, '').replace(/^0/, '963') : '';
  }
  var qrMode = 'site';
  function qrTarget() { return qrMode === 'wa' ? waContact() : siteUrl(); }

  function renderQR() {
    var draw = function () {
      var box = $('qrAdmin'); box.innerHTML = '';
      var url = qrTarget();
      if (!url) { box.innerHTML = '<div class="empty">ضع رابط مراسلة واتساب في «بيانات الموقع» أولًا</div>'; $('qrUrl').textContent = ''; return; }
      var c = qrCanvas(url, 600, true);
      c.style.width = '240px'; c.style.height = '240px';
      box.appendChild(c);
      $('qrUrl').textContent = url;
      Array.prototype.forEach.call($('qrSegAdmin').querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.k === qrMode); });
    };
    if (eagleImg.complete) draw(); else eagleImg.onload = draw;
  }
  $('qrSegAdmin').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]'); if (!b) return;
    qrMode = b.dataset.k; renderQR();
  });

  $('dlQr').addEventListener('click', function () {
    var url = qrTarget(); if (!url) return;
    download(qrCanvas(url, 1200, true), qrMode === 'wa' ? 'باركود-واتساب-الشعبة.png' : 'باركود-شعبة-الشؤون-العلمية.png');
  });

  $('dlPoster').addEventListener('click', function () {
    var url = qrTarget(); if (!url) return;
    var isWa = qrMode === 'wa';
    var fontsReady = document.fonts && document.fonts.load
      ? Promise.all(['900 80px Qomra', '900 80px TajawalLocal', '500 40px Qomra', '500 40px TajawalLocal'].map(function (f) { return document.fonts.load(f).catch(function () {}); }))
      : Promise.resolve();
    fontsReady.then(function () {
      var W = 1240, H = 1754; // A4 بدقة 150
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d');
      var FF = 'Qomra, TajawalLocal, sans-serif';
      g.fillStyle = '#f5f4ee'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#002623'; g.fillRect(0, 0, W, 560);
      g.fillStyle = 'rgba(66,129,119,.22)'; g.beginPath(); g.arc(80, 40, 300, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(152,133,97,.16)'; g.beginPath(); g.arc(W - 60, 560, 240, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#002623'; g.fillRect(0, 560, W, 0);
      if (eagleImg.naturalWidth) g.drawImage(eagleImg, (W - 240) / 2, 70, 240, 240 * 168.086 / 221.166);
      g.direction = 'rtl'; g.textAlign = 'center';
      g.fillStyle = '#b9a779'; g.font = '500 40px ' + FF; g.fillText('مديرية أوقاف حلب', W / 2, 380);
      g.fillStyle = '#ffffff'; g.font = '900 84px ' + FF; g.fillText(S.settings.site_title || 'شعبة الشؤون العلمية', W / 2, 480);
      var q = qrCanvas(url, 760, true);
      var qx = (W - q.width) / 2, qy = 660;
      g.fillStyle = '#ffffff'; roundRect(g, qx - 30, qy - 30, q.width + 60, q.height + 60, 40); g.fill();
      g.drawImage(q, qx, qy);
      g.fillStyle = '#054239'; g.font = '900 56px ' + FF; g.fillText(isWa ? 'راسل الشعبة على واتساب' : 'امسح الباركود بكاميرا هاتفك', W / 2, qy + q.height + 122);
      g.fillStyle = '#3d3a3b'; g.font = '500 36px ' + FF; g.fillText(isWa ? 'امسح الباركود لتبدأ محادثة مع الشعبة مباشرة' : 'الخدمات · اللقاء الشهري · الدروس · الدورات · الإصدارات', W / 2, qy + q.height + 186);
      g.direction = 'ltr'; g.fillStyle = '#988561'; g.font = '500 34px ' + FF; g.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, qy + q.height + 238);
      g.fillStyle = '#002623'; g.fillRect(0, H - 90, W, 90);
      g.direction = 'rtl'; g.fillStyle = '#edebe0'; g.font = '500 32px ' + FF; g.fillText('مديرية أوقاف حلب', W / 2, H - 34);
      download(c, isWa ? 'باركود-واتساب-للطباعة.png' : 'باركود-للطباعة.png');
    });
  });

  start();
})();
