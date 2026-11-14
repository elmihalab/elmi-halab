/* مصحف الشهباء — يحفظ الموقع في الجهاز ليعمل دون إنترنت */
const SHELL_V = 'shahba-shell-0.8.0';
const PAGES = 'shahba-pages-v1';          // font packs never change: kept across versions
const DATA = 'shahba-data-v3';            // imlaei text, tafsir books, the phonetic reference: kept until their data changes
const VENDOR = 'shahba-vendor-v1';        // libraries with their version in the file name: kept across versions
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/tafsir.js', 'js/audio.js', 'js/tasmee-core.js', 'js/tasmee.js', 'js/tasmee-worker.js', 'js/tajweed-core.js', 'js/tajweed-worker.js', 'js/store.js', 'manifest.webmanifest', 'favicon.ico',
  'icons/eagle.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'fonts/Qomra-regular.ttf', 'fonts/Qomra-medium.ttf', 'fonts/Qomra-black.ttf', 'fonts/QCF_SurahHeader_COLOR-Regular.woff2', 'fonts/UthmanicHafs1Ver18.woff2',
  'data/pages.json', 'data/surahs.json', 'data/packs.json', 'data/glyphs.json', 'data/ayat.json'];

// each file on its own: one missing file must not stop the whole update (it is fetched later when asked for)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_V).then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // only this site's own old copies are removed: saved recitations and the downloaded models stay
  const old = k => (k.startsWith('shahba-shell-') && k !== SHELL_V) || (k.startsWith('shahba-data-') && k !== DATA);
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(old).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const big = url.pathname.includes('/fonts/pages/') || url.pathname.endsWith('/data/words.json');
  const data = url.pathname.includes('/data/t/') || url.pathname.endsWith('/data/imlaei.json') || url.pathname.endsWith('/data/ph-hafs.json');
  const lib = url.pathname.includes('/js/vendor/');
  if (big || data || lib) {
    e.respondWith(caches.open(big ? PAGES : lib ? VENDOR : DATA).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      let res = await fetch(req).catch(() => null);
      if (!res || !res.ok) res = await fetch(req.url, { cache: 'reload' });   // never trust a stored "not found"
      if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(SHELL_V).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(SHELL_V).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
