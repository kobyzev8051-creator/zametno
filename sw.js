// «Заметно» — заметки и дела. © 2026 Кобызев С. Е. Все права защищены.
//
// Фоновый модуль приложения: сохраняет файлы приложения на устройстве,
// чтобы оно открывалось и работало без интернета.
// При изменении файлов приложения увеличьте номер версии — устройства получат обновление.
const CACHE = 'zametno-v2';

const FILES = [
  './',
  './index.html',
  './help.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// Удаляем файлы старых версий
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала пробуем сеть (чтобы приходили обновления), без сети — берём сохранённое
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || caches.match('./index.html')))
  );
});
