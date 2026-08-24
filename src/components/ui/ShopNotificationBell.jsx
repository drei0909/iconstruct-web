// src/components/ui/ShopNotificationBell.jsx
// Admin-style bell for shop dashboards. Important items (maintenance) sort to the top.

import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { TbBell } from "react-icons/tb";
import { db } from "../../services/firebase";
import {
  formatCountdownLong,
  formatStartLocal,
  getCountdownRemainingMs,
  isNoticeCountdownActive,
} from "../../utils/maintenanceStatus";

export default function ShopNotificationBell({ extraItems = [] }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({});
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "systemConfig", "maintenance"),
      (snap) => setConfig(snap.exists() ? snap.data() : {}),
      () => setConfig({})
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!config?.noticeActive || config?.maintenanceMode) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [config?.noticeActive, config?.maintenanceMode]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const noticeLive = isNoticeCountdownActive(config, now);
  const remaining = getCountdownRemainingMs(config, now);
  const startLabel = formatStartLocal(config);
  const note = String(config?.noticeMessage || "").trim();

  const items = [];

  if (noticeLive) {
    items.push({
      id: "maintenance",
      important: true,
      title: "Scheduled maintenance",
      body: note || "iConstruct will be temporarily unavailable for system updates.",
      meta: startLabel
        ? `Starts ${startLabel} · in ${formatCountdownLong(remaining)}`
        : `Starts in ${formatCountdownLong(remaining)}`,
    });
  }

  for (const item of extraItems) {
    if (item?.id) items.push({ ...item, important: !!item.important });
  }

  items.sort((a, b) => Number(b.important) - Number(a.important));

  const badgeCount = items.length;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          background: "#F8FAFC",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748B",
          position: "relative",
        }}
      >
        <TbBell size={17} />
        {badgeCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#EF4444",
              color: "#fff",
              minWidth: 16,
              height: 16,
              borderRadius: "50%",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              padding: "0 3px",
            }}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 320,
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
              Notifications
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 10,
                color: "#3B82F6",
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Close
            </button>
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  color: "#94A3B8",
                  fontSize: 12,
                }}
              >
                No new notifications
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #F8FAFC",
                    background: item.important ? "#FFFBEB" : "#fff",
                    borderLeft: item.important
                      ? "3px solid #D97706"
                      : "3px solid transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    {item.important && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#B45309",
                          background: "#FEF3C7",
                          borderRadius: 20,
                          padding: "2px 7px",
                        }}
                      >
                        Important
                      </span>
                    )}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      {item.title}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748B",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.body}
                  </div>
                  {item.meta ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: item.important ? "#A16207" : "#94A3B8",
                        marginTop: 6,
                        fontWeight: 500,
                      }}
                    >
                      {item.meta}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
