const { setGlobalOptions } = require("firebase-functions");
const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

setGlobalOptions({ maxInstances: 10 });

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

async function tokensForSchool(schoolCode) {
  let snap;

  if (schoolCode === "ALL") {
    snap = await db.collection("fcmTokens").get();
  } else {
    snap = await db
      .collection("fcmTokens")
      .where("schoolCode", "==", schoolCode)
      .get();
  }

  const tokens = [];

  snap.forEach((d) => {
    const t = d.data().token || d.id;
    if (t) tokens.push(t);
  });

  return [...new Set(tokens)];
}

async function sendToTokens(tokens, title, body, url) {
  if (!tokens.length) {
    logger.info("Push: token lama helin.");
    return;
  }

  const messaging = getMessaging();

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);

    const res = await messaging.sendEachForMulticast({
      tokens: chunk,

      notification: {
        title,
        body,
      },

      data: {
        title: String(title || ""),
        body: String(body || ""),
        url: String(url || "/"),
      },

      webpush: {
        fcmOptions: {
          link: String(url || "/"),
        },

        notification: {
          icon: "/favicon.ico",
        },
      },
    });

    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error && r.error.code;

        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          db
            .collection("fcmTokens")
            .doc(chunk[idx])
            .delete()
            .catch(() => {});
        }
      }
    });

    logger.info(
      `Push: ${res.successCount} guul / ${res.failureCount} fashil`
    );
  }
}

// Notifications → Push
exports.sendPushOnNotification = onDocumentCreated(
  "notifications/{id}",
  async (event) => {
    const data = event.data && event.data.data();

    if (!data) return;

    const target = data.targetSchoolCode || "ALL";
    const title = "Ogeysiis cusub";
    const body = data.message || "";

    const tokens = await tokensForSchool(target);

    await sendToTokens(
      tokens,
      title,
      body,
      "/admin/dashboard"
    );
  }
);

// News → Push
exports.sendPushOnNews = onDocumentCreated(
  "news/{id}",
  async (event) => {
    const data = event.data && event.data.data();

    if (!data) return;

    const schoolCode = data.schoolCode || "";

    if (!schoolCode) return;

    const title = data.schoolName
      ? `War: ${data.schoolName}`
      : "War cusub";

    const body = data.text || "";

    const tokens = await tokensForSchool(schoolCode);

    await sendToTokens(
      tokens,
      title,
      body,
      "/news"
    );
  }
);