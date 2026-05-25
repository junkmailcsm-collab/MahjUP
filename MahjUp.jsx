// ─────────────────────────────────────────────────────────────
//  MahjUp — Signup Sheet App
//  Firestore-backed. See firebase.js for config + SETUP.md
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase"; // ← your Firebase config

// ── Constants ────────────────────────────────────────────────
const ADMIN_PASSWORD = "changeme123"; // change before deploy

// ── Helpers ──────────────────────────────────────────────────
function makeSlots() {
  return [
    { id: "s1", label: "Slot 1", name: "", email: "", signedUp: false },
    { id: "s2", label: "Slot 2", name: "", email: "", signedUp: false },
    { id: "s3", label: "Slot 3", name: "", email: "", signedUp: false },
    { id: "s4", label: "Slot 4", name: "", email: "", signedUp: false },
  ];
}

function fmtDate(date, time) {
  if (!date || !time) return "";
  return new Date(`${date}T${time}`).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtReminder(date, time) {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  d.setHours(d.getHours() - 12);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function slotsLeft(table) {
  return table.slots.filter((s) => !s.signedUp).length;
}

// ── Global CSS ────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F5F2EC; }

  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pop {
    0%   { transform: scale(0.8); opacity: 0; }
    70%  { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  ::placeholder { color: #B0AA9E; }

  input[type="text"], input[type="email"], input[type="date"],
  input[type="time"], input[type="password"] {
    width: 100%;
    padding: 10px 14px;
    border: 1.5px solid #D9D4CA;
    border-radius: 8px;
    background: #FDFAF6;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    color: #1A1814;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus {
    border-color: #C94F2E;
    box-shadow: 0 0 0 3px rgba(201,79,46,0.1);
  }

  button { cursor: pointer; font-family: 'DM Sans', sans-serif; }
`;

// ── Styled primitives ─────────────────────────────────────────
const S = {
  // layout
  page: {
    minHeight: "100vh",
    background: "#F5F2EC",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1A1814",
  },

  // nav
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 2rem",
    height: 64,
    background: "#1A1814",
    position: "sticky",
    top: 0,
    zIndex: 200,
  },
  logo: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: "1.5rem",
    color: "#F5F2EC",
    letterSpacing: "-0.02em",
    cursor: "pointer",
    userSelect: "none",
  },
  logoAccent: { color: "#E8714A" },

  // buttons
  btnPrimary: {
    padding: "10px 22px",
    background: "#C94F2E",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: "0.01em",
    transition: "background 0.15s, transform 0.1s",
  },
  btnOutline: {
    padding: "9px 20px",
    background: "transparent",
    color: "#F5F2EC",
    border: "1.5px solid rgba(245,242,236,0.3)",
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 14,
    transition: "background 0.15s",
  },
  btnGhost: {
    padding: "8px 16px",
    background: "transparent",
    color: "#7A7670",
    border: "1.5px solid #D9D4CA",
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 13,
  },
  btnDanger: {
    padding: "8px 14px",
    background: "transparent",
    color: "#C94F2E",
    border: "1.5px solid rgba(201,79,46,0.35)",
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 13,
  },

  // cards
  card: {
    background: "#fff",
    border: "1px solid #E8E3DA",
    borderRadius: 14,
    padding: "1.4rem 1.6rem",
  },

  // form
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7A7670",
    marginBottom: 6,
  },
  err: { fontSize: 12, color: "#C94F2E", marginTop: 4 },

  // slots
  slotRow: (sel, taken) => ({
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 14px",
    borderRadius: 10,
    border: sel ? "2px solid #C94F2E" : "1.5px solid #E8E3DA",
    background: sel ? "#FEF5F2" : taken ? "#FDFAF6" : "#fff",
    cursor: taken ? "not-allowed" : "pointer",
    opacity: taken ? 0.65 : 1,
    marginBottom: 8,
    transition: "all 0.12s",
  }),

  // pill badge
  pill: (full) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    background: full ? "#FEF2EE" : "#EEF7EF",
    color: full ? "#C94F2E" : "#2E7D32",
    border: `1px solid ${full ? "rgba(201,79,46,0.25)" : "rgba(46,125,50,0.2)"}`,
  }),

  reminderBox: {
    background: "#FFFBF5",
    border: "1px solid #EDDFCC",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    marginTop: 16,
  },
};

// ── Toast ─────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        background: "#1A1814",
        color: "#F5F2EC",
        padding: "12px 20px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 999,
        animation: "toastIn 0.25s ease",
        maxWidth: 320,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }}
    >
      {toast.msg}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#B0AA9E",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════════════════════════════
function HomePage({ tables, loading, onSignup, goAdmin }) {
  return (
    <div style={S.page}>
      {/* Hero */}
      <div
        style={{
          background: "#1A1814",
          padding: "5rem 2rem 4rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(232,113,74,0.15)",
            color: "#E8714A",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "5px 14px",
            borderRadius: 20,
            border: "1px solid rgba(232,113,74,0.3)",
            marginBottom: 24,
          }}
        >
          Event Signups, Simplified
        </div>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.5rem, 6vw, 4rem)",
            color: "#F5F2EC",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: 16,
          }}
        >
          Grab your spot.<br />
          <span style={{ color: "#E8714A", fontStyle: "italic" }}>
            We'll remind you.
          </span>
        </h1>
        <p
          style={{
            color: "#7A7670",
            fontSize: 16,
            maxWidth: 440,
            margin: "0 auto 2rem",
            lineHeight: 1.6,
          }}
        >
          Sign up for a slot. We'll send a reminder 12 hours before so you
          never miss a thing.
        </p>
        <button
          style={{ ...S.btnOutline, fontSize: 13 }}
          onClick={goAdmin}
        >
          Admin →
        </button>
      </div>

      {/* Sheets */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#B0AA9E", padding: "3rem 0" }}>
            Loading…
          </div>
        ) : tables.length === 0 ? (
          <div
            style={{
              ...S.card,
              textAlign: "center",
              padding: "4rem 2rem",
              color: "#B0AA9E",
            }}
          >
            <div
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "2rem",
                color: "#D9D4CA",
                marginBottom: 10,
              }}
            >
              Nothing yet
            </div>
            Ask an organiser to create a signup sheet.
          </div>
        ) : (
          <>
            <SectionLabel>Open Sheets</SectionLabel>
            <div style={{ display: "grid", gap: 12 }}>
              {tables.map((t) => {
                const left = slotsLeft(t);
                const isFull = left === 0;
                return (
                  <div
                    key={t.id}
                    style={{
                      ...S.card,
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      animation: "fadeUp 0.3s ease both",
                    }}
                  >
                    {/* Date block */}
                    <div
                      style={{
                        minWidth: 54,
                        textAlign: "center",
                        background: "#F5F2EC",
                        borderRadius: 10,
                        padding: "10px 6px",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#C94F2E",
                        }}
                      >
                        {t.date
                          ? new Date(`${t.date}T12:00`).toLocaleString(
                              "en-US",
                              { month: "short" }
                            )
                          : "—"}
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Serif Display', serif",
                          fontSize: "1.7rem",
                          lineHeight: 1,
                          color: "#1A1814",
                        }}
                      >
                        {t.date
                          ? new Date(`${t.date}T12:00`).getDate()
                          : "—"}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 16,
                          marginBottom: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          color: "#7A7670",
                          fontSize: 13,
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>📍 {t.location}</span>
                        <span>🕐 {t.time}</span>
                      </div>
                    </div>

                    {/* Slots remaining */}
                    <div
                      style={{
                        textAlign: "center",
                        flexShrink: 0,
                        minWidth: 56,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'DM Serif Display', serif",
                          fontSize: "1.8rem",
                          lineHeight: 1,
                          color: isFull ? "#C94F2E" : "#2E7D32",
                        }}
                      >
                        {left}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "#B0AA9E",
                          fontWeight: 600,
                        }}
                      >
                        left
                      </div>
                    </div>

                    <button
                      style={{
                        ...S.btnPrimary,
                        opacity: isFull ? 0.45 : 1,
                        flexShrink: 0,
                      }}
                      disabled={isFull}
                      onClick={() => onSignup(t)}
                    >
                      {isFull ? "Full" : "Sign Up"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SIGNUP PAGE
// ═══════════════════════════════════════════════════════════════
function SignupPage({ table, onBack, onConfirm }) {
  const [slotId, setSlotId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  async function submit() {
    const e = {};
    if (!slotId) e.slot = "Pick a slot";
    if (!name.trim()) e.name = "Required";
    if (!email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Bad email";
    if (Object.keys(e).length) { setErrs(e); return; }

    setSaving(true);
    await onConfirm({ tableId: table.id, slotId, name: name.trim(), email: email.trim() });
    setDone({ name: name.trim(), email: email.trim() });
    setSaving(false);
  }

  if (done) {
    return (
      <div style={S.page}>
        <div
          style={{
            maxWidth: 520,
            margin: "4rem auto",
            padding: "0 1.5rem",
            animation: "fadeUp 0.3s ease",
          }}
        >
          <div style={{ ...S.card, textAlign: "center", padding: "2.5rem" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#EEF7EF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 1rem",
                animation: "pop 0.4s ease",
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "1.6rem",
                marginBottom: 6,
              }}
            >
              You're in, {done.name.split(" ")[0]}!
            </div>
            <div style={{ color: "#7A7670", fontSize: 14, marginBottom: "1.5rem" }}>
              Spot confirmed for{" "}
              <strong style={{ color: "#1A1814" }}>{table.title}</strong>
            </div>
            <div style={S.reminderBox}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
              <div style={{ textAlign: "left" }}>
                <div
                  style={{ fontWeight: 600, fontSize: 13, color: "#1A1814", marginBottom: 3 }}
                >
                  Reminder email scheduled
                </div>
                <div style={{ fontSize: 12, color: "#7A7670", lineHeight: 1.5 }}>
                  We'll email <strong>{done.email}</strong> on{" "}
                  <strong>{fmtReminder(table.date, table.time)}</strong> — 12 hrs
                  before the event starts.
                </div>
              </div>
            </div>
            <button
              style={{ ...S.btnPrimary, marginTop: "1.5rem", width: "100%", padding: 12 }}
              onClick={onBack}
            >
              Back to all sheets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <button
          style={{ ...S.btnGhost, marginBottom: 20, fontSize: 13 }}
          onClick={onBack}
        >
          ← All sheets
        </button>

        <div style={{ marginBottom: "1.75rem" }}>
          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.8rem",
              marginBottom: 6,
              letterSpacing: "-0.02em",
            }}
          >
            {table.title}
          </h2>
          <div style={{ color: "#7A7670", fontSize: 13, display: "flex", gap: 16 }}>
            <span>📍 {table.location}</span>
            <span>🗓 {fmtDate(table.date, table.time)}</span>
          </div>
        </div>

        <div style={S.card}>
          <SectionLabel>Pick your slot</SectionLabel>
          {errs.slot && (
            <div style={{ ...S.err, marginBottom: 8 }}>{errs.slot}</div>
          )}
          {table.slots.map((s) => (
            <div
              key={s.id}
              style={S.slotRow(slotId === s.id, s.signedUp)}
              onClick={() => { if (!s.signedUp) setSlotId(s.id); }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border:
                    slotId === s.id
                      ? "none"
                      : "2px solid #D9D4CA",
                  background:
                    slotId === s.id ? "#C94F2E" : "transparent",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {slotId === s.id && (
                  <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>
                    ✓
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {s.label}
                </span>
                {s.signedUp ? (
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 12,
                      color: "#C94F2E",
                    }}
                  >
                    Taken
                  </span>
                ) : (
                  <span
                    style={{ marginLeft: 10, fontSize: 12, color: "#2E7D32" }}
                  >
                    Open
                  </span>
                )}
              </div>
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid #F0EBE2",
              margin: "1.25rem 0",
            }}
          />

          <SectionLabel>Your info</SectionLabel>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={S.label}>Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errs.name && <div style={S.err}>{errs.name}</div>}
            </div>
            <div>
              <label style={S.label}>Email</label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errs.email && <div style={S.err}>{errs.email}</div>}
            </div>
          </div>

          <div style={S.reminderBox}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔔</span>
            <div style={{ fontSize: 12, color: "#7A7670", lineHeight: 1.5 }}>
              Reminder email will be sent on{" "}
              <strong style={{ color: "#1A1814" }}>
                {fmtReminder(table.date, table.time)}
              </strong>{" "}
              — 12 hours before the event.
            </div>
          </div>

          <button
            style={{
              ...S.btnPrimary,
              width: "100%",
              padding: 13,
              marginTop: "1.25rem",
              fontSize: 15,
              opacity: saving ? 0.6 : 1,
            }}
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving…" : "Confirm My Spot →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ═══════════════════════════════════════════════════════════════
function AdminLogin({ onSuccess, goHome }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  function submit(e) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { onSuccess(); }
    else { setErr(true); }
  }
  return (
    <div style={S.page}>
      <div
        style={{
          maxWidth: 400,
          margin: "6rem auto",
          padding: "0 1.5rem",
          animation: "fadeUp 0.3s ease",
        }}
      >
        <button style={{ ...S.btnGhost, marginBottom: 20 }} onClick={goHome}>
          ← Back
        </button>
        <div style={S.card}>
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.6rem",
              marginBottom: 6,
            }}
          >
            Admin Login
          </div>
          <div
            style={{ color: "#7A7670", fontSize: 13, marginBottom: "1.5rem" }}
          >
            Enter your admin password to manage signup sheets.
          </div>
          <label style={S.label}>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            onKeyDown={(e) => e.key === "Enter" && submit(e)}
          />
          {err && (
            <div style={S.err}>Incorrect password.</div>
          )}
          <button
            style={{
              ...S.btnPrimary,
              width: "100%",
              padding: 12,
              marginTop: 16,
            }}
            onClick={submit}
          >
            Login →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
function AdminDashboard({ tables, loading, onDelete, onCreate, onLogout }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", location: "", date: "", time: "" });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  async function submitCreate(e) {
    e.preventDefault();
    const err = {};
    if (!form.title.trim()) err.title = "Required";
    if (!form.location.trim()) err.location = "Required";
    if (!form.date) err.date = "Required";
    if (!form.time) err.time = "Required";
    if (Object.keys(err).length) { setErrs(err); return; }
    setSaving(true);
    await onCreate(form);
    setForm({ title: "", location: "", date: "", time: "" });
    setErrs({});
    setCreating(false);
    setSaving(false);
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: "1.8rem",
                letterSpacing: "-0.02em",
              }}
            >
              Signup Sheets
            </h2>
            <div style={{ color: "#B0AA9E", fontSize: 13 }}>
              {tables.length} sheet{tables.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              style={S.btnGhost}
              onClick={onLogout}
            >
              Logout
            </button>
            <button
              style={S.btnPrimary}
              onClick={() => setCreating(true)}
            >
              + New Sheet
            </button>
          </div>
        </div>

        {/* Create form */}
        {creating && (
          <div
            style={{
              ...S.card,
              marginBottom: "1.5rem",
              animation: "fadeUp 0.2s ease",
              borderColor: "#C94F2E",
            }}
          >
            <div
              style={{ fontWeight: 600, fontSize: 15, marginBottom: "1rem" }}
            >
              New Signup Sheet
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>Event Title</label>
                <input
                  type="text"
                  placeholder="Community Cleanup Day"
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                />
                {errs.title && <div style={S.err}>{errs.title}</div>}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>Location</label>
                <input
                  type="text"
                  placeholder="Riverside Park, East Entrance"
                  value={form.location}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, location: e.target.value }))
                  }
                />
                {errs.location && <div style={S.err}>{errs.location}</div>}
              </div>
              <div>
                <label style={S.label}>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                />
                {errs.date && <div style={S.err}>{errs.date}</div>}
              </div>
              <div>
                <label style={S.label}>Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, time: e.target.value }))
                  }
                />
                {errs.time && <div style={S.err}>{errs.time}</div>}
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 10, marginTop: 16 }}
            >
              <button
                style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}
                onClick={submitCreate}
                disabled={saving}
              >
                {saving ? "Creating…" : "Create Sheet"}
              </button>
              <button
                style={S.btnGhost}
                onClick={() => { setCreating(false); setErrs({}); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sheet list */}
        {loading ? (
          <div style={{ color: "#B0AA9E", padding: "3rem 0", textAlign: "center" }}>
            Loading…
          </div>
        ) : tables.length === 0 ? (
          <div
            style={{
              ...S.card,
              textAlign: "center",
              padding: "3rem",
              color: "#B0AA9E",
            }}
          >
            No sheets yet. Create one above!
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {tables.map((t) => {
              const takenCount = t.slots.filter((s) => s.signedUp).length;
              return (
                <div
                  key={t.id}
                  style={{ ...S.card, animation: "fadeUp 0.25s ease" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 14,
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {t.title}
                      </div>
                      <div
                        style={{
                          color: "#7A7670",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        📍 {t.location} · 🗓 {fmtDate(t.date, t.time)}
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}
                    >
                      <span style={S.pill(takenCount === 4)}>
                        {takenCount}/4 filled
                      </span>
                      {confirmDel === t.id ? (
                        <>
                          <button
                            style={S.btnDanger}
                            onClick={() => {
                              onDelete(t.id);
                              setConfirmDel(null);
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            style={S.btnGhost}
                            onClick={() => setConfirmDel(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          style={S.btnDanger}
                          onClick={() => setConfirmDel(t.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {t.slots.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: s.signedUp ? "#EEF7EF" : "#FDFAF6",
                          border: `1px solid ${s.signedUp ? "rgba(46,125,50,0.2)" : "#EDE9E3"}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "#B0AA9E",
                            marginBottom: 3,
                          }}
                        >
                          {s.label}
                        </div>
                        {s.signedUp ? (
                          <>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {s.name}
                            </div>
                            <div
                              style={{ fontSize: 11, color: "#2E7D32" }}
                            >
                              {s.email}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#B0AA9E",
                              fontStyle: "italic",
                            }}
                          >
                            Empty
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT APP — Firestore wiring
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("home"); // home | adminLogin | admin | signup
  const [adminAuth, setAdminAuth] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast({ msg });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Live Firestore listener ─────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "sheets"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Firestore: create sheet ─────────────────────────────────
  async function handleCreate(form) {
    await addDoc(collection(db, "sheets"), {
      title: form.title,
      location: form.location,
      date: form.date,
      time: form.time,
      slots: makeSlots(),
      createdAt: serverTimestamp(),
    });
    showToast("Sheet created!");
  }

  // ── Firestore: delete sheet ─────────────────────────────────
  async function handleDelete(id) {
    await deleteDoc(doc(db, "sheets", id));
    showToast("Sheet deleted.");
  }

  // ── Firestore: sign up for a slot ──────────────────────────
  //  Also writes to `reminders` collection → triggers Cloud Function
  async function handleSignup({ tableId, slotId, name, email }) {
    const tableRef = doc(db, "sheets", tableId);
    const table = tables.find((t) => t.id === tableId);
    const updatedSlots = table.slots.map((s) =>
      s.id === slotId ? { ...s, name, email, signedUp: true } : s
    );
    await updateDoc(tableRef, { slots: updatedSlots });

    // ── Write reminder record — Cloud Function picks this up ──
    // The function (see SETUP.md) reads `sendAt`, waits, then emails.
    const eventDt = new Date(`${table.date}T${table.time}`);
    const sendAt = new Date(eventDt.getTime() - 12 * 60 * 60 * 1000);
    await addDoc(collection(db, "reminders"), {
      email,
      name,
      eventTitle: table.title,
      eventLocation: table.location,
      eventDate: table.date,
      eventTime: table.time,
      sendAt: sendAt.toISOString(),
      sent: false,
      createdAt: serverTimestamp(),
    });
  }

  // ── Nav ─────────────────────────────────────────────────────
  const Nav = () => (
    <nav style={S.nav}>
      <span style={S.logo} onClick={() => setView("home")}>
        Mahj<span style={S.logoAccent}>Up</span>
      </span>
      <div>
        {view !== "admin" && (
          <button
            style={S.btnOutline}
            onClick={() => setView(adminAuth ? "admin" : "adminLogin")}
          >
            {adminAuth ? "Dashboard" : "Admin"}
          </button>
        )}
      </div>
    </nav>
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Toast toast={toast} />
      <Nav />

      {view === "home" && (
        <HomePage
          tables={tables}
          loading={loading}
          onSignup={(t) => { setSelectedTable(t); setView("signup"); }}
          goAdmin={() => setView(adminAuth ? "admin" : "adminLogin")}
        />
      )}

      {view === "adminLogin" && (
        <AdminLogin
          onSuccess={() => { setAdminAuth(true); setView("admin"); }}
          goHome={() => setView("home")}
        />
      )}

      {view === "admin" && (
        <AdminDashboard
          tables={tables}
          loading={loading}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onLogout={() => { setAdminAuth(false); setView("home"); }}
        />
      )}

      {view === "signup" && selectedTable && (
        <SignupPage
          table={tables.find((t) => t.id === selectedTable.id) || selectedTable}
          onBack={() => setView("home")}
          onConfirm={handleSignup}
        />
      )}
    </>
  );
}
