// src/components/layout/Features.jsx
// Fetches subscription plans live from Firestore (systemConfig/subscriptionPlans)
// so any edit made in System Settings is reflected on the landing pricing cards.

import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { PLAN_CONFIG } from "../../config/planConfig";

const FEATURE_DWELL_MS = 5500;

// ─── Static feature cards (unchanged) ────────────────────────────────────────
const features = [
  {
    tag: "Visibility",
    title: "Get Found by Nearby Builders",
    description:
      "iConstruct surfaces your shop through proximity-based listings and supplier matching, connecting you directly with homeowners, contractors, and builders in Lipa City who are actively planning their projects.",
  },
  {
    tag: "Estimation",
    title: "Integrated Material Estimation",
    description:
      "Builders compute material requirements inside iConstruct using automated calculation based on project dimensions, and your shop appears as a recommended supplier with no extra effort on your part.",
  },
  {
    tag: "Costing",
    title: "Localized Cost Computation",
    description:
      "Project cost estimates are generated using live unit prices from registered shops in Lipa City, so builders get accurate, locally grounded budget figures tied directly to your inventory.",
  },
  {
    tag: "Growth",
    title: "Tools That Help You Win More Bids",
    description:
      "Pro and Business plans unlock unlimited bidding, revenue analytics, CSV export, pricing guides, and reusable bid templates, all built to help every peso of your subscription close more supply work.",
  },
  {
    tag: "Trust",
    title: "Verified Business Platform",
    description:
      "Every shop undergoes admin verification of uploaded business permits (e.g., Mayor's Permit) before being listed, keeping iConstruct a trusted network of legitimate, compliant hardware businesses.",
  },
  {
    tag: "Management",
    title: "Unified Shop Manager Dashboard",
    description:
      "Review posted projects, quote line by line, set what you supply, manage your storefront, and track bidding history. It's all in one centralized web dashboard built for hardware shop owners.",
  },
];

const stats = [
  { val: "3×",   label: "More Customer Reach" },
  { val: "100%", label: "Verified Shops Only"  },
  { val: "Free", label: "To Get Started"       },
];

// ─── Default fallback plans (from planConfig — single source) ───────────────
const DEFAULT_PLANS = ["basic", "pro", "business"].map((key) => {
  const p = PLAN_CONFIG[key];
  const isBasic = key === "basic";
  const price = isBasic && p.price === 0 ? "Free" : `₱${p.price.toLocaleString("en-PH")}`;
  return {
    key,
    name: key === "basic" ? "Basic" : key === "pro" ? "Pro" : "Business",
    price,
    period: isBasic && p.price === 0 ? "" : `/ ${p.billingCycle}`,
    badge: key === "pro" ? "Most Popular" : key === "business" ? "Best Value" : null,
    color: p.color,
    features: p.features,
    cta: isBasic
      ? "Included on Registration"
      : `Get ${key === "pro" ? "Pro" : "Business"} — ${price}/mo`,
    ctaStyle: key === "pro" ? "filled" : "outline",
    isPublic: true,
  };
});

