/*
 * Boshqaruv paneli uchun service worker.
 *
 * Vazifasi ikkitagina:
 *   1. Panelni telefonga/kompyuterga ilova sifatida o'rnatish imkonini berish.
 *   2. Internet uzilganda oq ekran o'rniga tushunarli sahifa ko'rsatish.
 *
 * Ataylab HECH NARSA keshlanmaydi (offline sahifadan boshqa). Panelda
 * har doim eng oxirgi versiya turishi kerak — eskirgan JS bilan ishlash
 * buyurtmani yo'qotishdan ko'ra yomonroq.
 */

const OFFLINE_CACHE = 'afsona-admin-offline-v1'
const OFFLINE_URL = '/offline-admin.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)),
  )
  // Yangi versiya kutib turmasin
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  // Faqat sahifaga o'tishlarni ushlaymiz. Qolgan hamma so'rov (JS, rasm,
  // Firestore, /api) tegilmasdan brauzerga o'tadi — mini app ham shu
  // service worker qamrovida, unga umuman aralashmasligimiz kerak.
  if (request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (!url.pathname.startsWith('/admin')) return

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL)),
  )
})
