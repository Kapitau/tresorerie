/* Service worker — Trésorerie AJLEC (v1.0.3)
   Réseau d'abord : les mises à jour arrivent dès qu'il y a du réseau.
   La copie en cache ne sert qu'en secours (hors ligne) et n'est JAMAIS remplacée par autre chose
   que la vraie page de l'application (pas d'écran de connexion, pas de page d'erreur).
   Ce fichier ne touche jamais aux données : elles restent dans le stockage de l'application. */
const V = 'ajlec-treso-v1.0.3';
const FICHIERS = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const MARQUEUR = 'name="ajlec-app"';

self.addEventListener('install', e => {
  // Chaque fichier est ajouté séparément : un fichier introuvable ne bloque pas l'installation.
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(FICHIERS.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(repondre(req));
});

async function repondre(req) {
  const cache = await caches.open(V);
  const copie = async () =>
    (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
  try {
    const r = await fetch(req);
    // Redirection ou accès refusé (ex. site repassé en privé : écran de connexion) : on garde la copie de l'app.
    if (r.redirected || r.status === 401 || r.status === 403) return (await copie()) || r;
    // 404 et autres erreurs : vraie réponse, jamais mise en cache.
    if (!r.ok) return r;
    // Une page HTML qui n'est pas l'application n'est ni affichée à la place de la copie, ni mise en cache.
    if ((r.headers.get('content-type') || '').includes('text/html')) {
      const texte = await r.clone().text();
      if (!texte.includes(MARQUEUR)) return (await copie()) || r;
    }
    cache.put(req, r.clone());
    return r;
  } catch (err) {
    return (await copie()) || Response.error(); // hors ligne
  }
}
