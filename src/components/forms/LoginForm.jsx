import { useState } from "react";
import { Link } from "react-router-dom";

export default function LoginForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1400);
    console.log("Login:", form);
    // TODO: connect to Firebase Auth
  };

  return (
    <div className="login-page">
      <div className="login-wrap">

        {/* ── Left branding panel ── */}
        <div className="login-left">
          <div className="login-left-top">
            <div className="login-left-eyebrow">
              <span className="login-left-eyebrow-line" />
              Shop Owner Portal
            </div>
            <h2 className="login-left-title">
              Manage Your<br />
              <span>Hardware Shop.</span>
            </h2>
            <p className="login-left-text">
              Sign in to your shop dashboard to post products,
              update your inventory, and connect with
              contractors and builders near you.
            </p>

            <div className="login-bullets">
              {[
                "Post and manage your products",
                "Receive inquiries from contractors",
                "Update shop info and pricing",
              ].map((item, i) => (
                <div className="login-bullet" key={i}>
                  <span className="login-bullet-dot" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Approval reminder */}
          <div style={{
            background: "rgba(237,228,212,0.08)",
            border: "1px solid rgba(237,228,212,0.15)",
            borderRadius: "10px",
            padding: "16px 18px",
            position: "relative",
            zIndex: 1,
          }}>
            <p style={{
              fontSize: "10px", fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "rgba(237,228,212,0.55)", marginBottom: "6px",
            }}>
              New to iConstruct?
            </p>
            <p style={{
              fontSize: "12px", fontWeight: 300,
              color: "rgba(237,228,212,0.4)", lineHeight: 1.65, margin: 0,
            }}>
              Register your hardware shop first. Your account
              will be activated once approved by our admin team.
            </p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="login-right">
          <p className="login-form-eyebrow">Shop Owner Access</p>
          <h3 className="login-form-title">Sign In to Your Shop</h3>
          <p className="login-form-sub">
            Enter the credentials you used when registering your hardware shop.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Email Address</label>
              <input
                className="login-input"
                type="email"
                name="email"
                placeholder="yourshop@email.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input
                  className="login-input has-toggle"
                  type={showPass ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <a href="#" className="login-forgot">Forgot password?</a>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-text">Don't have a shop account yet?</span>
            <span className="login-divider-line" />
          </div>

          <p className="login-signup-row">
            <Link to="/register" className="login-signup-link">
              Register your hardware shop →
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
