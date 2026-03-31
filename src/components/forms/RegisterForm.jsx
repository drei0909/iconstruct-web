// src/components/forms/RegisterForm.jsx
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { sendOTP, verifyOTP, registerShop } from "../../controllers/authController";

const STEPS = [
  { number: "01", label: "Account"     },
  { number: "02", label: "Verify Email" },
  { number: "03", label: "Shop Info"   },
  { number: "04", label: "Review"      },
];

const initialForm = {
  ownerName: "", email: "", password: "", confirmPassword: "",
  shopName: "", phone: "", address: "", city: "", province: "",
  description: "", documentURL: "", documentName: "",
};

const EyeBtn = ({ show, onToggle }) => (
  <button type="button" className="reg-toggle" onClick={onToggle} aria-label={show ? "Hide" : "Show"}>
    {show ? (
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
);

export default function RegisterForm() {
  const [step, setStep]           = useState(0);
  const [form, setForm]           = useState(initialForm);
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors]       = useState({});
  const [firebaseError, setFirebaseError] = useState("");

  // OTP state
  const [otpSent, setOtpSent]     = useState(false);
  const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError]   = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  // File upload state
  const fileRef = useRef(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError]   = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Step 0 validation ──
  const validateStep0 = () => {
    const e = {};
    if (!form.ownerName.trim())                    e.ownerName       = "Full name is required.";
    if (!form.email.trim())                        e.email           = "Email is required.";
    if (!/\S+@\S+\.\S+/.test(form.email))         e.email           = "Enter a valid email address.";
    if (form.password.length < 8)                 e.password        = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)   e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 2 validation ──
  const validateStep2 = () => {
    const e = {};
    if (!form.shopName.trim()) e.shopName = "Shop name is required.";
    if (!form.phone.trim())    e.phone    = "Phone number is required.";
    if (!form.address.trim())  e.address  = "Address is required.";
    if (!form.city.trim())     e.city     = "City is required.";
    if (!form.province.trim()) e.province = "Province is required.";
    if (!form.documentURL)     e.document = "Please upload a valid business document or photo.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Send OTP ──
  const handleSendOTP = async () => {
    if (!validateStep0()) return;
    setLoading(true);
    setFirebaseError("");
    try {
      await sendOTP(form.email, form.ownerName);
      setOtpSent(true);
      setStep(1);
      // Start 60s resend timer
      setResendTimer(60);
      const interval = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) { clearInterval(interval); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (err) {
      setFirebaseError("Failed to send OTP. Please check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    // Auto-advance
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || "";
    setOtp(newOtp);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Verify OTP ──
  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter the complete 6-digit code."); return; }
    setLoading(true);
    setOtpError("");
    try {
      await verifyOTP(form.email, code);
      setStep(2); // go to shop info
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await sendOTP(form.email, form.ownerName);
      setOtp(["", "", "", "", "", ""]);
      setOtpError("");
      setResendTimer(60);
      const interval = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) { clearInterval(interval); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch {
      setOtpError("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── File upload ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileError("");

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setFileError("Only JPG, PNG, or PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File must be under 5MB.");
      return;
    }

    // Convert to base64 (store as dataURL for now — replace with Cloudinary/Storage upload later)
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview(file.type.startsWith("image/") ? ev.target.result : null);
      setForm((prev) => ({
        ...prev,
        documentURL:  ev.target.result,
        documentName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFilePreview(null);
    setFileError("");
    setForm((prev) => ({ ...prev, documentURL: "", documentName: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Step navigation ──
  const goNext = () => {
    if (step === 2 && !validateStep2()) return;
    setErrors({});
    setStep((s) => s + 1);
  };

  const back = () => {
    setErrors({});
    setFirebaseError("");
    setOtpError("");
    setStep((s) => s - 1);
  };

  // ── Final submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFirebaseError("");
    try {
      await registerShop(form);
      setSubmitted(true);
    } catch (err) {
      const msg = {
        "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
        "auth/invalid-email":        "The email address is not valid.",
        "auth/weak-password":        "Password is too weak. Use at least 8 characters.",
      };
      setFirebaseError(msg[err.code] || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    

      <div className="reg-page">
        <div className="reg-wrap">

          {/* ── Left panel ── */}
          <div className="reg-left">
            <div>
              <div className="reg-left-eyebrow">
                <span className="reg-left-eyebrow-line" />
                Hardware Shop Registration
              </div>
              <h2 className="reg-left-title">
                Join the<br /><span>iConstruct</span><br />Network.
              </h2>
              <p className="reg-left-text">
                Register your hardware shop and get discovered by contractors
                and builders who need your materials every day.
              </p>
              <div className="reg-left-steps">
                {STEPS.map((s, i) => (
                  <div key={i} className={`reg-left-step ${i === step ? "active" : i < step ? "done" : ""}`}>
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
            <div className="reg-approval-note">
              <p className="reg-approval-note-title">Pending Approval</p>
              <p className="reg-approval-note-text">
                After submitting, your application and uploaded documents will
                be reviewed by our admin team. You'll receive confirmation once approved.
              </p>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="reg-right">
            {submitted ? (
              <div className="reg-success">
                <div className="reg-success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.95)"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="reg-success-title">Application Submitted!</h3>
                <p className="reg-success-text">
                  Thank you, <strong>{form.ownerName}</strong>. Your shop{" "}
                  <strong>"{form.shopName}"</strong> has been submitted for review.
                  We'll notify you once approved.
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

                <p className="reg-form-eyebrow">
                  Step {step + 1} of {STEPS.length} — {STEPS[step].label}
                </p>
                <h3 className="reg-form-title">
                  {["Create Your Account", "Verify Your Email", "Your Shop Details", "Review & Submit"][step]}
                </h3>
                <p className="reg-form-sub">
                  {[
                    "Set up your login credentials.",
                    `We sent a 6-digit code to ${form.email || "your email"}. Enter it below.`,
                    "Tell us about your hardware shop and upload proof of legitimacy.",
                    "Please review everything before submitting.",
                  ][step]}
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
                            placeholder="Min. 8 characters" value={form.password} onChange={handleChange} />
                          <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
                        </div>
                        {errors.password && <p className="reg-error-msg">{errors.password}</p>}
                      </div>
                      <div className="reg-field">
                        <label className="reg-label">Confirm Password</label>
                        <div className="reg-input-wrap">
                          <input className={`reg-input has-toggle ${errors.confirmPassword ? "error" : ""}`}
                            type={showConf ? "text" : "password"} name="confirmPassword"
                            placeholder="Repeat password" value={form.confirmPassword} onChange={handleChange} />
                          <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
                        </div>
                        {errors.confirmPassword && <p className="reg-error-msg">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    {firebaseError && (
                      <div style={{ background:"rgba(180,40,40,0.07)", border:"1px solid rgba(180,40,40,0.2)",
                        borderRadius:"8px", padding:"12px 16px", marginBottom:"16px",
                        fontSize:"13px", color:"rgba(160,30,30,0.9)", lineHeight:1.5 }}>
                        {firebaseError}
                      </div>
                    )}

                    <div className="reg-actions" style={{ marginTop: 16 }}>
                      <button type="button" className="reg-btn-next"
                        onClick={handleSendOTP} disabled={loading}>
                        {loading ? <><span className="reg-spinner" /> Sending OTP...</> : <>
                          Continue — Send OTP
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </>}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 1: OTP Verify ── */}
                {step === 1 && (
                  <div>
                    <div className="otp-info-box">
                      <p className="otp-info-email">📧 {form.email}</p>
                      <p className="otp-info-sub">
                        A 6-digit verification code has been sent to your email.
                        Check your inbox (and spam folder). The code expires in 10 minutes.
                      </p>
                    </div>

                    <div className="otp-row" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => (otpRefs.current[i] = el)}
                          className={`otp-input ${digit ? "filled" : ""} ${otpError ? "error-state" : ""}`}
                          type="text" inputMode="numeric" maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        />
                      ))}
                    </div>

                    {otpError && <p className="otp-error">{otpError}</p>}

                    <button className="otp-verify-btn" onClick={handleVerifyOTP} disabled={loading}>
                      {loading ? <><span className="reg-spinner" /> Verifying...</> : <>
                        Verify Code
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </>}
                    </button>

                    <div className="otp-resend-row">
                      {resendTimer > 0
                        ? `Resend code in ${resendTimer}s`
                        : <>Didn't receive it?{" "}
                            <button className="otp-resend-btn" onClick={handleResend} disabled={loading}>
                              Resend OTP
                            </button>
                          </>
                      }
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <button type="button" className="reg-btn-back" onClick={back}
                        style={{ width: "100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Change Email
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Shop Info + Document Upload ── */}
                {step === 2 && (
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
                      <label className="reg-label">
                        Shop Description{" "}
                        <span style={{ fontWeight:300, textTransform:"none", letterSpacing:0 }}>(optional)</span>
                      </label>
                      <textarea className="reg-textarea" name="description"
                        placeholder="Briefly describe your shop and what materials you carry..."
                        value={form.description} onChange={handleChange} />
                    </div>

                    {/* Document upload */}
                    <div className="reg-field">
                      <label className="reg-label">
                        Business Document / Shop Photo
                        <span style={{ fontWeight:300, textTransform:"none", letterSpacing:0, marginLeft:6 }}>
                          (required)
                        </span>
                      </label>

                      {form.documentURL ? (
                        <div className="upload-preview">
                          {filePreview ? (
                            <img src={filePreview} alt="preview" />
                          ) : (
                            <div className="upload-preview-file">
                              <div className="upload-preview-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.9)"
                                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                              </div>
                              <span className="upload-preview-name">{form.documentName}</span>
                            </div>
                          )}
                          <button className="upload-remove" onClick={removeFile} type="button">×</button>
                        </div>
                      ) : (
                        <div className="upload-zone">
                          <input
                            ref={fileRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange}
                          />
                          <div className="upload-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#648DB6"
                              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                              <polyline points="16 16 12 12 8 16"/>
                              <line x1="12" y1="12" x2="12" y2="21"/>
                              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                            </svg>
                          </div>
                          <p className="upload-title">Upload Business Document or Shop Photo</p>
                          <p className="upload-sub">
                            DTI Certificate, Business Permit, Mayor's Permit, or a clear photo of your shop.
                            <br />Click to browse or drag and drop.
                          </p>
                          <div className="upload-types">
                            {["JPG", "PNG", "PDF", "Max 5MB"].map(t => (
                              <span className="upload-type-pill" key={t}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {fileError && <p className="reg-error-msg">{fileError}</p>}
                      {errors.document && !form.documentURL && <p className="reg-error-msg">{errors.document}</p>}
                    </div>

                    <div className="reg-actions" style={{ marginTop: 16 }}>
                      <button type="button" className="reg-btn-back" onClick={back}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Back
                      </button>
                      <button type="button" className="reg-btn-next" onClick={goNext}>
                        Continue
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Review ── */}
                {step === 3 && (
                  <form onSubmit={handleSubmit}>
                    <div className="reg-review-section">
                      <p className="reg-review-heading">Account Information</p>
                      {[
                        ["Full Name",     form.ownerName],
                        ["Email Address", form.email],
                        ["Email Verified","✓ Verified"],
                        ["Password",      "••••••••"],
                      ].map(([k, v]) => (
                        <div className="reg-review-row" key={k}>
                          <span className="reg-review-key">{k}</span>
                          <span className="reg-review-val" style={k==="Email Verified"?{color:"#2e7d32"}:{}}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="reg-review-section">
                      <p className="reg-review-heading">Shop Information</p>
                      {[
                        ["Shop Name", form.shopName], ["Phone", form.phone],
                        ["Address",   form.address],  ["City",  form.city],
                        ["Province",  form.province],
                        form.description && ["Description", form.description],
                      ].filter(Boolean).map(([k, v]) => (
                        <div className="reg-review-row" key={k}>
                          <span className="reg-review-key">{k}</span>
                          <span className="reg-review-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="reg-review-section">
                      <p className="reg-review-heading">Document</p>
                      <div className="reg-review-row">
                        <span className="reg-review-key">File</span>
                        <span className="reg-review-val">{form.documentName || "—"}</span>
                      </div>
                    </div>

                    {firebaseError && (
                      <div style={{ background:"rgba(180,40,40,0.07)", border:"1px solid rgba(180,40,40,0.2)",
                        borderRadius:"8px", padding:"12px 16px", marginBottom:"16px",
                        fontSize:"13px", color:"rgba(160,30,30,0.9)", lineHeight:1.5 }}>
                        {firebaseError}
                      </div>
                    )}

                    <div className="reg-actions">
                      <button type="button" className="reg-btn-back" onClick={back}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Back
                      </button>
                      <button className="reg-btn-submit" type="submit" disabled={loading}>
                        {loading
                          ? <><span className="reg-spinner" /> Submitting...</>
                          : <>Submit Application
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                            </>
                        }
                      </button>
                    </div>
                  </form>
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
