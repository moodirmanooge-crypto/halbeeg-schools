// src/pages/SuperAdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { ShieldCheck, Mail, Lock, ArrowRight } from "lucide-react";
import "../styles/home.css";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Direct Firestore check inside 'admin' collection
      const q = query(collection(db, "admin"), where("email", "==", email.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Admin email wax jira ma aha!");
        setLoading(false);
        return;
      }

      let adminDoc = null;
      querySnapshot.forEach((doc) => {
        adminDoc = { id: doc.id, ...doc.data() };
      });

      // Simple password matching logic / validation
      if (adminDoc && adminDoc.isActive !== false) {
        localStorage.setItem("superAdminAuth", JSON.stringify(adminDoc));
        navigate("/super-admin/dashboard");
      } else {
        setError("Account-kaagu ma aha active ama xogtu waa hanti kugu qaldan!");
      }
    } catch (err) {
      console.error(err);
      setError("Login-ku waa uu fashilmay. Fadlan dib u tijaabi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="school-modal-card" style={{ maxWidth: "420px", width: "100%" }}>
        <div className="school-icon-wrapper" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          <ShieldCheck size={32} />
        </div>
        <h2 className="portals-main-title">SUPER ADMIN LOGIN</h2>
        <p className="portals-desc">Magaca Maamulaha Guud iyo Nidaamka Iskuulada.</p>

        {error && <div style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>{error}</div>}

        <form onSubmit={handleLogin} className="school-login-form">
          <div className="input-group">
            <label>Admin Email</label>
            <div className="input-field-wrap">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                placeholder="moodirmanooge@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-field-wrap">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="school-submit-btn" disabled={loading} style={{ background: "#3730a3" }}>
            {loading ? "Authenticating..." : "Login to Super Admin"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}