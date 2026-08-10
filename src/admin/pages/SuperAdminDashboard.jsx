// src/pages/SuperAdminDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import {
  collection, setDoc, getDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, addDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import {
  Building2, KeyRound, PlusCircle, LogOut, CheckCircle2,
  Upload, Edit3, Trash2, X, Send, Megaphone, School, Users,
  Search, ChevronDown,
} from "lucide-react";

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [logoBase64, setLogoBase64] = useState("");
  const [planType, setPlanType] = useState("Monthly");
  const [price, setPrice] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editSchool, setEditSchool] = useState(null);
  const navigate = useNavigate();

  // ---- Send Notification state ----
  const [notifTarget, setNotifTarget] = useState("ALL"); // "ALL" | "ONE"
  const [notifSchoolCode, setNotifSchoolCode] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifSending, setNotifSending] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [codeDropdownOpen, setCodeDropdownOpen] = useState(false);

  // Codsiyada cusbooneysiinta (renewal) ee schools-yada dhacay.
  const [renewals, setRenewals] = useState([]);
  const [renewBusyId, setRenewBusyId] = useState(null);

  useEffect(() => {
    const auth = localStorage.getItem("superAdminAuth");
    if (!auth) {
      navigate("/super-admin-login");
    } else {
      fetchSchools();
    }
  }, [navigate]);

  useEffect(() => {
    if (!startDate) return;
    const start = new Date(startDate);
    if (planType === "Monthly") start.setMonth(start.getMonth() + 1);
    else start.setFullYear(start.getFullYear() + 1);
    setExpiryDate(start.toISOString().split("T")[0]);
  }, [startDate, planType]);

  const fetchSchools = async () => {
    try {
      const snap = await getDocs(collection(db, "schools"));
      const today = new Date().toISOString().split("T")[0];
      const list = snap.docs.map((d) => {
        const data = d.data();
        // "Disabled" (super-admin gacan ku joojiyay) waa la ilaaliyaa.
        // Haddii kale, taariikhda ayaa go'aamisa Expired/Active.
        let status;
        if (data.status === "Disabled") {
          status = "Disabled";
        } else {
          const isExpired = data.expiryDate && data.expiryDate < today;
          status = isExpired ? "Expired" : (data.status || "Active");
        }
        return { id: d.id, ...data, status };
      });
      setSchools(list);
    } catch (err) {
      console.error(err);
    }
  };

  // Soo qaado codsiyada renewal-ka ee sugaya (pending).
  const fetchRenewals = async () => {
    try {
      const snap = await getDocs(collection(db, "renewalRequests"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status === "pending");
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRenewals(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Sawirku waa inuu ka yaryahay 1MB!");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLogoBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const parsedPrice = parseFloat(price) || 0;
      const parsedPaid = parseFloat(amountPaid) || 0;
      const cleanCode = code.trim().toLowerCase();

      const schoolRef = doc(db, "schools", cleanCode);
      const existing = await getDoc(schoolRef);
      if (existing.exists()) {
        setMsg("School Code-kan horey ayuu u jiray! Dooro code kale.");
        setLoading(false);
        return;
      }

      await setDoc(schoolRef, {
        name: name.trim(),
        schoolName: name.trim(),
        code: cleanCode,
        schoolCode: cleanCode,
        password: password.trim(),
        logoUrl: logoBase64 || "",
        planType,
        price: parsedPrice,
        amountPaid: parsedPaid,
        startDate,
        expiryDate,
        status: "Active",
        createdAt: serverTimestamp(),
      });

      setMsg("Iskuulka si sax ah ayaa loo abuuray!");
      resetForm();
      fetchSchools();
    } catch (err) {
      console.error(err);
      setMsg("Cillad ayaa dhacday marka iskuulka la abuurayay.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(""); setCode(""); setPassword(""); setLogoBase64("");
    setPrice(""); setAmountPaid(""); setEditSchool(null);
  };

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    if (!editSchool) return;
    setLoading(true);
    try {
      const cleanCode = editSchool.id;
      const schoolRef = doc(db, "schools", editSchool.id);
      await updateDoc(schoolRef, {
        name: editSchool.name,
        schoolName: editSchool.name,
        code: cleanCode,
        schoolCode: cleanCode,
        password: editSchool.password,
        logoUrl: editSchool.logoUrl,
        planType: editSchool.planType,
        price: parseFloat(editSchool.price) || 0,
        amountPaid: parseFloat(editSchool.amountPaid) || 0,
        startDate: editSchool.startDate,
        expiryDate: editSchool.expiryDate,
        status: editSchool.status,
      });
      setMsg("Xogta Iskuulka waa la cusbooneysiiyay!");
      setEditSchool(null);
      fetchSchools();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchool = async (id) => {
    if (window.confirm("Ma hubtaa inaad tiraysid iskuulkan?")) {
      await deleteDoc(doc(db, "schools", id));
      fetchSchools();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("superAdminAuth");
    navigate("/super-admin-login");
  };

  // ---- Send Notification handler ----
  // Diraya notification cusub oo Firestore lagu keydiyo. targetSchoolCode
  // waxa ay noqonaysaa "ALL" (dhammaan schools) ama school code gaar ah,
  // si NotificationBell-ka school-ku uu si toos ah (real-time) ugu arko.
  const handleSendNotification = async (e) => {
    e.preventDefault();
    setNotifMsg("");

    const trimmedMsg = notifMessage.trim();
    if (!trimmedMsg) {
      setNotifMsg("Fadlan qor fariin ka hor inta aadan dirin.");
      return;
    }

    let targetCode = "ALL";
    if (notifTarget === "ONE") {
      targetCode = notifSchoolCode.trim().toLowerCase();
      if (!targetCode) {
        setNotifMsg("Fadlan dooro ama qor School Code-ka.");
        return;
      }
      const exists = schools.some((s) => s.id === targetCode);
      if (!exists) {
        setNotifMsg("School Code-kan lama helin liiska schools-ka.");
        return;
      }
    }

    setNotifSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        message: trimmedMsg,
        targetSchoolCode: targetCode,
        createdAt: serverTimestamp(),
        readBy: {},
      });
      setNotifMsg(
        targetCode === "ALL"
          ? "Fariinta waxaa loo diray dhammaan schools-ka!"
          : `Fariinta waxaa loo diray school code: ${targetCode}`
      );
      setNotifMessage("");
      setNotifSchoolCode("");
    } catch (err) {
      console.error(err);
      setNotifMsg("Cillad ayaa dhacday marka fariinta la dirayay.");
    } finally {
      setNotifSending(false);
    }
  };

  const filteredCodeSuggestions = useMemo(() => {
    if (!notifSchoolCode) return schools.slice(0, 6);
    const q = notifSchoolCode.toLowerCase();
    return schools.filter(
      (s) => s.code?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [notifSchoolCode, schools]);

  const totalSchools = schools.length;
  const activeSchools = schools.filter((s) => s.status === "Active").length;
  const expiredSchools = schools.filter((s) => s.status === "Expired").length;
  const totalExpectedRevenue = schools.reduce((acc, c) => acc + (parseFloat(c.price) || 0), 0);
  const totalPaid = schools.reduce((acc, c) => acc + (parseFloat(c.amountPaid) || 0), 0);
  const totalUnpaid = totalExpectedRevenue - totalPaid;

  return (
    <div style={pageWrap}>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: 'Inter','Segoe UI',sans-serif; }
        .sa-input:focus, .sa-select:focus, .sa-textarea:focus {
          outline: none; border-color: #16a34a !important;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
        }
        .sa-btn-primary:hover { background: #15803d !important; }
        .sa-btn-danger:hover { background: #b91c1c !important; }
        .sa-target-tab { transition: all .15s ease; }
        .sa-code-row:hover { background: #F0FDF4 !important; }
        @media (max-width: 1080px) {
          .sa-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={headerWrap}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: "#0f3d2e", fontWeight: 800, letterSpacing: -0.5 }}>
            Super Admin
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13.5 }}>
            Maamul Iskuulada, Billing-ka, iyo Ogeysiisyada.
          </p>
        </div>
        <button onClick={handleLogout} style={logoutBtnStyle}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {/* Stat cards */}
      <div style={statsGrid}>
        <StatCard label="TOTAL SCHOOLS" value={totalSchools} accent="#2563eb"
          sub={`${activeSchools} Active · ${expiredSchools} Expired`} icon={<School size={18} />} />
        <StatCard label="EXPECTED REVENUE" value={`$${totalExpectedRevenue.toFixed(2)}`} accent="#166534"
          sub="Guud ahaan qiimaha subscription-ka" icon={<Users size={18} />} />
        <StatCard label="TOTAL PAID" value={`$${totalPaid.toFixed(2)}`} accent="#15803d"
          sub="Lacagta la helay" icon={<CheckCircle2 size={18} />} />
        <StatCard label="UNPAID / DUE" value={`$${totalUnpaid.toFixed(2)}`} accent="#dc2626"
          sub="Lacagaha baaqiga ah" icon={<KeyRound size={18} />} />
      </div>

      <div className="sa-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Send Notification card */}
          <div style={cardStyle}>
            <div style={cardHeaderRow}>
              <div style={{ ...iconBubble, background: "#EDE9FE" }}>
                <Megaphone size={20} color="#7c3aed" />
              </div>
              <div>
                <h2 style={cardTitleStyle}>Dir Ogeysiis</h2>
                <p style={cardSubStyle}>U dir fariin dhammaan schools-ka ama mid gaar ah.</p>
              </div>
            </div>

            {notifMsg && (
              <div style={{ ...noticeBanner, background: notifMsg.includes("Cillad") || notifMsg.includes("Fadlan") || notifMsg.includes("lama") ? "#FEF2F2" : "#F0FDF4", color: notifMsg.includes("Cillad") || notifMsg.includes("Fadlan") || notifMsg.includes("lama") ? "#991b1b" : "#166534" }}>
                <CheckCircle2 size={15} /> {notifMsg}
              </div>
            )}

            <form onSubmit={handleSendNotification}>
              {/* Target toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  className="sa-target-tab"
                  onClick={() => setNotifTarget("ALL")}
                  style={{ ...targetTabStyle, ...(notifTarget === "ALL" ? targetTabActive : {}) }}
                >
                  🌐 Dhammaan Schools ({totalSchools})
                </button>
                <button
                  type="button"
                  className="sa-target-tab"
                  onClick={() => setNotifTarget("ONE")}
                  style={{ ...targetTabStyle, ...(notifTarget === "ONE" ? targetTabActive : {}) }}
                >
                  🏫 School Gaar ah
                </button>
              </div>

              {/* School code search — only when targeting one school */}
              {notifTarget === "ONE" && (
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <label style={labelStyle}>School Code</label>
                  <div style={inputFieldWrap}>
                    <Search size={16} style={{ color: "#9CA3AF", marginRight: 8 }} />
                    <input
                      type="text"
                      className="sa-input"
                      placeholder="Qor ama dooro school code..."
                      value={notifSchoolCode}
                      onChange={(e) => { setNotifSchoolCode(e.target.value); setCodeDropdownOpen(true); }}
                      onFocus={() => setCodeDropdownOpen(true)}
                      style={plainInputStyle}
                    />
                    <ChevronDown size={15} style={{ color: "#9CA3AF" }} />
                  </div>

                  {codeDropdownOpen && filteredCodeSuggestions.length > 0 && (
                    <div style={dropdownPanel}>
                      {filteredCodeSuggestions.map((s) => (
                        <div
                          key={s.id}
                          className="sa-code-row"
                          onClick={() => { setNotifSchoolCode(s.code); setCodeDropdownOpen(false); }}
                          style={dropdownRow}
                        >
                          <span style={{ fontWeight: 700, color: "#111827" }}>{s.code}</span>
                          <span style={{ color: "#9CA3AF", fontSize: 12 }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Fariinta</label>
                <textarea
                  className="sa-textarea"
                  placeholder="Qor fariinta halkan..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  rows={4}
                  style={textareaStyle}
                  required
                />
              </div>

              <button type="submit" disabled={notifSending} style={sendBtnStyle}>
                <Send size={15} /> {notifSending ? "Dirayaa..." : "Dir Fariinta"}
              </button>
            </form>
          </div>

          {/* Create School card */}
          <div style={cardStyle}>
            <div style={cardHeaderRow}>
              <div style={{ ...iconBubble, background: "#dcfce7" }}>
                <PlusCircle size={20} color="#14532d" />
              </div>
              <div>
                <h2 style={cardTitleStyle}>Diiwaangali Iskuul Cusub</h2>
                <p style={cardSubStyle}>Gali xogta iyo rukunka billing-ka.</p>
              </div>
            </div>

            {msg && (
              <div style={{ ...noticeBanner, background: "#F0FDF4", color: "#166534" }}>
                <CheckCircle2 size={15} /> {msg}
              </div>
            )}

            <form onSubmit={handleCreateSchool}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Magaca Iskuulka</label>
                <div style={inputFieldWrap}>
                  <Building2 size={16} style={{ color: "#9CA3AF", marginRight: 8 }} />
                  <input type="text" className="sa-input" placeholder="E.g. Halbeeg Primary & Secondary"
                    value={name} onChange={(e) => setName(e.target.value)} style={plainInputStyle} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>School Code</label>
                  <div style={inputFieldWrap}>
                    <KeyRound size={16} style={{ color: "#9CA3AF", marginRight: 8 }} />
                    <input type="text" className="sa-input" placeholder="halbeeg01"
                      value={code} onChange={(e) => setCode(e.target.value)} style={plainInputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={inputFieldWrap}>
                    <KeyRound size={16} style={{ color: "#9CA3AF", marginRight: 8 }} />
                    <input type="password" className="sa-input" placeholder="Password-ka"
                      value={password} onChange={(e) => setPassword(e.target.value)} style={plainInputStyle} required />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Logo-da Iskuulka</label>
                <div style={{ ...inputFieldWrap, background: "#F9FAFB" }}>
                  <Upload size={16} style={{ marginRight: 8, color: "#9CA3AF" }} />
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ border: "none", background: "transparent", fontSize: 12.5 }} />
                </div>
                {logoBase64 && <img src={logoBase64} alt="Preview" style={{ width: 40, height: 40, marginTop: 8, objectFit: "contain", borderRadius: 8 }} />}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Plan</label>
                  <select className="sa-select" value={planType} onChange={(e) => setPlanType(e.target.value)} style={selectStyle}>
                    <option value="Monthly">Bille</option>
                    <option value="Yearly">Sanadle</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Qiimaha ($)</label>
                  <input type="number" className="sa-input" placeholder="100" value={price} onChange={(e) => setPrice(e.target.value)} style={plainBoxInput} required />
                </div>
                <div>
                  <label style={labelStyle}>Bixiyay ($)</label>
                  <input type="number" className="sa-input" placeholder="50" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} style={plainBoxInput} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={plainBoxInput} />
                </div>
                <div>
                  <label style={labelStyle}>Expire Date</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={plainBoxInput} required />
                </div>
              </div>

              <button type="submit" className="sa-btn-primary" disabled={loading} style={createBtnStyle}>
                {loading ? "Kaydinayaa..." : "Save & Create School"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN — Schools list */}
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 16, color: "#111827" }}>
            Liiska Iskuulada ({schools.length})
          </h3>
          <div style={{ display: "grid", gap: 14 }}>
            {schools.length === 0 ? (
              <p style={{ color: "#9CA3AF", fontSize: 14 }}>Weli wax Iskuul ah ma jiraan.</p>
            ) : (
              schools.map((sch) => {
                const unpaid = (parseFloat(sch.price) || 0) - (parseFloat(sch.amountPaid) || 0);
                const isExpired = sch.status === "Expired";
                return (
                  <div key={sch.id} style={{ ...schoolCardStyle, borderColor: isExpired ? "#fca5a5" : "#EEF0F4" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <img
                          src={sch.logoUrl || ""}
                          alt="logo"
                          style={{ width: 46, height: 46, objectFit: "contain", borderRadius: 12, background: "#F8FAFC", border: "1px solid #EEF0F4" }}
                        />
                        <div>
                          <h4 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: "#0f3d2e" }}>{sch.name}</h4>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                            Code: <strong style={{ color: "#374151" }}>{sch.code}</strong> · Pass: <strong style={{ color: "#374151" }}>{sch.password}</strong>
                          </p>
                        </div>
                      </div>
                      <span style={{ ...statusPill, background: isExpired ? "#fee2e2" : "#dcfce7", color: isExpired ? "#991b1b" : "#166534" }}>
                        {isExpired ? "🔴 EXPIRED" : "🟢 ACTIVE"}
                      </span>
                    </div>

                    <hr style={{ margin: "14px 0", border: "none", borderTop: "1px dashed #EEF0F4" }} />

                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 12, color: "#4b5563" }}>
                      <div>Plan: <strong>{sch.planType || "Monthly"}</strong> · Expire: <strong style={{ color: isExpired ? "#dc2626" : "inherit" }}>{sch.expiryDate || "N/A"}</strong></div>
                      <div>Price: <strong>${sch.price || 0}</strong> · Paid: <strong style={{ color: "#16a34a" }}>${sch.amountPaid || 0}</strong> · Due: <strong style={{ color: unpaid > 0 ? "#dc2626" : "#16a34a" }}>${unpaid}</strong></div>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                      <button onClick={() => setEditSchool(sch)} style={editBtnStyle}>
                        <Edit3 size={13} /> Wax ka baddal
                      </button>
                      <button onClick={() => handleDeleteSchool(sch.id)} className="sa-btn-danger" style={deleteBtnStyle}>
                        <Trash2 size={13} /> Tir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editSchool && (
        <div style={modalOverlay} onClick={() => setEditSchool(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditSchool(null)} style={closeModalBtn}><X size={18} /></button>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: "#0f3d2e" }}>Wax Ka Baddal Iskuulka</h3>

            <form onSubmit={handleUpdateSchool}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Magaca Iskuulka</label>
                <input type="text" value={editSchool.name} onChange={(e) => setEditSchool({ ...editSchool, name: e.target.value })} style={plainBoxInput} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Code (lama beddeli karo)</label>
                  <input type="text" value={editSchool.code} readOnly style={{ ...plainBoxInput, background: "#F1F5F9", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="text" value={editSchool.password} onChange={(e) => setEditSchool({ ...editSchool, password: e.target.value })} style={plainBoxInput} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Qiimaha Total ($)</label>
                  <input type="number" value={editSchool.price || ""} onChange={(e) => setEditSchool({ ...editSchool, price: e.target.value })} style={plainBoxInput} />
                </div>
                <div>
                  <label style={labelStyle}>Inta Bixiyay ($)</label>
                  <input type="number" value={editSchool.amountPaid || ""} onChange={(e) => setEditSchool({ ...editSchool, amountPaid: e.target.value })} style={plainBoxInput} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div>
                  <label style={labelStyle}>Status-ka</label>
                  <select value={editSchool.status} onChange={(e) => setEditSchool({ ...editSchool, status: e.target.value })} style={selectStyle}>
                    <option value="Active">Active</option>
                    <option value="Expired">Expired / Inactive</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expire Date</label>
                  <input type="date" value={editSchool.expiryDate || ""} onChange={(e) => setEditSchool({ ...editSchool, expiryDate: e.target.value })} style={plainBoxInput} />
                </div>
              </div>

              <button type="submit" style={createBtnStyle}>Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={statCardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color: accent, fontWeight: 800, fontSize: 11.5, letterSpacing: 0.4 }}>{label}</span>
        <div style={{ color: accent, opacity: 0.6 }}>{icon}</div>
      </div>
      <h2 style={{ margin: "8px 0 2px", fontSize: 26, fontWeight: 900, color: "#111827" }}>{value}</h2>
      <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{sub}</span>
    </div>
  );
}

/* ---------------- styles ---------------- */

const pageWrap = { minHeight: "100vh", background: "#F5F6FA", padding: "30px clamp(20px,5vw,48px)" };

const headerWrap = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 };

const logoutBtnStyle = {
  display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#dc2626",
  border: "1px solid #FECACA", padding: "10px 18px", borderRadius: 12, fontWeight: 700,
  fontSize: 13, cursor: "pointer",
};

const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 26 };

const statCardStyle = {
  background: "#fff", padding: "20px 22px", borderRadius: 18,
  boxShadow: "0 4px 16px rgba(17,24,39,0.05)", border: "1px solid #EEF0F4",
};

const cardStyle = {
  background: "#fff", borderRadius: 20, padding: "24px 26px",
  boxShadow: "0 4px 18px rgba(17,24,39,0.05)", border: "1px solid #EEF0F4",
};

const cardHeaderRow = { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 };

const iconBubble = { width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

const cardTitleStyle = { margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" };
const cardSubStyle = { margin: "3px 0 0", fontSize: 12.5, color: "#9CA3AF" };

const noticeBanner = { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, padding: "9px 12px", borderRadius: 10, marginBottom: 14 };

const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 };

const inputFieldWrap = {
  display: "flex", alignItems: "center", background: "#fff",
  border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "10px 14px",
};

const plainInputStyle = { border: "none", outline: "none", flex: 1, fontSize: 13.5, background: "transparent" };

const plainBoxInput = { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 13.5 };

const selectStyle = { width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 13.5, background: "#fff" };

const textareaStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB",
  fontSize: 13.5, resize: "vertical", fontFamily: "inherit",
};

const sendBtnStyle = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "#7c3aed", color: "#fff", border: "none", padding: "13px", borderRadius: 12,
  fontWeight: 700, fontSize: 14, cursor: "pointer",
};

const createBtnStyle = {
  width: "100%", background: "#16a34a", color: "#fff", border: "none", padding: "13px",
  borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer",
};

const targetTabStyle = {
  flex: 1, padding: "10px 12px", borderRadius: 12, border: "1.5px solid #E5E7EB",
  background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
};

const targetTabActive = { background: "#F5F3FF", borderColor: "#7c3aed", color: "#7c3aed" };

const dropdownPanel = {
  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff",
  border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(17,24,39,0.1)",
  zIndex: 30, maxHeight: 220, overflowY: "auto",
};

const dropdownRow = {
  display: "flex", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", fontSize: 13,
};

const schoolCardStyle = {
  background: "#fff", border: "1.5px solid #EEF0F4", borderRadius: 18, padding: 18,
  boxShadow: "0 4px 14px rgba(17,24,39,0.04)",
};

const statusPill = { padding: "5px 13px", borderRadius: 999, fontSize: 11, fontWeight: 800 };

const editBtnStyle = {
  background: "#EEF2FF", color: "#4338CA", border: "none", padding: "7px 14px", borderRadius: 10,
  cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
};

const deleteBtnStyle = {
  background: "#FEE2E2", color: "#991B1B", border: "none", padding: "7px 14px", borderRadius: 10,
  cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
};

const modalOverlay = {
  position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
};

const modalCard = {
  background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480,
  position: "relative", maxHeight: "90vh", overflowY: "auto",
};

const closeModalBtn = {
  position: "absolute", top: 18, right: 18, background: "#F3F4F6", border: "none",
  width: 32, height: 32, borderRadius: 10, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", color: "#6B7280",
};