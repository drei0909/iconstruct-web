// src/components/shop/ShopMessagesPanel.jsx
// Shop ↔ builder chat for accepted quotations.

import { useEffect, useMemo, useRef, useState } from "react";
import { TbMessage, TbSend, TbMessages, TbPhoto, TbFileText, TbCheck, TbDownload } from "react-icons/tb";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { openQuotePdf } from "../../utils/quotePdf";
import {
  openChatForAcceptedQuote,
  sendShopChatMessage,
  uploadChatImage,
  markShopConversationRead,
  subscribeShopConversations,
  subscribeConversationMessages,
} from "../../controllers/chatController";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]}])/gi;
const MAX_TEXT = 4000;

/** Return the string only if it's a well-formed http(s) URL — else null. */
function safeHttpUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Render message text with clickable links. Text is React-escaped; only
 *  validated http(s) URLs become anchors. */
function renderText(text, mine) {
  const str = String(text == null ? "" : text).slice(0, MAX_TEXT);
  const parts = str.split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const href = safeHttpUrl(part);
      if (!href) return part; // not a safe URL → plain text
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{
            color: mine ? "#DBEAFE" : "#1D4ED8",
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function formatTime(ts) {
  if (!ts) return "";
  const d =
    typeof ts.toDate === "function"
      ? ts.toDate()
      : typeof ts.seconds === "number"
        ? new Date(ts.seconds * 1000)
        : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * @param {object} props
 * @param {string} [props.accentColor]
 * @param {string|null} [props.initialConversationId]
 * @param {object|null} [props.bootstrapQuote] - accepted quote to open chat for
 * @param {function} [props.onBootstrapped]
 */
export default function ShopMessagesPanel({
  accentColor = "#2C5282",
  initialConversationId = null,
  bootstrapQuote = null,
  onBootstrapped,
  shop = null,
  quotations = [],
  projects = [],
  estimateConfig = null,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(initialConversationId);

  const handleDownloadInvoice = async (quoteData, m) => {
    let quote = quoteData;
    if (!quote?.items?.length) {
      const match = (quotations || []).find((q) => q.id === (m.quotationId || quote.id));
      if (match?.items?.length) {
        quote = match;
      } else if (m.quotationId && active?.projectId) {
        try {
          const snap = await getDoc(doc(db, "projectPosts", active.projectId, "quotations", m.quotationId));
          if (snap.exists()) {
            quote = { id: snap.id, ...snap.data() };
          }
        } catch (fetchErr) {
          console.warn("[Invoice] Fetch quotation failed:", fetchErr);
        }
      }
    }

    const matchedProject =
      (projects || []).find((p) => String(p.id) === String(quote?.projectId || active?.projectId)) ||
      null;

    const ok = openQuotePdf(quote, {
      shop,
      project: matchedProject,
      estimateConfig,
    });
    if (!ok) {
      window.alert("Please allow pop-ups for this site, then try Download PDF again.");
    }
  };
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]); // optimistic "Sending…" bubbles
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeShopConversations(
      (list) => {
        setConversations(list);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.warn(err);
        setLoading(false);
        const msg = String(err?.message || "");
        if (/requires an index/i.test(msg)) {
          setError("Firestore index missing. Hard-refresh after deploying indexes, or chat list uses a no-index query now.");
        } else if (/permission|insufficient/i.test(msg)) {
          setError("Chat access denied. Hard-refresh — Firestore rules were updated. If it persists, sign out and back in.");
        } else {
          setError(err?.message || "Could not load conversations.");
        }
      }
    );
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!bootstrapQuote) return;
    let cancelled = false;
    (async () => {
      try {
        const id = await openChatForAcceptedQuote(bootstrapQuote);
        if (!cancelled) {
          setActiveId(id);
          onBootstrapped?.();
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open chat.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapQuote, onBootstrapped]);

  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    setPending([]);
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    markShopConversationRead(activeId);
    const unsub = subscribeConversationMessages(
      activeId,
      (list) => setMessages(list),
      (err) => setError(err?.message || "Could not load messages.")
    );
    return () => unsub?.();
  }, [activeId]);

  // Re-stamp the read marker whenever the builder sends something while open.
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.senderRole === "builder") markShopConversationRead(activeId);
  }, [messages, activeId]);

  // Drop an optimistic bubble once its real message lands in the snapshot.
  useEffect(() => {
    if (pending.length === 0) return;
    setPending((p) =>
      p.filter(
        (pm) =>
          !messages.some(
            (m) =>
              m.senderRole === "shop" &&
              m.createdAt &&
              (pm.imageUrl ? m.imageUrl === pm.imageUrl : m.text === pm.text)
          )
      )
    );
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!activeId || !body || sending) return;
    const tempId = `pending_${Date.now()}`;
    setSending(true);
    setError("");
    setPending((p) => [...p, { tempId, text: body }]);
    setText("");
    try {
      await sendShopChatMessage(activeId, { text: body });
    } catch (err) {
      setPending((p) => p.filter((pm) => pm.tempId !== tempId));
      setText(body);
      setError(err.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !activeId || sending) return;
    const tempId = `pending_${Date.now()}`;
    setSending(true);
    setError("");
    try {
      const url = await uploadChatImage(activeId, file);
      setPending((p) => [...p, { tempId, text: "", imageUrl: url }]);
      await sendShopChatMessage(activeId, { imageUrl: url });
    } catch (err) {
      setPending((p) => p.filter((pm) => pm.tempId !== tempId));
      setError(err.message || "Failed to send photo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 300px) 1fr",
        gap: 0,
        minHeight: 520,
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
        overflow: "hidden",
      }}
      className="shop-messages-panel"
    >
      <aside style={{ borderRight: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
            <TbMessages size={18} color={accentColor} /> Messages
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
            Unlocks after a builder accepts your quote
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 12, lineHeight: 1.6 }}>
              No chats yet. When a builder accepts your quotation, a thread will appear here.
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    border: "none",
                    borderBottom: "1px solid #F1F5F9",
                    background: isActive ? "#EFF6FF" : "transparent",
                    borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>
                    {c.projectTitle || "Project"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.lastMessage || "No messages yet"}
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
                    {formatTime(c.lastMessageAt)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section style={{ display: "flex", flexDirection: "column", minWidth: 0, background: "#fff" }}>
        {!activeId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", gap: 10, padding: 32 }}>
            <TbMessage size={36} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>Select a conversation</div>
            <div style={{ fontSize: 12, textAlign: "center", maxWidth: 280, lineHeight: 1.55 }}>
              Or open an accepted quotation and click <strong>Message builder</strong>.
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                {active?.projectTitle || "Conversation"}
              </div>
              <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                Chat with builder{active?.builderName ? ` · ${active.builderName}` : ""}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
              {messages.length === 0 && pending.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 40 }}>
                  Say hello — coordinate delivery, pricing details, or pickup.
                </div>
              ) : (
                [
                  ...messages.map((m) => ({ ...m, _pending: false })),
                  ...pending.map((p) => ({
                    id: p.tempId,
                    senderRole: "shop",
                    text: p.text,
                    imageUrl: p.imageUrl || "",
                    createdAt: null,
                    _pending: true,
                  })),
                ].map((m) => {
                  const isInvoice = m.type === "quotation_invoice" || String(m.text || "").includes("[OFFICIAL_TRANSACTION_INVOICE]");

                  if (isInvoice) {
                    const quoteData = m.quotationSnapshot || (quotations || []).find((q) => q.id === m.quotationId) || {
                      id: m.quotationId,
                      projectTitle: active?.projectTitle || "Project",
                      amount: m.acceptedTotal,
                      acceptedTotal: m.acceptedTotal,
                      createdAt: m.createdAt,
                    };
                    const qRef = String(m.quotationId || quoteData.id || "").slice(-6).toUpperCase() || "INV";
                    const totalAmount = Number(m.acceptedTotal || quoteData.acceptedTotal || quoteData.amount || 0);
                    const itemsCount = Array.isArray(quoteData.items)
                      ? quoteData.items.filter((it) => it && it.status !== "declined").length
                      : 0;

                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: "center",
                          width: "100%",
                          maxWidth: 440,
                          background: "#FFFFFF",
                          border: "1.5px solid #10B981",
                          borderRadius: 14,
                          overflow: "hidden",
                          boxShadow: "0 4px 14px rgba(16, 185, 129, 0.12)",
                          margin: "10px 0",
                        }}
                      >
                        {/* Top banner */}
                        <div style={{
                          background: "linear-gradient(135deg, #065F46, #059669)",
                          color: "#fff",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <TbFileText size={18} />
                            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.02em" }}>
                              Official Quotation &amp; Invoice
                            </span>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            background: "rgba(255,255,255,0.2)",
                            padding: "2px 8px",
                            borderRadius: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}>
                            <TbCheck size={12} /> Verified
                          </span>
                        </div>

                        {/* Card body */}
                        <div style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                              {quoteData.projectTitle || active?.projectTitle || "Project"}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                              Ref #{qRef}
                            </span>
                          </div>

                          <div style={{
                            background: "#F8FAFC",
                            borderRadius: 8,
                            padding: "10px 12px",
                            border: "1px solid #E2E8F0",
                            marginBottom: 12,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#64748B", marginBottom: 4 }}>
                              <span>Transaction Status:</span>
                              <strong style={{ color: "#065F46" }}>Confirmed &amp; Secured</strong>
                            </div>
                            {itemsCount > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#64748B", marginBottom: 4 }}>
                                <span>Accepted Items:</span>
                                <strong style={{ color: "#334155" }}>{itemsCount} item{itemsCount !== 1 ? "s" : ""}</strong>
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0F172A", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #CBD5E1" }}>
                              <span style={{ fontWeight: 700 }}>Total Confirmed:</span>
                              <strong style={{ color: "#059669", fontSize: 15, fontWeight: 900 }}>
                                ₱{totalAmount.toLocaleString("en-PH", { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(quoteData, m)}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: "none",
                              background: "linear-gradient(135deg, #059669, #10B981)",
                              color: "#fff",
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 7,
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
                              transition: "filter 0.15s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.07)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                          >
                            <TbDownload size={15} />
                            Download PDF Quotation / Invoice
                          </button>

                          <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
                            Official invoice document · Click to save or print PDF
                          </div>
                        </div>

                        <div style={{ fontSize: 9.5, opacity: 0.7, padding: "0 16px 8px", textAlign: "right", color: "#94A3B8" }}>
                          {formatTime(m.createdAt)}
                        </div>
                      </div>
                    );
                  }

                  const mine = m.senderRole === "shop";
                  const imgSrc = safeHttpUrl(m.imageUrl);
                  const seenAt = active?.builderLastReadAt;
                  const seen =
                    mine && !m._pending && m.createdAt && seenAt &&
                    (typeof seenAt.toMillis === "function" ? seenAt.toMillis() : (seenAt.seconds || 0) * 1000) >=
                      (typeof m.createdAt.toMillis === "function" ? m.createdAt.toMillis() : (m.createdAt.seconds || 0) * 1000);
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "78%",
                        background: mine ? accentColor : "#fff",
                        color: mine ? "#fff" : "#0F172A",
                        border: mine ? "none" : "1px solid #E2E8F0",
                        borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "10px 12px",
                        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                        opacity: m._pending ? 0.7 : 1,
                      }}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt="attachment"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                          onClick={() => window.open(imgSrc, "_blank", "noopener,noreferrer")}
                          style={{
                            display: "block", maxWidth: 220, maxHeight: 260,
                            borderRadius: 8, cursor: "pointer",
                            marginBottom: m.text ? 6 : 0,
                          }}
                        />
                      ) : m.imageUrl ? (
                        <div style={{ fontSize: 11, opacity: 0.7, fontStyle: "italic", marginBottom: m.text ? 6 : 0 }}>
                          [attachment unavailable]
                        </div>
                      ) : null}
                      {m.text ? (
                        <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {renderText(m.text, mine)}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                        {m._pending
                          ? "Sending…"
                          : mine
                            ? `${formatTime(m.createdAt)} · ${seen ? "Seen" : "Sent"}`
                            : formatTime(m.createdAt)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {error ? (
              <div style={{ padding: "8px 18px", fontSize: 12, color: "#B91C1C", background: "#FEF2F2" }}>
                {error}
              </div>
            ) : null}

            <form
              onSubmit={handleSend}
              style={{
                display: "flex",
                gap: 8,
                padding: "12px 14px",
                borderTop: "1px solid #E2E8F0",
                background: "#fff",
                alignItems: "center",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                title="Attach a photo"
                style={{
                  width: 40, height: 44, flexShrink: 0,
                  border: "1.5px solid #E2E8F0", borderRadius: 10,
                  background: "#F8FAFC", cursor: sending ? "not-allowed" : "pointer",
                  color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <TbPhoto size={18} />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                maxLength={4000}
                style={{
                  flex: 1,
                  border: "1.5px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  background: accentColor,
                  color: "#fff",
                  cursor: sending || !text.trim() ? "not-allowed" : "pointer",
                  opacity: sending || !text.trim() ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TbSend size={18} />
              </button>
            </form>
          </>
        )}
      </section>

      <style>{`
        @media (max-width: 800px) {
          .shop-messages-panel {
            grid-template-columns: 1fr !important;
            min-height: 640px !important;
          }
        }
      `}</style>
    </div>
  );
}
