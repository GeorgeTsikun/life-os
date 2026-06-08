const CACHE = 'life-os-v1';
const STATIC = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/components.css',
  '/css/screens.css',
  '/js/app.js',
  '/js/db.js',
  '/js/gamification.js',
  '/js/telegram.js',
  '/js/screens/dash.js',
  '/js/screens/tasks.js',
  '/js/screens/health.js',
  '/js/screens/projects.js',
  '/js/screens/people.js',
  '/js/screens/achievements.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-first for Supabase API
  if (url.hostname.includes('supabase')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});

// Background sync for offline task creation
self.addEventListener('sync', e => {
  if (e.tag === 'sync-tasks') {
    e.waitUntil(syncPendingTasks());
  }
});

async function syncPendingTasks() {
  // Tasks saved offline will be synced when connection returns
  // Implementation handled in db.js
}
