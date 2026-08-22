import { useMemo, useState } from "react";
import {
  archiveContactMessage,
  markContactMessageRead,
  reopenContactMessage,
  replyToContactMessage,
  deleteContactMessage,
} from "../../controllers/adminController";
import {
  EnvelopeSimple,
  ArrowRight,
  Archive,
  ArrowCounterClockwise,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";

function formatWhen(ts) {
  try {
    const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
    if (!d || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function firstName(fullName) {
  const n = String(fullName || "").trim();
  if (!n) return "there";
  return n.split(/\s+/)[0];
}

/** Detect sender + topic and build ready Gmail reply templates. */
function buildReplyTemplates(msg = {}) {
  const name = firstName(msg.name);
  const full = String(msg.name || "there").trim() || "there";
  const subject = String(msg.subject || "your inquiry").trim();
  const hay = `${subject} ${msg.message || ""}`.toLowerCase();

  const items = [
    {
      key: "general",
      label: "General thanks",
      text: `Hi ${name},\n\nThank you for contacting iConstruct about "${subject}".\n\nWe received your message and our support team is reviewing it. We'll get back to you as soon as we can.\n\nIf you have more details to share, just reply to this email.\n\nBest regards,\niConstruct Support Team\niconstruct2026@gmail.com`,
    },
    {
      key: "signup",
      label: "Sign-up / bug",
      text: `Hi ${name},\n\nThank you for reporting an issue with the sign-up / registration page.\n\nWe've noted your concern and our team is checking it now. We'll follow up once it's fixed or if we need more information from you.\n\nWe appreciate your patience.\n\nBest regards,\niConstruct Support Team\niconstruct2026@gmail.com`,
    },
    {
      key: "payment",
      label: "Payment / plan",
      text: `Hi ${name},\n\nThank you for contacting iConstruct about billing or your subscription plan.\n\nWe've received your message and will verify the details on our side. We'll reply with an update or next steps shortly.\n\nBest regards,\niConstruct Support Team\niconstruct2026@gmail.com`,
    },
    {
      key: "shop",
      label: "Shop joining",
      text: `Hi ${name},\n\nThank you for your interest in joining iConstruct as a hardware shop.\n\nPlease complete registration with the required business documents. Our admin team usually reviews applications within 24–48 hours.\n\nIf you already applied, we can look up your submission using this email (${msg.email || "your email"}).\n\nBest regards,\niConstruct Support Team\niconstruct2026@gmail.com`,
    },
    {
      key: "short",
      label: "Short ack",
      text: `Hi ${full},\n\nThanks for reaching out to iConstruct. We got your message about "${subject}" and will reply soon.\n\n— iConstruct Support`,
    },
  ];

  let defaultKey = "general";
  if (/sign\s*up|register|registration|login|broken|bug|error|fix|page/.test(hay)) {
    defaultKey = "signup";
  } else if (/pay|payment|bill|subscri|gcash|plan|pro|business|refund/.test(hay)) {
    defaultKey = "payment";
  } else if (/shop|hardware|join|partner|seller|store/.test(hay)) {
    defaultKey = "shop";
  }

  return { items, defaultKey, detectedName: name };
}

const STATUS = {
  new: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", label: "New" },
  read: { bg: "#E0E7FF", border: "#A5B4FC", text: "#3730A3", label: "Read" },
  archived: { bg: "#F1F5F9", border: "#CBD5E1", text: "#475569", label: "Archived" },
};

function StatusPill({ status }) {
  const c = STATUS[status] || STATUS.new;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {c.label}
    </span>
  );
}

/**
 * Super Admin inbox for Contact Us form submissions.
 * Replies are emailed to the sender via EmailJS → Gmail.
 */
export default function ContactMessagesTab({
  messages = [],
  onReload,
  showToast,
  onPatchMessage,
  onRemoveMessage,
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [activeTemplate, setActiveTemplate] = useState("general");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const norm = (s) => String(s || "new").trim().toLowerCase();

  const stats = useMemo(
    () => ({
      total: messages.filter((m) => norm(m.status) !== "archived").length,
      new: messages.filter((m) => norm(m.status) === "new").length,
      read: messages.filter((m) => norm(m.status) === "read").length,
      archived: messages.filter((m) => norm(m.status) === "archived").length,
    }),
    [messages]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      const st = norm(m.status);
      if (filter === "all") {
        if (st === "archived") return false;
      } else if (st !== filter) {
        return false;
      }
      if (!q) return true;
      return [m.name, m.email, m.subject, m.message]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [messages, filter, search]);

  const templates = useMemo(
    () => (selected ? buildReplyTemplates(selected) : null),
    [selected]
  );

  const applyTemplate = (key, msg = selected) => {
    if (!msg) return;
    const pack = buildReplyTemplates(msg);
    const item = pack.items.find((t) => t.key === key) || pack.items[0];
    setActiveTemplate(item.key);
    setReplyText(item.text);
  };

  const openMessage = async (msg) => {
    setSelected(msg);
    const pack = buildReplyTemplates(msg);
    setActiveTemplate(pack.defaultKey);
    setReplyText(pack.items.find((t) => t.key === pack.defaultKey)?.text || pack.items[0].text);

    // Stay in Archived if opened from there; otherwise show Inbox
    if (norm(msg.status) !== "archived") setFilter("all");

    if (norm(msg.status) === "new") {
      onPatchMessage?.(msg.id, { status: "read" });
      setSelected((s) => (s ? { ...s, status: "read" } : s));
      try {
        await markContactMessageRead(msg.id);
        onReload?.();
      } catch {
        onPatchMessage?.(msg.id, { status: "new" });
        setSelected((s) => (s ? { ...s, status: "new" } : s));
      }
    }
  };

  const run = async (
    action,
    id,
    okMsg,
    { remove = false, patch = null, goToFilter = null } = {}
  ) => {
    setBusy(true);
    try {
      await action(id);
      showToast?.(okMsg);
      setSelected(null);
      setReplyText("");
      if (remove) onRemoveMessage?.(id);
      else if (patch) onPatchMessage?.(id, patch);
      if (goToFilter) setFilter(goToFilter);
      await onReload?.();
    } catch (err) {
      showToast?.(err.message || "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = window.confirm(
      `Permanently delete this message from ${selected.name || "sender"}?\n\nThis cannot be undone.`
    );
    if (!ok) return;
    await run(deleteContactMessage, selected.id, "Message deleted.", { remove: true });
  };

  const handleArchive = async () => {
    if (!selected) return;
    await run(
      archiveContactMessage,
      selected.id,
      "Archived — open the Archived tab to see it anytime.",
      { patch: { status: "archived" }, goToFilter: "archived" }
    );
  };

  const handleSendReply = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const res = await replyToContactMessage(selected.id, replyText, selected);
      showToast?.(`Reply sent via Gmail to ${res.toEmail}`);
      onPatchMessage?.(selected.id, {
        status: "read",
        lastReplyText: replyText.trim(),
        lastReplyBy: "you",
      });
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: "read",
              lastReplyText: replyText.trim(),
              lastReplyBy: "you",
            }
          : prev
      );
      await onReload?.();
    } catch (err) {
      showToast?.(err.message || "Failed to send reply.", "error");
    } finally {
      setSending(false);
    }
  };

  const filterCards = [
    { label: "Inbox", value: stats.total, f: "all", color: "#3B82F6", tip: "New + read" },
    { label: "New", value: stats.new, f: "new", color: "#F59E0B", urgent: stats.new > 0, tip: "Unread" },
    { label: "Read", value: stats.read, f: "read", color: "#6366F1", tip: "Opened" },
    {
      label: "Archived",
      value: stats.archived,
      f: "archived",
      color: "#64748B",
      tip: "Stored here after Archive",
      highlight: filter === "archived",
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 900,
              color: "#0F172A",
              marginBottom: 4,
            }}
          >
            Contact Messages
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
            Open a message → ready reply template (auto-detects the sender) → send via Gmail.
            Use <strong>Archive</strong> to store it; open the <strong>Archived</strong> tab to find it again.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
          {stats.new} new · {stats.total} inbox · {stats.archived} archived
        </div>
      </div>

      {/* filter cards */}
      <div
        className="adm-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {filterCards.map((c) => (
          <button
            key={c.f}
            type="button"
            title={c.tip}
            onClick={() => setFilter(c.f)}
            style={{
              textAlign: "left",
              fontFamily: "inherit",
              cursor: "pointer",
              background: filter === c.f ? `${c.color}10` : "#fff",
              borderRadius: 12,
              border:
                filter === c.f
                  ? `2px solid ${c.color}`
                  : c.urgent
                    ? `1px solid ${c.color}40`
                    : "1px solid #E2E8F0",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 900,
                color: c.color,
              }}
            >
              {c.value}
            </div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2, fontWeight: 700 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{c.tip}</div>
          </button>
        ))}
      </div>

      {filter === "archived" && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#F1F5F9",
            border: "1px solid #CBD5E1",
            fontSize: 12.5,
            color: "#334155",
          }}
        >
          <strong>Archived folder</strong> — messages you archived are listed here. Use{" "}
          <strong>Restore</strong> to move one back to Inbox, or <strong>Delete</strong> to remove it forever.
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, subject, or message..."
        style={{
          width: "100%",
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #E2E8F0",
          fontSize: 13,
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #E2E8F0",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center", color: "#94A3B8" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              {filter === "archived" ? (
                <Archive size={36} weight="thin" color="#CBD5E1" />
              ) : (
                <EnvelopeSimple size={36} weight="thin" color="#CBD5E1" />
              )}
            </div>
            <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: 4, fontSize: 14 }}>
              {filter === "archived"
                ? "No archived messages yet"
                : messages.length === 0
                  ? "No messages yet"
                  : filter === "new"
                    ? "No new messages"
                    : "Nothing in this view"}
            </div>
            <div style={{ fontSize: 13, maxWidth: 360, margin: "0 auto", lineHeight: 1.5 }}>
              {filter === "archived"
                ? "When you click Archive on a message, it moves here so your Inbox stays clean."
                : messages.length === 0
                  ? "When someone submits Contact Us, it appears in Inbox."
                  : filter === "new" && stats.read > 0
                    ? `You have ${stats.read} read message(s). Open Inbox or Read to see them.`
                    : "Try another tab above, or clear search."}
            </div>
            {filter !== "all" && messages.length > 0 ? (
              <button
                type="button"
                onClick={() => setFilter(filter === "archived" ? "all" : "all")}
                style={{
                  marginTop: 14,
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Back to Inbox
              </button>
            ) : null}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["From", "Subject", "Received", "Status", ""].map((h) => (
                  <th
                    key={h || "a"}
                    style={{
                      padding: "11px 16px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#94A3B8",
                      textAlign: "left",
                      borderBottom: "1px solid #E2E8F0",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const st = norm(m.status);
                return (
                  <tr
                    key={m.id}
                    style={{
                      background: st === "new" ? "#FFFBEB" : "transparent",
                    }}
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{m.email}</div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "#334155", maxWidth: 280 }}>
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.subject}
                        {m.lastReplyAt ? " · replied" : ""}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 11.5, color: "#94A3B8" }}>
                      {formatWhen(m.createdAt)}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <StatusPill status={st} />
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <button
                        type="button"
                        onClick={() => openMessage(m)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: st === "new" ? "#0F172A" : "#F1F5F9",
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: st === "new" ? "#fff" : "#334155",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {st === "new" ? "Open" : "View"}{" "}
                        <ArrowRight size={11} weight="bold" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && templates && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelected(null);
              setReplyText("");
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              overflow: "auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 1,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                  {selected.subject}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  {formatWhen(selected.createdAt)} · <StatusPill status={norm(selected.status)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReplyText("");
                }}
                style={{
                  border: "none",
                  background: "#F1F5F9",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  color: "#64748B",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "18px 20px" }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94A3B8", marginBottom: 4 }}>
                  DETECTED SENDER
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
                  {selected.name}{" "}
                  <span style={{ fontWeight: 500, color: "#64748B", fontSize: 12 }}>
                    (template uses “{templates.detectedName}”)
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#2563EB" }}>{selected.email}</div>
              </div>

              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 14,
                  color: "#334155",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  maxHeight: 140,
                  overflow: "auto",
                  marginBottom: 16,
                }}
              >
                {selected.message}
              </div>

              {selected.lastReplyText ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    borderRadius: 10,
                    background: "#EEF2FF",
                    border: "1px solid #C7D2FE",
                    fontSize: 12.5,
                    color: "#312E81",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Last reply sent:</strong>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                    {selected.lastReplyText}
                  </div>
                </div>
              ) : null}

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94A3B8", marginBottom: 8 }}>
                  READY REPLY TEMPLATES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {templates.items.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => applyTemplate(t.key)}
                      style={{
                        padding: "6px 11px",
                        borderRadius: 20,
                        border:
                          activeTemplate === t.key
                            ? "1px solid #0F172A"
                            : "1px solid #E2E8F0",
                        background: activeTemplate === t.key ? "#0F172A" : "#fff",
                        color: activeTemplate === t.key ? "#fff" : "#475569",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94A3B8", marginBottom: 6 }}>
                  YOUR REPLY (sent via Gmail) — edit anytime
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={7}
                  maxLength={5000}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    padding: 12,
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    resize: "vertical",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
                  Sends to <strong>{selected.email}</strong> from EmailJS Gmail
                  (iconstruct2026@gmail.com).
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #F1F5F9",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                bottom: 0,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {norm(selected.status) === "archived" ? (
                  <button
                    type="button"
                    disabled={busy || sending}
                    onClick={() =>
                      run(reopenContactMessage, selected.id, "Restored to Inbox.", {
                        patch: { status: "new" },
                        goToFilter: "all",
                      })
                    }
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#fff",
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ArrowCounterClockwise size={14} /> Restore to Inbox
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || sending}
                    onClick={handleArchive}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#fff",
                      fontWeight: 600,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Archive size={14} /> Archive
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || sending}
                  onClick={handleDelete}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Trash size={14} /> Delete
                </button>
              </div>

              <button
                type="button"
                disabled={sending || busy || replyText.trim().length < 5}
                onClick={handleSendReply}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    sending || replyText.trim().length < 5 ? "#94A3B8" : "#0F172A",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor:
                    sending || replyText.trim().length < 5 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <PaperPlaneTilt size={15} weight="bold" />
                {sending ? "Sending via Gmail…" : "Send Reply via Gmail"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
