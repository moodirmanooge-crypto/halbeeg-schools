// src/utils/subscription.js
//
// Xakameynta rukunka (subscription) ee school walba.
//
//   - isSchoolBlocked(school)  -> true haddii school-ku dhacay (expired)
//                                 ama la joojiyay (Disabled/Expired status).
//   - buildRenewUSSD(amount)   -> code-ka lacag-bixinta: *799*37316539*<amount>#
//   - fetchSchoolByCode(code)  -> soo qaado doc-ka schools/{code}
//   - getPendingRenewal(code)  -> codsi renewal ah oo sugaya (pending) haddii jiro
//   - submitRenewalRequest()   -> abuur codsi renewal cusub (pending)
//
// Firestore doc-ka school-ku wuxuu leeyahay: expiryDate ("YYYY-MM-DD"),
// status ("Active" | "Expired" | "Disabled"), price, planType, schoolCode/code.

import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// Lambarka aasaasiga ah ee lacag-bixinta. Lacagta ($) waxaa lagu beddelaa
// qiimaha school-ka (price) markii USSD-ga la dhisayo.
export const RENEW_BASE = "*799*37316539*";

// Dhis USSD-ga buuxa: *799*37316539*<amount>#
export function buildRenewUSSD(amount) {
  const amt = Number(amount) || 0;
  return `${RENEW_BASE}${amt}#`;
}

// Maalinta maanta (YYYY-MM-DD) — isticmaal isku hab ah meel kasta.
export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// School-ku ma xaqiiqo inuu firfircoon yahay iyo in kale.
// Blocked = expiryDate maanta ka hor ama status Expired/Disabled.
export function isSchoolBlocked(school) {
  if (!school) return false;
  const today = todayStr();
  const expired = school.expiryDate && String(school.expiryDate) < today;
  const disabled =
    school.status === "Disabled" || school.status === "Expired";
  return Boolean(expired || disabled);
}

// Soo qaado school doc-ka code-kiisa (schools/{code}). Null haddii aan la helin.
export async function fetchSchoolByCode(code) {
  const clean = String(code || "").trim().toLowerCase();
  if (!clean) return null;
  try {
    const snap = await getDoc(doc(db, "schools", clean));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    // Fallback: haddii doc-ID-gu aan code ahayn, ku raadi field-ka code.
    const q = await getDocs(
      query(collection(db, "schools"), where("code", "==", clean))
    );
    if (!q.empty) return { id: q.docs[0].id, ...q.docs[0].data() };
    return null;
  } catch (err) {
    console.error("fetchSchoolByCode failed:", err);
    return null;
  }
}

// Codsi renewal ah oo weli sugaya (status pending) haddii uu jiro.
export async function getPendingRenewal(schoolCode) {
  const clean = String(schoolCode || "").trim().toLowerCase();
  if (!clean) return null;
  try {
    const q = await getDocs(
      query(
        collection(db, "renewalRequests"),
        where("schoolCode", "==", clean),
        where("status", "==", "pending")
      )
    );
    if (q.empty) return null;
    return { id: q.docs[0].id, ...q.docs[0].data() };
  } catch (err) {
    console.error("getPendingRenewal failed:", err);
    return null;
  }
}

// Abuur codsi renewal cusub oo pending ah.
export async function submitRenewalRequest({
  schoolCode,
  schoolName,
  amount,
  senderNumber,
}) {
  const clean = String(schoolCode || "").trim().toLowerCase();
  const ref = await addDoc(collection(db, "renewalRequests"), {
    schoolCode: clean,
    schoolName: schoolName || "",
    amount: Number(amount) || 0,
    senderNumber: String(senderNumber || "").trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}