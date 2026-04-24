// src/components/forms/LoginForm.jsx
import { useState }          from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginShop }         from "../../controllers/authController";
import ForgotPassword        from "./ForgotPassword";
import { requestNotificationPermission } from "../../services/fcmService"; // ← ADDED

export default function LoginForm() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [firebaseError, setFirebaseError] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setFirebaseError("");
    try {
      // loginShop already returns { user, status }
      // destructure user here — no extra auth calls needed
      const { user, status } = await loginShop(form.email, form.password); // ← added `user`

      if (status === "pending") {
        setFirebaseError("Your shop application is still under review.");
        return;
      }
      if (status === "rejected") {
        setFirebaseError("Your application was not approved. Please contact support.");
        return;
      }

      // ── FCM: request permission + save token using uid from loginShop ──
      await requestNotificationPermission(user.uid); // ← ADDED
      // ──────────────────────────────────────────────────────────────────

      navigate("/shop/dashboard");
    } catch (err) {
      const msg = {
        "auth/user-not-found":     "No account found with this email.",
        "auth/wrong-password":     "Incorrect password. Please try again.",
        "auth/invalid-email":      "The email address is not valid.",
        "auth/too-many-requests":  "Too many failed attempts. Please try again later.",
        "auth/invalid-credential": "Invalid email or password.",
        "no-shop":                 "Shop record not found. Please contact support.",
      };
      setFirebaseError(msg[err.message] || msg[err.code] || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <>
      {showForgot && <ForgotPassword onClose={() => setShowForgot(false)} />}
      <div className="login-page">
        <div className="login-wrap">
          <div className="login-left">
            <div className="login-left-top">
              <div className="login-left-eyebrow">
                <span className="login-left-eyebrow-line" />
                Shop Owner Portal
              </div>
              <h2 className="login-left-title">
                Manage Your<br /><span>Hardware Shop.</span>
              </h2>
              <p className="login-left-text">
                Sign in to your shop dashboard to post products, update your
                inventory, and connect with contractors and builders near you.
              </p>
              <div className="login-bullets">
                {["Post and manage your products","Receive inquiries from contractors","Update shop info and pricing"].map((item, i) => (
                  <div className="login-bullet" key={i}>
                    <span className="login-bullet-dot" />{item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              background:"rgba(237,228,212,0.08)", border:"1px solid rgba(237,228,212,0.15)",
              borderRadius:10, padding:"16px 18px", position:"relative", zIndex:1,
            }}>
              <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(237,228,212,0.55)", marginBottom:6 }}>
                New to iConstruct?
              </p>
              <p style={{ fontSize:12, fontWeight:300, color:"rgba(237,228,212,0.4)", lineHeight:1.65, margin:0 }}>
                Register your hardware shop first. Your account will be activated once approved.
              </p>
            </div>
          </div>

          <div className="login-right">
            <p className="login-form-eyebrow">Shop Owner Access</p>
            <h3 className="login-form-title">Sign In to Your Shop</h3>
            <p className="login-form-sub">
              Enter the credentials you used when registering your hardware shop.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="login-label">Email Address</label>
                <input className="login-input" type="email" name="email"
                  placeholder="yourshop@email.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="login-field">
                <label className="login-label">Password</label>
                <div className="login-input-wrap">
                  <input className="login-input has-toggle"
                    type={showPass ? "text" : "password"} name="password"
                    placeholder="Enter your password" value={form.password} onChange={handleChange} required />
                  <button type="button" className="login-toggle"
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
              <button type="button" className="login-forgot"
                onClick={() => { setFirebaseError(""); setShowForgot(true); }}>
                Forgot password?
              </button>
              {firebaseError && (
                <div className="login-error">{firebaseError}</div>
              )}
              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? (
                  <><span className="login-spinner" /> Signing In...</>
                ) : (
                  <>Sign In to Dashboard
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
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
    </>
  );
}