/* ==========================================================================
   Fehlerliste — Service Worker

   Strategie:
     · eigene Dateien (App-Shell)   → Cache zuerst, im Hintergrund erneuern
     · Seitenaufruf (Navigation)    → Netz zuerst, notfalls die gecachte Seite
     · Schriften und Firebase-SDK   → Cache zuerst (feste, versionierte URLs)
     · Firestore, Auth, alles Übrige → nur Netz, ohne Zwischenspeicher

   Nach Änderungen an den Dateien unten VERSION hochzählen — dann räumt der
   Worker beim nächsten Start die alten Caches ab.
   ========================================================================== */

const VERSION = 'v2';
const CACHE_STATISCH = `fehlerliste-${VERSION}-statisch`;
const CACHE_EXTERN   = `fehlerliste-${VERSION}-extern`;
const AKTUELL = [CACHE_STATISCH, CACHE_EXTERN];

// Relativ zum Speicherort des Workers — läuft dadurch auch unter
// https://name.github.io/Fehlerliste/ ohne Anpassung.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// Fremde Hosts, deren Antworten unveränderlich sind und daher gecacht werden.
const EXTERN_ERLAUBT = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://www.gstatic.com/firebasejs/'
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATISCH);
    // Einzeln laden: eine fehlende Datei soll nicht die ganze Installation kippen.
    await Promise.all(APP_SHELL.map((pfad) =>
      cache.add(new Request(pfad, { cache: 'reload' }))
           .catch((f) => console.warn('[sw] nicht gecacht:', pfad, f))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter((n) => n.startsWith('fehlerliste-') && !AKTUELL.includes(n))
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;

  const url = new URL(anfrage.url);

  // 1 · Seitenaufruf: Netz zuerst, damit Änderungen sofort ankommen.
  if (anfrage.mode === 'navigate') {
    ereignis.respondWith(netzZuerst(anfrage));
    return;
  }

  // 2 · Eigene Dateien: sofort aus dem Cache, Erneuerung im Hintergrund.
  if (url.origin === self.location.origin) {
    ereignis.respondWith(cacheZuerst(anfrage, CACHE_STATISCH));
    return;
  }

  // 3 · Schriften und SDK: feste URLs, dürfen dauerhaft im Cache liegen.
  if (EXTERN_ERLAUBT.some((praefix) => anfrage.url.startsWith(praefix))) {
    ereignis.respondWith(cacheZuerst(anfrage, CACHE_EXTERN));
    return;
  }

  // 4 · Alles Übrige (Firestore, Auth, Google-Anmeldung): unangetastet ans Netz.
});

async function netzZuerst(anfrage) {
  const cache = await caches.open(CACHE_STATISCH);
  try {
    const antwort = await fetch(anfrage);
    if (antwort && antwort.ok) cache.put('./index.html', antwort.clone());
    return antwort;
  } catch (fehler) {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

async function cacheZuerst(anfrage, cacheName) {
  const cache = await caches.open(cacheName);
  const gecacht = await cache.match(anfrage);

  const ausDemNetz = fetch(anfrage).then((antwort) => {
    // Fehlerseiten und undurchsichtige Antworten nicht ablegen.
    if (antwort && antwort.ok && antwort.type !== 'opaque') cache.put(anfrage, antwort.clone());
    return antwort;
  }).catch(() => null);

  if (gecacht) { ereignisFrei(ausDemNetz); return gecacht; }

  const antwort = await ausDemNetz;
  return antwort || new Response('', { status: 504, statusText: 'Offline' });
}

// Aktualisierung im Hintergrund; ein Fehlschlag darf nichts umwerfen.
function ereignisFrei(versprechen) { versprechen.catch(() => {}); }
