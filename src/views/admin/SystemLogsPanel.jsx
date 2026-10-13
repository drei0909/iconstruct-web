// src/views/admin/SystemLogsPanel.jsx
// System Logs — who signed up, signed in / out, opened the dashboard, failed
// to sign in (shop and admin), plus admin actions. Live, filterable.

import { useEffect, useMemo, useState } from "react";
import SearchBar from "../../components/ui/SearchBar";
import ListPagination, { paginate } from "../../components/ui/ListPagination";
import { watchSystemLogs } from "../../controllers/adminController";
import { formatDate, formatTime, toMillis } from "../../utils/dateTime";

const DAY = 24 * 60 * 60 * 1000;

const CATEGORIES = [
  { key: "all", label: "All activity" },
  { key: "signin", label: "Sign-ins", types: ["shop_login", "admin_login", "shop_visit"] },
  { key: "failed", label: "Failed sign-ins", types: ["login_failed", "admin_login_failed"] },
  { key: "signup", label: "Sign-ups", types: ["shop_signup"] },
  { key: "signout", label: "Sign-outs", types: ["shop_logout", "admin_logout"] },
  { key: "admin", label: "Admin actions", types: ["admin_action"] },
  { key: "system", label: "System", types: ["system"] },
];

const TYPE_LABEL = {
  shop_login: "Shop sign-in",
  shop_visit: "Dashboard visit",
  shop_logout: "Shop sign-out",
  shop_signup: "Shop sign-up",
  login_failed: "Failed sign-in",
  admin_login: "Admin sign-in",
  admin_logout: "Admin sign-out",
  admin_login_failed: "Failed admin sign-in",
  admin_action: "Admin action",
  system: "System",
};

const TYPE_TONE = {
  shop_login: ["#ECFDF5", "#047857"],
  shop_visit: ["#F0F9FF", "#0369A1"],
  shop_logout: ["#F1F5F9", "#475569"],
  shop_signup: ["#EEF2FF", "#4338CA"],
  login_failed: ["#FFFBEB", "#B45309"],
  admin_login: ["#F5F3FF", "#6D28D9"],
  admin_logout: ["#F1F5F9", "#475569"],
  admin_login_failed: ["#FEF2F2", "#B91C1C"],
  admin_action: ["#F8FAFC", "#334155"],
  system: ["#F8FAFC", "#64748B"],
};

const LEVEL_COLOR = { info: "#0891B2", success: "#059669", warn: "#D97706", error: "#DC2626" };

const RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All (latest 500)" },
];

/** Entries written before log categories existed carry no `type`. */
function typeOf(e) {
  if (e.type) return e.type;
  const msg = String(e.message || "");
  if (/^Admin signed in/i.test(msg)) return "admin_login";
  if (/^Admin signed out/i.test(msg)) return "admin_logout";
  return String(e.actor || "").includes("@") ? "admin_action" : "system";
}

function roleOf(e, type) {
  if (e.actorRole) return e.actorRole;
  if (type.startsWith("admin")) return "admin";
  if (type.startsWith("shop")) return "shop";
  return "system";
}

