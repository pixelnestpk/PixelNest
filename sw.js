/* v50: Urdu products — 8 new products + "Urdu Products" category (tile + filter + group); forces fresh shell cache so the new products reach phones. */
/* v45: Package #84 — Products table Price column + mobile scroll fix; forces fresh shell cache so the #83 categories fix reaches phones.
/* v44: Package #76c — (1) hero search bar REMOVED (only Install App
   stays in the hero; header search remains); (2) Buy mode is now a
   TRUE buyer preview — Buy Now / Add to Cart, cart drawer, reviews,
   stars and the LAUNCH10 badge all show, and the cart works, so the
   seller sees the store exactly as a buyer does. */

var CACHE_VERSION = "pixelnest-shell-v51";

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
       cache:"reload" forces a real network fetch, bypassing the
       browser HTTP cache — a refresh must show the newest version,
       never a stale copy. A 404 or a network failure falls back to
       the cached store page, so the installed app never opens to
       an error page. */

    event.respondWith(

      fetch(req, { cache: "reload" }).then(function(res){

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
