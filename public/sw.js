/* eslint-disable no-restricted-globals */

const CACHE_PREFIX = 'limur-project-shell-';
const CACHE_VERSION = 'v4';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const CORE_SHELL_PATHS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
];

const SUPABASE_API_PATH_RE = /\/(rest|realtime|auth|storage|functions)\/v1(\/|$)/i;
const DEV_INTERNAL_PATH_RE = /(\/@vite\/|\/@react-refresh|\/__vite_ping|\/@fs\/|\.hot-update\.)/i;
const STATIC_ASSET_EXT_RE = /\.(js|mjs|cjs|css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|json)$/i;

function resolveScopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function isSupabaseUrl(url) {
  const host = url.hostname.toLowerCase();
  if (
    host === 'supabase.co' ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.in') ||
    host.endsWith('.supabase.net')
  ) {
    return true;
  }
  return SUPABASE_API_PATH_RE.test(url.pathname);
}

function isGoogleFontsUrl(url) {
  const host = url.hostname.toLowerCase();
  return host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com';
}

function shouldBypassServiceWorker(request, url) {
  // Strictly bypass all non-GET methods (POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
  if (request.method !== 'GET') {
    return true;
  }

  // Only handle HTTP(S) requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  // Strictly exclude all Supabase REST / Realtime / Auth / Storage requests
  if (isSupabaseUrl(url)) {
    return true;
  }

  // Exclude requests carrying Supabase API auth headers (including custom self-hosted Supabase domains)
  if (request.headers.has('apikey') || request.headers.has('x-client-info')) {
    return true;
  }

  // Allow Google Fonts for the condensed brand logo; strictly bypass all other cross-origin requests
  if (url.origin !== self.location.origin && !isGoogleFontsUrl(url)) {
    return true;
  }

  // Never intercept Service Worker script itself so browser updates work reliably
  if (url.pathname.endsWith('/sw.js')) {
    return true;
  }

  // Never cache Vite dev-server / HMR internal endpoints
  if (DEV_INTERNAL_PATH_RE.test(url.pathname)) {
    return true;
  }

  return false;
}

function isNavigationRequest(request) {
  if (request.mode === 'navigate') {
    return true;
  }
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isCacheableResponse(response) {
  if (!response) {
    return false;
  }
  if (response.type === 'opaque') {
    return true;
  }
  if (!response.ok) {
    return false;
  }
  return response.type === 'basic' || response.type === 'cors';
}

function extractAssetUrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  const attrRegex = /<(?:script|link)\b[^>]+?(?:src|href)=["']([^"']+)["']/gi;
  let match = attrRegex.exec(html);

  while (match !== null) {
    const rawRef = match[1];
    if (rawRef && !rawRef.startsWith('data:') && !rawRef.startsWith('mailto:')) {
      try {
        const resolved = new URL(rawRef, baseUrl);
        if (
          resolved.origin === self.location.origin &&
          !isSupabaseUrl(resolved) &&
          !DEV_INTERNAL_PATH_RE.test(resolved.pathname) &&
          !resolved.pathname.endsWith('/sw.js')
        ) {
          urls.add(resolved.href);
        }
      } catch {
        // Ignore malformed asset URL
      }
    }
    match = attrRegex.exec(html);
  }

  return Array.from(urls);
}