/** "Chrome on Windows" from a user-agent string (best effort). */
function deviceLabel(ua = "") {
  if (!ua) return "";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

const selectStyle = {
  padding: "7px 10px", borderRadius: 8, fontSize: 11.5, border: "1px solid #E2E8F0",
  background: "#fff", color: "#334155", cursor: "pointer", fontFamily: "inherit",
};

export default function SystemLogsPanel() {
  const [range, setRange] = useState("7");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [role, setRole] = useState("all");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);

  // Re-subscribe when the date range changes (server-side narrowing).
  useEffect(() => {
    const sinceMs = range === "all" ? null : Date.now() - Number(range) * DAY;
    const unsub = watchSystemLogs(
      { sinceMs },
      (list) => { setRows(list); setError(""); },
      (err) => {
        console.warn("System logs listener failed:", err?.message || err);
        setError("Couldn't load logs. Refresh to try again.");
        setRows((r) => r || []);
      }
    );
    return () => unsub();
  }, [range]);

  const entries = useMemo(
    () => (rows || []).map((e) => {
      const type = typeOf(e);
      return { ...e, _type: type, _role: roleOf(e, type), _level: e.level || "info", _device: deviceLabel(e.userAgent) };
    }),
    [rows]
  );

  const counts = useMemo(() => {
    const c = { all: entries.length };
    for (const cat of CATEGORIES) {
      if (cat.types) c[cat.key] = entries.filter((e) => cat.types.includes(e._type)).length;
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.key === category);
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat?.types && !cat.types.includes(e._type)) return false;
      if (role !== "all" && e._role !== role) return false;
      if (level !== "all" && e._level !== level) return false;
      if (!q) return true;
      return [e.message, e.email, e.actor, e.ip, e._device]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [entries, category, role, level, query]);

  const filterKey = JSON.stringify([category, role, level, query, range, pageSize]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const pg = paginate(filtered, page, pageSize);

  const failedRecent = entries.filter((e) => e._type === "admin_login_failed").length;

  return (
    <div>
      {failedRecent > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>
          <strong>{failedRecent} failed admin sign-in{failedRecent === 1 ? "" : "s"}</strong> in this period.
          {" "}Check the IP and device below — repeated failures can mean someone is guessing the admin password.
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {CATEGORIES.map((c) => {
          const on = category === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setCategory(c.key)}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                border: on ? "1px solid #0F172A" : "1px solid #E2E8F0",
                background: on ? "#0F172A" : "#fff", color: on ? "#fff" : "#64748B",
              }}>
              {c.label} <span style={{ opacity: 0.7, fontWeight: 500 }}>({counts[c.key] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search message, email, IP address or device…"
        accentColor="#4F46E5"
        style={{ marginBottom: 10 }}
        width="100%"
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <select value={range} onChange={(e) => setRange(e.target.value)} style={selectStyle} aria-label="Date range">
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle} aria-label="Who">
          <option value="all">Everyone</option>
          <option value="shop">Shop owners</option>
          <option value="admin">Admins</option>
          <option value="visitor">Visitors (not signed in)</option>
          <option value="system">System</option>
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={selectStyle} aria-label="Level">
          <option value="all">All levels</option>
          <option value="success">Success</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#94A3B8" }}>
          {rows === null ? "Loading…" : `${filtered.length} of ${entries.length} entries`}
        </span>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 12 }}>{error}</div>
      )}

      <div style={{ borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {rows === null ? (
          <div style={{ padding: 28, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading logs…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            No log entries match these filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["When", "Event", "Details", "Who", "IP / Device"].map((h) => (
                    <th key={h} style={{ padding: "9px 12px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94A3B8", textAlign: "left", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pg.slice.map((e) => {
                  const [bg, fg] = TYPE_TONE[e._type] || TYPE_TONE.system;
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                        <div style={{ fontSize: 11.5, color: "#334155" }}>{toMillis(e.createdAt) ? formatDate(e.createdAt) : "Just now"}</div>
                        <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{formatTime(e.createdAt)}</div>
                      </td>
                      <td style={{ padding: "9px 12px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: bg, color: fg }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: LEVEL_COLOR[e._level] || LEVEL_COLOR.info }} />
                          {TYPE_LABEL[e._type] || e._type}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", fontSize: 12, color: "#0F172A", verticalAlign: "top" }}>{e.message}</td>
                      <td style={{ padding: "9px 12px", verticalAlign: "top" }}>
                        <div style={{ fontSize: 11.5, color: "#334155", wordBreak: "break-all" }}>{e.email || e.actor || "—"}</div>
                        <div style={{ fontSize: 10.5, color: "#94A3B8", textTransform: "capitalize" }}>{e._role}</div>
                      </td>
                      <td style={{ padding: "9px 12px", verticalAlign: "top" }}>
                        <div style={{ fontSize: 11, color: "#334155", fontFamily: "var(--font-mono, monospace)" }}>{e.ip || "—"}</div>
                        <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{e._device || ""}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {filtered.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <ListPagination
            page={pg.page}
            pageSize={pageSize}
            total={pg.total}
            onPageChange={(p) => setPageState({ key: filterKey, page: p })}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        </div>
      )}
    </div>
  );
}
