// ===== Service Worker — محفظتي v2 =====
// ✅ يستخدم مسارات نسبية (./) فيشتغل في أي مجلد
// ✅ يدعم رسائل SMS من تاسكر حتى بدون إنترنت

const CACHE_NAME = 'mhfazti-v2';

// الملفات للتخزين المؤقت (مسارات نسبية)
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// التثبيت: تخزين الملفات
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .catch(err => console.log('SW install error (safe to ignore):', err))
  );
  self.skipWaiting();
});

// التفعيل: حذف الكاش القديم
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

// ✅ معالج الطلبات: Network-First للصفحة الرئيسية، Cache-First للبقية
self.addEventListener('fetch', event => {
  // تجاهل طلبات Google Apps Script تماماً (تحتاج الإنترنت دائماً)
  if (event.request.url.includes('script.google.com')) return;
  if (event.request.url.includes('docs.google.com')) return;

  // تجاهل طلبات POST (لا نخزنها)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ===== استراتيجية خاصة: إذا كانت الصفحة تحتوي ?sms= أو ?key= =====
  // (رسائل تاسكر) — نجيب الصفحة من الكاش فوراً ونمرر معاملات URL
  if (url.search && (url.search.includes('sms=') || url.search.includes('key='))) {
    event.respondWith(
      caches.match('./index.html')
        .then(cached => {
          if (cached) {
            // نعيد الصفحة من الكاش مع الحفاظ على URL (بما فيه ?sms=)
            return cached;
          }
          return fetch(event.request);
        })
        .catch(() => fetch(event.request))
    );
    return;
  }

  // ===== Network-First للصفحة الرئيسية =====
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // ===== Cache-First لباقي الموارد =====
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // إذا طلب صفحة ولا يوجد إنترنت → أعد index.html
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