async function safeCacheUrl(cache, urlString) {
  try {
    const url = new URL(urlString, self.registration.scope);
    if (
      url.origin !== self.location.origin ||
      isSupabaseUrl(url) ||
      DEV_INTERNAL_PATH_RE.test(url.pathname) ||
      url.pathname.endsWith('/sw.js')
    ) {
      return;
    }

    const response = await fetch(new Request(url.href, { cache: 'no-cache' }));
    if (isCacheableResponse(response)) {
      await cache.put(url.href, response);
    }
  } catch {
    // Ignore individual precache failures so SW install stays resilient
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  const coreUrls = CORE_SHELL_PATHS.map(resolveScopeUrl);
  await Promise.allSettled(coreUrls.map((url) => safeCacheUrl(cache, url)));

  try {
    const indexUrl = resolveScopeUrl('./index.html');
    const rootUrl = resolveScopeUrl('./');
    const htmlResponse = await fetch(new Request(indexUrl, { cache: 'no-cache' }));

    if (isCacheableResponse(htmlResponse)) {
      const htmlText = await htmlResponse.clone().text();
      await Promise.all([
        cache.put(indexUrl, htmlResponse.clone()),
        cache.put(rootUrl, htmlResponse.clone()),
      ]);

      const discoveredAssets = extractAssetUrlsFromHtml(htmlText, indexUrl);
      await Promise.allSettled(
        discoveredAssets.map((assetUrl) => safeCacheUrl(cache, assetUrl))
      );
    }
  } catch {
    // Offline during install or HTML unavailable — keep already cached core assets
  }
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const indexUrl = resolveScopeUrl('./index.html');
  const rootUrl = resolveScopeUrl('./');

  // Strategy: Network-First with Cache fallback
  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      const cloned = networkResponse.clone();
      await Promise.allSettled([
        cache.put(request, cloned.clone()),
        cache.put(indexUrl, cloned.clone()),
        cache.put(rootUrl, cloned),
      ]);
    }
    return networkResponse;
  } catch {
    const cachedExact = await cache.match(request);
    if (cachedExact) {
      return cachedExact;
    }

    const cachedIgnoreSearch = await cache.match(request, { ignoreSearch: true });
    if (cachedIgnoreSearch) {
      return cachedIgnoreSearch;
    }

    const cachedIndex = await cache.match(indexUrl);
    if (cachedIndex) {
      return cachedIndex;
    }

    const cachedRoot = await cache.match(rootUrl);
    if (cachedRoot) {
      return cachedRoot;
    }

    return new Response(
      '<!doctype html><html lang="ru"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>LIMUR PROJECT — Офлайн</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;padding:24px}.box{max-width:420px;border:1px solid #0A0A0A;padding:24px}.brand{font-size:12px;font-weight:700;letter-spacing:.18em}h1{margin:12px 0 8px;font-size:18px}p{margin:0 0 16px;font-size:13px;line-height:1.5;color:#525252}button{background:#0A0A0A;color:#fff;border:0;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer}</style></head><body><div class="box"><div class="brand">LI.MUR PROJECT</div><h1>Нет подключения к интернету</h1><p>Локальная оболочка приложения ещё не была сохранена в кэш браузера. Откройте приложение один раз при подключении к сети, чтобы включить полноценный офлайн-режим.</p><button onclick="location.reload()">Повторить</button></div></body></html>',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

function handleStaticAssetRequest(event, request) {
  // Strategy: Stale-While-Revalidate
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cachedResponse) => {
      const networkFetchPromise = fetch(request)
        .then((networkResponse) => {
          if (isCacheableResponse(networkResponse)) {
            cache.put(request, networkResponse.clone()).catch(() => {
              // Ignore storage quota errors
            });
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkFetchPromise);
        return cachedResponse;
      }

      return networkFetchPromise.then((networkResponse) => {
        if (networkResponse) {
          return networkResponse;
        }
        return Response.error();
      });
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAppShell().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((oldName) => caches.delete(oldName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'WARM_CACHE' && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const uniqueUrls = Array.from(new Set(data.urls));
        await Promise.allSettled(
          uniqueUrls.map(async (rawUrl) => {
            if (typeof rawUrl !== 'string') return;
            try {
              const url = new URL(rawUrl, self.registration.scope);
              if (
                url.origin !== self.location.origin ||
                isSupabaseUrl(url) ||
                DEV_INTERNAL_PATH_RE.test(url.pathname) ||
                url.pathname.endsWith('/sw.js')
              ) {
                return;
              }
              if (!STATIC_ASSET_EXT_RE.test(url.pathname) && url.pathname !== new URL('./', self.registration.scope).pathname) {
                return;
              }
              const existing = await cache.match(url.href);
              if (!existing) {
                await safeCacheUrl(cache, url.href);
              }
            } catch {
              // Ignore invalid URL
            }
          })
        );
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strictly pass through Supabase API, non-GET mutations, non-font cross-origin, and dev internals
  if (shouldBypassServiceWorker(request, url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleStaticAssetRequest(event, request));
});
