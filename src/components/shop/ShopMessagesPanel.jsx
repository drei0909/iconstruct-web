// src/components/shop/ShopMessagesPanel.jsx
// Shop ↔ builder chat for accepted quotations.

import { useEffect, useMemo, useRef, useState } from "react";
import { TbMessage, TbSend, TbMessages } from "react-icons/tb";
import {
  openChatForAcceptedQuote,
  sendShopChatMessage,
  subscribeShopConversations,
  subscribeConversationMessages,
} from "../../controllers/chatController";

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
}) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

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
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    const unsub = subscribeConversationMessages(
      activeId,
      (list) => setMessages(list),
      (err) => setError(err?.message || "Could not load messages.")
    );
    return () => unsub?.();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!activeId || !text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await sendShopChatMessage(activeId, text);
      setText("");
    } catch (err) {
      setError(err.message || "Failed to send.");
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
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 40 }}>
                  Say hello — coordinate delivery, pricing details, or pickup.
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === "shop";
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
                      }}
                    >
                      <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.text}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: mine ? "right" : "left" }}>
                        {formatTime(m.createdAt)}
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
              }}
            >
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
