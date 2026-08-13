// src/components/PushSetup.jsx
//
// Component yar oo la geliyo meel kasta oo user login ah (tusaale admin
// Dashboard, teacher Dashboard, student Dashboard).
//   - Marka la furo, wuxuu weydiiyaa ogolaanshaha ogeysiisyada.
//   - Kaliya qofka riixa "Allow" ayaa token la keydiyaa.
//   - Wuxuu dejiyaa foreground listener (ogeysiis marka app-ku furan yahay).
//
// Isticmaal:
//   <PushSetup role="admin" schoolCode={getSchoolCode()} />
//   <PushSetup role="teacher" schoolCode={teacherSchoolCode} />
//   <PushSetup role="student" schoolCode={studentSchoolCode} />

import { useEffect, useState } from "react";
import { enablePush, listenForegroundPush } from "../utils/pushNotifications";

export default function PushSetup({ role = "", schoolCode = "" }) {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unsub = () => {};

    (async () => {
      // Dejii foreground listener (app furan).
      unsub = await listenForegroundPush();

      if (typeof Notification === "undefined") return;

      if (Notification.permission === "granted") {
        // Horeba waa la ogolaaday — cusbooneysii token-ka.
        await enablePush({ role, schoolCode });
      } else if (Notification.permission === "default") {
        // Weli lama weydiin — tus badge yar oo "Allow".
        setNeedsPermission(true);
      }
      // 'denied' -> waxba ma samayn karno; user-ka ayaa browser-ka ka furi kara.
    })();

    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, schoolCode]);

  const handleEnable = async () => {
    setBusy(true);
    const token = await enablePush({ role, schoolCode });
    setBusy(false);
    if (token) setNeedsPermission(false);
  };

  if (!needsPermission) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: "#0f2e1d",
        color: "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 10px 30px rgba(0,0,0,.3)",
        maxWidth: 320,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 22 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Ogeysiisyada shid</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
          Hel war iyo fariimo xitaa marka app-ku xiran yahay.
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        style={{
          background: "#fff",
          color: "#0f2e1d",
          border: "none",
          borderRadius: 10,
          padding: "8px 12px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "..." : "Allow"}
      </button>
    </div>
  );
}