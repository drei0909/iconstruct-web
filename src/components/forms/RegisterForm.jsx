import { useState } from "react";
import { Link } from "react-router-dom";

const STEPS = [
  { number: "01", label: "Account"  },
  { number: "02", label: "Shop Info" },
  { number: "03", label: "Review"   },
];

const initialForm = {
  // Step 1 — Account
  ownerName: "",
  email: "",
  password: "",
  confirmPassword: "",
  // Step 2 — Shop Info
  shopName: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  description: "",
};

export default function RegisterForm() {
  const [step, setStep]         = useState(0);
  const [form, setForm]         = useState(initialForm);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors]     = useState({});

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  /* ── Validation ── */
  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.ownerName.trim())           e.ownerName = "Full name is required.";
      if (!form.email.trim())               e.email     = "Email is required.";
      if (form.password.length < 8)         e.password  = "Password must be at least 8 characters.";
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    }
    if (step === 1) {
      if (!form.shopName.trim())  e.shopName = "Shop name is required.";
      if (!form.phone.trim())     e.phone    = "Phone number is required.";
      if (!form.address.trim())   e.address  = "Address is required.";
      if (!form.city.trim())      e.city     = "City is required.";
      if (!form.province.trim())  e.province = "Province is required.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => { setErrors({}); setStep((s) => s - 1); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1600);
    console.log("Register:", form);
  };

  /* ── Eye toggle button ── */
  const EyeBtn = ({ show, onToggle }) => (
    <button type="button" className="reg-toggle" onClick={onToggle}
      aria-label={show ? "Hide" : "Show"}>
      {show ? (
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
  );

  return (
    <>
      <style>{`
        /* ── Register page ── */
        .reg-page {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f6f2;
          padding: 140px 16px 60px;
          position: relative;
          overflow: hidden;
        }
        .reg-page::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 420px; height: 420px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(44,62,80,0.05) 0%, rgba(100,141,182,0.07) 100%);
          pointer-events: none;
        }
        .reg-page::after {
          content: '';
          position: absolute;
          bottom: -80px; left: -80px;
          width: 320px; height: 320px;
          border-radius: 50%;
          background: rgba(237,228,212,0.55);
          pointer-events: none;
        }

        /* ── Wrapper ── */
        .reg-wrap {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          width: 100%;
          max-width: 960px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 72px rgba(44,62,80,0.16);
          position: relative;
          z-index: 1;
        }
        @media (max-width: 767px) {
          .reg-wrap  { grid-template-columns: 1fr; }
          .reg-left  { display: none; }
        }

        /* ── Left panel ── */
        .reg-left {
          background: linear-gradient(180deg, #2C3E50 30.29%, #648DB6 87.5%);
          padding: 56px 44px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .reg-left::before {
          content: '';
          position: absolute;
          left: 0; top: 0;
          width: 4px; height: 100%;
          background: rgba(237,228,212,0.4);
        }
        .reg-left::after {
          content: 'iConstruct';
          position: absolute;
          bottom: -24px; left: -10px;
          font-family: 'Playfair Display', serif;
          font-size: 72px;
          font-weight: 900;
          color: rgba(237,228,212,0.06);
          line-height: 1;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
        }

        .reg-left-eyebrow {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(237,228,212,0.5);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .reg-left-eyebrow-line {
          display: inline-block;
          width: 20px; height: 1.5px;
          background: rgba(237,228,212,0.35);
          border-radius: 2px;
        }

        .reg-left-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(24px, 2.8vw, 32px);
          font-weight: 900;
          color: #fff;
          line-height: 1.15;
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }
        .reg-left-title span {
          background: linear-gradient(180deg, #EDE4D4 30%, rgba(237,228,212,0.55) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .reg-left-text {
          font-size: 13px;
          font-weight: 300;
          color: rgba(237,228,212,0.65);
          line-height: 1.75;
          margin-bottom: 0;
        }

        /* Process steps on left */
        .reg-left-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-top: 36px;
          position: relative;
          z-index: 1;
        }
        .reg-left-step {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          padding-bottom: 24px;
        }
        .reg-left-step:last-child { padding-bottom: 0; }
        .reg-left-step:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 14px;
          top: 32px;
          width: 1px;
          height: calc(100% - 12px);
          background: rgba(237,228,212,0.15);
        }
        .reg-left-step-dot {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(237,228,212,0.1);
          border: 1.5px solid rgba(237,228,212,0.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-family: 'Playfair Display', serif;
          font-size: 11px;
          font-weight: 700;
          color: rgba(237,228,212,0.5);
          transition: all 0.3s;
          position: relative;
          z-index: 1;
        }
        .reg-left-step.active .reg-left-step-dot {
          background: rgba(237,228,212,0.95);
          border-color: transparent;
          color: #2C3E50;
        }
        .reg-left-step.done .reg-left-step-dot {
          background: rgba(237,228,212,0.25);
          border-color: rgba(237,228,212,0.4);
          color: rgba(237,228,212,0.9);
        }
        .reg-left-step-label {
          font-size: 13px;
          font-weight: 400;
          color: rgba(237,228,212,0.4);
          transition: color 0.3s;
        }
        .reg-left-step.active .reg-left-step-label { color: rgba(237,228,212,0.95); font-weight: 500; }
        .reg-left-step.done  .reg-left-step-label  { color: rgba(237,228,212,0.6); }

        /* Approval note */
        .reg-approval-note {
          background: rgba(237,228,212,0.08);
          border: 1px solid rgba(237,228,212,0.15);
          border-radius: 10px;
          padding: 16px 18px;
          position: relative;
          z-index: 1;
        }
        .reg-approval-note-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(237,228,212,0.6);
          margin-bottom: 6px;
        }
        .reg-approval-note-text {
          font-size: 12px;
          font-weight: 300;
          color: rgba(237,228,212,0.45);
          line-height: 1.65;
          margin: 0;
        }

        /* ── Right panel ── */
        .reg-right {
          background: #ffffff;
          padding: 48px 44px;
          display: flex;
          flex-direction: column;
        }

        .reg-form-eyebrow {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #648DB6;
          margin-bottom: 8px;
        }
        .reg-form-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 900;
          color: #2C3E50;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .reg-form-sub {
          font-size: 13px;
          font-weight: 300;
          color: rgba(44,62,80,0.5);
          margin-bottom: 28px;
          line-height: 1.6;
        }

        /* Step progress bar */
        .reg-progress {
          display: flex;
          gap: 6px;
          margin-bottom: 28px;
        }
        .reg-progress-seg {
          flex: 1;
          height: 3px;
          border-radius: 3px;
          background: rgba(44,62,80,0.1);
          transition: background 0.4s;
        }
        .reg-progress-seg.filled {
          background: linear-gradient(90deg, #2C3E50, #648DB6);
        }

        /* ── Fields ── */
        .reg-field { margin-bottom: 16px; }
        .reg-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 500px) { .reg-row { grid-template-columns: 1fr; } }

        .reg-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(44,62,80,0.5);
          margin-bottom: 7px;
        }
        .reg-input-wrap { position: relative; }
        .reg-input,
        .reg-textarea {
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #2C3E50;
          background: #f8f6f2;
          border: 1.5px solid rgba(44,62,80,0.1);
          border-radius: 8px;
          padding: 11px 16px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          resize: none;
        }
        .reg-input::placeholder, .reg-textarea::placeholder { color: rgba(44,62,80,0.3); }
        .reg-input:focus, .reg-textarea:focus {
          border-color: #648DB6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(100,141,182,0.12);
        }
        .reg-input.error  { border-color: rgba(200,60,60,0.5); }
        .reg-input.has-toggle { padding-right: 44px; }
        .reg-textarea { min-height: 80px; }

        .reg-error-msg {
          font-size: 11px;
          color: rgba(180,40,40,0.8);
          margin-top: 4px;
        }

        .reg-toggle {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer;
          color: rgba(44,62,80,0.35);
          display: flex; align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }
        .reg-toggle:hover { color: #2C3E50; }

        /* ── Navigation buttons ── */
        .reg-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }
        .reg-btn-back {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: transparent;
          color: rgba(44,62,80,0.6);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 13px 20px;
          border-radius: 8px;
          border: 1.5px solid rgba(44,62,80,0.15);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .reg-btn-back:hover { border-color: #2C3E50; color: #2C3E50; }

        .reg-btn-next,
        .reg-btn-submit {
          flex: 2;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(180deg, #2C3E50 30.29%, #648DB6 87.5%);
          color: rgba(237,228,212,1);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 13px 24px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 6px 20px rgba(44,62,80,0.28);
        }
        .reg-btn-next:hover, .reg-btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(44,62,80,0.42);
        }
        .reg-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        /* Spinner */
        .reg-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(237,228,212,0.3);
          border-top-color: rgba(237,228,212,0.9);
          border-radius: 50%;
          animation: regspin 0.7s linear infinite;
        }
        @keyframes regspin { to { transform: rotate(360deg); } }

        /* Sign in link */
        .reg-signin-row {
          text-align: center;
          font-size: 13px;
          color: rgba(44,62,80,0.5);
          margin-top: 20px;
        }
        .reg-signin-link {
          font-weight: 600;
          color: #2C3E50;
          text-decoration: none;
          transition: color 0.2s;
        }
        .reg-signin-link:hover { color: #648DB6; text-decoration: none; }

        /* ── Review step ── */
        .reg-review-section { margin-bottom: 20px; }
        .reg-review-heading {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #648DB6;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(44,62,80,0.07);
        }
        .reg-review-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          margin-bottom: 7px;
        }
        .reg-review-key {
          color: rgba(44,62,80,0.45);
          font-weight: 400;
          flex-shrink: 0;
        }
        .reg-review-val {
          color: #2C3E50;
          font-weight: 500;
          text-align: right;
          word-break: break-word;
        }

        /* ── Success ── */
        .reg-success {
          text-align: center;
          padding: 32px 0 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .reg-success-icon {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: linear-gradient(180deg, #2C3E50 30.29%, #648DB6 87.5%);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .reg-success-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 900;
          color: #2C3E50;
          margin-bottom: 12px;
        }
        .reg-success-text {
          font-size: 14px;
          font-weight: 300;
          color: rgba(44,62,80,0.6);
          line-height: 1.75;
          max-width: 340px;
          margin: 0 auto 12px;
        }
        .reg-success-note {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(100,141,182,0.1);
          border: 1px solid rgba(100,141,182,0.2);
          border-radius: 40px;
          padding: 7px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #648DB6;
          margin-bottom: 28px;
        }
        .reg-success-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #648DB6;
          animation: regpulse 2s ease-in-out infinite;
        }
        @keyframes regpulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.7); }
        }
        .reg-success-login {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(180deg, #2C3E50 30.29%, #648DB6 87.5%);
          color: rgba(237,228,212,1);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          padding: 12px 28px;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 6px 20px rgba(44,62,80,0.28);
        }
        .reg-success-login:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(44,62,80,0.42);
          color: #fff; text-decoration: none;
        }
      `}</style>

      <div className="reg-page">
        <div className="reg-wrap">

          {/* ── Left branding panel ── */}
          <div className="reg-left">
            <div>
              <div className="reg-left-eyebrow">
                <span className="reg-left-eyebrow-line" />
                Hardware Shop Registration
              </div>
              <h2 className="reg-left-title">
                Join the<br />
                <span>iConstruct</span><br />
                Network.
              </h2>
              <p className="reg-left-text">
                Register your hardware shop and get discovered
                by contractors and builders who need your
                materials every day.
              </p>

              {/* Step tracker */}
              <div className="reg-left-steps">
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    className={`reg-left-step ${i === step ? "active" : i < step ? "done" : ""}`}
                  >
                    <div className="reg-left-step-dot">
                      {i < step ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                          strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : s.number}
                    </div>
                    <span className="reg-left-step-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval note */}
            <div className="reg-approval-note">
              <p className="reg-approval-note-title">Pending Approval</p>
              <p className="reg-approval-note-text">
                After submitting, your application will be reviewed
                by our admin team. You'll be able to log in once
                your shop is approved.
              </p>
            </div>
          </div>

          {/* ── Right form panel ── */}
          <div className="reg-right">
            {submitted ? (
              /* ── Success screen ── */
              <div className="reg-success">
                <div className="reg-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.95)"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="reg-success-title">Application Submitted!</h3>
                <p className="reg-success-text">
                  Thank you, <strong>{form.ownerName}</strong>. Your shop
                  <strong> "{form.shopName}"</strong> has been submitted for
                  review. We'll notify you once approved.
                </p>
                <div className="reg-success-note">
                  <span className="reg-success-dot" />
                  Awaiting admin approval
                </div>
                <Link to="/login" className="reg-success-login">
                  Go to Sign In
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="reg-progress">
                  {STEPS.map((_, i) => (
                    <div key={i} className={`reg-progress-seg ${i <= step ? "filled" : ""}`} />
                  ))}
                </div>

                <p className="reg-form-eyebrow">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</p>
                <h3 className="reg-form-title">
                  {step === 0 && "Create Your Account"}
                  {step === 1 && "Your Shop Details"}
                  {step === 2 && "Review & Submit"}
                </h3>
                <p className="reg-form-sub">
                  {step === 0 && "Set up your login credentials."}
                  {step === 1 && "Tell us about your hardware shop."}
                  {step === 2 && "Please review your information before submitting."}
                </p>

                {/* ── Step 0: Account ── */}
                {step === 0 && (
                  <div>
                    <div className="reg-field">
                      <label className="reg-label">Full Name</label>
                      <input className={`reg-input ${errors.ownerName ? "error" : ""}`}
                        type="text" name="ownerName" placeholder="Juan dela Cruz"
                        value={form.ownerName} onChange={handleChange} />
                      {errors.ownerName && <p className="reg-error-msg">{errors.ownerName}</p>}
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Email Address</label>
                      <input className={`reg-input ${errors.email ? "error" : ""}`}
                        type="email" name="email" placeholder="juan@email.com"
                        value={form.email} onChange={handleChange} />
                      {errors.email && <p className="reg-error-msg">{errors.email}</p>}
                    </div>

                    <div className="reg-row">
                      <div className="reg-field">
                        <label className="reg-label">Password</label>
                        <div className="reg-input-wrap">
                          <input className={`reg-input has-toggle ${errors.password ? "error" : ""}`}
                            type={showPass ? "text" : "password"} name="password"
                            placeholder="Min. 8 characters"
                            value={form.password} onChange={handleChange} />
                          <EyeBtn show={showPass} onToggle={() => setShowPass((v) => !v)} />
                        </div>
                        {errors.password && <p className="reg-error-msg">{errors.password}</p>}
                      </div>
                      <div className="reg-field">
                        <label className="reg-label">Confirm Password</label>
                        <div className="reg-input-wrap">
                          <input className={`reg-input has-toggle ${errors.confirmPassword ? "error" : ""}`}
                            type={showConf ? "text" : "password"} name="confirmPassword"
                            placeholder="Repeat password"
                            value={form.confirmPassword} onChange={handleChange} />
                          <EyeBtn show={showConf} onToggle={() => setShowConf((v) => !v)} />
                        </div>
                        {errors.confirmPassword && <p className="reg-error-msg">{errors.confirmPassword}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 1: Shop Info ── */}
                {step === 1 && (
                  <div>
                    <div className="reg-field">
                      <label className="reg-label">Hardware Shop Name</label>
                      <input className={`reg-input ${errors.shopName ? "error" : ""}`}
                        type="text" name="shopName" placeholder="e.g. dela Cruz Hardware"
                        value={form.shopName} onChange={handleChange} />
                      {errors.shopName && <p className="reg-error-msg">{errors.shopName}</p>}
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Contact Number</label>
                      <input className={`reg-input ${errors.phone ? "error" : ""}`}
                        type="tel" name="phone" placeholder="09XX XXX XXXX"
                        value={form.phone} onChange={handleChange} />
                      {errors.phone && <p className="reg-error-msg">{errors.phone}</p>}
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Shop Address</label>
                      <input className={`reg-input ${errors.address ? "error" : ""}`}
                        type="text" name="address" placeholder="Street / Barangay"
                        value={form.address} onChange={handleChange} />
                      {errors.address && <p className="reg-error-msg">{errors.address}</p>}
                    </div>

                    <div className="reg-row">
                      <div className="reg-field">
                        <label className="reg-label">City / Municipality</label>
                        <input className={`reg-input ${errors.city ? "error" : ""}`}
                          type="text" name="city" placeholder="e.g. Lipa City"
                          value={form.city} onChange={handleChange} />
                        {errors.city && <p className="reg-error-msg">{errors.city}</p>}
                      </div>
                      <div className="reg-field">
                        <label className="reg-label">Province</label>
                        <input className={`reg-input ${errors.province ? "error" : ""}`}
                          type="text" name="province" placeholder="e.g. Batangas"
                          value={form.province} onChange={handleChange} />
                        {errors.province && <p className="reg-error-msg">{errors.province}</p>}
                      </div>
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Shop Description <span style={{fontWeight:300,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                      <textarea className="reg-textarea" name="description"
                        placeholder="Briefly describe your shop and what materials you carry..."
                        value={form.description} onChange={handleChange} />
                    </div>
                  </div>
                )}

                {/* ── Step 2: Review ── */}
                {step === 2 && (
                  <form onSubmit={handleSubmit}>
                    <div className="reg-review-section">
                      <p className="reg-review-heading">Account Information</p>
                      {[
                        ["Full Name",      form.ownerName],
                        ["Email Address",  form.email],
                        ["Password",       "••••••••"],
                      ].map(([k, v]) => (
                        <div className="reg-review-row" key={k}>
                          <span className="reg-review-key">{k}</span>
                          <span className="reg-review-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="reg-review-section">
                      <p className="reg-review-heading">Shop Information</p>
                      {[
                        ["Shop Name",    form.shopName],
                        ["Phone",        form.phone],
                        ["Address",      form.address],
                        ["City",         form.city],
                        ["Province",     form.province],
                        form.description && ["Description", form.description],
                      ].filter(Boolean).map(([k, v]) => (
                        <div className="reg-review-row" key={k}>
                          <span className="reg-review-key">{k}</span>
                          <span className="reg-review-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="reg-actions">
                      <button type="button" className="reg-btn-back" onClick={back}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Back
                      </button>
                      <button className="reg-btn-submit" type="submit" disabled={loading}>
                        {loading ? (
                          <><span className="reg-spinner" /> Submitting...</>
                        ) : (
                          <>Submit Application
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <line x1="22" y1="2" x2="11" y2="13"/>
                              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Next / Back nav (steps 0 & 1) */}
                {step < 2 && (
                  <div className="reg-actions" style={{ marginTop: 16 }}>
                    {step > 0 && (
                      <button type="button" className="reg-btn-back" onClick={back}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Back
                      </button>
                    )}
                    <button type="button" className="reg-btn-next" onClick={next}>
                      Continue
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  </div>
                )}

                <p className="reg-signin-row">
                  Already have an account?{" "}
                  <Link to="/login" className="reg-signin-link">Sign in →</Link>
                </p>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
