const CACHE = 'pool-eyes-v29';

const SHELL = [
  './',
  './index.html',
  './problems.html',
  './styles.css',
  './app.js',
  './problems.js',
  './pool-problems.js',
  './supabase-db.js',
  './config.js',
  './i18n/i18n.js',
  './i18n/ru.js',
  './i18n/en.js',
  './i18n/es.js',
  './i18n/pool-problems-ru.js',
  './i18n/pool-problems-en.js',
  './i18n/pool-problems-es.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

async function openCache() {
  return caches.open(CACHE);
}

function stripSearch(url) {
  const clean = new URL(url);
  clean.search = '';
  return clean.toString();
}

async function matchCached(request) {
  const cache = await openCache();
  const direct = await cache.match(request);
  if (direct) return direct;

  const noSearch = await cache.match(stripSearch(request.url));
  if (noSearch) return noSearch;

  const url = new URL(request.url);
  const basePath = url.pathname.replace(/\/[^/]*$/, '/');
  const fileName = url.pathname.split('/').pop();
  if (fileName) {
    const relative = await cache.match('./' + fileName);
    if (relative) return relative;
    const nested = await cache.match(basePath + fileName);
    if (nested) return nested;
  }

  return null;
}

async function precacheAssets(urls) {
  const cache = await openCache();
  await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) {
        await cache.put(url, response.clone());
        await cache.put(stripSearch(url), response.clone());
      }
    } catch (err) {
      console.warn('[sw] precache skip', url, err);
    }
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(
    precacheAssets(SHELL).then(() => self.skipWaiting())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate'
    || request.destination === 'document'
    || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

async function respondFromNetworkThenCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await openCache();
      const copy = response.clone();
      cache.put(request, copy);
      cache.put(stripSearch(request.url), copy);
    }
    return response;
  } catch {
    const cached = await matchCached(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/i18n/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => matchCached(event.request))
    );
    return;
  }

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      respondFromNetworkThenCache(event.request).catch(async () => {
        const cached = await matchCached(event.request);
        if (cached) return cached;
        if (url.pathname.includes('problems')) {
          const problems = await caches.match('./problems.html');
          if (problems) return problems;
        }
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    respondFromNetworkThenCache(event.request).catch(() => matchCached(event.request))
  );
});
