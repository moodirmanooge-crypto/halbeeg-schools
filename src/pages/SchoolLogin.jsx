// src/pages/SchoolLogin.jsx
//
// HAL LOGIN FLOW oo dhammaan school-yada iyo role-yada wadaagaan.
//
// Talaabo 1: School Code + School Password  -> hubi schools/{...}
//            haddii sax, school context waa la keydiyaa (schoolName...)
// Talaabo 2: Dooro Role (Admin/Teacher/Student/Parent/Cashier)
//            + gali username/id + password  -> hubi collection-ka role-ka
//            iyadoo la sugayo schoolName == school-ka la doortay.
// Natiijo:  qof kastaa wuxuu tagaa dashboard-kiisa u gaar ah.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { setSchoolContext, clearSchoolContext } from "../utils/schoolContext";

const ROLES = [
  { key: "Admin", label: "Admin", emoji: "👑" },
  { key: "Teacher", label: "Macalin", emoji: "👨‍🏫" },
  { key: "Student", label: "Arday", emoji: "🎒" },
  { key: "Parent", label: "Waalid", emoji: "👪" },
  { key: "Cashier", label: "Cashier", emoji: "💰" },
];

export default function SchoolLogin() {
  const navigate = useNavigate();

  // Step control
  const [step, setStep] = useState(1); // 1 = school, 2 = role login
  const [loading, setLoading] = useState(false);

  // Step 1 — school
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolPassword, setSchoolPassword] = useState("");
  const [school, setSchool] = useState(null); // {id, schoolName, ...}

  // Step 2 — role
  const [role, setRole] = useState("Admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // -------- Step 1: verify school --------
  const verifySchool = async () => {
    if (!schoolCode.trim() || !schoolPassword.trim()) {
      alert("Gali School Code iyo School Password");
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "schools"),
          where("schoolCode", "==", schoolCode.trim())
        )
      );
      if (snap.empty) {
        alert("School Code khaldan ama ma jiro");
        return;
      }
      const docSnap = snap.docs[0];
      const d = docSnap.data();
      if (d.schoolPassword !== schoolPassword.trim()) {
        alert("School Password khaldan");
        return;
      }
      if (d.active === false) {
        alert("School-kan waa la joojiyay. La xiriir maamulaha.");
        return;
      }
      const ctx = {
        schoolId: docSnap.id,
        schoolName: d.schoolName,
        schoolCode: d.schoolCode,
      };
      setSchool({ id: docSnap.id, ...d });
      setSchoolContext(ctx);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay, isku day mar kale");
    } finally {
      setLoading(false);
    }
  };

  // -------- Step 2: verify role login (schoolName-scoped) --------
  const login = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Buuxi dhammaan meelaha");
      return;
    }
    setLoading(true);
    try {
      const schoolName = school?.schoolName || "";

      let collectionName = "";
      switch (role) {
        case "Admin":
          collectionName = "admin";
          break;
        case "Teacher":
          collectionName = "teachers";
          break;
        case "Cashier":
          collectionName = "cashier";
          break;
        case "Student":
        case "Parent":
          collectionName = "students";
          break;
        default:
          return;
      }

      // Kaliya doorka school-kan (schoolName filter)
      const snapshot = await getDocs(
        query(
          collection(db, collectionName),
          where("schoolName", "==", schoolName)
        )
      );

      let found = false;

      snapshot.forEach((item) => {
        const data = item.data();

        if (role === "Admin") {
          if (
            (data.email === username.trim() ||
              data.username === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("adminId", item.id);
            localStorage.setItem(
              "adminName",
              data.fullName || data.name || data.username || "Admin"
            );
            localStorage.setItem("adminRole", data.role || "admin");
            localStorage.setItem(
              "adminPermissions",
              JSON.stringify(
                Array.isArray(data.permissions) ? data.permissions : []
              )
            );
          }
        }

        if (role === "Teacher") {
          if (
            (data.username === username.trim() ||
              data.teacherId === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("teacherId", item.id);
            localStorage.setItem(
              "teacherName",
              data.fullName || data.name || data.username || "Teacher"
            );
          }
        }

        if (role === "Cashier") {
          if (
            data.username === username.trim() &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("cashierId", item.id);
            localStorage.setItem(
              "cashierName",
              data.name || data.username || "Cashier"
            );
          }
        }

        if (role === "Student") {
          if (
            (data.studentId === username.trim() ||
              item.id === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem(
              "studentName",
              data.fullName || data.name || "Student"
            );
          }
        }

        if (role === "Parent") {
          if (
            (data.studentId === username.trim() ||
              data.parentPhone === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem("parentName", data.parentName || "Parent");
          }
        }
      });

      if (!found) {
        alert(
          role === "Admin"
            ? "Hubi email/username ama password"
            : "Hubi user ama password"
        );
        return;
      }

      if (role === "Admin") navigate("/admin/dashboard");
      if (role === "Teacher") navigate("/teacher/dashboard");
      if (role === "Cashier") navigate("/cashier/dashboard");
      if (role === "Student") navigate("/student/dashboard");
      if (role === "Parent") navigate("/parent/dashboard");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay, isku day mar kale");
    } finally {
      setLoading(false);
    }
  };

  const backToSchool = () => {
    setStep(1);
    setUsername("");
    setPassword("");
    clearSchoolContext();
    setSchool(null);
  };

  return (
    <div style={wrap}>
      <div style={card}>
        {step === 1 ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={badge}>🏫</div>
              <h1 style={h1}>HALBEEG SCHOOLS</h1>
              <p style={sub}>Gali xogta school-kaaga</p>
            </div>

            <label style={lbl}>School Code</label>
            <input
              style={input}
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="Tusaale: IFTIN-2026"
            />
            <div style={{ height: 14 }} />
            <label style={lbl}>School Password</label>
            <input
              type="password"
              style={input}
              value={schoolPassword}
              onChange={(e) => setSchoolPassword(e.target.value)}
              placeholder="Password-ka school-ka"
              onKeyDown={(e) => e.key === "Enter" && verifySchool()}
            />
            <div style={{ height: 22 }} />
            <button style={btn} onClick={verifySchool} disabled={loading}>
              {loading ? "Hubinaya..." : "Sii wad ➜"}
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={badge}>{ROLES.find((r) => r.key === role)?.emoji}</div>
              <h1 style={h1}>{school?.schoolName}</h1>
              <p style={sub}>Dooro doorkaaga oo gal</p>
            </div>

            {/* Role selector */}
            <div style={roleRow}>
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  style={{
                    ...rolePill,
                    ...(role === r.key ? rolePillActive : {}),
                  }}
                >
                  <span style={{ fontSize: 18 }}>{r.emoji}</span>
                  <span style={{ fontSize: 12 }}>{r.label}</span>
                </button>
              ))}
            </div>

            <div style={{ height: 8 }} />
            <label style={lbl}>
              {role === "Admin"
                ? "Email ama Username"
                : role === "Teacher"
                ? "Teacher Username"
                : role === "Cashier"
                ? "Cashier Username"
                : role === "Parent"
                ? "Student ID / Parent Phone"
                : "Student ID"}
            </label>
            <input
              style={input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                role === "Admin"
                  ? "Admin Email/Username"
                  : role === "Parent"
                  ? "Student ID / Phone"
                  : role === "Student"
                  ? "Student ID"
                  : "Username"
              }
            />
            <div style={{ height: 14 }} />
            <label style={lbl}>Password</label>
            <input
              type="password"
              style={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            <div style={{ height: 22 }} />
            <button style={btn} onClick={login} disabled={loading}>
              {loading ? "Gelaya..." : "LOGIN"}
            </button>
            <button style={btnGhost} onClick={backToSchool}>
              ⟵ Beddel School
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
  padding: 36,
  borderRadius: 22,
  boxShadow: "0 10px 50px rgba(0,0,0,.35)",
  boxSizing: "border-box",
};
const badge = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "#0f2e1d",
  color: "#fff",
  fontSize: 30,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
};
const h1 = { margin: 0, fontSize: 22, color: "#0f2e1d" };
const sub = { margin: "4px 0 0", color: "#778", fontSize: 14 };
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
const btn = {
  width: "100%",
  padding: "15px",
  background: "#0f2e1d",
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
const roleRow = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 6,
  marginBottom: 12,
};
const rolePill = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  padding: "10px 4px",
  borderRadius: 12,
  border: "1px solid #dde",
  background: "#f7f9f7",
  cursor: "pointer",
  color: "#334",
};
const rolePillActive = {
  border: "2px solid #0f2e1d",
  background: "#eaf3ec",
  color: "#0f2e1d",
  fontWeight: 700,
};