

const features = [
  {
    tag: "Visibility",
    title: "Get Found by Nearby Builders",
    description:
      "iConstruct surfaces your shop through proximity-based listings and supplier matching — connecting you directly with homeowners, contractors, and builders in Lipa City actively planning their projects.",
  },
  {
    tag: "Estimation",
    title: "Integrated Material Estimation",
    description:
      "Builders compute material requirements inside iConstruct using automated calculation based on project dimensions. Your shop appears as a recommended supplier — no extra effort needed.",
  },
  {
    tag: "Costing",
    title: "Localized Cost Computation",
    description:
      "Project cost estimates are generated using live unit prices from registered shops in Lipa City — giving builders accurate, locally grounded budget figures tied directly to your inventory.",
  },
  {
    tag: "Marketing",
    title: "Promotional Exposure & Featured Placement",
    description:
      "Pro and Business subscribers gain priority listing in search results and featured placement on the platform — putting your shop in front of active buyers at the right moment.",
  },
  {
    tag: "Trust",
    title: "Verified Business Platform",
    description:
      "Every shop undergoes admin verification of uploaded business permits (e.g., Mayor's Permit) before being listed — ensuring iConstruct remains a trusted network of legitimate, compliant hardware businesses.",
  },
  {
    tag: "Management",
    title: "Unified Shop Manager Dashboard",
    description:
      "Update product listings, manage pricing, review posted projects, submit quotations, and track bidding history — all from one centralized web dashboard built for hardware shop owners.",
  },
];

const stats = [
  { val: "3×",   label: "More Customer Reach" },
  { val: "100%", label: "Verified Shops Only"  },
  { val: "Free", label: "To Get Started"       },
];

const plans = [
  {
    name: "Basic",
    price: "Free",
    period: "",
    badge: null,
    color: "#648DB6",
    features: [
      "List up to 20 products",
      "Shop profile listing",
      "View limited project postings",
      "Submit up to 3 quotations/month",
      "Basic shop visibility",
    ],
    cta: "Included on Registration",
    ctaStyle: "outline",
    limitNote: "20 products max",
    limitPct: 15,
  },
  {
    name: "Pro",
    price: "₱499",
    period: "/ month",
    badge: "Most Popular",
    color: "#2C3E50",
    features: [
      "List up to 150 products",
      "Everything in Basic",
      "Priority listing in search",
      "Unlimited project bidding",
      "Promotional exposure",
      "Quotation performance insights",
    ],
    cta: "Get Pro — ₱499/mo",
    ctaStyle: "filled",
    limitNote: "150 products max",
    limitPct: 58,
  },
  {
    name: "Business",
    price: "₱4,499",
    period: "/ year",
    badge: "Best Value",
    color: "#648DB6",
    features: [
      "Unlimited product listings",
      "Everything in Pro",
      "Featured placement on platform",
      "Priority customer support",
      "Advanced analytics dashboard",
      "Bulk product import (CSV/Excel)",
      "Save ₱1,489 vs monthly",
    ],
    cta: "Get Business — ₱4,499/yr",
    ctaStyle: "outline",
    limitNote: "No product cap",
    limitPct: 100,
  },
];

