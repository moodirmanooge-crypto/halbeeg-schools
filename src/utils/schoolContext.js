// src/utils/schoolContext.js
//
// Saldhigga multi-tenant. Wax kasta oo school-scoped ah waxay maraan
// halkan. localStorage ayaa lagu kaydiyaa school-ka hadda soo galay.
//
//   schoolName      -> magaca buuxa (tusaale "Iftin", "Alisra")
//   schoolCode      -> code-ka gelitaanka
//   schoolId        -> doc.id-ga schools/{id}
//
// Student ID prefix rule:
//   Labada xaraf ee UGU HORREEYA magaca school (waaweyn).
//   Tusaale: "Iftin"  -> "IF" -> IF0001
//            "Sanaag" -> "SA" -> SA0001
//            "Alisra" -> "AL" -> AL0001 (Alisra oo dhan isku prefix)

const KEY_NAME = "schoolName";
const KEY_CODE = "schoolCode";
const KEY_ID = "schoolId";

export function setSchoolContext({ schoolName, schoolCode, schoolId }) {
  if (schoolName) localStorage.setItem(KEY_NAME, schoolName);
  if (schoolCode) localStorage.setItem(KEY_CODE, schoolCode);
  if (schoolId) localStorage.setItem(KEY_ID, schoolId);
}

export function getSchoolName() {
  return localStorage.getItem(KEY_NAME) || "";
}

export function getSchoolCode() {
  return localStorage.getItem(KEY_CODE) || "";
}

export function getSchoolId() {
  return localStorage.getItem(KEY_ID) || "";
}

export function clearSchoolContext() {
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_CODE);
  localStorage.removeItem(KEY_ID);
}

// ---- Student ID prefix (labada xaraf ee magaca school) ----
// Sida caadiga ah: labada xaraf ee ugu horreeya magaca school.
// XEER GAAR AH: haddii magacu ku bilaabmo "AL", "AL" waa la iska reebaa
// oo waxaa la qaataa labada xaraf ee KU XIGA.
//   "AL ISRA"  -> iska reeb "AL" -> "IS" -> IS0001
//   "AL FURQAN"-> iska reeb "AL" -> "FU" -> FU0001
//   "Iftin"    -> "IF" -> IF0001
export function schoolPrefix(schoolName) {
  const name = (schoolName || getSchoolName() || "").trim();
  if (!name) return "ST";
  let letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.startsWith("AL") && letters.length >= 4) {
    letters = letters.slice(2); // iska reeb "AL", qaado xarfaha ku xiga
  }
  return letters.slice(0, 2) || "ST";
}

// ---- ID buuxa: prefix + 4-digit padded number ----
// count = tirada arday ee HORE u jira school-kan (schoolName filtered)
export function makeStudentId(schoolName, count) {
  const prefix = schoolPrefix(schoolName);
  const num = String((count || 0) + 1).padStart(4, "0");
  return `${prefix}${num}`; // tusaale IF0001
}