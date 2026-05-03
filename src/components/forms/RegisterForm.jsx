// src/components/forms/RegisterForm.jsx
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { sendOTP, verifyOTP, registerShop } from "../../controllers/authController";
import TermsModal from "../forms/TermsModal";

// ── Constants ──────────────────────────────────────────────
const STEPS = [
  { number: "01", label: "Account"      },
  { number: "02", label: "Verify Email" },
  { number: "03", label: "Shop Info"    },
  { number: "04", label: "Documents"    },
  { number: "05", label: "Review"       },
];

// UPDATED: All barangays of Lipa City, Batangas
const LIPA_BARANGAYS = [
  "Adya", "Anilao-Labac", "Antipolo Del Norte", "Antipolo Del Sur",
  "Bagong Pook", "Balintawak", "Banaybanay", "Barangay I (Poblacion)",
  "Barangay II (Poblacion)", "Barangay III (Poblacion)", "Barangay IV (Poblacion)",
  "Barangay V (Poblacion)", "Barangay VI (Poblacion)", "Barangay VII (Poblacion)",
  "Barangay VIII (Poblacion)", "Barangay IX (Poblacion)", "Barangay X (Poblacion)",
  "Barangay XI (Poblacion)", "Bolbok", "Bugtong Na Pulo", "Bulacnin",
  "Bulaklak", "Calamias", "Cumba", "Dagatan", "Duhatan", "Halang",
  "Inosluban", "Kayumanggi", "Latag", "Lodlod", "Lumbang", "Mabini",
  "Malagonlong", "Malitlit", "Marauoy", "Mataas Na Lupa", "Munting Pulo",
  "Pagolingin Bata", "Pagolingin East", "Pagolingin West", "Pangao",
  "Pinagkawitan", "Pinagtongulan", "Plaridel", "Prinza", "Progreso",
  "Pusil", "Quezon", "Rizal", "Sabang", "Sampaguita", "San Benito",
  "San Carlos", "San Celestino", "San Francisco", "San Guillermo",
  "San Jose", "San Lucas", "San Miguel", "San Patricio", "San Pedro",
  "San Salvador", "San Sebastian", "Santo Niño", "Santo Tomas",
  "Sapac", "Sico", "Talisay", "Tambo", "Tangob", "Tanguay",
  "Tibig", "Tipacan", "Zacarias",
];

// UPDATED: Document types now include Valid ID and Selfie
const DOCUMENT_TYPES = [
  { value: "dti",      label: "DTI Certificate"            },
  { value: "business", label: "Business Permit"            },
  { value: "mayors",   label: "Mayor's Permit"             },
  { value: "bir",      label: "BIR Certificate"            },
  { value: "shop",     label: "Shop Exterior Photo"        },
  { value: "validId",  label: "Valid Government ID"        },
  { value: "selfie",   label: "Selfie with Valid ID"       },
  { value: "other",    label: "Other Supporting Document"  },
];

const initialForm = {
  ownerName: "", email: "", password: "", confirmPassword: "",
  shopName: "", phone: "", address: "",
  city: "Lipa City",       // locked
  province: "Batangas",    // locked
  barangay: "",
  description: "", documents: [],
};

