// src/pages/Home.jsx
import "../styles/home.css";
import logo from "../assets/logo.png";
import heroPhoto from "../admin/assets/hero-students.jpg";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { collection, getCountFromServer, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { setSchoolContext } from "../utils/schoolContext";
import {
  Home as HomeIcon,
  GraduationCap,
  ShieldCheck,
  Award,
  Users,
  TrendingUp,
  BookOpen,
  User,
  Users2,
  DollarSign,
  ClipboardList,
  MoreHorizontal,
  Star,
  Lock,
  Building2,
  ArrowRight,
  X
} from "lucide-react";

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "halbeegschools@gmail.com";
const SUPPORT_PHONE_DISPLAY = "+252 61 7390261";
const SUPPORT_LOCATION = "Mogadishu, Somalia";

const NAV_LINKS = [
  { label: "Home", to: "/", icon: <HomeIcon size={16} /> },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Library", to: "/library" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const FEATURES = [
  { icon: <GraduationCap size={28} />, title: "Quality Education", desc: "Excellence in teaching & learning", color: "#1a7a4c" },
  { icon: <ShieldCheck size={28} />, title: "Safe Environment", desc: "Secure and caring school community", color: "#eab308" },
  { icon: <Award size={28} />, title: "Experienced Staff", desc: "Qualified and dedicated teachers", color: "#7c3aed" },
  { icon: <User size={28} />, title: "Student Focused", desc: "Developing every child's potential", color: "#ea580c" },
  { icon: <TrendingUp size={28} />, title: "Modern Facilities", desc: "Advanced resources for better learning", color: "#22a05f" },
  { icon: <Award size={28} />, title: "Proven Results", desc: "Outstanding academic performance", color: "#2563eb" },
];

const PORTALS = [
  {
    key: "student",
    icon: <GraduationCap size={24} />,
    title: "Student Portal",
    desc: "Access your profile, materials, results and more.",
    to: "/student-login",
    theme: "green",
    btnText: "Login →"
  },
  {
    key: "teacher",
    icon: <Users size={24} />,
    title: "Teacher Portal",
    desc: "Manage classes, resources and assignments.",
    to: "/teacher-login",
    theme: "yellow",
    btnText: "Login →"
  },
  {
    key: "parent",
    icon: <Users2 size={24} />,
    title: "Parent Portal",
    desc: "Track your child's progress and activities.",
    to: "/parent-login",
    theme: "purple",
    btnText: "Login →"
  },
  {
    key: "cashier",
    icon: <DollarSign size={24} />,
    title: "Cashier Portal",
    desc: "Record payments and manage school fees.",
    to: "/cashier-login",
    theme: "orange",
    btnText: "Login →"
  },
  {
    key: "admission",
    icon: <ClipboardList size={24} />,
    title: "Online Admission",
    desc: "Apply online for admissions easily and quickly.",
    to: "/admissions",
    theme: "dark-green",
    btnText: "Apply Now →"
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSchoolForm, setShowSchoolForm] = useState(false); // Modal control
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState("");
  const [schoolPassword, setSchoolPassword] = useState("");
  const [schoolLoginLoading, setSchoolLoginLoading] = useState(false);
  const [schoolLoginError, setSchoolLoginError] = useState("");

  const [statsData, setStatsData] = useState({
    students: "1,250+",
    teachers: "85+",
    classes: "30+",
    passRate: "98%"
  });

  useEffect(() => {
    async function loadStats() {
      try {
        await Promise.all([
          getCountFromServer(collection(db, "students")),
          getCountFromServer(collection(db, "teachers")),
          getCountFromServer(collection(db, "classes")),
        ]);
      } catch (err) {
        console.error("Failed to load home stats:", err);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSchoolLogin = async (e) => {
    e.preventDefault();
    setSchoolLoginError("");

    const codeInput = schoolCode.trim().toLowerCase();
    const passInput = schoolPassword.trim();

    if (!codeInput || !passInput) {
      setSchoolLoginError("Gali School Code iyo Password.");
      return;
    }

    setSchoolLoginLoading(true);
    try {
      // Ka raadi schools collection code-ka la geliyay.
      const snap = await getDocs(
        query(collection(db, "schools"), where("code", "==", codeInput))
      );

      if (snap.empty) {
        setSchoolLoginError("School Code khaldan ama ma jiro.");
        return;
      }

      const docSnap = snap.docs[0];
      const d = docSnap.data();

      if ((d.password || "") !== passInput) {
        setSchoolLoginError("Password-ka School-ka waa khaldan yahay.");
        return;
      }

      // Hubi in school-ku uusan dhicin (expired) ama la joojin (disabled).
      const today = new Date().toISOString().split("T")[0];
      if (d.status === "Disabled") {
        setSchoolLoginError("School-kan waa la joojiyay. La xiriir maamulaha guud.");
        return;
      }
      const isExpired =
        (d.expiryDate && d.expiryDate < today) || d.status === "Expired";
      if (isExpired) {
        // Rukunku wuu dhacay — geey bogga cusbooneysiinta (renewal).
        const code = d.schoolCode || d.code || codeInput;
        setShowSchoolForm(false);
        navigate(`/renew/${code}`);
        return;
      }

      // Keydi school-ka hadda si dashboard-ka admin-ku xogtiisa gaar ah u soo bandhigo.
      setSchoolContext({
        schoolId: docSnap.id,
        schoolName: d.schoolName || d.name || "",
        schoolCode: d.schoolCode || d.code || codeInput,
      });

      setShowSchoolForm(false);
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("School login failed:", err);
      setSchoolLoginError("Cillad ayaa dhacday. Fadlan dib u tijaabi.");
    } finally {
      setSchoolLoginLoading(false);
    }
  };

  return (
    <div className="home">
      {/* ---------- Top Nav ---------- */}
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="HALBEEG SCHOOLS logo" />
          <div className="brand-text">
            <span className="brand-name">HALBEEG SCHOOLS</span>
            <span className="brand-tagline">HALBEEG  PRIMARY &amp; SECONDARY SCHOOL</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link 
              key={l.to} 
              to={l.to} 
              className={`home-nav-link ${l.label === "Home" ? "active" : ""}`}
            >
              {l.icon && <span className="nav-icon">{l.icon}</span>}
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="dots-btn"
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={20} color="#fff" />
            </button>

            {menuOpen && (
              <div className="dots-menu">
                <button 
                  type="button" 
                  className="dots-menu-item btn-link"
                  onClick={() => { setMenuOpen(false); setShowSchoolForm(true); }}
                >
                  🏫 School Login
                </button>
                <Link to="/admin-login" className="dots-menu-item">
                  👑 Admin Login
                </Link>
                <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="dots-menu-item">
                  💬 Support
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero Section ---------- */}
      <section className="hero-section" style={{ backgroundImage: `url(${heroPhoto})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon"><Star size={14} fill="#fff" /></span>
            Excellence in Education
          </div>
          <h1 className="hero-title">
            NURTURING MINDS,<br />
            <span className="text-yellow">BUILDING FUTURES</span>
          </h1>
          <p className="hero-lede">
            Providing quality education in a safe, caring and inspiring
            environment where every child can achieve greatness.
          </p>
          <div className="hero-cta-row">
            <Link to="/admissions" className="btn btn-outline">
              Apply for Admission <span>→</span>
            </Link>
            <Link to="/about" className="btn btn-solid">
              Learn More <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Features & Stats ---------- */}
      <section className="features-stats-container">
        <div className="features-card">
          {FEATURES.map((f, i) => (
            <div className="feature-item" key={i}>
              <div className="feature-icon" style={{ color: f.color }}>
                {f.icon}
              </div>
              <h4 className="feature-title">{f.title}</h4>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="stats-card">
          <div className="stat-item">
            <GraduationCap size={32} className="stat-icon" />
            <div className="stat-value">{statsData.students}</div>
            <div className="stat-label">Students Enrolled</div>
          </div>
          <div className="stat-item">
            <Users size={32} className="stat-icon" />
            <div className="stat-value">{statsData.teachers}</div>
            <div className="stat-label">Qualified Teachers</div>
          </div>
          <div className="stat-item">
            <BookOpen size={32} className="stat-icon" />
            <div className="stat-value">{statsData.classes}</div>
            <div className="stat-label">Subjects Offered</div>
          </div>
          <div className="stat-item">
            <Award size={32} className="stat-icon text-yellow" />
            <div className="stat-value text-yellow">{statsData.passRate}</div>
            <div className="stat-label">Pass Rate</div>
          </div>
        </div>
      </section>

      {/* ---------- Portals System Section ---------- */}
      <section className="portals-section">
        <div className="portals-wrapper">
          
          {/* Card-ka bidix oo badal ku sameeyay (Trigger to Open Modal) */}
          <div className="portals-intro">
            <div className="school-icon-wrapper">
              <Building2 size={32} color="#14532d" />
            </div>
            <h2 className="portals-main-title">SCHOOL LOGIN</h2>
            <h3 className="portals-sub-title">Access your portal</h3>
            <p className="portals-desc">Click below to enter school code and password to access the system dashboard.</p>
            <button 
              type="button" 
              className="open-login-btn"
              onClick={() => setShowSchoolForm(true)}
            >
              School Login <ArrowRight size={16} />
            </button>
          </div>

          {/* User Portals */}
          <div className="portals-grid">
            {PORTALS.map((p) => (
              <div className="portal-card" key={p.key}>
                <div className={`portal-icon-box theme-${p.theme}`}>
                  {p.icon}
                </div>
                <h4 className="portal-title">{p.title}</h4>
                <p className="portal-text">{p.desc}</p>
                <Link to={p.to} className={`portal-btn btn-theme-${p.theme}`}>
                  {p.btnText}
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ---------- Pop-up School Login Form Modal ---------- */}
      {showSchoolForm && (
        <div className="modal-overlay" onClick={() => setShowSchoolForm(false)}>
          <div className="school-modal-card" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button" 
              className="close-modal-btn"
              onClick={() => setShowSchoolForm(false)}
            >
              <X size={20} />
            </button>

            <div className="school-icon-wrapper">
              <Building2 size={30} color="#14532d" />
            </div>
            <h2 className="portals-main-title">SCHOOL LOGIN</h2>
            <p className="portals-desc">Enter your credentials to access the central management dashboard.</p>
            
            {schoolLoginError && (
              <div style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>
                {schoolLoginError}
              </div>
            )}

            <form onSubmit={handleSchoolLogin} className="school-login-form">
              <div className="input-group">
                <label>School Code</label>
                <div className="input-field-wrap">
                  <Building2 size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="Enter school code"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>School Password</label>
                <div className="input-field-wrap">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={schoolPassword}
                    onChange={(e) => setSchoolPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="school-submit-btn" disabled={schoolLoginLoading}>
                {schoolLoginLoading ? "Hubinaya..." : "Login System"} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Footer ---------- */}
      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="HALBEEG SCHOOLS logo" />
          <div>
            <div className="footer-school-name">HALBEEG SCHOOLS</div>
            <div className="footer-school-tagline">HALBEEGG  PRIMARY &amp; SECONDARY SCHOOL</div>
          </div>
        </div>
        <div className="home-footer-contact">
          <a href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}>📞 {SUPPORT_PHONE_DISPLAY}</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>✉️ {SUPPORT_EMAIL}</a>
          <span>📍 {SUPPORT_LOCATION}</span>
        </div>
      </footer>
    </div>
  );
}