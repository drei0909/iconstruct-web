// src/components/forms/TermsModal.jsx
// ✅ NO separate CSS import — all styles live in src/style/global.css
// Usage: import TermsModal from "../forms/TermsModal";
//
// Props:
//   open       {boolean}  — controls visibility
//   onAccept   {fn}       — called when user clicks "I Agree & Continue"
//   onDecline  {fn}       — called when user clicks "Decline"

import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  {
    num: "01",
    title: "Platform Overview",
    body: `iConstruct is a web and mobile-based Smart Construction Support System developed as a capstone project by students of the BS Information Technology program at National University – Lipa. The platform serves hardware shop owners and builders within Lipa City, Batangas, Philippines.

iConstruct provides construction material estimation, total cost computation, a rule-based material recommendation engine, project bidding and quotation posting, and proximity-based hardware shop listings. It is not a financial transaction platform — all negotiations and material purchases occur directly between users and hardware shops outside the system.`,
  },
  {
    num: "02",
    title: "Eligibility & Registration",
    body: `By registering as a hardware shop on iConstruct, you confirm that:

• Your shop is physically located and operating within Lipa City, Batangas.
• You are the authorized owner or representative of the registered business.
• You are at least 18 years of age and legally capable of entering into binding agreements.
• All information provided during registration — including shop name, address, contact number, and barangay — is accurate, complete, and up to date.

iConstruct currently serves hardware shops and builders within Lipa City only. Shops or users outside this coverage area are not eligible for registration at this time.`,
  },
  {
    num: "03",
    title: "Document Verification Requirement",
    body: `All hardware shop registrations are subject to manual review and verification by the iConstruct administrator before the shop is listed on the platform. You are required to upload all four (4) of the following documents during registration:

1. Business Document — DTI Certificate, Business Permit, Mayor's Permit, or BIR Certificate
2. Shop Exterior Photo — A clear, current photograph of your shop front
3. Valid Government ID — Any government-issued identification card
4. Selfie with Valid ID — A photo of you physically holding your government-issued ID

Approval is granted only after all submitted documents are verified for authenticity and compliance. Approval typically takes 24 to 48 hours after submission. iConstruct reserves the right to reject or revoke registration if documents are found to be false, expired, or non-compliant with local business regulations.`,
  },
  {
    num: "04",
    title: "Subscription Plans & Fees",
    body: `Upon admin approval, your shop is automatically granted Basic (Free) access. You may optionally upgrade to a paid subscription plan for expanded features.

Basic Plan — Free
• Up to 20 product listings
• Basic shop profile visibility
• View limited project postings
• Submit up to 3 quotations per month

Pro Plan — ₱499/month
• Up to 150 product listings
• Priority listing in search results
• Unlimited project bidding access
• Promotional exposure on the platform
• Quotation performance insights

Business Plan — ₱4,499/year
• Unlimited product listings
• All Pro Plan features
• Featured placement on the platform
• Advanced analytics dashboard
• Bulk product import (CSV/Excel)
• Priority customer support

Subscription fees are non-refundable once a billing cycle has begun. If you downgrade your plan, product listings exceeding your new plan's limit will be hidden — not permanently deleted — until your listing count falls within the allowed limit or you upgrade again. iConstruct does not process direct financial transactions between users and hardware shops; subscription payments are the only fees processed through the platform.`,
  },
  {
    num: "05",
    title: "Acceptable Use of the Platform",
    body: `As a registered hardware shop on iConstruct, you agree to:

• Keep your product listings, pricing, and shop information accurate and updated at all times.
• Submit quotations and bidding responses honestly and in good faith.
• Use the platform solely for lawful construction supply and hardware business purposes within Lipa City.
• Respond to project bids and quotation requests in a timely and professional manner.

You must NOT:
• Submit false, misleading, or inflated quotations to builders or contractors.
• Upload fraudulent, expired, or fabricated business documents.
• Use iConstruct to conduct direct online sales, collect payments, or process financial transactions through the platform.
• Share your account credentials with unauthorized individuals.
• Attempt to manipulate search rankings, recommendation outputs, or bidding results.

Violation of these terms may result in immediate account suspension or permanent removal from the platform.`,
  },
  {
    num: "06",
    title: "Intellectual Property",
    body: `iConstruct, its name, logo, system design, material estimation algorithms, and rule-based recommendation engine are the intellectual property of the iConstruct development team. All rights are reserved.

You retain ownership of the business information, product listings, and documents you upload to the platform. By uploading content, you grant iConstruct a non-exclusive, royalty-free license to display, process, and use that content solely for the purpose of operating and improving the platform — including displaying your shop profile to builders, contractors, and homeowners within Lipa City.

You may not reproduce, distribute, modify, or commercially exploit any part of the iConstruct platform without prior written consent from the development team.`,
  },
  {
    num: "07",
    title: "Privacy & Data Collection",
    body: `iConstruct collects and processes the following personal and business information during registration and platform use:

• Full name and email address of the shop owner or representative
• Shop name, address, barangay, city, and contact number
• Uploaded business documents and government-issued identification
• Product listings, pricing data, and quotation history
• Platform activity and system interaction data

This information is collected for the sole purpose of account verification, shop listing management, and platform operation. iConstruct uses Firebase for cloud-based authentication, real-time database management, and secure file storage.

Your data will not be sold to third parties. It may be shared with platform administrators for verification purposes and with builders or contractors for quotation and bidding interactions. By registering, you consent to this data collection and processing as described.`,
  },
  {
    num: "08",
    title: "Limitation of Liability",
    body: `iConstruct is a construction planning and supplier-matching platform. It does not guarantee the accuracy of material estimates, the availability of products listed by shops, or the outcome of any bidding or quotation transaction.

All material estimation outputs are generated using standard construction formulas and local pricing data from registered shops. Estimates may vary based on actual site conditions, contractor specifications, and market fluctuations.

iConstruct is not liable for:
• Losses arising from inaccurate material estimates or cost computations
• Disputes between builders and hardware shops regarding quotations or deliveries
• Business losses resulting from account suspension due to policy violations
• Technical downtime, data interruptions, or service unavailability

The platform is currently offered as a capstone academic project and is not affiliated with, endorsed by, or commissioned by any government agency or private corporation.`,
  },
  {
    num: "09",
    title: "Account Suspension & Termination",
    body: `iConstruct reserves the right to suspend or permanently remove any hardware shop account under the following circumstances:

• Submission of false, fraudulent, or expired business documents
• Violation of the Acceptable Use Policy outlined in Section 05
• Non-payment of active subscription fees (for paid plans)
• Inactivity for an extended period without notice
• Any activity deemed harmful to the platform, its users, or the local construction community

Upon account termination, your shop profile and product listings will be removed from the platform. You may request reactivation by contacting the iConstruct team and providing updated, valid documentation.`,
  },
  {
    num: "10",
    title: "Amendments to These Terms",
    body: `iConstruct reserves the right to update or modify these Terms and Conditions at any time. Registered users will be notified of material changes via their registered email address or through an in-platform notification.

Your continued use of the platform after such notification constitutes your acceptance of the revised terms. If you do not agree with the updated terms, you may request account deactivation by contacting the iConstruct team.

These Terms and Conditions are governed by the applicable laws of the Republic of the Philippines. Any disputes arising from the use of this platform shall be subject to the jurisdiction of the appropriate courts in Lipa City, Batangas.`,
  },
];

