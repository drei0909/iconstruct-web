// src/components/ui/MobileNav.jsx
// Drop this into DashboardBasicPage, DashboardProPage, DashboardBusinessPage
// Usage: <MobileNav items={NAV} activeTab={activeTab} onSelect={setActiveTab} accentColor="#3B82F6" />

import React from "react";

const DEFAULT_ICONS = {
  overview:   "⊞",
  projects:   "📋",
  quotations: "💬",
  analytics:  "📊",
  profile:    "🏪",
  products:   "📦",
  billing:    "💳",
  settings:   "⚙️",
  upgrade:    "⚡",
  featured:   "⭐",
};

/**
 * @param {{ items: {key:string, label:string}[], activeTab: string, onSelect: (key:string)=>void, accentColor?: string }} props
 */
export default function MobileNav({ items = [], activeTab, onSelect, accentColor = "#3B82F6" }) {
  // Show max 5 items; if more, show the active one + first 4
  const visible = items.length <= 5
    ? items
    : [
        ...items.slice(0, 4),
        items.find(i => i.key === activeTab && !items.slice(0, 4).includes(i)) || items[4],
      ].filter(Boolean).slice(0, 5);

  return (
    <nav
      className="db-mobile-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: "#1A2332",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 100,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {visible.map(item => {
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              color: isActive ? accentColor : "rgba(168,184,200,0.5)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "6px 4px",
              borderRadius: 8,
              flex: 1,
              minHeight: 44,
              transition: "color 0.15s",
              fontFamily: "var(--font-base)",
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>
              {DEFAULT_ICONS[item.key] || "•"}
            </span>
            <span style={{ maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}