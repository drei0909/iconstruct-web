import { useState } from "react";

const faqs = [
  {
    category: "General",
    question: "What is iConstruct?",
    answer:
      "iConstruct is a smart construction support system that helps builders estimate materials, manage project costs, and connect with nearby verified hardware suppliers — all in one platform.",
  },
  {
    category: "General",
    question: "Who can use iConstruct?",
    answer:
      "Builders, contractors, and hardware shop owners can use the system to simplify construction planning and material sourcing. Whether you're managing a large project or a small renovation, iConstruct is built for you.",
  },
  {
    category: "Mobile App",
    question: "Is the mobile app free?",
    answer:
      "Yes, the iConstruct mobile application is completely free to download from the Google Play Store and the Apple App Store.",
  },
  {
    category: "Mobile App",
    question: "What platforms is the app available on?",
    answer:
      "The iConstruct app is available on both Android (Google Play) and iOS (App Store). A web version is also accessible directly from your browser.",
  },
  {
    category: "Hardware Shops",
    question: "How do I register my hardware shop?",
    answer:
      "Click the 'Register Your Shop' button on the homepage or navigate to the Sign Up page. Fill in your business details and submit for verification. Approved shops are listed on the platform within 24–48 hours.",
  },
  {
    category: "Hardware Shops",
    question: "Is there a fee for registering my shop?",
    answer:
      "Registration is currently free for all hardware shops. We believe in building a trusted network first — you can list your shop and connect with contractors at no cost.",
  },
  {
    category: "Estimation",
    question: "How accurate is the material estimation?",
    answer:
      "iConstruct uses real hardware prices from registered shops and standard construction formulas to deliver estimates with up to 98% accuracy. Results improve as more suppliers join the platform.",
  },
];

const categories = ["All", ...new Set(faqs.map((f) => f.category))];

export default function FAQs() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);

  const filtered =
    activeCategory === "All"
      ? faqs
      : faqs.filter((f) => f.category === activeCategory);

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <>
    
      <div className="faq-page">
        <div className="container">

          {/* Header */}
          <div className="faq-hero">
            <div className="faq-eyebrow">
              <span className="faq-eyebrow-line" />
              Support
              <span className="faq-eyebrow-line" />
            </div>
            <h1 className="faq-title">
              Frequently Asked<br /><span>Questions</span>
            </h1>
            <p className="faq-subtitle">
              Everything you need to know about iConstruct. Can't find
              an answer? Reach out to our team.
            </p>
          </div>

          {/* Category filters */}
          <div className="faq-filters">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`faq-filter-btn ${activeCategory === cat ? "active" : ""}`}
                onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Accordion */}
          <div className="faq-list">
            {filtered.map((faq, i) => (
              <div
                key={i}
                className={`faq-item ${openIndex === i ? "open" : ""}`}
              >
                <button className="faq-question" onClick={() => toggle(i)}>
                  <div className="faq-q-left">
                    <span className="faq-q-num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="faq-q-text">{faq.question}</span>
                  </div>
                  <span className="faq-q-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </span>
                </button>

                <div className="faq-answer">
                  <div className="faq-answer-inner">
                    <span className="faq-cat-pill">{faq.category}</span>
                    <p style={{ margin: 0 }}>{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="faq-cta">
            <div className="faq-cta-left">
              <h4>Still have questions?</h4>
              <p>Our team is happy to help you get started.</p>
            </div>
            <a href="/contact-us" className="faq-cta-btn">
              Contact Us
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