// ─── Helper: convert Firestore plan doc → display shape ──────────────────────
// Price, features, billing, limits all prefer Firestore (admin edits).
function firestorePlanToDisplay(key, plan) {
  const staticPlan = PLAN_CONFIG[key] ?? {};
  const isBasic    = key === "basic";
  const isPro      = key === "pro";
  const isBusiness = key === "business";

  const priceNum = Number(
    plan.price !== undefined && plan.price !== null
      ? plan.price
      : staticPlan.price ?? 0
  );
  const billingRaw = plan.billingCycle || staticPlan.billingCycle || "month";
  const billingCycle = String(billingRaw).replace(/ly$/i, "").toLowerCase() || "month";

  const price = isBasic
    ? (priceNum === 0 ? "Free" : `₱${Number(priceNum).toLocaleString("en-PH")}`)
    : `₱${Number(priceNum).toLocaleString("en-PH")}`;

  const period = isBasic && priceNum === 0 ? "" : `/ ${billingCycle}`;

  const features =
    Array.isArray(plan.features) && plan.features.length
      ? plan.features
      : staticPlan.features ?? [];

  const displayName =
    plan.label ||
    (isBasic ? "Basic" : isPro ? "Pro" : "Business");

  const ctaText = isBasic
    ? "Included on Registration"
    : `Get ${displayName} — ${price}/${billingCycle}`;

  return {
    key,
    name: displayName,
    price,
    period,
    badge: isPro ? "Most Popular" : isBusiness ? "Best Value" : null,
    color: isBusiness ? "#648DB6" : isPro ? "#2C3E50" : "#648DB6",
    features,
    cta: ctaText,
    ctaStyle: isPro ? "filled" : "outline",
    isPublic: plan.isPublic !== false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Features() {
  const [plans, setPlans]         = useState(DEFAULT_PLANS);
  const [loading, setLoading]     = useState(true);
  const [active, setActive]       = useState(0);
  const [paused, setPaused]       = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const sectionRef = useRef(null);
  const [inView, setInView]       = useState(false);

  const activeFeature = features[active];

  // Fetch live plans from Firestore on mount + refresh every 60s while on page
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "systemConfig", "subscriptionPlans"));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data().plans ?? {};
          const order = ["basic", "pro", "business"];
          const live = order
            .filter((k) => data[k] && data[k].isPublic !== false)
            .map((k) => firestorePlanToDisplay(k, data[k]));

          if (live.length > 0) setPlans(live);
        }
      } catch (err) {
        console.warn(
          "Features: could not load plans from Firestore, using defaults.",
          err
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Reveal stage when section enters viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          setProgressKey((k) => k + 1);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Slow autoplay — one feature at a time so visitors can actually read
  useEffect(() => {
    if (paused || !inView) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % features.length);
      setProgressKey((k) => k + 1);
    }, FEATURE_DWELL_MS);
    return () => clearInterval(id);
  }, [paused, inView, active]);

  const selectFeature = (index) => {
    setActive(index);
    setProgressKey((k) => k + 1);
  };

  return (
    <>
      {/* ── Features Section ── */}
      <section
        ref={sectionRef}
        className={`ft-section${inView ? " ft-section--in" : ""}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="ft-stage-bg" aria-hidden="true" />

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
            Slow down for a moment. Six reasons hardware shops in Lipa
            choose iConstruct, one at a time.
          </p>
        </div>

        <div className="ft-stage">
          <nav className="ft-rail" aria-label="Platform features">
            {features.map((f, i) => (
              <button
                key={f.tag}
                type="button"
                className={`ft-rail-item${i === active ? " is-active" : ""}`}
                onClick={() => selectFeature(i)}
                aria-current={i === active ? "true" : undefined}
              >
                <span className="ft-rail-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="ft-rail-label">{f.tag}</span>
              </button>
            ))}
          </nav>

          <div className="ft-spotlight" key={active}>
            <div className="ft-spotlight-meta">
              <span className="ft-spotlight-tag">{activeFeature.tag}</span>
              <span className="ft-spotlight-count">
                {String(active + 1).padStart(2, "0")}
                <span> / {String(features.length).padStart(2, "0")}</span>
              </span>
            </div>

            <p className="ft-spotlight-index" aria-hidden="true">
              {String(active + 1).padStart(2, "0")}
            </p>

            <h3 className="ft-spotlight-title">{activeFeature.title}</h3>
            <p className="ft-spotlight-body">{activeFeature.description}</p>

            <div className="ft-progress" aria-hidden="true">
              {inView && (
                <div
                  key={progressKey}
                  className={`ft-progress-fill${paused ? " is-paused" : ""}`}
                  style={{ animationDuration: `${FEATURE_DWELL_MS}ms` }}
                />
              )}
            </div>
          </div>
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
            <a href="#plans" className="ft-btn-ghost">See Plans</a>
            <a href="/register" className="ft-btn-fill">Register Your Shop →</a>
          </div>
        </div>
      </section>

      {/* ── Subscription Plans Section ── */}
      <section className="sp-section" id="plans">
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
              unlimited quoting, priority visibility, and powerful analytics.
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
                      If downgraded, listings beyond your new plan's limit are hidden, not deleted.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="sp-payments">
            <span className="sp-payments-label">Accepted payments</span>
            <div className="sp-payment-chips">
              {["GCash", "Maya"].map((m) => (
                <span key={m} className="sp-payment-chip">{m}</span>
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}