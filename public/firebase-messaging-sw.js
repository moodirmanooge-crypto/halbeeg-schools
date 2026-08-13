/* public/firebase-messaging-sw.js
 *
 * Service Worker-ka background-ka ee FCM.
 * Kani wuxuu shaqeeyaa xitaa marka browser-ku XIRAN yahay — wuxuu helaa
 * push-ka Cloud Function-ku diray oo wuxuu tusaa ogeysiis (notification).
 *
 * MUHIIM: Faylkan waa inuu ku jiraa `public/` si uu ugu soo baxo
 * https://<domain>/firebase-messaging-sw.js (root-ka).
 * Ma isticmaali karo import module-ka app-ka, sidaas config-ka waa
 * hardcoded (rawaan-online-shop).
 */

importScripts(
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
  authDomain: "rawaan-online-shop.firebaseapp.com",
  projectId: "rawaan-online-shop",
  storageBucket: "rawaan-online-shop.firebasestorage.app",
  messagingSenderId: "492970437433",
  appId: "1:492970437433:web:92363b34f8407b596b56e8",
  measurementId: "G-FHNW9QG7DP",
});

const messaging = firebase.messaging();

// Marka push yimaado app-kuna XIRAN yahay (background):
messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    "HALBEEG SCHOOLS";

  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    "";

  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      // URL-ka la furo marka la taabto ogeysiiska (haddii la keeno).
      url: (payload.data && payload.data.url) || "/",
    },
  });
});

// Marka la taabto ogeysiiska -> fur app-ka (ama tab-ka horeba furan).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});