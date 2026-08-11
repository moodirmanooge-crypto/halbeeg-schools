// src/admin/components/NotificationBell.jsx
// Bell icon + badge count + dropdown panel oo tuso fariimaha Super Admin-ka
// u diray school-kan (ama dhammaan schools-ka "ALL").
import { useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { db } from "../../firebase/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getSchoolCode } from "../../utils/schoolContext";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const wrapperRef = useRef(null);
  const schoolCode = getSchoolCode();

  // Dhagayso (real-time) labada nooc ee fariimaha: kuwa "ALL" iyo kuwa
  // gaarka u ah school-kan. Waxaan isku daraynaa oo ku kala saarnaa taariikhda.
  useEffect(() => {
    if (!schoolCode) return;

    const notifRef = collection(db, "notifications");

    // MUHIIM: orderBy waa la saaray labada query si aan looga baahnayn
    // "composite index" Firestore (where + orderBy). Kala-soobaynta taariikhda
    // waxaa lagu sameeyaa merge() gudaha (client-side). Sidaas ALL iyo school
    // gaar labaduba si hufan ayay u shaqeeyaan — mid uma baahdo index gaar ah.
    const qAll = query(
      notifRef,
      where("targetSchoolCode", "==", "ALL")
    );
    const qMine = query(
      notifRef,
      where("targetSchoolCode", "==", schoolCode)
    );

    let allDocs = [];
    let mineDocs = [];

    const merge = () => {
      const combined = [...allDocs, ...mineDocs];
      combined.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(combined);
    };

    const unsubAll = onSnapshot(
      qAll,
      (snap) => {
        allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        merge();
      },
      (err) => console.error("notifications ALL listener:", err)
    );
    const unsubMine = onSnapshot(
      qMine,
      (snap) => {
        mineDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        merge();
      },
      (err) => console.error("notifications school listener:", err)
    );

    return () => {
      unsubAll();
      unsubMine();
    };
  }, [schoolCode]);

  // Xir dropdown-ka marka la taabto meel kale oo bogga ah
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readBy?.[schoolCode]).length;

  // Calaamadi hal fariin in la akhriyay (readBy.{schoolCode} = true)
  const markAsRead = async (notif) => {
    if (notif.readBy?.[schoolCode]) return;
    try {
      await updateDoc(doc(db, "notifications", notif.id), {
        [`readBy.${schoolCode}`]: true,
      });
    } catch (err) {
      console.error("Khalad markii la calaamadeynayay akhrinta:", err);
    }
  };

  // Calaamadi dhammaan sida la akhriyay
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.readBy?.[schoolCode]);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, "notifications", n.id), {
          [`readBy.${schoolCode}`]: true,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatTime = (ts) => {
    if (!ts?.seconds) return "";
    const d = new Date(ts.seconds * 1000);
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 42,
          height: 42,
          borderRadius: 12,
          border: "1px solid rgba(17,24,39,0.08)",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(17,24,39,0.05)",
        }}
        aria-label="Notifications"
      >
        <Bell size={19} color="#374151" />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 999,
              background: "#dc2626",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 50,
            right: 0,
            width: 340,
            maxHeight: 420,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(17,24,39,0.14)",
            border: "1px solid rgba(17,24,39,0.06)",
            overflow: "hidden",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: "#111827" }}>
              Ogeysiisyada ({notifications.length})
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    color: "#16a34a",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <CheckCheck size={13} /> Dhammaan akhri
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <p style={{ padding: "24px 16px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>
                Weli ogeysiis lama helin.
              </p>
            ) : (
              notifications.map((n) => {
                const isRead = !!n.readBy?.[schoolCode];
                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #F9FAFB",
                      cursor: "pointer",
                      background: isRead ? "#fff" : "#F0FDF4",
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isRead ? "transparent" : "#16a34a",
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#111827",
                          fontWeight: isRead ? 500 : 700,
                          lineHeight: 1.45,
                          wordBreak: "break-word",
                        }}
                      >
                        {n.message}
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, color: "#9CA3AF" }}>{formatTime(n.createdAt)}</span>
                        {n.targetSchoolCode === "ALL" && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: "#7c3aed",
                              background: "#EDE9FE",
                              padding: "1px 6px",
                              borderRadius: 8,
                            }}
                          >
                            DHAMMAAN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}