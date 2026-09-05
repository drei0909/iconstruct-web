// src/components/ui/MobileDrawerNav.jsx
// Hamburger-triggered off-canvas nav drawer for shop + admin dashboards on phone.
// Lists every nav item (unlike the old bottom tab bar, which capped at 5).

import { X } from "@phosphor-icons/react";
import DashboardBrand from "./DashboardBrand";

export default function MobileDrawerNav({
  items = [],
  activeTab,
  onSelect,
  open,
  onClose,
  accentColor = "#2C5282",
  subtitle = "Menu",
  onLogout,
}) {
  return (
    <>
      <div
        className={`db-mobile-backdrop${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <nav
        className={`db-mobile-drawer${open ? " is-open" : ""}`}
        aria-label="Mobile navigation"
        style={{ "--db-mobile-accent": accentColor }}
      >
        <div className="db-mobile-drawer-head">
          <DashboardBrand compact subtitle={subtitle} />
          <button
            type="button"
            className="db-mobile-drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="db-mobile-drawer-items">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`db-mobile-drawer-item${activeTab === item.key ? " active" : ""}`}
              onClick={() => {
                onSelect(item.key);
                onClose();
              }}
            >
              <span className="db-mobile-drawer-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.isUpgrade && <span className="db-nav-badge-new">UPGRADE</span>}
              {item.badge > 0 && <span className="db-mobile-drawer-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
        {onLogout && (
          <button type="button" className="db-mobile-drawer-signout" onClick={onLogout}>
            Sign Out
          </button>
        )}
      </nav>
    </>
  );
}
