const CACHE = 'webserial-crtk-v1';
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/index_advanced.html',
    '/manifest.webmanifest',
    '/static/css/styles.css',
    '/static/css/index-styles.css',
    '/static/css/index-advanced-styles.css',
    '/static/js/script.js',
    '/static/js/index-script.js',
    '/static/js/index-advanced-script.js',
    '/static/logo.png',
    '/static/icons/icon-192.svg',
    '/static/icons/icon-512.svg',
    '/conf_files/advanced/NavX_bluetooth.cfg',
    '/conf_files/advanced/NavX_GNSS_Mixed.cfg',
    '/conf_files/advanced/NavX_GNSS_Openfield.cfg',
    '/conf_files/advanced/NavX_GNSS_Town.cfg',
    '/conf_files/advanced/RTKBase_GNSS_UM980.cfg',
    '/conf_files/advanced/RTKBase_GNSS_UM982.cfg',
    '/conf_files/user/manifest.json',
    '/conf_files/user/NavX_GNSS_Mixed.cfg',
    '/conf_files/user/NavX_GNSS_Openfield.cfg',
    '/conf_files/user/NavX_GNSS_Town.cfg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const req = event.request;
    // Only handle same-origin GET requests
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

    event.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(resp => {
            return caches.open(CACHE).then(cache => {
                cache.put(req, resp.clone());
                return resp;
            });
        }).catch(() => caches.match('/index.html')))
    );
});
