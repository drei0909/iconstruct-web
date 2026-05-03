// src/components/SettingsTab.jsx
import { useState } from "react";
import { auth, db } from "../services/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { logoutShop } from "../controllers/shopController";

export default function SettingsTab({
  shop,
  accentColor = "#2C3E50",
  accentGradient,
}) {
  const navigate = useNavigate();
  const gradient = accentGradient || `linear-gradient(135deg,${accentColor},${accentColor}90)`;

  // ── Profile ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    shopName:    shop?.shopName    || "",
    ownerName:   shop?.ownerName   || "",
    phone:       shop?.phone       || "",
    address:     shop?.address     || "",
    description: shop?.description || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState(null);

  // ── Password ─────────────────────────────────────────────────────────────
  const [pwForm,   setPwForm]   = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState(null);

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    newProject:     shop?.notifs?.newProject     ?? true,
    quotationReply: shop?.notifs?.quotationReply ?? true,
    weeklyDigest:   shop?.notifs?.weeklyDigest   ?? false,
    marketing:      shop?.notifs?.marketing      ?? false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg,    setNotifMsg]    = useState(null);

  // ── Delete ───────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteModal,   setDeleteModal]   = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteMsg,     setDeleteMsg]     = useState(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      await updateDoc(doc(db, "shops", user.uid), {
        shopName:    profile.shopName.trim(),
        ownerName:   profile.ownerName.trim(),
        phone:       profile.phone.trim(),
        address:     profile.address.trim(),
        description: profile.description.trim(),
      });
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current)
      return setPwMsg({ type: "error", text: "Enter your current password." });
    if (pwForm.next.length < 6)
      return setPwMsg({ type: "error", text: "New password must be at least 6 characters." });
    if (pwForm.next !== pwForm.confirm)
      return setPwMsg({ type: "error", text: "Passwords do not match." });
    setPwSaving(true);
    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "success", text: "Password changed successfully!" });
    } catch (err) {
      setPwMsg({
        type: "error",
        text: err.code === "auth/wrong-password"
          ? "Current password is incorrect."
          : err.message,
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleSaveNotifs = async () => {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, "shops", user.uid), { notifs });
      setNotifMsg({ type: "success", text: "Notification preferences saved!" });
    } catch {
      setNotifMsg({ type: "error", text: "Failed to save preferences." });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE")
      return setDeleteMsg({ type: "error", text: 'Type "DELETE" to confirm.' });
    setDeleting(true);
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, "shops", user.uid), { status: "deleted" });
      await deleteUser(user);
      navigate("/login");
    } catch (err) {
      setDeleteMsg({
        type: "error",
        text: err.message || "Failed. Please re-login and try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = {
    background: "#fff", borderRadius: 14,
    border: "1px solid #E2E8F0", padding: "24px 28px", marginBottom: 20,
  };
  const sectionTitle = {
    fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4,
  };
  const sectionSub = {
    fontSize: 12, color: "#64748B", marginBottom: 20,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: "#94A3B8",
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 6, display: "block",
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #E2E8F0", fontSize: 13, color: "#0F172A",
    outline: "none", background: "#FAFAFA", transition: "border 0.15s",
    boxSizing: "border-box", fontFamily: "inherit",
  };
  const focusInput = (e) => (e.target.style.border = `1.5px solid ${accentColor}`);
  const blurInput  = (e) => (e.target.style.border = "1.5px solid #E2E8F0");
  const primaryBtn = {
    padding: "10px 24px", borderRadius: 9, border: "none",
    background: gradient, color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
  };
  const msgBox = (type) => ({
    padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginTop: 12,
    background: type === "success" ? "#D1FAE5" : "#FEE2E2",
    color:      type === "success" ? "#065F46" : "#991B1B",
    border:     `1px solid ${type === "success" ? "#6EE7B7" : "#FCA5A5"}`,
  });

  // ── Toggle switch ─────────────────────────────────────────────────────────
  const Toggle = ({ checked, onChange }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: "pointer",
        background: checked ? accentColor : "#CBD5E1",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: checked ? 21 : 3, transition: "left 0.2s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
      }} />
    </div>
  );

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 19, fontWeight: 900, color: "#0F172A", marginBottom: 4,
          fontFamily: "var(--font-base)",
        }}>
          Settings
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Manage your shop profile, security, and preferences.
        </div>
      </div>

      {/* ── SHOP INFORMATION ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Shop Information</div>
        <div style={sectionSub}>Update your shop's public profile details.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[
            { key: "shopName",  label: "Shop Name"    },
            { key: "ownerName", label: "Owner Name"   },
            { key: "phone",     label: "Phone Number" },
            { key: "address",   label: "Address"      },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                style={inputStyle}
                value={profile[key]}
                onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                onFocus={focusInput}
                onBlur={blurInput}
                placeholder={label}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Shop Description</label>
          <textarea
            style={{ ...inputStyle, height: 90, resize: "vertical" }}
            value={profile.description}
            onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
            onFocus={focusInput}
            onBlur={blurInput}
            placeholder="Describe your shop, specialties, and services..."
          />
        </div>

        <button style={primaryBtn} onClick={handleSaveProfile} disabled={profileSaving}>
          {profileSaving ? "Saving..." : "Save Changes"}
        </button>
        {profileMsg && <div style={msgBox(profileMsg.type)}>{profileMsg.text}</div>}
      </div>

      {/* ── CHANGE PASSWORD ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Change Password</div>
        <div style={sectionSub}>Keep your account secure with a strong password.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
          {[
            { key: "current", label: "Current Password",     placeholder: "Your current password"   },
            { key: "next",    label: "New Password",         placeholder: "Min. 6 characters"       },
            { key: "confirm", label: "Confirm New Password", placeholder: "Repeat new password"     },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                type="password"
                style={inputStyle}
                value={pwForm[key]}
                onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                onFocus={focusInput}
                onBlur={blurInput}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button style={primaryBtn} onClick={handleChangePassword} disabled={pwSaving}>
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
        {pwMsg && <div style={msgBox(pwMsg.type)}>{pwMsg.text}</div>}
      </div>

      {/* ── NOTIFICATION PREFERENCES ─────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Notification Preferences</div>
        <div style={sectionSub}>Choose which alerts and emails you receive.</div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            {
              key:   "newProject",
              label: "New Project Alerts",
              desc:  "Get notified when a new project is posted.",
            },
            {
              key:   "quotationReply",
              label: "Quotation Status Updates",
              desc:  "Know when a builder accepts or rejects your quote.",
            },
            {
              key:   "weeklyDigest",
              label: "Weekly Summary Email",
              desc:  "A digest of your activity every Monday.",
            },
            {
              key:   "marketing",
              label: "Promotions & Updates",
              desc:  "Product news and tips from iConstruct.",
            },
          ].map(({ key, label, desc }, i, arr) => (
            <div
              key={key}
              style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 16,
                padding: "14px 0",
                borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{desc}</div>
              </div>
              <Toggle
                checked={notifs[key]}
                onChange={val => setNotifs(n => ({ ...n, [key]: val }))}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button style={primaryBtn} onClick={handleSaveNotifs} disabled={notifSaving}>
            {notifSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
        {notifMsg && <div style={msgBox(notifMsg.type)}>{notifMsg.text}</div>}
      </div>

      {/* ── DANGER ZONE ──────────────────────────────────────────────────── */}
      <div style={{ ...card, border: "1px solid #FCA5A5", background: "#FFF5F5" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>
          Danger Zone
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
          Permanently delete your shop account. This action cannot be undone.
        </div>
        <button
          onClick={() => setDeleteModal(true)}
          style={{
            padding: "10px 22px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#DC2626,#EF4444)",
            color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          }}
        >
          Delete Account
        </button>
      </div>

      {/* ── DELETE MODAL ─────────────────────────────────────────────────── */}
      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(6px)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "36px 32px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.2)", position: "relative",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#DC2626,#EF4444)", borderRadius: "16px 16px 0 0" }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>
              Delete Account?
            </div>
            <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, marginBottom: 20 }}>
              This will <strong style={{ color: "#DC2626" }}>permanently delete</strong> your
              shop, all products, and quotation history. This cannot be reversed.
            </p>
            <label style={labelStyle}>Type <strong>DELETE</strong> to confirm</label>
            <input
              style={{ ...inputStyle, marginBottom: 16 }}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
            {deleteMsg && (
              <div style={{ ...msgBox("error"), marginBottom: 12 }}>{deleteMsg.text}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteConfirm("");
                  setDeleteMsg(null);
                }}
                style={{
                  flex: 1, padding: "10px", borderRadius: 9,
                  border: "1.5px solid #E2E8F0", background: "transparent",
                  color: "#64748B", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  flex: 2, padding: "10px", borderRadius: 9, border: "none",
                  background: "linear-gradient(135deg,#DC2626,#EF4444)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {deleting ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}