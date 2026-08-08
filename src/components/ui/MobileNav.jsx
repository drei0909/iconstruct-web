// src/components/ui/MobileNav.jsx
// Bottom tab bar for shop + admin dashboards on ≤768px.
// Hidden on desktop via .db-mobile-nav in responsive.css.

const DEFAULT_ICONS = {
  overview: "⊞",
  projects: "📋",
  quotations: "💬",
  analytics: "📊",
  profile: "🏪",
  products: "📦",
  billing: "💳",
  settings: "⚙️",
  upgrade: "⚡",
  featured: "⭐",
  tools: "🧰",
  dashboard: "⊞",
  applications: "📥",
  shops: "🏪",
  subscriptions: "💳",
};

/**
 * @param {{ items: {key:string, label:string}[], activeTab: string, onSelect: (key:string)=>void, accentColor?: string }} props
 */
export default function MobileNav({ items = [], activeTab, onSelect, accentColor = "#3B82F6" }) {
  const visible =
    items.length <= 5
      ? items
      : [
          ...items.slice(0, 4),
          items.find((i) => i.key === activeTab && !items.slice(0, 4).some((x) => x.key === i.key)) ||
            items[4],
        ]
          .filter(Boolean)
          .filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx)
          .slice(0, 5);

  return (
    <nav className="db-mobile-nav" aria-label="Mobile navigation">
      {visible.map((item) => {
        const isActive = activeTab === item.key;
        const short = (item.label || "").split(" ")[0];
        return (
          <button
            key={item.key}
            type="button"
            className={`db-mobile-nav-item${isActive ? " active" : ""}`}
            onClick={() => onSelect(item.key)}
            style={{ color: isActive ? accentColor : undefined }}
          >
            <span className="db-mobile-nav-icon">{DEFAULT_ICONS[item.key] || "•"}</span>
            <span className="db-mobile-nav-label">{short}</span>
          </button>
        );
      })}
    </nav>
  );
}