export default function Features() {
  return (
    <>
      {/* ── Features Section ── */}
      <section className="ft-section">

        <div className="ft-head">
          <div className="ft-head-left">
            <div className="ft-eyebrow">
              <span className="ft-eyebrow-line" />
              Platform Features
              <span className="ft-eyebrow-line" />
            </div>
            <h2 className="ft-h2">
              Why Your Shop Belongs<br />
              on <em>iConstruct</em>
            </h2>
          </div>
          <p className="ft-head-right">
            Everything your hardware business needs to connect with the
            builders, contractors, and homeowners looking for you.
          </p>
        </div>

        <div className="ft-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className={`ft-cell${i === 0 ? " ft-cell--wide" : ""}`}
            >
              <div className="ft-cell-idx">{String(i + 1).padStart(2, "0")}</div>
              <span className="ft-cell-tag">{f.tag}</span>
              <h3 className="ft-cell-h3">{f.title}</h3>
              <p className="ft-cell-p">{f.description}</p>
              <div className="ft-cell-bar" />
              <span className="ft-cell-glyph">{String(i + 1).padStart(2, "0")}</span>
            </div>
          ))}
        </div>

        <div className="ft-stats">
          {stats.map((s, i) => (
            <div className="ft-stat" key={i}>
              <span className="ft-stat-val">{s.val}</span>
              <span className="ft-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="ft-cta">
          <p className="ft-cta-text">
            Ready to grow your <span>hardware business?</span>
          </p>
          <div className="ft-cta-btns">
            <a href="#" className="ft-btn-ghost">Learn More</a>
            <a href="/register" className="ft-btn-fill">Register Your Shop →</a>
          </div>
        </div>

      </section>

      {/* ── Subscription Plans Section ── */}
      <section className="sp-section">
        <div className="container">

          <div className="sp-header">
            <div className="ft-eyebrow">
              <span className="ft-eyebrow-line" />
              Subscription Plans
              <span className="ft-eyebrow-line" />
            </div>
            <h2 className="sp-title">
              Choose the Plan That<br />
              <span>Fits Your Shop</span>
            </h2>
            <p className="sp-subtitle">
              Start free after your shop is approved. Upgrade any time to unlock
              more product listings, priority visibility, and powerful analytics.
            </p>
            <div className="sp-flow-pill">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" width="13" height="13">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v3.5l2 2" />
              </svg>
              Register first → get approved → then choose your plan
            </div>
          </div>

          <div className="sp-plans">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`sp-plan-card ${plan.badge === "Most Popular" ? "sp-plan-featured" : ""}`}
              >
                {plan.badge && (
                  <span className={`sp-plan-badge ${plan.badge === "Most Popular" ? "sp-badge-dark" : "sp-badge-blue"}`}>
                    {plan.badge}
                  </span>
                )}
                <div className="sp-plan-top">
                  <div className="sp-plan-dot" style={{ background: plan.color }} />
                  <span className="sp-plan-name">{plan.name}</span>
                </div>
                <div className="sp-plan-price">
                  <span className="sp-plan-amount">{plan.price}</span>
                  {plan.period && <span className="sp-plan-period">{plan.period}</span>}
                </div>
                <div className="sp-limit-box">
                  <div className="sp-limit-header">
                    <span className="sp-limit-label">Product listings</span>
                    <span className="sp-limit-value">{plan.limitNote}</span>
                  </div>
                  <div className="sp-limit-bar">
                    <div
                      className={`sp-limit-fill ${plan.limitPct === 100 ? "sp-limit-fill--full" : ""}`}
                      style={{ width: `${plan.limitPct}%` }}
                    />
                  </div>
                </div>
                <ul className="sp-plan-features">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="sp-plan-feature-item">
                      <svg viewBox="0 0 14 14" fill="none" stroke="#22c55e" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
                        style={{ flexShrink: 0 }}>
                        <path d="M2.5 7.5l3 3 6-6" />
                      </svg>
                      {j === 0 ? <strong style={{ fontWeight: 600 }}>{feat}</strong> : feat}
                    </li>
                  ))}
                </ul>
                <a
                  href="/register"
                  className={`sp-plan-cta ${plan.ctaStyle === "filled" ? "sp-cta-filled" : "sp-cta-outline"}`}
                >
                  {plan.cta}
                </a>
                {plan.name === "Basic" && (
                  <p className="sp-plan-note">Automatically granted after admin approval.</p>
                )}
                {plan.name === "Business" && (
                  <p className="sp-plan-note">
                    If downgraded, listings beyond your new plan's limit are hidden — not deleted.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="sp-payments">
            <span className="sp-payments-label">Accepted payments</span>
            <div className="sp-payment-chips">
              {["GCash", "Maya", "BDO", "BPI", "Visa / Mastercard", "UnionBank"].map((m) => (
                <span key={m} className="sp-payment-chip">{m}</span>
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}