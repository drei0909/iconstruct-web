// src/views/admin/AdminLoginPage.jsx
import { useState } from "react";
import { loginAdmin } from "../../controllers/adminController";
import ForgotPassword from "../../components/forms/ForgotPassword";

// Already-signed-in admins are redirected away from /admin by the
// <GuestOnly adminAware> route guard (see App.jsx / context/AuthContext).
// On success this form doesn't navigate itself either — see handleSubmit.

export default function AdminLogin() {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // No "already signed in, skip re-auth" shortcut here on purpose: if
    // auth.currentUser belongs to a signed-in but NON-admin session (e.g.
    // someone testing the shop side earlier in the same browser), jumping
    // straight to /admin/dashboard ignored whatever was just typed in this
    // form entirely — AdminRoute would reject that stale session and bounce
    // back here with the fields cleared, looking like a silent failure no
    // matter what credentials were entered. A genuinely already-confirmed
    // admin never even reaches this form — <GuestOnly adminAware> redirects
    // them before it renders — so this shortcut only ever fired for the
    // broken case, never a useful one.
    setLoading(true);
    setError("");
    try {
      await loginAdmin(form.email, form.password);
      // Don't navigate here. loginAdmin() runs its own admin check, but
      // AuthContext's onAuthStateChanged runs a SEPARATE, concurrent one to
      // set isAdmin — the two don't share results. Navigating immediately
      // used to race that: AdminRoute could still read the old
      // isAdmin:false (initializing doesn't reset on a fresh sign-in) and
      // bounce a genuine admin straight back here. Leaving loading on and
      // not navigating lets the wrapping <GuestOnly adminAware> redirect
      // once AuthContext actually confirms isAdmin — only one source of
      // truth, no race. This component unmounts via that redirect shortly.
    } catch (err) {
      setError(err.message || "Invalid credentials.");
      setLoading(false);
    }
  };

  return (
    <>
      {showForgot && (
        <ForgotPassword variant="admin" onClose={() => setShowForgot(false)} />
      )}

      <div className="adm-login-page">
        <div className="adm-login-card">
          <div className="adm-login-badge">
            <span className="adm-login-badge-dot" />
            Super Admin Portal
          </div>
          <h2 className="adm-login-title">Admin Sign In</h2>
          <p className="adm-login-sub">
            Restricted access. This portal is for authorized administrators only.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="adm-field">
              <label className="adm-label">Admin Email</label>
              <input className="adm-input" type="email" name="email"
                placeholder="admin@iconstruct.ph"
                value={form.email} onChange={handleChange} required />
            </div>

            <div className="adm-field">
              <label className="adm-label">Password</label>
              <div className="adm-input-wrap">
                <input className="adm-input has-toggle"
                  type={showPass ? "text" : "password"} name="password"
                  placeholder="Enter admin password"
                  value={form.password} onChange={handleChange} required />
                <button type="button" className="adm-toggle"
                  onClick={() => setShowPass(v => !v)}>
                  {showPass ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="adm-forgot"
              onClick={() => {
                setError("");
                setShowForgot(true);
              }}
            >
              Forgot password?
            </button>

            {error && <div className="adm-error">{error}</div>}

            <button className="adm-submit" type="submit" disabled={loading}>
              {loading ? (
                <><span className="adm-spinner" /> Signing In...</>
              ) : (
                <>Access Dashboard
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
