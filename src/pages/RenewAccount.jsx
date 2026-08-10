// src/pages/RenewAccount.jsx
//
// Bogga cusbooneysiinta (renewal). Waxaa la geeyaa marka rukunka school-ku
// dhaco (expired). Wuxuu tusayaa:
//   1. Magaca school-ka + qiimaha la rabo.
//   2. USSD-ka lacagta lagu diro: *799*37316539*<price>#  (price = qiimaha).
//   3. Batoon "Bixi Lacagta" oo dialer-ka furaya (mobile).
//   4. Goob lambarka telefoonka aad lacagta ka dirtay.
//   5. Submit -> wuxuu qoraa renewalRequests/{autoId} status "pending",
//      wuxuuna calaamadeeyaa school-ka renewalPending: true.
//   6. Kadib wuxuu sugayaa ansixinta super-admin.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const PAY_BASE = "*799*37316539*"; // meesha $ ka lacagta ayaa la gelinayaa

export default function RenewAccount() {
  const { schoolCode } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [senderPhone, setSenderPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "schools", schoolCode));
        if (snap.exists()) {
          const d = { id: snap.id, ...snap.data() };
          setSchool(d);

          // Hubi haddii codsi renewal ah oo sugaya uu horeba u jiro.
          const rq = await getDocs(
            query(
              collection(db, "renewalRequests"),
              where("schoolCode", "==", schoolCode),
              where("status", "==", "pending")
            )
          );
          if (!rq.empty) {
            setPendingRequest({ id: rq.docs[0].id, ...rq.docs[0].data() });
          }
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolCode]);

  const price = school ? parseFloat(school.price) || 0 : 0;
  const ussd = `${PAY_BASE}${price}#`;

  const dialPayment = () => {
    // Fur dialer-ka (mobile). # waa la encode-gareeyaa si uu u shaqeeyo.
    window.location.href = `tel:${encodeURIComponent(ussd)}`;
  };

  const submitRenewal = async () => {
    if (!senderPhone.trim() || senderPhone.trim().length < 7) {
      alert("Fadlan geli lambarka telefoonka aad lacagta ka dirtay.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) Qor codsiga renewal-ka
      const reqRef = await addDoc(collection(db, "renewalRequests"), {
        schoolCode: school.schoolCode || school.code || schoolCode,
        schoolName: school.schoolName || school.name || "",
        amount: price,
        senderPhone: senderPhone.trim(),
        status: "pending", // pending -> approved / rejected
        createdAt: serverTimestamp(),
      });

      // 2) Calaamadee school-ka in codsi sugaya uu jiro
      await updateDoc(doc(db, "schools", school.id), {
        renewalPending: true,
        lastRenewalRequestId: reqRef.id,
        lastRenewalSenderPhone: senderPhone.trim(),
      });

      setPendingRequest({
        id: reqRef.id,
        senderPhone: senderPhone.trim(),
        amount: price,
        status: "pending",
      });
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay. Fadlan mar kale isku day.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={{ color: "#667", textAlign: "center" }}>Soo raraya...</p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h2 style={{ color: "#0f2e1d", marginTop: 0 }}>School lama helin</h2>
          <p style={{ color: "#667" }}>
            School-kan lama helin. Fadlan hubi code-ka ama la xiriir maamulaha.
          </p>
          <button style={btnGhost} onClick={() => navigate("/")}>
            ⟵ Ku noqo bogga hore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={badge}>🔒</div>
          <h1 style={{ margin: "10px 0 4px", color: "#0f2e1d", fontSize: 22 }}>
            Rukunku wuu dhacay
          </h1>
          <p style={{ margin: 0, color: "#778", fontSize: 14 }}>
            {school.schoolName || school.name}
          </p>
        </div>

        {pendingRequest ? (
          // Haddii codsi sugaya uu jiro — tus xaaladda.
          <div style={{ textAlign: "center" }}>
            <div style={pendingBox}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>⏳</div>
              <h3 style={{ margin: "0 0 6px", color: "#92600a" }}>
                Codsigaaga waa la helay
              </h3>
              <p style={{ margin: 0, color: "#7a6", fontSize: 13.5, color: "#665" }}>
                Lacag-bixintaada waxaa la hubinayaa. Marka maamulaha guud uu
                ansixiyo, account-kaaga wuu dib u shaqayn doonaa.
              </p>
              <div style={infoRow}>
                <span>Lambarka aad ka dirtay:</span>
                <b>{pendingRequest.senderPhone}</b>
              </div>
              <div style={infoRow}>
                <span>Lacagta:</span>
                <b>${pendingRequest.amount}</b>
              </div>
            </div>
            <button style={btnGhost} onClick={() => navigate("/")}>
              ⟵ Ku noqo bogga hore
            </button>
          </div>
        ) : (
          <>
            <div style={amountBox}>
              <span style={{ color: "#556", fontSize: 13 }}>
                Lacagta la rabo (renewal)
              </span>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f2e1d" }}>
                ${price}
              </div>
            </div>

            <div style={ussdBox}>
              <span style={{ color: "#556", fontSize: 12.5 }}>
                U dir lacagta USSD-kan:
              </span>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f2e1d", letterSpacing: 0.5, marginTop: 4 }}>
                {ussd}
              </div>
            </div>

            <button style={btnPay} onClick={dialPayment}>
              📞 Bixi Lacagta
            </button>

            <div style={{ height: 18 }} />

            <label style={lbl}>Lambarka aad lacagta ka dirtay</label>
            <input
              style={input}
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              placeholder="Tusaale: 61xxxxxxx"
              inputMode="numeric"
            />
            <div style={{ height: 18 }} />

            <button
              style={{ ...btnSubmit, opacity: submitting ? 0.7 : 1 }}
              onClick={submitRenewal}
              disabled={submitting}
            >
              {submitting ? "Diraya..." : "Submit"}
            </button>

            <button style={btnGhost} onClick={() => navigate("/")}>
              ⟵ Ku noqo bogga hore
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const wrap = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  background: "#0f2e1d",
  padding: 16,
};
const card = {
  width: 440,
  maxWidth: "100%",
  background: "#fff",
  padding: 34,
  borderRadius: 22,
  boxShadow: "0 10px 50px rgba(0,0,0,.35)",
  boxSizing: "border-box",
};
const badge = {
  width: 62,
  height: 62,
  borderRadius: "50%",
  background: "#fde8e8",
  color: "#c0392b",
  fontSize: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const amountBox = {
  background: "#eef3ee",
  borderRadius: 14,
  padding: "14px 18px",
  textAlign: "center",
  marginBottom: 14,
};
const ussdBox = {
  background: "#f7f9f7",
  border: "1px dashed #cbd5cb",
  borderRadius: 14,
  padding: "14px 18px",
  textAlign: "center",
  marginBottom: 16,
};
const pendingBox = {
  background: "#fff8e6",
  border: "1px solid #f0d488",
  borderRadius: 16,
  padding: "22px 18px",
  marginBottom: 18,
};
const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13.5,
  color: "#556",
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px dashed #e2d9b8",
};
const lbl = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: "#556",
  fontWeight: 600,
};
const input = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "1px solid #ccd",
  fontSize: 15,
  boxSizing: "border-box",
};
const btnPay = {
  width: "100%",
  padding: "14px",
  background: "#0f2e1d",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
};
const btnSubmit = {
  width: "100%",
  padding: "15px",
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
};
const btnGhost = {
  width: "100%",
  marginTop: 10,
  padding: "12px",
  background: "transparent",
  color: "#0f2e1d",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};