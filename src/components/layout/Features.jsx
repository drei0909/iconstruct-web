// src/components/layout/Features.jsx
// Fetches subscription plans live from Firestore (systemConfig/subscriptionPlans)
// so any edit made in SystemSettingsTab is immediately reflected here.

import { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";

// ─── Static feature cards (unchanged) ────────────────────────────────────────
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

// ─── Default fallback plans (used if Firestore has no data yet) ───────────────
const DEFAULT_PLANS = [
  {
    key: "basic",
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
    isPublic: true,
  },
  {
    key: "pro",
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
    isPublic: true,
  },
  {
    key: "business",
    name: "Business",
    price: "₱999",
    period: "/ month",
    badge: "Best Value",
    color: "#648DB6",
    features: [
      "Unlimited product listings",
      "Everything in Pro",
      "Featured placement on platform",
      "Priority customer support",
      "Custom branding",
    ],
    cta: "Get Business — ₱999/mo",
    ctaStyle: "outline",
    limitNote: "No product cap",
    limitPct: 100,
    isPublic: true,
  },
];

// ─── Helper: convert Firestore plan doc → display shape ──────────────────────
function firestorePlanToDisplay(key, plan) {
  const isBasic    = key === "basic";
  const isPro      = key === "pro";
  const isBusiness = key === "business";

  const price = isBasic
    ? (plan.price === 0 ? "Free" : `₱${plan.price}`)
    : `₱${plan.price?.toLocaleString() ?? 0}`;

  const period = isBasic && plan.price === 0 ? "" : `/ ${plan.billingCycle ?? "month"}`;

  const productLimit = plan.productLimit === -1 ? "Unlimited" : String(plan.productLimit ?? 20);
  const quotaLimit   = plan.quotaLimit   === -1 ? "Unlimited" : `${plan.quotaLimit ?? 3}/mo`;

  // limitPct for the visual progress bar
  const limitPct = plan.productLimit === -1
    ? 100
    : isPro
    ? Math.round(Math.min((plan.productLimit / 150) * 58, 58))
    : isBasic
    ? Math.round(Math.min((plan.productLimit / 20) * 15, 15))
    : 100;

  // CTA text
  const ctaText = isBasic
    ? "Included on Registration"
    : `Get ${plan.label ?? key} — ${price}/${plan.billingCycle ?? "month"}`;

  return {
    key,
    name:      plan.label ?? key,
    price,
    period,
    badge:     isPro ? "Most Popular" : isBusiness ? "Best Value" : null,
    color:     isBusiness ? "#648DB6" : isPro ? "#2C3E50" : "#648DB6",
    features:  plan.features ?? [],
    cta:       ctaText,
    ctaStyle:  isPro ? "filled" : "outline",
    limitNote: plan.productLimit === -1 ? "No product cap" : `${productLimit} products max`,
    limitPct,
    isPublic:  plan.isPublic !== false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Features() {
  const [plans, setPlans]       = useState(DEFAULT_PLANS);
  const [loading, setLoading]   = useState(true);

  // Fetch live plans from Firestore on mount
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
        if (snap.exists()) {
          const data  = snap.data().plans ?? {};
          const order = ["basic", "pro", "business"];
          const live  = order
            .filter(k => data[k] && data[k].isPublic !== false) // hide non-public plans
            .map(k => firestorePlanToDisplay(k, data[k]));

          if (live.length > 0) setPlans(live);
        }
        // If no Firestore doc yet → keep DEFAULT_PLANS as fallback
      } catch (err) {
        console.warn("Features: could not load plans from Firestore, using defaults.", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

          {/* Loading skeleton */}
          {loading ? (
            <div style={{ display: "flex", gap: 20, justifyContent: "center", padding: "40px 0" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 260, height: 380, borderRadius: 16,
                  background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.4s infinite",
                }} />
              ))}
              <style>{`
                @keyframes shimmer {
                  0%   { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
            </div>
          ) : (
            <div className="sp-plans">
              {plans.map((plan, i) => (
                <div
                  key={plan.key ?? i}
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
                    {(plan.features ?? []).map((feat, j) => (
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
                  {plan.key === "basic" && (
                    <p className="sp-plan-note">Automatically granted after admin approval.</p>
                  )}
                  {plan.key === "business" && (
                    <p className="sp-plan-note">
                      If downgraded, listings beyond your new plan's limit are hidden — not deleted.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

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