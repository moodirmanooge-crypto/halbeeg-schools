import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart3,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  Users,
  Phone,
  Smartphone,
} from "lucide-react";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Reports() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsMap = {};
      studentsSnap.docs.forEach((d) => {
        studentsMap[d.id] = d.data();
      });
      setStudents(studentsMap);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentsList = paymentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setPayments(paymentsList);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (p) => {
    const paid = Number(p.paidAmount) || 0;
    const fee = Number(p.monthlyFee) || 0;
    if (paid <= 0) return "Unpaid";
    if (paid >= fee && fee > 0) return "Full Paid";
    return "Partial Paid";
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!p.createdAt) return false;
      const date = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      const monthMatch = date.getMonth() === selectedMonth;
      const yearMatch = date.getFullYear() === selectedYear;

      const status = getStatus(p);
      const statusMatch = statusFilter === "All" || status === statusFilter;

      const searchMatch =
        !search.trim() ||
        (p.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.studentId || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.parentPhone || "").includes(search);

      return monthMatch && yearMatch && statusMatch && searchMatch;
    });
  }, [payments, selectedMonth, selectedYear, statusFilter, search]);

  const totals = useMemo(() => {
    let totalIncome = 0;
    let fullPaid = 0;
    let partialPaid = 0;
    let unpaid = 0;

    filteredPayments.forEach((p) => {
      totalIncome += Number(p.paidAmount) || 0;
      const status = getStatus(p);
      if (status === "Full Paid") fullPaid++;
      else if (status === "Partial Paid") partialPaid++;
      else unpaid++;
    });

    return { totalIncome, fullPaid, partialPaid, unpaid, total: filteredPayments.length };
  }, [filteredPayments]);

  const years = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#151233,#181341)",
          borderRadius: 24,
          padding: "36px 40px",
          border: "1px solid rgba(139,108,245,0.25)",
          maxWidth: 1400,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <style>{`
          select option {
            background: #1e1a4a;
            color: #ffffff;
          }
        `}</style>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 30 }}>
          <div
            style={{
              width: 55,
              height: 55,
              borderRadius: 15,
              background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BarChart3 color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, color: "#fff" }}>Reports</h1>
            <div style={{ color: "#8b87ad", fontSize: 14 }}>
              Warbixinta Lacagaha, Cashierka iyo Bixinta Ardayda
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 30,
            alignItems: "center",
            position: "relative",
            zIndex: 20,
          }}
        >
          <FilterBox icon={Calendar}>
            <select
              style={selectStyle}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </FilterBox>

          <FilterBox icon={Calendar}>
            <select
              style={selectStyle}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterBox>

          <FilterBox icon={Wallet}>
            <select
              style={selectStyle}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Dhammaan Status</option>
              <option value="Full Paid">Full Paid</option>
              <option value="Partial Paid">Partial Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </FilterBox>

          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={17}
              color="#8b87ad"
              style={{ position: "absolute", left: 14, top: 13 }}
            />
            <input
              style={{ ...inputStyle, paddingLeft: 40 }}
              placeholder="Raadi magaca, ID-ga, ama numbarka waalidka..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            marginBottom: 34,
          }}
        >
          <SummaryCard
            icon={Wallet}
            label="Wadarta Lacagta Soo Gashay"
            value={`$${totals.totalIncome.toLocaleString()}`}
            color="#6d5df0"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Full Paid"
            value={totals.fullPaid}
            color="#22C55E"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Partial Paid"
            value={totals.partialPaid}
            color="#F59E0B"
          />
          <SummaryCard
            icon={Clock}
            label="Unpaid / Reminder"
            value={totals.unpaid}
            color="#EF4444"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
            Soo raraya xogta...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
            Ma jiraan xog waafaqsan bilaha aad doorattay.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Sawir</Th>
                  <Th>Magaca</Th>
                  <Th>ID</Th>
                  <Th>Fasalka</Th>
                  <Th>Numb. Ardayga</Th>
                  <Th>Numb. Waalidka</Th>
                  <Th>Fee</Th>
                  <Th>La Bixiyay</Th>
                  <Th>Hadhay</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const status = getStatus(p);
                  const student = students[p.studentId] || {};
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(139,108,245,0.12)" }}>
                      <Td>
                        <img
                          src={
                            student.studentPhoto ||
                            "https://ui-avatars.com/api/?background=6d5df0&color=fff&name=" +
                              encodeURIComponent(p.studentName || "S")
                          }
                          alt=""
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid rgba(139,108,245,0.4)",
                          }}
                        />
                      </Td>
                      <Td style={{ fontWeight: 600, color: "#fff" }}>{p.studentName}</Td>
                      <Td>{p.studentId}</Td>
                      <Td>{p.className || "-"}</Td>
                      <Td>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Smartphone size={14} color="#8b87ad" />
                          {p.studentPhone || "-"}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Phone size={14} color="#8b87ad" />
                          {p.parentPhone || "-"}
                        </span>
                      </Td>
                      <Td>${Number(p.monthlyFee) || 0}</Td>
                      <Td>${Number(p.paidAmount) || 0}</Td>
                      <Td>${Number(p.remaining) || 0}</Td>
                      <Td>
                        <StatusBadge status={status} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBox({ icon: Icon, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.02)",
        border: "1.5px solid rgba(139,108,245,0.35)",
        borderRadius: 12,
        padding: "6px 14px",
      }}
    >
      <Icon size={16} color="#8b6cf5" />
      {children}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(139,108,245,0.25)",
        borderRadius: 18,
        padding: "22px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#8b87ad" }}>{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Full Paid": { bg: "#22C55E22", color: "#22C55E" },
    "Partial Paid": { bg: "#F59E0B22", color: "#F59E0B" },
    Unpaid: { bg: "#EF444422", color: "#EF4444" },
  };
  const s = map[status] || map["Unpaid"];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "6px 12px",
        borderRadius: 20,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        color: "#8b87ad",
        fontSize: 13,
        fontWeight: 600,
        borderBottom: "1.5px solid rgba(139,108,245,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }) {
  return (
    <td
      style={{
        padding: "14px",
        color: "#e5e3f7",
        fontSize: 14,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

const selectStyle = {
  background: "#151233",
  border: "none",
  outline: "none",
  color: "#e5e3f7",
  fontSize: 14,
  padding: "8px 4px",
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  fontSize: 14,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
};