export default function TermsModal({ open, onAccept, onDecline }) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const bodyRef = useRef(null);
  const sectionRefs = useRef([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setScrolled(false);
      setActiveSection(0);
      setTimeout(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      }, 50);
    }
  }, [open]);

  // Track scroll position to unlock the agree button + highlight active section
  const handleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) setScrolled(true);

    // Figure out which section is in view
    const scrollMid = el.scrollTop + el.clientHeight / 3;
    let active = 0;
    sectionRefs.current.forEach((ref, i) => {
      if (ref && ref.offsetTop <= scrollMid) active = i;
    });
    setActiveSection(active);
  };

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onDecline?.(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onDecline]);

  if (!open) return null;

  return (
    <div
      className="tc-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onDecline?.(); }}
    >
      <div className="tc-modal">

        {/* ── Header ── */}
        <div className="tc-modal-head">
          <div className="tc-modal-head-left">
            <div className="tc-modal-eyebrow">Terms & Conditions</div>
            <h2 className="tc-modal-title">iConstruct Platform Agreement</h2>
            <p className="tc-modal-subtitle">
              Hardware Shop Registration · Lipa City, Batangas
            </p>
          </div>
          <button className="tc-modal-close" onClick={onDecline} aria-label="Close"></button>
        </div>

        {/* ── Body ── */}
        <div className="tc-modal-body-wrap">

          {/* Sidebar nav (desktop) */}
          <nav className="tc-sidebar">
            {SECTIONS.map((s, i) => (
              <button
                key={i}
                className={`tc-sidebar-btn ${activeSection === i ? "active" : ""}`}
                onClick={() => {
                  const el = sectionRefs.current[i];
                  if (el && bodyRef.current) {
                    bodyRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
                  }
                }}
              >
                <span className="tc-sidebar-num">{s.num}</span>
                <span className="tc-sidebar-label">{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Scrollable content */}
          <div className="tc-modal-body" ref={bodyRef} onScroll={handleScroll}>

            {/* Effective date notice */}
            <div className="tc-notice">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Effective April 2026 · By clicking "I Agree & Continue" you confirm you have read,
                understood, and agree to be bound by these terms.
              </span>
            </div>

            {/* Sections */}
            {SECTIONS.map((s, i) => (
              <div
                key={i}
                className="tc-section"
                ref={(el) => (sectionRefs.current[i] = el)}
              >
                <div className="tc-section-head">
                  <span className="tc-section-num">{s.num}</span>
                  <h3 className="tc-section-title">{s.title}</h3>
                </div>
                <div className="tc-section-body">
                  {s.body.split("\n\n").map((para, j) => {
                    // Render bullet-list paragraphs
                    const lines = para.split("\n");
                    const isList = lines.some((l) => l.trim().startsWith("•") || /^\d+\./.test(l.trim()));
                    if (isList) {
                      return (
                        <ul className="tc-list" key={j}>
                          {lines.map((line, k) => {
                            const clean = line.replace(/^[•\d.]\s*/, "").trim();
                            if (!clean) return null;
                            // Check for "bold label — rest" pattern
                            const boldMatch = clean.match(/^([^—]+)—(.+)/);
                            return (
                              <li key={k} className="tc-list-item">
                                {boldMatch ? (
                                  <>
                                    <strong>{boldMatch[1].trim()}</strong>
                                    {" — "}
                                    {boldMatch[2].trim()}
                                  </>
                                ) : clean}
                              </li>
                            );
                          })}
                        </ul>
                      );
                    }
                    return <p className="tc-para" key={j}>{para}</p>;
                  })}
                </div>
              </div>
            ))}

            {/* Bottom scroll indicator */}
            <div className="tc-bottom-note">
              {scrolled
                ? "✓ You've reviewed all sections. You may now accept the agreement."
                : "↓ Continue scrolling to read all terms before accepting."}
            </div>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="tc-modal-foot">
          <div className="tc-foot-left">
            {!scrolled && (
              <div className="tc-scroll-hint">
                <div className="tc-scroll-bar">
                  <div className="tc-scroll-fill" />
                </div>
                <span>Scroll to read all terms</span>
              </div>
            )}
          </div>
          <div className="tc-foot-actions">
            <button className="tc-btn-decline" onClick={onDecline}>
              Decline
            </button>
            <button
              className={`tc-btn-agree ${scrolled ? "ready" : "locked"}`}
              onClick={scrolled ? onAccept : undefined}
              disabled={!scrolled}
              title={!scrolled ? "Please scroll to read all terms first" : ""}
            >
              {scrolled ? (
                <>
                  I Agree & Continue
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Read All Terms First
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}