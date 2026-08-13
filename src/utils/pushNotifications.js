// src/utils/pushNotifications.js
//
// Maamulka Web Push (FCM) ee dhinaca client-ka:
//   - enablePush({schoolCode, role})  -> weydii ogolaansho, hel token,
//                                        keydi Firestore (fcmTokens/{token}).
//   - listenForegroundPush()          -> tus ogeysiis marka app-ku FURAN yahay.
//
// Push-ka gaadha marka browser-ku XIRAN yahay wuxuu ka yimaadaa Cloud
// Function (server), oo isticmaala public/firebase-messaging-sw.js.

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { halbeegApp, db } from "../firebase/firebase";

// ⚠️ KU DHEJI VAPID KEY-GAAGA HALKAN.
// Firebase Console -> Project Settings -> Cloud Messaging ->
// Web Push certificates -> "Key pair" (public key).
export const VAPID_KEY = "BLLeowyQr9bfEHlShRwaVOS6nbhChjIMrPbNLUNTHowES4d3td9l0iT8Ih6M7D8mYvkZg_0bMIcq1fJQ6ISxlQ8";

let messagingInstance = null;

async function getMessagingSafe() {
  try {
    const supported = await isSupported();
    if (!supported) return null; // iOS Safari duug ama browser aan taageerin
    if (!messagingInstance) messagingInstance = getMessaging(halbeegApp);
    return messagingInstance;
  } catch (err) {
    console.log("Messaging lama taageerin:", err);
    return null;
  }
}

// Diiwaangeli service worker-ka background-ka.
async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    return reg;
  } catch (err) {
    console.error("SW registration failed:", err);
    return null;
  }
}

// Weydii ogolaansho, hel token, keydi Firestore.
// Wuxuu soo celiyaa token-ka (ama null haddii aan la ogolaan/taageerin).
export async function enablePush({ schoolCode = "", role = "" } = {}) {
  if (VAPID_KEY.startsWith("PASTE_")) {
    console.warn(
      "VAPID_KEY weli lama dhejin — push ma shaqeyn doono ilaa la dhejiyo."
    );
    return null;
  }

  const messaging = await getMessagingSafe();
  if (!messaging) return null;

  // Weydii ogolaanshaha (kaliya qofka riixa 'Allow').
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  const reg = await registerSW();
  if (!reg) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;

    // Keydi token-ka + schoolCode si Cloud Function-ku u diri karo.
    await setDoc(
      doc(db, "fcmTokens", token),
      {
        token,
        schoolCode: schoolCode || "",
        role: role || "",
        platform: navigator.userAgent || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (err) {
    console.error("getToken failed:", err);
    return null;
  }
}

// Marka app-ku FURAN yahay oo push yimaado -> tus ogeysiis gudaha browser-ka.
export async function listenForegroundPush() {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    const title =
      payload?.notification?.title || payload?.data?.title || "HALBEEG SCHOOLS";
    const body = payload?.notification?.body || payload?.data?.body || "";

    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch (e) {
        // qaar browser-ada ma ogola Notification toos ah — iska dhaaf
        console.log(title, body);
      }
    }
  });

  return unsub;
}