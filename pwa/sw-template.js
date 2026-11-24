// Jhusey FC service worker. `npm run build` turns this template into dist/sw.js
// (see vite.config.ts): VERSION and PRECACHE are filled in for each build.
//
// What it caches: only the app's own files (HTML shell, JS, CSS, icons) and Google Fonts.
// What it never caches: Supabase (API, auth, storage). Attendance, fines, payments and sign-in
// always come live from the server, so nothing private or stale is kept on the phone.
/* global self, caches, fetch, Response */

const VERSION = /* __VERSION__ */ 'dev'
const PRECACHE = /* __PRECACHE__ */ []
const SHELL = `jfc-shell-${VERSION}`
const FONTS = 'jfc-fonts'

self.addEventListener('install', (event) => {
  // A new version installs in the background and then waits: the app shows
  // "New version available" and only switches when the member taps Reload.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('jfc-shell-') && key !== SHELL)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // Pages: network first, so a new deploy is used right away; offline -> the cached shell.
      event.respondWith(
        fetch(request).catch(
          async () =>
            (await caches.match('/', { cacheName: SHELL, ignoreVary: true })) ?? Response.error(),
        ),
      )
      return
    }
    if (PRECACHE.includes(url.pathname)) {
      // App files have content-hashed names: the cached copy is always correct. ignoreVary:
      // scripts are requested with an Origin header, the precache without one.
      event.respondWith(
        caches
          .match(request, { cacheName: SHELL, ignoreVary: true })
          .then((hit) => hit ?? fetch(request)),
      )
    }
    return
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request))
  }
  // Anything else (Supabase) is not intercepted: straight to the network, never cached.
})

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONTS)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => cached ?? Response.error())
  return cached ?? network
}
