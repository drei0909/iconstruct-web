import { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const features = [
  {
    tag: "Visibility",
    title: "Get More Customers",
    description:
      "Contractors and builders can easily find your hardware shop when they need construction materials.",
  },
  {
    tag: "Estimation",
    title: "Smart Material Estimation",
    description:
      "Contractors calculate materials using iConstruct, and your shop becomes their trusted supplier.",
  },
  {
    tag: "Costing",
    title: "Accurate Cost Calculation",
    description:
      "Help customers estimate project costs using real hardware prices from registered shops.",
  },
  {
    tag: "Marketing",
    title: "Promote Your Hardware Shop",
    description:
      "Show your shop to contractors, builders, and homeowners looking for reliable suppliers.",
  },
  {
    tag: "Trust",
    title: "Verified Business Platform",
    description:
      "Only approved hardware shops are listed, creating a trusted environment for construction partners.",
  },
  {
    tag: "Management",
    title: "Easy Shop Management",
    description:
      "Manage your shop profile, update materials, and connect with customers through one platform.",
  },
];

// Subscription plan tiers
const plans = [
  {
    name: "Basic",
    price: "Free",
    period: "",
    badge: null,
    color: "#648DB6",
    features: [
      "Shop profile listing",
      "View limited project postings",
      "Submit up to 3 quotations/month",
      "Basic shop visibility",
    ],
    cta: "Included on Registration",
    ctaStyle: "outline",
  },
  {
    name: "Pro",
    price: "₱499",
    period: "/ month",
    badge: "Most Popular",
    color: "#2C3E50",
    features: [
      "Everything in Basic",
      "Priority listing in search",
      "Unlimited project bidding",
      "Promotional exposure",
      "Quotation performance insights",
    ],
    cta: "Get Pro — ₱499/mo",
    ctaStyle: "filled",
  },
  {
    name: "Business",
    price: "₱4,499",
    period: "/ year",
    badge: "Best Value",
    color: "#648DB6",
    features: [
      "Everything in Pro",
      "Featured placement on platform",
      "Priority customer support",
      "Advanced analytics dashboard",
      "Save ₱1,489 vs monthly",
    ],
    cta: "Get Business — ₱4,499/yr",
    ctaStyle: "outline",
  },
];

export default function Features() {
  const swiperRef = useRef(null);

  return (
    <>
      {/* ── Features Section ── */}
      <section className="ft-section">
        <div className="container">

          {/* Header */}
          <div className="ft-header">
            <div className="ft-eyebrow">
              <span className="ft-eyebrow-line" />
              Platform Features
              <span className="ft-eyebrow-line" />
            </div>
            <h2 className="ft-title">
              Why Register Your Shop<br />
              with <span>iConstruct</span>?
            </h2>
            <p className="ft-subtitle">
              Everything you need to grow your hardware business and become
              the go-to supplier for builders and contractors.
            </p>
          </div>

          {/* Swiper */}
          <div className="ft-swiper-wrap">
            <Swiper
              onSwiper={(swiper) => (swiperRef.current = swiper)}
              modules={[Autoplay, Navigation, Pagination]}
              spaceBetween={24}
              slidesPerView={3}
              navigation={{ prevEl: ".ft-nav-prev", nextEl: ".ft-nav-next" }}
              pagination={{ clickable: true, el: ".ft-pagination" }}
              autoplay={{
                delay: 4000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              breakpoints={{
                0:   { slidesPerView: 1 },
                640: { slidesPerView: 2, spaceBetween: 16 },
                992: { slidesPerView: 3, spaceBetween: 24 },
              }}
            >
              {features.map((f, i) => (
                <SwiperSlide key={i} style={{ height: "auto" }}>
                  <div className="ft-card">
                    <div className="ft-card-watermark">{String(i + 1).padStart(2, "0")}</div>
                    <div className="ft-card-top">
                      <span className="ft-number-badge">{String(i + 1).padStart(2, "0")}</span>
                      <span className="ft-tag">{f.tag}</span>
                    </div>
                    <h4 className="ft-card-title">{f.title}</h4>
                    <p className="ft-card-desc">{f.description}</p>
                    <div className="ft-card-line" />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Custom nav row */}
            <div className="ft-nav-row">
              <button className="ft-nav-btn ft-nav-prev" aria-label="Previous">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M10 4L6 8l4 4" />
                </svg>
              </button>
              <div className="ft-pagination" />
              <button className="ft-nav-btn ft-nav-next" aria-label="Next">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            </div>
          </div>

          {/* CTA strip */}
          <div className="ft-cta">
            <div className="ft-cta-inner">
              <p className="ft-cta-text">Ready to grow your hardware business?</p>
              <a href="/register" className="ft-cta-btn">
                Register Your Shop →
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ── Subscription Plans Section ── */}
      <section className="sp-section">
        <div className="container">

          {/* Header */}
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
              priority listings, unlimited bidding, and powerful analytics.
            </p>

            {/* Flow hint pill */}
            <div className="sp-flow-pill">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" width="13" height="13">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v3.5l2 2" />
              </svg>
              Register first → get approved → then choose your plan
            </div>
          </div>

          {/* Plan cards */}
          <div className="sp-plans">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`sp-plan-card ${plan.badge === "Most Popular" ? "sp-plan-featured" : ""}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <span className={`sp-plan-badge ${plan.badge === "Most Popular" ? "sp-badge-dark" : "sp-badge-blue"}`}>
                    {plan.badge}
                  </span>
                )}

                <div className="sp-plan-top">
                  <div
                    className="sp-plan-dot"
                    style={{ background: plan.color }}
                  />
                  <span className="sp-plan-name">{plan.name}</span>
                </div>

                <div className="sp-plan-price">
                  <span className="sp-plan-amount">{plan.price}</span>
                  {plan.period && (
                    <span className="sp-plan-period">{plan.period}</span>
                  )}
                </div>

                <ul className="sp-plan-features">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="sp-plan-feature-item">
                      <svg viewBox="0 0 14 14" fill="none" stroke="#22c55e" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" width="13" height="13" style={{ flexShrink: 0 }}>
                        <path d="M2.5 7.5l3 3 6-6" />
                      </svg>
                      {feat}
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
                  <p className="sp-plan-note">
                    Automatically granted after admin approval.
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Payment method row */}
          <div className="sp-payments">
            <span className="sp-payments-label">Accepted payments</span>
            <div className="sp-payment-chips">
              {["GCash", "Maya", "BDO", "BPI", "Visa / Mastercard", "UnionBank"].map((method) => (
                <span key={method} className="sp-payment-chip">{method}</span>
              ))}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
