// src/utils/schoolGuard.js
//
// Hubinta xaaladda lacag-bixinta (subscription) ee school kasta.
//
// School doc kasta (schools/{schoolCode}) wuxuu qabaa:
//   expiryDate : "YYYY-MM-DD"  -> taariikhda rukunku dhacayo
//   status     : "Active" | "Expired" | "Disabled"
//   price      : lacagta la rabo (renewal-ka)
//
// XEER:
//   - Haddii status === "Disabled" -> super-admin ayaa gacan ku joojiyay,
//     marnaba ma shaqeeyo (xitaa haddii expiry weli jiro).
//   - Haddii expiryDate < maanta -> waa EXPIRED, waa in la cusbooneysiiyaa.
//   - Haddii status === "Expired" -> sidoo kale EXPIRED.
//
// isSchoolActive() waxay soo celisaa { active, reason, school }.

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export function isExpiredByData(d) {
  if (!d) return true;
  if (d.status === "Disabled") return true;
  const today = new Date().toISOString().split("T")[0];
  const expired = (d.expiryDate && d.expiryDate < today) || d.status === "Expired";
  return !!expired;
}

// Soo qaado school-ka + hubi in uu firfircoon yahay.
export async function fetchSchoolStatus(schoolCode) {
  if (!schoolCode) return { active: false, reason: "no-school", school: null };
  try {
    const snap = await getDoc(doc(db, "schools", schoolCode));
    if (!snap.exists()) {
      return { active: false, reason: "not-found", school: null };
    }
    const d = { id: snap.id, ...snap.data() };
    if (d.status === "Disabled") {
      return { active: false, reason: "disabled", school: d };
    }
    if (isExpiredByData(d)) {
      return { active: false, reason: "expired", school: d };
    }
    return { active: true, reason: "active", school: d };
  } catch (err) {
    console.log("fetchSchoolStatus error:", err);
    // Haddii cilad shabakad dhacdo, ha xannibin (si aan loo qasin isticmaalka).
    return { active: true, reason: "error", school: null };
  }
}