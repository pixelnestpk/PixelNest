/* OneSignal Web Push worker code — imported FIRST, inside this same
   worker, so OneSignal push messages are received and displayed by
   the store's existing service worker even when the app is fully
   closed. The pages point OneSignal's serviceWorkerPath at this
   file (sw.js), so no separate OneSignal worker fights over the
   scope. If this import ever fails (offline first install), the
   rest of the worker below still runs exactly as before. */
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch(e){}

/* PixelNest service worker — app-shell caching.
   v14: persistent sign-in (Firebase LOCAL persistence, so a user
   signed in once stays signed in); sign-in with an unknown email
   auto-switches to the Sign Up form; order delivery email wiring
   (sendDeliveryReadyEmail, placeholder template ID — send skipped
   until a real delivery template is set). Same seller exclusion,
   sign-up name, email verification, WhatsApp-style notification
   read/unread and OneSignal REST key as v13. OneSignal push (Web
   SDK v16) — the worker imports the OneSignal worker code first, so
   pushes arrive even when the app is fully closed. Same shell, new
   cache version so phones pick up the new build.
   Caches the store page and its static assets (cache-first for
   same-origin files, network-first for page navigations with a
   cached fallback), so the store opens fast on repeat visits and
   keeps working when the phone is offline. Cross-origin requests
   (Firebase, fonts, payment/file hosts) are never cached — they
   always go to the network, so orders, accounts and live stats
   stay live. Bump CACHE_VERSION whenever the shell changes.

   v2 fix: the app shell is the explicit file "index.html",
   never the bare directory "index.html" — a directory URL can answer
   404 on some hosts, which is what the installed app used to
   open to. Navigations that come back 404 (or fail outright)
   now fall back to the cached store page instead of showing
   the host's error page.

   v3: the store is split into separate pages (Home at
   "index.html", the other pages beside this worker:
   shop.html, categories.html, why-us.html, about.html,
   contact.html, track-order.html). Every page is cached under
   its own URL — a navigation is stored and served by the exact
   address it was requested with, falling back to the cached
   copy of that same page, then to the Home page. */
var CACHE_VERSION = "pixelnest-shell-v14";
var SHELL_URLS = [
  "index.html",
  "shop.html",
  "categories.html",
  "why-us.html",
  "about.html",
  "contact.html",
  "track-order.html",
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

/* Seller order alerts: the page shows new-order notifications
   through this worker (registration.showNotification with
   requireInteraction, so an alert stays in the tray until the
   seller dismisses it). Tapping one brings the store back to the
   front — an already-open window is focused, otherwise the store
   home page is opened — and the notification is cleared. */
self.addEventListener("notificationclick", function(event){
  /* OneSignal pushes are handled by OneSignal's own click handler
     (imported above), which opens the store URL they carry. This
     handler is only for the store's LOCAL seller alerts, whose
     tags start with "pixelnest-" — leave every other notification
     (OneSignal pushes included) to its own handler. */
  var tg = (event.notification && event.notification.tag) || "";
  if(tg.indexOf("pixelnest-") !== 0) return;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if("focus" in list[i]) return list[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow("index.html");
    })
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
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
          return res;
        }
        return caches.match(req).then(function(hit){
          return hit || caches.match("index.html").then(function(h2){ return h2 || res; });
        });
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match("index.html").then(function(h2){ return h2 || Response.error(); });
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
