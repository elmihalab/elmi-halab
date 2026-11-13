/* ============================================================
   عامل الخدمة لصفحة الأذكار — شعبة الشؤون العلمية في حلب
   ------------------------------------------------------------
   يحفظ صفحة الأذكار وبياناتها وخطوطها على الجهاز عند أول زيارة،
   فتعمل بعدها دون إنترنت. نطاقه صفحة الأذكار وحدها (/adhkar)،
   ولا يمسّ الصفحة الرئيسية.

   عند كل إصدار جديد: غيّر V هنا بما يوافق ?v= في adhkar.html،
   فيُحفظ الجديد ويُحذف القديم وحده.
   ============================================================ */
var V = '2.6';
var CACHE = 'adhkar-' + V;
var Q = '?v=' + V;

// ما لا تعمل الصفحة بدونه: إن تعذّر شيء منه لم يُثبَّت العامل
var CORE = ['/adhkar', '/adhkar-data.js' + Q, '/adhkar.js' + Q, '/search.js' + Q, '/style.css' + Q, '/adhkar-more.js' + Q];
// ما يُحسّنها: يُحفظ ما تيسّر منه
var EXTRA = [
  '/content.js' + Q, '/times/index.json', '/times/g0.json', '/adhkar.webmanifest',
  '/fonts/noto-naskh-arabic-400-normal.woff2', '/fonts/tajawal-arabic-400-normal.woff2', '/fonts/tajawal-arabic-500-normal.woff2',
  '/fonts/tajawal-arabic-700-normal.woff2', '/fonts/tajawal-arabic-900-normal.woff2',
  '/images/eagle.svg', '/images/favicon.svg', '/favicon.ico', '/images/pattern-light.svg', '/images/aleppo-skyline.png',
  '/images/adhkar-192.png', '/images/adhkar-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE.map(function (u) { return new Request(u, { cache: 'reload' }); })).then(function () {
      return Promise.all(EXTRA.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () { }); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('adhkar-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  e.respondWith(asset(req, e));
});

// الصفحة: من الشبكة أولًا ليصل كل تحديث، فإن تأخرت أو انقطعت فالمحفوظة
function page(req) {
  return caches.open(CACHE).then(function (c) {
    var net = fetch(req).then(function (r) {
      if (r && r.ok && r.type === 'basic' && !r.redirected) c.put('/adhkar', r.clone());
      return r;
    });
    net.catch(function () { });
    var late = new Promise(function (res) { setTimeout(res, 4000); });
    return Promise.race([net, late.then(function () { return null; })]).catch(function () { return null; }).then(function (r) {
      if (r) return r;
      return c.match('/adhkar').then(function (hit) {
        return hit || caches.match('/adhkar', { ignoreSearch: true }).then(function (h) { return h || net; });
      });
    });
  });
}

// الملفات: المحفوظ فورًا، ويُجدَّد من الشبكة في الخلفية
function asset(req, e) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') c.put(req, r.clone());
        return r;
      }).catch(function () { return null; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (r) {
        if (r) return r;
        return caches.match(req, { ignoreSearch: true }).then(function (any) {
          return any || new Response('', { status: 504, statusText: 'offline' });
        });
      });
    });
  });
}
