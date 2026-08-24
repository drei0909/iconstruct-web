// src/models/maintenanceModel.js

import { db } from "../services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const REF = () => doc(db, "systemConfig", "maintenance");

export async function fetchMaintenanceConfig() {
  const snap = await getDoc(REF());
  return snap.exists() ? snap.data() : {};
}

export async function saveMaintenanceConfig(patch) {
  await setDoc(
    REF(),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Schedule maintenance at a specific time. Does not set maintenanceMode yet. */
export async function scheduleMaintenanceNotice({ message, scheduledAtMs }) {
  const start = Timestamp.fromMillis(scheduledAtMs);
  const scheduleId = String(scheduledAtMs);

  await setDoc(
    REF(),
    {
      maintenanceMode: false,
      noticeActive: true,
      noticeMessage: String(message || "").trim(),
      scheduledStartAt: start,
      scheduleId,
      initialPushSentFor: null,
      reminderPushSentFor: null,
      noticeStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { scheduledStartAt: start, scheduleId };
}

export async function cancelMaintenanceNotice() {
  await setDoc(
    REF(),
    {
      noticeActive: false,
      noticeMessage: "",
      scheduledStartAt: null,
      scheduleId: null,
      noticeStartedAt: null,
      initialPushSentFor: null,
      reminderPushSentFor: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function enableMaintenanceNow() {
  await setDoc(
    REF(),
    {
      maintenanceMode: true,
      noticeActive: false,
      scheduledStartAt: null,
      scheduleId: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function disableMaintenance() {
  await setDoc(
    REF(),
    {
      maintenanceMode: false,
      noticeActive: false,
      noticeMessage: "",
      scheduledStartAt: null,
      scheduleId: null,
      noticeStartedAt: null,
      initialPushSentFor: null,
      reminderPushSentFor: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function activateScheduledMaintenance() {
  await setDoc(
    REF(),
    {
      maintenanceMode: true,
      noticeActive: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchShopsForMaintenanceNotice() {
  const snap = await getDocs(collection(db, "shops"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => {
      const status = String(s.status || "").toLowerCase();
      if (status === "deleted" || status === "rejected") return false;
      const email = String(s.email || "").trim();
      return email.includes("@");
    });
}

export async function markNoticeEmailsSent(count) {
  await setDoc(
    REF(),
    {
      notifiedShopCount: count,
      emailsNotifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
