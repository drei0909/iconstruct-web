// src/controllers/settingsController.js

import { auth, db } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, setDoc, serverTimestamp,
  addDoc, collection,
} from "firebase/firestore";
import {
  fetchAllAdmins,
  fetchAdminById,
  updateAdminRecord,
  deleteAdminRecord,
} from "../models/settingsModel";

// ── System Log Writer (same pattern as adminController) ─────────────────────
export async function writeLog(level, message) {
  try {
    const actor = auth.currentUser?.email || "system";
    await addDoc(collection(db, "systemLogs"), {
      level,
      message,
      actor,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[settingsController] Failed to write log:", err);
  }
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getAllAdmins() {
  return fetchAllAdmins();
}

export async function getCurrentAdminProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  return fetchAdminById(user.uid);
}

// ── Create Admin ────────────────────────────────────────────────────────────

export async function createAdmin({ email, password, displayName, role = "admin" }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "admins", cred.user.uid), {
    email, displayName, role,
    createdAt: serverTimestamp(),
  });
  await writeLog("success", `New admin account created: ${email} (${role})`);
  return cred.user;
}

// ── Update Admin Profile ─────────────────────────────────────────────────────

export async function updateAdminProfile(uid, { displayName, role }) {
  await updateAdminRecord(uid, { displayName, role });
  await writeLog("info", `Admin profile updated: ${displayName} — role set to ${role}`);
}

// ── Change Own Password ──────────────────────────────────────────────────────

export async function changeAdminPassword({ currentPassword, newPassword }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  await writeLog("success", `Admin password changed: ${user.email}`);
}

// ── Send Password Reset ──────────────────────────────────────────────────────

export async function sendAdminPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
  await writeLog("info", `Password reset email sent to: ${email}`);
}

// ── Delete Admin ─────────────────────────────────────────────────────────────

export async function removeAdmin(uid) {
  await deleteAdminRecord(uid);
  await writeLog("warn", `Admin account removed. UID: ${uid}`);
}