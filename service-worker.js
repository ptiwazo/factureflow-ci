/* =====================================================================
   FactureFlow CI — Service Worker
   ---------------------------------------------------------------------
   Phase 1 : rend l'app installable et met en cache le "shell" statique
   (HTML/CSS/JS/icônes) pour un démarrage rapide même en réseau instable.
   Le support offline complet des données est prévu en Phase 3 ; ici on
   ne met JAMAIS en cache les appels Supabase ni le proxy IA.
===================================================================== */
const CACHE = "factureflow-ci-v12";

// Shell statique. (Les modules JS sont chargés dynamiquement ; on met en
// cache l'essentiel et on laisse le réseau gérer le reste avec repli cache.)
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ne traiter que le GET de même origine. Tout le reste (POST, Supabase,
  // proxy IA, Storage) passe directement par le réseau.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, repli sur le shell en cache (offline launch).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Assets de l'app : RÉSEAU D'ABORD (les nouveaux déploiements gagnent
  // toujours quand on est en ligne), avec mise en cache pour le repli hors-ligne.
  // Cache-first était problématique : il figeait l'app sur une vieille version.
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req)) // hors-ligne → dernière version connue
  );
});
