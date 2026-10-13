// src/controllers/contactController.js
// Public Contact Us submission (no auth required).

import { insertContactMessage } from "../models/contactModel";

function clean(str, max) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

/**
 * Validate (for instant feedback) and send a contact message. The real
 * checks and the spam limits run in the submitContactMessage Cloud Function.
 */
export async function submitContactMessage({ name, email, subject, message, website }) {
  const payload = {
    name: clean(name, 120),
    email: clean(email, 200).toLowerCase(),
    subject: clean(subject, 200),
    message: String(message || "").trim().slice(0, 5000),
    website: String(website || ""),
  };

  if (!payload.name) throw new Error("Please enter your name.");
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!payload.subject) throw new Error("Please enter a subject.");
  if (!payload.message || payload.message.length < 10) {
    throw new Error("Please write a slightly longer message (at least 10 characters).");
  }

  const id = await insertContactMessage(payload);
  return { id };
}
