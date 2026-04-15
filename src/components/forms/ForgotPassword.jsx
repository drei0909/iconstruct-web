// src/components/forms/ForgotPassword.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { sendOTP, verifyOTP } from "../../controllers/authController";

const STEPS = ["Enter Email", "Verify OTP", "Reset Password", "Done"];

export default function ForgotPassword({ onClose }) {
  const navigate = useNavigate();
  const [step, setStep]             = useState(0);
  const [email, setEmail]           = useState("");
  const [ownerName, setOwnerName]   = useState("");
  const [otp, setOtp]               = useState(["","","","","",""]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const startResendTimer = () => {
    setResendTimer(60);
    const id = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(id); return 0; } return t - 1; });
    }, 1000);
  };

  /* Step 0 */
  const handleEmailSubmit = async () => {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    try {
      const { getDocs, collection, query, where } = await import("firebase/firestore");
      const q    = query(collection(db, "shops"), where("email", "==", email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError("No shop account found with this email address."); return; }
      const shopData = snap.docs[0].data();
      setOwnerName(shopData.ownerName || "Shop Owner");
      await sendOTP(email.trim().toLowerCase(), shopData.ownerName || "Shop Owner");
      startResendTimer();
      setStep(1);
    } catch (err) {
      setError("Failed to send verification code. Please try again.");
    } finally { setLoading(false); }
  };

  /* OTP handlers */
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp]; next[index] = value.slice(-1); setOtp(next); setError("");
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  /* Step 1 */
  const handleOtpSubmit = async () => {
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the complete 6-digit code."); return; }
    setLoading(true); setError("");
    try {
      await verifyOTP(email.trim().toLowerCase(), code);
      setError(""); setStep(2);
    } catch (err) {
      setError(err.message || "Invalid code. Please try again.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true); setError("");
    try {
      await sendOTP(email.trim().toLowerCase(), ownerName);
      setOtp(["","","","","",""]); startResendTimer();
    } catch { setError("Failed to resend code. Please try again."); }
    finally { setLoading(false); }
  };

  /* Step 2 */
  const handlePasswordReset = async () => {
    setLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setStep(3);
    } catch (err) {
      setError("Failed to send reset link. Please try again.");
    } finally { setLoading(false); }
  };

  const otpFilled = otp.join("").length === 6;

  return (
    <div className="fp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fp-modal">

        {/* Close button */}
        {step < 3 && (
          <button className="fp-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}

        {/* Progress bar */}
        <div className="fp-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`fp-progress-seg${i <= step ? " fp-progress-seg--active" : ""}`} />
          ))}
        </div>

        {/* Step label */}
        <p className="fp-step-label">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

        {/* ── Step 0: Email ── */}
        {step === 0 && (
          <>
            <h3 className="fp-title">Forgot Password?</h3>
            <p className="fp-sub">
              Enter the email address linked to your shop account. We'll send a 6-digit verification code to confirm it's you.
            </p>
            <div className="fp-field">
              <label className="fp-label">Email Address</label>
              <input
                className="fp-input"
                type="email"
                placeholder="yourshop@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
              />
            </div>
            {error && <div className="fp-error">{error}</div>}
            <button className="fp-btn-primary" onClick={handleEmailSubmit} disabled={loading}>
              {loading ? <><span className="fp-spinner" /> Sending Code...</> : "Send Verification Code →"}
            </button>
            <button className="fp-btn-ghost" onClick={onClose}>← Back to Sign In</button>
          </>
        )}

        {/* ── Step 1: OTP ── */}
        {step === 1 && (
          <>
            <h3 className="fp-title">Check Your Email</h3>
            <p className="fp-sub">We sent a 6-digit code to</p>
            <div className="fp-email-badge">📧 {email}</div>

            <div className="fp-otp-row" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => (otpRefs.current[i] = el)}
                  className={`fp-otp-box${digit ? " fp-otp-box--filled" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                />
              ))}
            </div>

            {error && <div className="fp-error">{error}</div>}

            <button
              className="fp-btn-primary"
              onClick={handleOtpSubmit}
              disabled={loading || !otpFilled}
              data-disabled={!otpFilled}
            >
              {loading ? <><span className="fp-spinner" /> Verifying...</> : "Verify Code →"}
            </button>

            <div className="fp-resend">
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : (
                <>Didn't receive it?{" "}
                  <button className="fp-resend-btn" onClick={handleResend} disabled={loading}>
                    Resend OTP
                  </button>
                </>
              )}
            </div>

            <button className="fp-btn-ghost" onClick={() => { setStep(0); setOtp(["","","","","",""]); setError(""); }}>
              ← Change Email
            </button>
          </>
        )}

        {/* ── Step 2: Send Reset Link ── */}
        {step === 2 && (
          <>
            <h3 className="fp-title">Reset Your Password</h3>
            <p className="fp-sub">Identity verified ✓ — We'll send a secure reset link to your email.</p>
            <div className="fp-info-box">
              <strong>How this works:</strong><br />
              Click the button below. Firebase will send a password reset link to <strong>{email}</strong>. Open that email and follow the link to set your new password securely.
            </div>
            {error && <div className="fp-error">{error}</div>}
            <button className="fp-btn-primary" onClick={handlePasswordReset} disabled={loading}>
              {loading ? <><span className="fp-spinner" /> Sending Reset Link...</> : "Send Password Reset Link →"}
            </button>
            <button className="fp-btn-ghost" onClick={() => setStep(1)}>← Back</button>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <div className="fp-done">
            <div className="fp-done-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="fp-title">Reset Link Sent!</h3>
            <p className="fp-sub">
              Check your inbox at <strong>{email}</strong> for the password reset link.
              It expires in 15 minutes. Also check your spam folder.
            </p>
            <button className="fp-btn-primary" onClick={onClose}>
              Back to Sign In →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}