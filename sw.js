/* v39: Fiverr-style seller dashboard + refresh fix — (1) the dashboard
   now opens like a Fiverr seller profile: seller profile header
   (photo, name, SELLER badge, bio, level, store rating), "Your path
   to the next level" progress bar (completed orders toward the next
   milestone), and a My Products table with real orders + earned per
   product. (2) Refresh fix: the seller dashboard no longer
   auto-opens on page load/refresh — it opens only when he taps
   Seller Orders / Seller Account — and the buyer ("View Store")
   view now survives a refresh via localStorage. Same as v38
   otherwise.

   v38: Google sign-in on phones — the popup never opens the Google
   account chooser on mobile / installed-app (PWA) phones, so Google
   sign-in now goes straight to the full-page redirect flow there
   (Google account page opens in the same tab and returns to the
   store); desktop keeps popup-first with redirect fallback. Same
   as v37 otherwise.

   v37: Sign-in fixes — (1) the auth init no longer gives up after 15s:
   on a slow phone connection Firebase could still be loading when the
   60-retry cap expired, leaving every sign-in stuck on "Sign-in is
   still loading"; init() now retries every 250ms until Firebase is
   there, and Sign In / Sign in with Google / Resend verification all
   run ensureAuth() first so tapping the button itself retries the
   init, with a clear "check your internet connection and reload"
   message when the Firebase scripts did not load at all. (2) The
   Help chatbot button no longer covers the "Sign in with Google"
   button: it is hidden while the sign-in dialog is open and shown
   again when the dialog closes. Same as v36 otherwise.

   OneSignal Web Push worker code — imported FIRST, inside this same
   worker, so OneSignal push messages are received and displayed by
   the store's existing service worker even when the app is fully
   closed. The pages point OneSignal's serviceWorkerPath at this
   file (sw.js), so no separate OneSignal worker fights over the
   scope. If this import ever fails (offline first install), the
   rest of the worker below still runs exactly as before. */
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch(e){}

/* PixelNest service worker — app-shell caching.
   v29: Search/category fix — tapping a category chip clears any
   stale search text first, so the old query can no longer keep
   filtering after a category tap; the Shop restore block lets a
   restored category filter win over a stored query; the no-results
   area names the active query with a Clear search button.
   Same as v28 otherwise:
   v28: Chatbot intent-matching fix — informal, misspelt English is
   read the way a person reads it (typo-normalizer: "whay"->"what",
   "u"->"you", "halp"->"help"); "What can you do?" in ANY word
   order or spelling and "can I ask anything else?" / "anything
   else" all get the short help list; where something is completely
   not understood there is no more "Sorry, I didn't get that" — the
   bot directly shows its help list. Same as v27 otherwise:
   v27: Chatbot fix — a greeting gets only a short greeting back,
   "how can you help me?" gets only a short capabilities list (no
   Easypaisa steps), every answer is only that question's (withMore
   no longer appends the extra topic list), and all 23 languages'
   fallback answers are short, with no payment-system dump.
   Same as v26 otherwise:    v26: Completed-order upload lock — a Completed order's "Upload
   delivery file" button locks 48 hours after completion
   (deliveredAt, createdAt fallback): it becomes a disabled grey
   "Upload closed" button with a note, and the change handler +
   PixelDelivery.upload refuse locked uploads, so a file can never be
   sent again by accident. Same as v25 otherwise: STRICT seller/buyer
   separation — when the seller account is signed in the whole
   store hides and only the seller dashboard shows (products one line
   each, name + price); buyers never see any seller option; the
   notification test alert no longer hangs on serviceWorker.ready
   (getRegistration() + 700ms fallback). Help chat welcome is just 2 short lines
   — "Welcome, <name> to PixelNest!" then "You can talk in any
   language." — so the pills below it are visible without scrolling.
   Help chat ChatGPT-style + 3D intro once per session (sessionStorage
   flag, Home clicks skip it), WhatsApp chat button removed (only the
   foreigner checkout button + footer plain-text number remain), Help
   chat is a full-screen page and the assistant answers in the visitor
   language. 3D intro on the home page — full-screen THREE.js gold
   pixel-cube nest, Loading Store 0%->100% in ~7s, then Sign Up /
   View Store as Guest buttons into the real store (no demo text).
   Distinct professional colours (teal
   action buttons, violet PixelNest Assistant chatbot), PixelNest
   Assistant chatbot on the whole store (foreigner flow explained),
   checkout now asks "Are you from Pakistan or a foreigner?"
   (Foreigner = WhatsApp manual payment, no Trx ID), and completed
   orders leave the seller board automatically 2 days after
   completion (counts and Total Earned keep the full totals).
   OneSignal REST key is ABSENT in this static build (closed-app
   push disabled by design); in-app notifications and email still
   work. Same cart drawer 440px Remove fix, header loading state,
   footer delivery wording, auto-switch on ANY sign-in error,
   LAUNCH10 stale state fix, checkout gate on Sign In, EmailJS
   comment LIVE, seller dashboard LTR, delivery email
   (template_8bmn0gq), persistent sign-in, seller exclusion,
   sign-up name, email verification, WhatsApp-style notification
   read/unread as v25.
   OneSignal push (Web SDK v16) — the worker imports the OneSignal
   worker code first. Same shell, new cache version so phones pick
   up the new build.
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
var CACHE_VERSION = "pixelnest-shell-v39";
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
