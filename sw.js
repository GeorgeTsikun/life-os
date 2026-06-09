// ── Service Worker — ВРЕМЕННО ОТКЛЮЧЁН ──────────────────────────────────────
// Старая версия слишком жёстко кэшировала и не давала видеть новые экраны.
// Этот пустой SW заменяет старый, чистит все его кэши, и unregister-ит себя.
// После активации страница загружается напрямую с сети.

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Удаляем все старые кэши
    const ключи = await caches.keys();
    await Promise.all(ключи.map(k => caches.delete(k)));
    // Берём контроль над всеми вкладками
    await self.clients.claim();
    // Само-разрегистрация — следующий заход уже без SW
    await self.registration.unregister();
    // Заставляем все открытые вкладки перезагрузиться
    const клиенты = await self.clients.matchAll({ type: 'window' });
    клиенты.forEach(c => c.navigate(c.url));
  })());
});

// Все fetch-запросы идут напрямую в сеть (никакого кэширования)
self.addEventListener('fetch', e => {
  // ничего не делаем — браузер сам обработает
});
