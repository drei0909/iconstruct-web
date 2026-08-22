import logo from "../../assets/logo/logo2.png";

/**
 * Formal sidebar brand for admin + shop dashboards.
 * Uses logo2 on dark panels; subtitle identifies the workspace.
 */
export default function DashboardBrand({
  subtitle = "Shop Manager",
  collapsed = false,
  children = null,
  compact = false,
}) {
  if (collapsed) {
    return (
      <div className="db-brand db-brand--collapsed" title="iConstruct">
        <img src={logo} alt="iConstruct" className="db-brand-mark" />
      </div>
    );
  }

  return (
    <div className={`db-brand${compact ? " db-brand--compact" : ""}`}>
      <img src={logo} alt="iConstruct" className="db-brand-logo" />
      <div className="db-brand-meta">
        <div className="db-brand-name">iConstruct</div>
        {subtitle ? <div className="db-brand-sub">{subtitle}</div> : null}
      </div>
      {children ? <div className="db-brand-extra">{children}</div> : null}
    </div>
  );
}