// ── Small helpers ───────────────────────────────────────────
const EyeBtn = ({ show, onToggle }) => (
  <button type="button" className="reg-toggle" onClick={onToggle}>
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

const FieldError = ({ msg }) => msg
  ? <p className="reg-error-msg"> {msg}</p>
  : null;

// ── Main component ──────────────────────────────────────────
export default function RegisterForm() {
  const [step, setStep]           = useState(0);
  const [form, setForm]           = useState(initialForm);
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors]       = useState({});
  const [globalError, setGlobalError] = useState("");

  // OTP
  const [otp, setOtp]             = useState(["","","","","",""]);
  const [otpError, setOtpError]   = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  // Terms modal
  const [termsOpen,    setTermsOpen]    = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Documents
  const [previewModal, setPreviewModal] = useState(null);
  const fileRef = useRef(null);

  // ── Field change ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: "" }));
  };

  // ── Validations ──
  const validateStep0 = () => {
    const e = {};
    if (!form.ownerName.trim())
      e.ownerName = "Full name is required.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(form.password))
      e.password = "Include at least one uppercase letter.";
    if (!/[0-9]/.test(form.password))
      e.password = "Include at least one number.";
    if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.shopName.trim())
      e.shopName = "Shop name is required.";
    if (!form.phone.trim())
      e.phone = "Phone number is required.";
    else if (!/^(09|\+639)\d{9}$/.test(form.phone.replace(/\s/g, "")))
      e.phone = "Enter a valid PH number (e.g. 09171234567).";
    if (!form.address.trim())
      e.address = "Street / house address is required.";
    if (!form.barangay)
      e.barangay = "Please select your barangay.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // UPDATED: Validates all 4 required document types
  const validateStep3 = () => {
    const e = {};
    const hasBusinessDoc = form.documents.some(d =>
      ["dti", "business", "mayors", "bir"].includes(d.docType)
    );
    const hasShopPhoto = form.documents.some(d => d.docType === "shop");
    const hasValidId   = form.documents.some(d => d.docType === "validId");
    const hasSelfie    = form.documents.some(d => d.docType === "selfie");

    if (!hasBusinessDoc)
      e.documents = "Upload at least 1 official business document (DTI, Business Permit, Mayor's Permit, or BIR).";
    else if (!hasShopPhoto)
      e.documents = "Upload at least 1 photo of your shop exterior.";
    else if (!hasValidId)
      e.documents = "Upload a clear photo of your Valid Government ID.";
    else if (!hasSelfie)
      e.documents = "Upload a selfie photo of yourself holding your Valid ID.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── OTP flow ──
  const startResendTimer = () => {
    setResendTimer(60);
    const t = setInterval(() => {
      setResendTimer(v => { if (v <= 1) { clearInterval(t); return 0; } return v - 1; });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!validateStep0()) return;
    setLoading(true); setGlobalError("");
    try {
      await sendOTP(form.email, form.ownerName);
      setStep(1);
      startResendTimer();
    } catch {
      setGlobalError("Failed to send OTP. Please check your email and try again.");
    } finally { setLoading(false); }
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
    setOtpError("");
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    const n = [...otp];
    for (let i = 0; i < 6; i++) n[i] = p[i] || "";
    setOtp(n);
    otpRefs.current[Math.min(p.length, 5)]?.focus();
  };

  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Enter the complete 6-digit code."); return; }
    setLoading(true); setOtpError("");
    try {
      await verifyOTP(form.email, code);
      setStep(2);
    } catch (err) { setOtpError(err.message); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await sendOTP(form.email, form.ownerName);
      setOtp(["","","","","",""]);
      setOtpError("");
      startResendTimer();
    } catch { setOtpError("Failed to resend. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Document upload ──
  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const valid = ["image/jpeg","image/png","image/jpg","application/pdf"];
    const maxMB = 5 * 1024 * 1024;

    for (const file of files) {
      if (!valid.includes(file.type)) {
        setErrors(p => ({ ...p, documents: `${file.name}: Only JPG, PNG, PDF allowed.` }));
        continue;
      }
      if (file.size > maxMB) {
        setErrors(p => ({ ...p, documents: `${file.name}: Must be under 5MB.` }));
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm(p => ({
          ...p,
          documents: [...p.documents, {
            url:     ev.target.result,
            name:    file.name,
            type:    file.type,
            docType: "other",
            size:    file.size,
          }],
        }));
      };
      reader.readAsDataURL(file);
    }
    if (fileRef.current) fileRef.current.value = "";
    setErrors(p => ({ ...p, documents: "" }));
  };

  const handleRemoveDoc = (i) => {
    setForm(p => ({ ...p, documents: p.documents.filter((_, idx) => idx !== i) }));
  };

  const handleDocTypeChange = (i, val) => {
    setForm(p => {
      const docs = [...p.documents];
      docs[i] = { ...docs[i], docType: val };
      return { ...p, documents: docs };
    });
  };

  // ── Navigation ──
  const goNext = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setErrors({});
    setStep(s => s + 1);
  };

  const goBack = () => {
    setErrors({}); setGlobalError(""); setOtpError("");
    setStep(s => s - 1);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!termsAccepted) {
    setGlobalError("You must accept the Terms and Conditions to proceed.");
    return;
  }
  setLoading(true); setGlobalError("");
  try {
    await registerShop(form);
    setSubmitted(true);
  } catch (err) {
    const msg = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email":        "The email address is not valid.",
      "auth/weak-password":        "Password is too weak.",
    };
    setGlobalError(msg[err.code] || "Something went wrong. Please try again.");
  } finally { setLoading(false); }
  };

  // ── Password strength ──
  const pwStrength = () => {
    const p = form.password;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8)          score++;
    if (/[A-Z]/.test(p))        score++;
    if (/[0-9]/.test(p))        score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const map = [
      null,
      { label: "Weak",   color: "#EF4444", width: "25%" },
      { label: "Fair",   color: "#F59E0B", width: "50%" },
      { label: "Good",   color: "#3B82F6", width: "75%" },
      { label: "Strong", color: "#10B981", width: "100%" },
    ];
    return map[score];
  };

  const strength = pwStrength();

  // ── Document status chips helper ──
  const docStatus = [
    {
      ok: form.documents.some(d => ["dti","business","mayors","bir"].includes(d.docType)),
      label: "Business Doc",
      
    },
    {
      ok: form.documents.some(d => d.docType === "shop"),
      label: "Shop Photo",
      
    },
    {
      ok: form.documents.some(d => d.docType === "validId"),
      label: "Valid ID",
      
    },
    {
      ok: form.documents.some(d => d.docType === "selfie"),
      label: "ID Selfie",
      
    },
  ];

  // ─────────────────────────────────────────────────────────
  return (
    <>

     <TermsModal
      open={termsOpen}
      onAccept={() => { setTermsAccepted(true); setTermsOpen(false); }}
      onDecline={() => setTermsOpen(false)}
    />
      {/* Document preview modal */}
      {previewModal && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1000,
            display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => setPreviewModal(null)}
        >
          <div style={{ position:"relative", maxWidth:780, width:"100%", maxHeight:"90vh" }}
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModal(null)}
              style={{ position:"absolute", top:-14, right:-14, width:34, height:34,
                borderRadius:"50%", background:"#fff", border:"none", fontSize:20,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 2px 12px rgba(0,0,0,0.3)", zIndex:1, lineHeight:1 }}>
            </button>
            {previewModal.type?.startsWith("image") ? (
              <img src={previewModal.url} alt={previewModal.name}
                style={{ width:"100%", maxHeight:"85vh", objectFit:"contain", borderRadius:14,
                  display:"block", background:"#111" }} />
            ) : (
              <div style={{ background:"#fff", borderRadius:14, padding:40, textAlign:"center" }}>
                <div style={{ fontSize:56, marginBottom:16 }}></div>
                <div style={{ fontSize:15, fontWeight:600, color:"#0F172A" }}>{previewModal.name}</div>
                <p style={{ fontSize:13, color:"#64748B", marginTop:8 }}>PDF preview not available. File is uploaded.</p>
              </div>
            )}
          </div>
        </div>
      )}


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
                Register your hardware shop in Lipa City and get discovered by
                contractors and builders who need your materials every day.
              </p>
              <div className="reg-left-steps">
                {STEPS.map((s, i) => (
                  <div key={i} className={`reg-left-step ${i === step ? "active" : i < step ? "done" : ""}`}>
                    <div className="reg-left-step-dot">
                      {i < step ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
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
              <p className="reg-approval-note-title">🛡 Document Verification</p>
              <p className="reg-approval-note-text">
                Our admin team manually reviews all submitted documents. You'll need a business
                document, shop photo, valid ID, and a selfie with your ID.
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
                  We'll notify you via email once approved.
                </p>
                <div className="reg-success-note">
                  <span className="reg-success-dot" />
                  Awaiting admin verification
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
                  {["Create Your Account","Verify Your Email","Shop Details","Upload Documents","Review & Submit"][step]}
                </h3>
                <p className="reg-form-sub">
                  {[
                    "Set up your login credentials.",
                    `We sent a 6-digit code to ${form.email}. Enter it below.`,
                    "Tell us about your hardware shop in Lipa City.",
                    "Upload all 4 required documents for verification.",
                    "Review everything before submitting your application.",
                  ][step]}
                </p>

                {/* ══ STEP 0: Account ══ */}
                {step === 0 && (
                  <div>
                    <div className="reg-field">
                      <label className="reg-label">Full Name</label>
                      <input className={`reg-input ${errors.ownerName ? "error" : ""}`}
                        type="text" name="ownerName" placeholder="Juan dela Cruz"
                        value={form.ownerName} onChange={handleChange} />
                      <FieldError msg={errors.ownerName} />
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Email Address</label>
                      <input className={`reg-input ${errors.email ? "error" : ""}`}
                        type="email" name="email" placeholder="juan@email.com"
                        value={form.email} onChange={handleChange} />
                      <FieldError msg={errors.email} />
                    </div>

                    <div className="reg-row">
                      <div className="reg-field">
                        <label className="reg-label">Password</label>
                        <div className="reg-input-wrap">
                          <input className={`reg-input has-toggle ${errors.password ? "error" : ""}`}
                            type={showPass ? "text" : "password"} name="password"
                            placeholder="Min. 8 characters"
                            value={form.password} onChange={handleChange} />
                          <EyeBtn show={showPass} onToggle={() => setShowPass(v => !v)} />
                        </div>
                        {strength && (
                          <div style={{ marginTop:6 }}>
                            <div style={{ height:4, background:"#E2E8F0", borderRadius:4, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:strength.width,
                                background:strength.color, borderRadius:4,
                                transition:"width 0.3s, background 0.3s" }} />
                            </div>
                            <p style={{ fontSize:10, marginTop:3, color:strength.color, fontWeight:600 }}>
                              {strength.label} password
                            </p>
                          </div>
                        )}
                        <FieldError msg={errors.password} />
                      </div>

                      <div className="reg-field">
                        <label className="reg-label">Confirm Password</label>
                        <div className="reg-input-wrap">
                          <input className={`reg-input has-toggle ${errors.confirmPassword ? "error" : ""}`}
                            type={showConf ? "text" : "password"} name="confirmPassword"
                            placeholder="Repeat password"
                            value={form.confirmPassword} onChange={handleChange} />
                          <EyeBtn show={showConf} onToggle={() => setShowConf(v => !v)} />
                        </div>
                        <FieldError msg={errors.confirmPassword} />
                      </div>
                    </div>

                    {globalError && <div className="reg-global-error">{globalError}</div>}

                    <div className="reg-actions" style={{ marginTop:16 }}>
                      <button type="button" className="reg-btn-next"
                        onClick={handleSendOTP} disabled={loading}>
                        {loading ? <><span className="reg-spinner" /> Sending OTP...</> :
                          <>Continue — Verify Email <span style={{fontSize:16}}>→</span></>}
                      </button>
                    </div>
                  </div>
                )}

                {/* ══ STEP 1: OTP ══ */}
                {step === 1 && (
                  <div>
                    <div className="otp-info-box">
                      <p className="otp-info-email"> {form.email}</p>
                      <p className="otp-info-sub">
                        Check your inbox and spam folder. The code expires in 10 minutes.
                      </p>
                    </div>

                    <div className="otp-row" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input key={i}
                          ref={el => (otpRefs.current[i] = el)}
                          className={`otp-input ${digit ? "filled" : ""} ${otpError ? "error-state" : ""}`}
                          type="text" inputMode="numeric" maxLength={1}
                          value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)} />
                      ))}
                    </div>

                    {otpError && <p className="otp-error">{otpError}</p>}

                    <button className="otp-verify-btn" onClick={handleVerifyOTP} disabled={loading}>
                      {loading ? <><span className="reg-spinner" /> Verifying...</> : "Verify Code ✓"}
                    </button>

                    <div className="otp-resend-row">
                      {resendTimer > 0
                        ? `Resend available in ${resendTimer}s`
                        : <>Didn't receive it?{" "}
                            <button className="otp-resend-btn" onClick={handleResend} disabled={loading}>
                              Resend OTP
                            </button>
                          </>}
                    </div>

                    <button type="button" className="reg-btn-back"
                      style={{ width:"100%", marginTop:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
                      onClick={goBack}>
                      ← Change Email
                    </button>
                  </div>
                )}

                {/* ══ STEP 2: Shop Info ══ */}
                {step === 2 && (
                  <div>
                    <div className="reg-field">
                      <label className="reg-label">Hardware Shop Name</label>
                      <input className={`reg-input ${errors.shopName ? "error" : ""}`}
                        type="text" name="shopName" placeholder="e.g. dela Cruz Hardware"
                        value={form.shopName} onChange={handleChange} />
                      <FieldError msg={errors.shopName} />
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Contact Number</label>
                      <div style={{ position:"relative" }}>
                        <span style={{ position:"absolute", left:12, top:"50%",
                          transform:"translateY(-50%)", fontSize:12, color:"#64748B",
                          fontWeight:600, pointerEvents:"none" }}>🇵🇭</span>
                        <input className={`reg-input ${errors.phone ? "error" : ""}`}
                          style={{ paddingLeft:36 }}
                          type="tel" name="phone" placeholder="09171234567"
                          value={form.phone} onChange={handleChange} />
                      </div>
                      <p style={{ fontSize:10.5, color:"#94A3B8", marginTop:4 }}>
                        Format: 09XXXXXXXXX or +639XXXXXXXXX
                      </p>
                      <FieldError msg={errors.phone} />
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">Street / House No. Address</label>
                      <input className={`reg-input ${errors.address ? "error" : ""}`}
                        type="text" name="address" placeholder="e.g. 123 Rizal St., Block 4 Lot 2"
                        value={form.address} onChange={handleChange} />
                      <FieldError msg={errors.address} />
                    </div>

                    {/* Barangay selector — Lipa City barangays only */}
                    <div className="reg-field">
                      <label className="reg-label">Barangay</label>
                      <select className={`reg-input ${errors.barangay ? "error" : ""}`}
                        name="barangay" value={form.barangay} onChange={handleChange}
                        style={{ cursor:"pointer" }}>
                        <option value="">Select barangay...</option>
                        {LIPA_BARANGAYS.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <FieldError msg={errors.barangay} />
                    </div>

                    {/* City & Province — locked, read-only */}
                    <div className="reg-row">
                      <div className="reg-field">
                        <label className="reg-label">City</label>
                        <div style={{ position:"relative" }}>
                          <input
                            className="reg-input"
                            type="text"
                            value="Lipa City"
                            readOnly
                            style={{ background:"#F1F5F9", color:"#64748B", cursor:"not-allowed" }}
                          />
                          <span style={{
                            position:"absolute", right:12, top:"50%",
                            transform:"translateY(-50%)", fontSize:10,
                            background:"#E2E8F0", color:"#94A3B8",
                            borderRadius:4, padding:"2px 6px", fontWeight:600, letterSpacing:"0.06em"
                          }}>LOCKED</span>
                        </div>
                        <p style={{ fontSize:10.5, color:"#94A3B8", marginTop:4 }}>
                          iConstruct currently serves Lipa City only.
                        </p>
                      </div>
                      <div className="reg-field">
                        <label className="reg-label">Province</label>
                        <div style={{ position:"relative" }}>
                          <input
                            className="reg-input"
                            type="text"
                            value="Batangas"
                            readOnly
                            style={{ background:"#F1F5F9", color:"#64748B", cursor:"not-allowed" }}
                          />
                          <span style={{
                            position:"absolute", right:12, top:"50%",
                            transform:"translateY(-50%)", fontSize:10,
                            background:"#E2E8F0", color:"#94A3B8",
                            borderRadius:4, padding:"2px 6px", fontWeight:600, letterSpacing:"0.06em"
                          }}>LOCKED</span>
                        </div>
                      </div>
                    </div>

                    <div className="reg-field">
                      <label className="reg-label">
                        Shop Description
                        <span style={{ fontWeight:300, fontSize:11, marginLeft:6, textTransform:"none", letterSpacing:0 }}>
                          (optional)
                        </span>
                      </label>
                      <textarea className="reg-textarea" name="description"
                        placeholder="Briefly describe your shop and what materials you carry..."
                        value={form.description} onChange={handleChange} />
                      <p style={{ fontSize:10.5, color:"#94A3B8", marginTop:4 }}>
                        {form.description.length}/300 characters
                      </p>
                    </div>

                    <div className="reg-actions" style={{ marginTop:16 }}>
                      <button type="button" className="reg-btn-back" onClick={goBack}>← Back</button>
                      <button type="button" className="reg-btn-next" onClick={goNext}>
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {/* ══ STEP 3: Documents ══ */}
                {step === 3 && (
                  <div>
                    {/* Requirement info box — all 4 required */}
                    <div style={{ background:"#F0F9FF", border:"1px solid #BAE6FD",
                      borderRadius:10, padding:"14px 16px", marginBottom:18, fontSize:12.5 }}>
                      <div style={{ fontWeight:700, color:"#0369A1", marginBottom:8, fontSize:13 }}>
                         4 Documents Required
                      </div>
                      <div style={{ color:"#0C4A6E", lineHeight:2 }}>
                        <span style={{ display:"block" }}>
                           <strong>1 Business Document</strong> — DTI, Business Permit, Mayor's Permit, or BIR
                        </span>
                        <span style={{ display:"block" }}>
                           <strong>1 Shop Exterior Photo</strong> — Clear photo of your shop front
                        </span>
                        <span style={{ display:"block" }}>
                           <strong>1 Valid Government ID</strong> — Any government-issued ID
                        </span>
                        <span style={{ display:"block" }}>
                           <strong>1 Selfie with Valid ID</strong> — Photo of you holding your ID
                        </span>
                      </div>
                      <div style={{ color:"#64748B", fontSize:11, marginTop:6 }}>
                        All 4 documents are required. The admin will verify before approving your shop.
                      </div>
                    </div>

                    {/* Upload zone */}
                    <label style={{ display:"flex", flexDirection:"column", alignItems:"center",
                      justifyContent:"center", padding:"24px 20px",
                      border:"2px dashed #CBD5E1", borderRadius:12, cursor:"pointer",
                      background:"#F8FAFC", marginBottom:14, transition:"border-color 0.2s, background 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#648DB6"; e.currentTarget.style.background = "#F0F9FF"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.background = "#F8FAFC"; }}>
                      <input ref={fileRef} type="file" multiple
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFileAdd} style={{ display:"none" }} />
                      <div style={{ fontSize:30, marginBottom:8 }}></div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#334155", marginBottom:4 }}>
                        Click to upload files
                      </div>
                      <div style={{ fontSize:11.5, color:"#64748B" }}>
                        JPG, PNG, PDF · Max 5MB each · Multiple files allowed
                      </div>
                    </label>

                    {/* Status chips — show progress on all 4 */}
                    {form.documents.length > 0 && (
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                        {docStatus.map(({ ok, label, icon }) => (
                          <div key={label} style={{
                            display:"flex", alignItems:"center", gap:5,
                            fontSize:11, fontWeight:700,
                            color: ok ? "#065F46" : "#92400E",
                            background: ok ? "#D1FAE5" : "#FEF3C7",
                            border: `1px solid ${ok ? "#6EE7B7" : "#FCD34D"}`,
                            borderRadius:20, padding:"4px 10px",
                          }}>
                            {ok ? "✓" : "○"} {icon} {label}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Uploaded files list */}
                    {form.documents.length > 0 && (
                      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
                        {form.documents.map((doc, i) => (
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                            background:"#fff", border:"1px solid #E2E8F0", borderRadius:10,
                            padding:"10px 14px" }}>

                            {/* Thumbnail */}
                            <div
                              onClick={() => setPreviewModal(doc)}
                              style={{ width:48, height:48, borderRadius:8, overflow:"hidden",
                                flexShrink:0, cursor:"pointer", border:"1px solid #E2E8F0",
                                background:"#F1F5F9", display:"flex", alignItems:"center",
                                justifyContent:"center", position:"relative" }}>
                              {doc.type?.startsWith("image") ? (
                                <>
                                  <img src={doc.url} alt={doc.name}
                                    style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                  <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0)",
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    transition:"background 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.35)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0)"}>
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize:22 }}></span>
                              )}
                            </div>

                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12.5, fontWeight:600, color:"#0F172A",
                                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                {doc.name}
                              </div>
                              <div style={{ fontSize:10.5, color:"#94A3B8", marginTop:2 }}>
                                {(doc.size / 1024).toFixed(0)} KB · Click thumbnail to preview
                              </div>
                            </div>

                            {/* Document type selector */}
                            <select
                              value={doc.docType}
                              onChange={e => handleDocTypeChange(i, e.target.value)}
                              style={{ fontSize:11, padding:"5px 8px", borderRadius:6,
                                border:"1px solid #E2E8F0", background:"#F8FAFC",
                                color:"#334155", cursor:"pointer", flexShrink:0 }}>
                              {DOCUMENT_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>

                            <button onClick={() => handleRemoveDoc(i)}
                              style={{ width:28, height:28, borderRadius:6, border:"1px solid #FCA5A5",
                                background:"#FEF2F2", color:"#EF4444", cursor:"pointer",
                                fontSize:15, display:"flex", alignItems:"center",
                                justifyContent:"center", flexShrink:0, lineHeight:1 }}>
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {form.documents.length === 0 && (
                      <div style={{ textAlign:"center", padding:"20px 0", color:"#94A3B8", fontSize:12.5 }}>
                        No files uploaded yet. Upload all 4 required documents above.
                      </div>
                    )}

                    <FieldError msg={errors.documents} />

                    <div className="reg-actions" style={{ marginTop:16 }}>
                      <button type="button" className="reg-btn-back" onClick={goBack}>← Back</button>
                      <button type="button" className="reg-btn-next" onClick={goNext}>
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                              {/* ══ STEP 4: Review ══ */}
                {step === 4 && (
                  <form onSubmit={handleSubmit}>
                    <div className="reg-review-section">
                      <p className="reg-review-heading">Account Information</p>
                      {[
                        ["Full Name",      form.ownerName],
                        ["Email Address",  form.email],
                        ["Email Verified", "Verified"],
                        ["Password",       "••••••••"],
                      ].map(([k, v]) => (
                        <div className="reg-review-row" key={k}>
                          <span className="reg-review-key">{k}</span>
                          <span className="reg-review-val"
                            style={k === "Email Verified" ? { color:"#10B981", fontWeight:600 } : {}}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="reg-review-section">
                      <p className="reg-review-heading">Shop Information</p>
                      {[
                        ["Shop Name", form.shopName],
                        ["Phone",     form.phone],
                        ["Address",   form.address],
                        ["Barangay",  form.barangay],
                        ["City",      form.city],
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
                      <p className="reg-review-heading">Uploaded Documents ({form.documents.length})</p>
                      {form.documents.map((doc, i) => (
                        <div key={i} className="reg-review-row"
                          style={{ cursor:"pointer" }}
                          onClick={() => setPreviewModal(doc)}>
                          <span className="reg-review-key">
                            {DOCUMENT_TYPES.find(t => t.value === doc.docType)?.label || "Document"}
                          </span>
                          <span className="reg-review-val"
                            style={{ color:"#3B82F6", textDecoration:"underline", fontSize:12 }}>
                            {doc.name} 
                          </span>
                        </div>
                      ))}
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                        {docStatus.map(({ ok, label, icon }) => (
                          <span key={label} style={{
                            fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20,
                            color: ok ? "#065F46" : "#991B1B",
                            background: ok ? "#D1FAE5" : "#FEE2E2",
                            border: `1px solid ${ok ? "#6EE7B7" : "#FCA5A5"}`,
                          }}>
                            {ok ? "✓" : "✗"} {icon} {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* ── Terms & Conditions checkbox ── */}
                    <div style={{
                      background: "#F8FAFC",
                      border: `1px solid ${termsAccepted ? "#6EE7B7" : "#E2E8F0"}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}>
                      <input
                        type="checkbox"
                        id="terms-check"
                        checked={termsAccepted}
                        onChange={() => {
                          if (!termsAccepted) setTermsOpen(true);
                          else setTermsAccepted(false);
                        }}
                        style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", accentColor: "#10B981" }}
                      />
                      <label htmlFor="terms-check" style={{ fontSize: 13, color: "#334155", cursor: "pointer", lineHeight: 1.5 }}>
                        I have read and agree to the{" "}
                        <button
                          type="button"
                          onClick={() => setTermsOpen(true)}
                          style={{
                            background: "none", border: "none", padding: 0,
                            color: "#3B82F6", fontWeight: 600, fontSize: 13,
                            cursor: "pointer", textDecoration: "underline",
                          }}
                        >
                          Terms and Conditions
                        </button>
                        {" "}of iConstruct. I confirm that all information and documents submitted are accurate and authentic.
                        {termsAccepted && (
                          <span style={{ color: "#10B981", fontWeight: 700, marginLeft: 6 }}> Accepted</span>
                        )}
                      </label>
                    </div>

                    {globalError && <div className="reg-global-error">{globalError}</div>}

                    <div className="reg-actions">
                      <button type="button" className="reg-btn-back" onClick={goBack}>← Back</button>
                      <button
                        className="reg-btn-submit"
                        type="submit"
                        disabled={loading || !termsAccepted}
                        style={{ opacity: !termsAccepted ? 0.5 : 1, cursor: !termsAccepted ? "not-allowed" : "pointer" }}
                      >
                        {loading
                          ? <><span className="reg-spinner" /> Submitting...</>
                          : <>Submit Application </>}
                      </button>
                    </div>
                  </form>
                )}

                <p className="reg-signin-row">
                  Already have an account?{" "}
                  <Link to="/login" className="reg-signin-link">Sign in</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}