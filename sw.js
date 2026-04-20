// ===== Service Worker — محفظتي =====
const CACHE_NAME = 'mhfazti-v1';
const BASE = '/mhfazti-/';

// الملفات التي نخزنها للعمل بدون إنترنت
const FILES_TO_CACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json'
];

// عند التثبيت: خزّن الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// عند التفعيل: احذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// عند الطلب: قدّم من الكاش أولاً، ثم من الإنترنت
self.addEventListener('fetch', event => {
  // تجاهل طلبات API الخارجية (Google Apps Script)
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // خزّن النسخة الجديدة
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // لا إنترنت ولا كاش — أعد الصفحة الرئيسية
        if (event.request.destination === 'document') {
          return caches.match(BASE + 'index.html');
        }
      });
    })
  );
});
