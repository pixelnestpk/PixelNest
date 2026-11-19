/* PixelNest service worker — app-shell caching.
   Caches the store page and its static assets (cache-first for
   same-origin files, network-first for page navigations with a
   cached fallback), so the store opens fast on repeat visits and
   keeps working when the phone is offline. Cross-origin requests
   (Firebase, fonts, payment/file hosts) are never cached — they
   always go to the network, so orders, accounts and live stats
   stay live. Bump CACHE_VERSION whenever the shell changes.

   v2 fix: the app shell is the explicit file "index.html",
   never the bare directory "../" — a directory URL can answer
   404 on some hosts, which is what the installed app used to
   open to. Navigations that come back 404 (or fail outright)
   now fall back to the cached store page instead of showing
   the host's error page.

   Deployment note: this file MUST live at the site root (sw.js),
   not under assets/ — a worker under assets/ can only control
   assets/*, so it could never control the store page and the
   install prompt would never fire. Its asset paths below are
   therefore root-relative (assets/...). */
var CACHE_VERSION = "pixelnest-shell-v2";
var SHELL_URLS = [
  "index.html",
  "assets/manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/apple-touch-icon.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      /* Individual adds: one missing file must not fail the install. */
      return Promise.all(SHELL_URLS.map(function(u){
        return cache.add(u).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch(e){ return; }
  if(url.origin !== self.location.origin) return; /* live services pass through */

  if(req.mode === "navigate"){
    /* Page: fresh copy first (prices/orders code stays current).
       A 404 or a network failure falls back to the cached store
       page, so the installed app never opens to an error page. */
    event.respondWith(
      fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put("index.html", copy); });
          return res;
        }
        return caches.match("index.html").then(function(hit){
          return hit || res;
        });
      }).catch(function(){
        return caches.match("index.html").then(function(hit){
          return hit || Response.error();
        });
      })
    );
    return;
  }

  /* Static files (images, manifest, icons): cache-first, then
     network — and keep a copy of whatever the network returns. */
  event.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
