// src/components/layout/contactUs.jsx
// ✅ NO separate CSS import — all styles live in src/style/global.css

import { useState } from "react";

const contactInfo = [
  {
    number: "01",
    label: "Email Us",
    value: "hello@iconstruct.ph",
    sub: "We reply within 24 hours",
    href: "mailto:hello@iconstruct.ph",
  },
  {
    number: "02",
    label: "Follow Us",
    value: "@iConstruct",
    sub: "Facebook & Instagram",
    href: "#",
  },
  {
    number: "03",
    label: "Location",
    value: "National University – Lipa",
    sub: "Lipa City, Batangas, Philippines",
    href: "#",
  },
];

export default function ContactUs() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1400);
  };

  return (
    <div className="ct-page">
      <div className="container">

        {/* Header */}
        <div className="ct-header">
          <div className="ct-eyebrow">
            <span className="ct-eyebrow-line" />
            Get In Touch
            <span className="ct-eyebrow-line" />
          </div>
          <h1 className="ct-title">
            Contact <span>Us</span>
          </h1>
          <p className="ct-subtitle">
            Have a question about iConstruct? We'd love to hear from you.
            Send us a message and we'll get back to you shortly.
          </p>
        </div>

        {/* Grid */}
        <div className="ct-grid">

          {/* Left — contact info */}
          <div className="ct-info-stack">
            {contactInfo.map((info, i) => (
              <a href={info.href} className="ct-info-card" key={i}>
                <div className="ct-info-num">{info.number}</div>
                <div className="ct-info-body">
                  <p className="ct-info-label">{info.label}</p>
                  <p className="ct-info-value">{info.value}</p>
                  <p className="ct-info-sub">{info.sub}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(44,62,80,0.2)"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  width="16" height="16">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            ))}

            <div className="ct-note-card">
              <h5 className="ct-note-title">We're here to help</h5>
              <p className="ct-note-text">
                Whether you're a contractor looking to estimate materials
                or a hardware shop owner wanting to join the platform —
                our team is ready to assist you.
              </p>
            </div>
          </div>

          {/* Right — form */}
          <div className="ct-form-card">
            {sent ? (
              <div className="ct-success">
                <div className="ct-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.95)"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    width="26" height="26">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="ct-success-title">Message Sent!</h3>
                <p className="ct-success-text">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
                <button
                  className="ct-success-btn"
                  onClick={() => {
                    setSent(false);
                    setForm({ name: "", email: "", subject: "", message: "" });
                  }}
                >
                  Send Another
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    width="14" height="14">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <h3 className="ct-form-title">Send a Message</h3>
                <p className="ct-form-sub">
                  Fill in the form below and we'll respond as soon as possible.
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="ct-row">
                    <div className="ct-field">
                      <label className="ct-label">Name</label>
                      <input
                        className="ct-input"
                        type="text"
                        name="name"
                        placeholder="Juan dela Cruz"
                        value={form.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="ct-field">
                      <label className="ct-label">Email</label>
                      <input
                        className="ct-input"
                        type="email"
                        name="email"
                        placeholder="juan@email.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="ct-field">
                    <label className="ct-label">Subject</label>
                    <input
                      className="ct-input"
                      type="text"
                      name="subject"
                      placeholder="What's this about?"
                      value={form.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="ct-field">
                    <label className="ct-label">Message</label>
                    <textarea
                      className="ct-textarea"
                      name="message"
                      placeholder="Tell us how we can help..."
                      value={form.message}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <button className="ct-submit" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="ct-spinner" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          width="16" height="16">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}