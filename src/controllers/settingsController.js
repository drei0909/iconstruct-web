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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  fetchAllAdmins,
  fetchAdminById,
  updateAdminRecord,
  deleteAdminRecord,
} from "../models/settingsModel";

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
  // Create the Firebase Auth user
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Write the admins/{uid} document so loginAdmin() authorizes them
  await setDoc(doc(db, "admins", cred.user.uid), {
    email,
    displayName,
    role,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

// ── Update Admin Profile ─────────────────────────────────────────────────────

export async function updateAdminProfile(uid, { displayName, role }) {
  await updateAdminRecord(uid, { displayName, role });
}

// ── Change Own Password ──────────────────────────────────────────────────────

export async function changeAdminPassword({ currentPassword, newPassword }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");

  // Re-authenticate first (Firebase requires this for sensitive ops)
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // Now update the password
  await updatePassword(user, newPassword);
}

// ── Send Password Reset ──────────────────────────────────────────────────────

export async function sendAdminPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Delete Admin ─────────────────────────────────────────────────────────────

export async function removeAdmin(uid) {
  // Remove Firestore record (auth user deletion requires admin SDK — skipped on client)
  await deleteAdminRecord(uid);
}