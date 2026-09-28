// Load local secrets only when present (emulator / local). Keep init fast for deploy discovery.
try {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath, quiet: true });
  }
} catch (_) {
  /* ignore — Cloud Functions use Secret Manager / env in production */
}
// iConstruct — Cloud Functions: PayMongo Checkout + FCM Notifications

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

const paymongoSecret = defineSecret("PAYMONGO_SECRET_KEY");
const paymongoWebhookSecret = defineSecret("PAYMONGO_WEBHOOK_SECRET");

// Amounts in centavos (PHP × 100) — keep in sync with src/config/planConfig.js
const PLAN_PRICES = {
  pro: { amount: 99900, currency: "PHP", name: "iConstruct Pro Plan", interval: "month" },
  business: { amount: 499900, currency: "PHP", name: "iConstruct Business Plan", interval: "month" },
};

/** Admin-editable amounts from systemConfig/subscriptionPlans (PHP → centavos). */
async function resolvePlanPrice(planId) {
  const fallback = PLAN_PRICES[planId];
  if (!fallback) return null;
  try {
    const snap = await db.collection("systemConfig").doc("subscriptionPlans").get();
    const p = snap.data()?.plans?.[planId];
    if (p && p.price !== undefined && p.price !== null) {
      const php = Number(p.price);
      if (Number.isFinite(php) && php >= 0) {
        return {
          amount: Math.round(php * 100),
          currency: "PHP",
          name: p.label
            ? `iConstruct ${p.label}`
            : fallback.name,
          interval: String(p.billingCycle || "month")
            .replace(/ly$/i, "")
            .toLowerCase() || "month",
        };
      }
    }
  } catch (e) {
    logger.warn("resolvePlanPrice fallback", planId, e.message);
  }
  return { ...fallback };
}

// In-memory rate limit (per Cloud Function instance)
const rateBuckets = new Map();

function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const entry = rateBuckets.get(key) || { stamps: [] };
  entry.stamps = entry.stamps.filter((t) => t > now - windowMs);
  if (entry.stamps.length >= max) {
    const retryAfterSec = Math.ceil((entry.stamps[0] + windowMs - now) / 1000);
    rateBuckets.set(key, entry);
    return { ok: false, retryAfterSec };
  }
  entry.stamps.push(now);
  rateBuckets.set(key, entry);
  return { ok: true, retryAfterSec: 0 };
}

function getPaymongoSecret() {
  // Bound secret (production) or dotenv (local emulator / fallback)
  try {
    const bound = paymongoSecret.value();
    if (bound) return bound;
  } catch {
    /* secret not bound in this context */
  }
  const fromEnv = process.env.PAYMONGO_SECRET_KEY;
  if (!fromEnv) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured.");
  }
  return fromEnv;
}

function getPaymongoWebhookSecret() {
  // Bound secret (production) or dotenv (local emulator / fallback)
  try {
    const bound = paymongoWebhookSecret.value();
    if (bound) return bound;
  } catch {
    /* secret not bound in this context */
  }
  const fromEnv = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!fromEnv) {
    throw new Error("PAYMONGO_WEBHOOK_SECRET is not configured.");
  }
  return fromEnv;
}

async function paymongoFetch(apiPath, options = {}) {
  const secret = getPaymongoSecret();
  const res = await fetch(`https://api.paymongo.com${apiPath}`, {
    ...options,
    headers: {
      Authorization: "Basic " + Buffer.from(`${secret}:`).toString("base64"),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.detail ||
      json?.error ||
      `PayMongo request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/** Require Firebase Auth Bearer token. */
async function requireAuth(req, res) {
  applyCors(req, res);
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing auth token. Sign in and try again." });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    logger.warn("Invalid auth token", err.message);
    res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
    return null;
  }
}

/** Browser CORS for SPA (localhost:5173 + Firebase Hosting). */
function applyCors(req, res) {
  const origin = req.headers.origin || "*";
  // Echo origin when present so local dev + Hosting both work
  res.set("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.set("Access-Control-Max-Age", "3600");
  res.set("Vary", "Origin");
}

/** Handle OPTIONS preflight; return true if response already sent. */
function handlePreflight(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

/** Only allow redirects back to our own origin (blocks open-redirect phishing). */
function safeAppUrl(candidate, fallback) {
  try {
    const base = new URL(fallback);
    const next = new URL(candidate || fallback, base.origin);
    if (next.origin !== base.origin) return fallback;
    return next.toString();
  } catch {
    return fallback;
  }
}

async function activateShopSubscription(shopId, planId, opts = {}) {
  const {
    sessionId = null,
    source = "unknown",
    amountCentavos = null,
  } = opts;

  if (!shopId || !PLAN_PRICES[planId]) {
    logger.warn("activateShopSubscription skipped", { shopId, planId });
    return null;
  }

  // Idempotent: same PayMongo session never double-extends expiry
  if (sessionId) {
    const actRef = db.collection("paymongoActivations").doc(sessionId);
    const actSnap = await actRef.get();
    if (actSnap.exists && actSnap.data()?.ok) {
      logger.info("Activation already applied for session", { sessionId, shopId, planId });
      return actSnap.data();
    }
  }

  const shopRef = db.collection("shops").doc(shopId);

  const result = await db.runTransaction(async (tx) => {
    if (sessionId) {
      const actRef = db.collection("paymongoActivations").doc(sessionId);
      const actSnap = await tx.get(actRef);
      if (actSnap.exists && actSnap.data()?.ok) {
        return actSnap.data();
      }
    }

    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists) {
      throw new Error("Shop not found for subscription activation.");
    }
    const data = shopSnap.data() || {};

    // Only stack onto the remaining time when this is a genuine early renewal
    // of the SAME plan while it's still active — that preserves paid days the
    // shop hasn't used yet. A first-time subscribe, a plan switch (e.g. Basic
    // -> Pro, Pro -> Business), or renewing after it already expired must all
    // start the 30 days fresh from today; otherwise a leftover expiry from a
    // different plan (or an old test payment) gets silently added on top.
    const isSamePlanActiveRenewal =
      data.subscriptionPlan === planId &&
      String(data.subscriptionStatus || "").toLowerCase() === "active";

    let baseMs = Date.now();
    if (isSamePlanActiveRenewal) {
      const exp = data.subscriptionExpiry;
      if (exp) {
        const d = typeof exp.toDate === "function" ? exp.toDate() : new Date(exp);
        if (!Number.isNaN(d.getTime()) && d.getTime() > baseMs) {
          baseMs = d.getTime();
        }
      }
    }
    const newExpiry = new Date(baseMs + 30 * 24 * 60 * 60 * 1000);
    const amount =
      amountCentavos != null
        ? amountCentavos / 100
        : PLAN_PRICES[planId].amount / 100;

    tx.set(
      shopRef,
      {
        subscriptionPlan: planId,
        subscriptionStatus: "active",
        subscriptionExpiry: admin.firestore.Timestamp.fromDate(newExpiry),
        lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPaymentSource: source,
        lastPaymentSessionId: sessionId || null,
        lastPaymentPlanId: planId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const payRef = db.collection("subscriptionPayments").doc();
    tx.set(payRef, {
      shopId,
      shopName: data.shopName || "",
      ownerName: data.ownerName || "",
      email: data.email || "",
      planName: planId,
      planPrice: amount,
      paymentMethod: "paymongo",
      status: "confirmed",
      source,
      sessionId: sessionId || null,
      referenceNumber: sessionId || `paymongo_${Date.now()}`,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (sessionId) {
      tx.set(
        db.collection("paymongoActivations").doc(sessionId),
        {
          ok: true,
          shopId,
          planId,
          source,
          amount,
          expiryMs: newExpiry.getTime(),
          paymentDocId: payRef.id,
          activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      ok: true,
      shopId,
      planId,
      source,
      expiry: newExpiry.toISOString(),
    };
  });

  logger.info("Shop subscription activated/renewed", {
    shopId,
    planId,
    source,
    sessionId,
    expiry: result?.expiry,
  });
  return result;
}

async function isCheckoutPaid(attrs = {}) {
  const payments = attrs.payments || [];
  return (
    payments.some(
      (p) => p?.attributes?.status === "paid" || p?.status === "paid"
    ) ||
    attrs.payment_intent?.attributes?.status === "succeeded" ||
    attrs.status === "paid"
  );
}

function extractPaidAmount(attrs = {}) {
  const payments = attrs.payments || [];
  return (
    payments[0]?.attributes?.amount ??
    payments[0]?.amount ??
    attrs.amount ??
    null
  );
}

/**
 * Verify the Paymongo-Signature header.
 * Header format: "t=<unix>,te=<test-hmac>,li=<live-hmac>"
 * Valid when HMAC-SHA256(`${t}.${rawBody}`, signingSecret) hex === te (test) or li (live).
 * rawBody MUST be the exact bytes PayMongo sent — never JSON.stringify(req.body).
 */
function verifyPaymongoSignature(req) {
  const header = req.headers["paymongo-signature"];
  if (typeof header !== "string" || !header) {
    return { ok: false, reason: "missing_signature_header" };
  }

  const parts = {};
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const timestamp = parts.t;
  const candidates = [parts.te, parts.li].filter(Boolean);
  if (!timestamp || candidates.length === 0) {
    return { ok: false, reason: "malformed_signature_header" };
  }

  // Replay protection: reject deliveries whose timestamp is more than 10 minutes
  // from now. PayMongo re-signs every retry with a fresh timestamp, so this does
  // not block legitimate redelivery.
  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 600) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const rawBody = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : Buffer.from(
        typeof req.rawBody === "string"
          ? req.rawBody
          : JSON.stringify(req.body || {}),
        "utf8"
      );

  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    rawBody,
  ]);

  const expected = crypto
    .createHmac("sha256", getPaymongoWebhookSecret().trim())
    .update(signedPayload)
    .digest("hex");
  const expBuf = Buffer.from(expected, "utf8");

  const match = candidates.some((c) => {
    const cBuf = Buffer.from(c, "utf8");
    return cBuf.length === expBuf.length && crypto.timingSafeEqual(cBuf, expBuf);
  });

  return match ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}

/**
 * PayMongo sends several webhook envelope shapes. Normalize to one structure.
 * See: docs.paymongo.com checkout_session.payment.paid
 */
function normalizePaymongoWebhook(body) {
  if (!body || typeof body !== "object") {
    return { eventId: null, eventType: "", sessionId: null, resource: null, attrs: {}, metadata: {} };
  }

  // ── Newer Hosted Checkout style ──────────────────────────────────────────
  // { event_type, data: { type: "checkout_session.payment.paid", data: { id: "cs_…", attributes } } }
  if (body.data && body.data.data && (body.data.type || body.event_type)) {
    const outer = body.data;
    const resource = outer.data || {};
    const attrs = resource.attributes || {};
    return {
      eventId:
        outer.id ||
        resource.id ||
        (body.event_type
          ? `${body.event_type}_${resource.id || Date.now()}`
          : null),
      eventType: String(outer.type || body.event_type || ""),
      sessionId: resource.id || null,
      resource,
      attrs,
      metadata: attrs.metadata || {},
      referenceNumber: attrs.reference_number || null,
      paymentIntentId:
        attrs.payment_intent?.id ||
        attrs.payment_intent_id ||
        null,
    };
  }

  // ── Classic event style ──────────────────────────────────────────────────
  // { data: { id: "evt_…", type: "event", attributes: { type: "…", data: { id, attributes } } } }
  if (body.data?.attributes) {
    const evt = body.data;
    const attributes = evt.attributes || {};
    const resource = attributes.data || {};
    const attrs = resource.attributes || {};
    const eventType = String(attributes.type || "");
    let sessionId = null;
    if (String(resource.id || "").startsWith("cs_")) {
      sessionId = resource.id;
    } else if (attrs.checkout_session_id) {
      sessionId = attrs.checkout_session_id;
    } else if (resource.type === "checkout_session") {
      sessionId = resource.id;
    }
    return {
      eventId: evt.id || null,
      eventType,
      sessionId,
      resource,
      attrs,
      metadata: attrs.metadata || {},
      referenceNumber: attrs.reference_number || null,
      paymentIntentId:
        attrs.payment_intent_id ||
        attrs.payment_intent?.id ||
        (String(resource.id || "").startsWith("pi_") ? resource.id : null),
      paymentId: String(resource.id || "").startsWith("pay_") ? resource.id : null,
    };
  }

  // ── Fallback flat ────────────────────────────────────────────────────────
  const attrs = body.attributes || body;
  return {
    eventId: body.id || null,
    eventType: String(body.type || body.event_type || ""),
    sessionId: body.id?.startsWith?.("cs_") ? body.id : null,
    resource: body,
    attrs,
    metadata: attrs.metadata || {},
    referenceNumber: attrs.reference_number || null,
    paymentIntentId: attrs.payment_intent_id || null,
  };
}

function parseReferenceShopPlan(ref) {
  if (!ref) return null;
  // Format written at checkout create: ic|{shopId}|{planId}
  const parts = String(ref).split("|");
  if (parts.length >= 3 && parts[0] === "ic" && PLAN_PRICES[parts[2]]) {
    return { shopId: parts[1], planId: parts[2] };
  }
  return null;
}

/**
 * Resolve shopId + planId + sessionId for activation from a webhook envelope.
 */
async function resolveWebhookActivation(parsed) {
  let shopId =
    parsed.metadata?.shopId ||
    parsed.metadata?.shop_id ||
    null;
  let planId =
    parsed.metadata?.planId ||
    parsed.metadata?.plan_id ||
    null;
  let sessionId = parsed.sessionId;

  const fromRef = parseReferenceShopPlan(parsed.referenceNumber);
  if (fromRef) {
    shopId = shopId || fromRef.shopId;
    planId = planId || fromRef.planId;
  }

  // Re-fetch checkout session from PayMongo for canonical metadata
  if (sessionId && String(sessionId).startsWith("cs_")) {
    try {
      const cs = await paymongoFetch(`/v1/checkout_sessions/${sessionId}`, {
        method: "GET",
      });
      const csAttrs = cs?.data?.attributes || {};
      const meta = csAttrs.metadata || {};
      shopId = shopId || meta.shopId || meta.shop_id;
      planId = planId || meta.planId || meta.plan_id;
      const refPlan = parseReferenceShopPlan(csAttrs.reference_number);
      if (refPlan) {
        shopId = shopId || refPlan.shopId;
        planId = planId || refPlan.planId;
      }
      if (!parsed.attrs?.payments?.length && csAttrs.payments) {
        parsed.attrs = { ...parsed.attrs, payments: csAttrs.payments };
      }
    } catch (err) {
      logger.warn("resolveWebhookActivation checkout fetch failed", err.message);
    }
  }

  // Firestore pending session (written at createCheckoutSession)
  if (sessionId && (!shopId || !planId)) {
    const pending = await db.collection("checkoutSessions").doc(sessionId).get();
    if (pending.exists) {
      shopId = shopId || pending.data().shopId;
      planId = planId || pending.data().planId;
    }
  }

  // payment.paid often has no session id — match pending row by payment_intent / email / amount
  if ((!shopId || !planId || !sessionId) && parsed.paymentIntentId) {
    const byPi = await db
      .collection("checkoutSessions")
      .where("paymentIntentId", "==", parsed.paymentIntentId)
      .limit(1)
      .get()
      .catch(() => null);
    if (byPi && !byPi.empty) {
      const d = byPi.docs[0].data();
      shopId = shopId || d.shopId;
      planId = planId || d.planId;
      sessionId = sessionId || byPi.docs[0].id;
    }
  }

  // Last resort: most recent pending session for shop from payment email
  if ((!shopId || !planId) && parsed.attrs?.billing?.email) {
    const email = String(parsed.attrs.billing.email).toLowerCase();
    const q = await db
      .collection("checkoutSessions")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .limit(5)
      .get()
      .catch(() => null);
    if (q && !q.empty) {
      // Prefer matching amount
      const amount = extractPaidAmount(parsed.attrs);
      let chosen = q.docs[0];
      if (amount != null) {
        const match = q.docs.find((d) => d.data().amount === amount);
        if (match) chosen = match;
      }
      const d = chosen.data();
      shopId = shopId || d.shopId;
      planId = planId || d.planId;
      sessionId = sessionId || chosen.id;
    }
  }

  return { shopId, planId, sessionId };
}

// ── Email OTP (server-side only — clients never read otp codes) ────────────

function otpPepper() {
  return (
    process.env.OTP_PEPPER ||
    process.env.PAYMONGO_SECRET_KEY ||
    "iconstruct-otp-pepper"
  );
}

function hashOtp(code) {
  return crypto
    .createHash("sha256")
    .update(`${String(code).trim()}:${otpPepper()}`)
    .digest("hex");
}

function generateOtpCode() {
  const n = crypto.randomInt(100000, 1000000);
  return String(n);
}

async function sendOtpViaEmailJs({ toEmail, toName, otpCode }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID || "service_ekwltb2";
  const templateId = process.env.EMAILJS_TEMPLATE_OTP || "template_i4tvz8h";
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || "8CRqLBqTGPfDxdwl-";
  // Private key recommended for server; set as Firebase secret / functions config
  const privateKey = process.env.EMAILJS_PRIVATE_KEY || "";

  const body = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: toEmail,
      to_name: toName || "Shop Owner",
      otp_code: otpCode,
      // Aliases some templates use
      email: toEmail,
      name: toName || "Shop Owner",
      otp: otpCode,
      message: `Your iConstruct verification code is ${otpCode}`,
    },
  };
  // EmailJS REST API: accessToken = private key for non-browser
  if (privateKey) body.accessToken = privateKey;

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const lower = String(text || "").toLowerCase();
    // Default EmailJS blocks Cloud Functions until this checkbox is on
    if (
      res.status === 403 &&
      (lower.includes("non-browser") || lower.includes("non browser"))
    ) {
      throw new Error(
        "EmailJS blocks server OTP until enabled. Open https://dashboard.emailjs.com/admin/account/security → enable “Allow EmailJS API for non-browser applications”, then try again. (Optional: set Firebase secret EMAILJS_PRIVATE_KEY.)"
      );
    }
    throw new Error(`OTP email failed (${res.status}): ${text || res.statusText}`);
  }
}

function normalizeEmailServer(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Find paid shops past subscriptionExpiry and reset them to basic in the DB.
 * @returns {{ checked: number, expired: number, shopIds: string[] }}
 */
async function enforceExpiredSubscriptions() {
  const now = admin.firestore.Timestamp.now();
  const shopIds = [];
  let checked = 0;

  // Query by expiry (avoids scanning every shop). Single-field inequality is fine.
  const snap = await db
    .collection("shops")
    .where("subscriptionExpiry", "<=", now)
    .limit(400)
    .get();

  const batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    checked += 1;
    const data = docSnap.data() || {};
    const plan = String(data.subscriptionPlan || "basic").toLowerCase();
    const status = String(data.subscriptionStatus || "").toLowerCase();

    // Only rewrite shops still stored as paid / active paid
    if (plan !== "pro" && plan !== "business") continue;
    if (status === "expired") continue;

    batch.set(
      docSnap.ref,
      {
        subscriptionPlan: "basic",
        subscriptionStatus: "expired",
        lastExpiredPlan: plan,
        lastExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batchCount += 1;
    shopIds.push(docSnap.id);
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info("Subscription expiry pass", {
    checked,
    expired: shopIds.length,
    shopIds,
  });

  return { checked, expired: shopIds.length, shopIds };
}

// Daily 16:00 UTC ≈ 00:00 Asia/Manila — rewrite expired paid plans to basic in Firestore
exports.enforceSubscriptionExpiry = onSchedule(
  {
    schedule: "every day 16:00",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    try {
      await enforceExpiredSubscriptions();
    } catch (err) {
      logger.error("enforceSubscriptionExpiry failed", err);
      throw err;
    }
  }
);

/** Manual/admin trigger (needs Firebase Auth admin token) for testing expiry now. */
exports.runSubscriptionExpiryNow = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;

    const adminSnap = await db.collection("admins").doc(decoded.uid).get();
    if (!adminSnap.exists) {
      return res.status(403).json({ error: "Admins only." });
    }

    const adminLimit = rateLimit(`expirynow-uid:${decoded.uid}`, {
      max: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!adminLimit.ok) {
      return res.status(429).json({
        error: `Too many requests. Retry in ${adminLimit.retryAfterSec}s.`,
      });
    }

    try {
      const result = await enforceExpiredSubscriptions();
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.error("runSubscriptionExpiryNow", err);
      return res.status(500).json({ error: err.message || "Failed" });
    }
  }
);

// CORS helpers + auth so SPA (localhost) can call these
exports.createCheckoutSession = onRequest(
  { cors: [/^http:\/\/localhost:\d+$/, /^https:\/\/.*\.web\.app$/, /^https:\/\/.*\.firebaseapp\.com$/, true], secrets: [paymongoSecret], invoker: "public" },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    applyCors(req, res);
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;

    const ipLimit = rateLimit(`checkout-ip:${clientIp(req)}`, {
      max: 20,
      windowMs: 15 * 60 * 1000,
    });
    const uidLimit = rateLimit(`checkout-uid:${decoded.uid}`, {
      max: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.ok || !uidLimit.ok) {
      return res.status(429).json({
        error: `Too many checkout attempts. Retry in ${Math.max(ipLimit.retryAfterSec, uidLimit.retryAfterSec)}s.`,
      });
    }

    try {
      const { planId, shopEmail, successUrl, cancelUrl } = req.body || {};
      if (!planId || !PLAN_PRICES[planId]) {
        return res.status(400).json({ error: "Invalid plan selected." });
      }

      // Always bind to authenticated user — never trust client shopId
      const shopId = decoded.uid;
      const plan = await resolvePlanPrice(planId);
      if (!plan || !plan.amount) {
        return res.status(400).json({ error: "Invalid plan selected." });
      }
      const origin = req.headers.origin || "http://localhost:5173";
      const success = safeAppUrl(
        successUrl,
        `${origin}/shop/payment-success`
      );
      const cancel = safeAppUrl(cancelUrl, `${origin}/shop/dashboard`);
      const payload = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `iConstruct ${planId} plan`,
            line_items: [
              {
                name: plan.name,
                amount: plan.amount,
                currency: plan.currency,
                quantity: 1,
                description: `${plan.interval}ly subscription`,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya", "qrph"],
            success_url: success,
            cancel_url: cancel,
            // reference_number is always returned on webhooks even if metadata is thin
            reference_number: `ic|${shopId}|${planId}`,
            metadata: {
              shopId,
              planId,
              source: "iconstruct-web",
            },
          },
        },
      };

      if (shopEmail || decoded.email) {
        payload.data.attributes.billing = {
          email: shopEmail || decoded.email,
        };
      }

      const json = await paymongoFetch("/v1/checkout_sessions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const sessionId = json?.data?.id;
      const checkoutUrl = json?.data?.attributes?.checkout_url;
      const paymentIntentId =
        json?.data?.attributes?.payment_intent?.id ||
        json?.data?.attributes?.payment_intent_id ||
        null;

      if (!checkoutUrl || !sessionId) {
        throw new Error("PayMongo did not return a checkout URL.");
      }

      // Persist pending checkout for webhook / renew audit trail
      await db.collection("checkoutSessions").doc(sessionId).set(
        {
          shopId,
          planId,
          status: "pending",
          email: String(shopEmail || decoded.email || "").toLowerCase(),
          amount: plan.amount,
          paymentIntentId: paymentIntentId || null,
          referenceNumber: `ic|${shopId}|${planId}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("PayMongo checkout created", { sessionId, planId, shopId });
      return res.status(200).json({ url: checkoutUrl, sessionId });
    } catch (err) {
      logger.error("PayMongo checkout error", err);
      return res.status(500).json({
        error: err.message || "Failed to create checkout session.",
      });
    }
  }
);

exports.verifyPaymentSession = onRequest(
  { cors: [/^http:\/\/localhost:\d+$/, true], secrets: [paymongoSecret], invoker: "public" },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    applyCors(req, res);
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;

    const limit = rateLimit(`verify:${decoded.uid}`, {
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.ok) {
      return res.status(429).json({
        error: `Too many verify attempts. Retry in ${limit.retryAfterSec}s.`,
      });
    }

    try {
      const { sessionId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required." });
      }

      // Already activated by webhook?
      const actSnap = await db.collection("paymongoActivations").doc(sessionId).get();
      if (actSnap.exists && actSnap.data()?.ok) {
        const a = actSnap.data();
        if (a.shopId && a.shopId !== decoded.uid) {
          return res.status(403).json({ error: "Session does not belong to this account." });
        }
        return res.status(200).json({
          success: true,
          paid: true,
          planId: a.planId,
          shopId: decoded.uid,
          source: "activation_record",
          expiry: a.expiryMs
            ? new Date(a.expiryMs).toISOString()
            : null,
        });
      }

      const json = await paymongoFetch(`/v1/checkout_sessions/${sessionId}`, {
        method: "GET",
      });

      const attrs = json?.data?.attributes || {};
      const paid = await isCheckoutPaid(attrs);
      const metadata = attrs.metadata || {};

      if (metadata.shopId && metadata.shopId !== decoded.uid) {
        return res.status(403).json({ error: "Session does not belong to this account." });
      }

      if (paid) {
        const planId = metadata.planId;
        const amountCentavos = extractPaidAmount(attrs);
        await activateShopSubscription(decoded.uid, planId, {
          sessionId,
          source: "verify_redirect",
          amountCentavos,
        });

        await db.collection("checkoutSessions").doc(sessionId).set(
          {
            status: "paid",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            activatedBy: "verify_redirect",
          },
          { merge: true }
        );

        return res.status(200).json({
          success: true,
          paid: true,
          planId,
          shopId: decoded.uid,
          email: attrs.billing?.email,
          amountPaid:
            amountCentavos ?? PLAN_PRICES[planId]?.amount,
          source: "verify_redirect",
        });
      }

      return res.status(200).json({ success: true, paid: false });
    } catch (err) {
      logger.error("PayMongo verify error", err);
      return res.status(500).json({
        error: err.message || "Failed to verify payment.",
      });
    }
  }
);

/**
 * PayMongo webhook — primary activation path (does not depend on browser return).
 * URL: https://us-central1-iconstruct-58a87.cloudfunctions.net/paymongoWebhook
 * Events: checkout_session.payment.paid (required), payment.paid (backup)
 * Create the webhook in the SAME mode as payments (Test vs Live).
 */
exports.paymongoWebhook = onRequest(
  { cors: false, secrets: [paymongoSecret, paymongoWebhookSecret], invoker: "public", timeoutSeconds: 60 },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method === "GET" || req.method === "HEAD") {
      return res.status(200).send("paymongoWebhook ok");
    }
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    try {
      const rawBody =
        typeof req.rawBody === "string"
          ? req.rawBody
          : Buffer.isBuffer(req.rawBody)
            ? req.rawBody.toString("utf8")
            : JSON.stringify(req.body || {});

      logger.info("paymongoWebhook POST", {
        contentType: req.headers["content-type"],
        bodyPreview: rawBody.slice(0, 500),
      });

      // Reject anything that is not a genuine, signed PayMongo delivery.
      const sig = verifyPaymongoSignature(req);
      if (!sig.ok) {
        logger.warn("paymongoWebhook signature rejected", {
          reason: sig.reason,
          ip: clientIp(req),
        });
        return res.status(401).json({ ok: false, error: "invalid_signature" });
      }

      const parsed = normalizePaymongoWebhook(req.body || {});
      const eventType = parsed.eventType || String(req.body?.data?.type || "");
      const typeLower = eventType.toLowerCase();
      const outerType = String(req.body?.data?.type || req.body?.data?.attributes?.type || "").toLowerCase();

      const eventId =
        parsed.eventId ||
        `evt_${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 28)}`;

      const eventRef = db.collection("paymongoEvents").doc(String(eventId).slice(0, 700));
      const existing = await eventRef.get();
      if (existing.exists && existing.data()?.processed && existing.data()?.ok) {
        return res.status(200).json({ ok: true, duplicate: true });
      }

      const looksPaid =
        typeLower.includes("paid") ||
        outerType.includes("paid") ||
        typeLower === "send.webhook" ||
        parsed.attrs?.status === "paid" ||
        (await isCheckoutPaid(parsed.attrs || {}));

      logger.info("PayMongo webhook parsed", {
        eventId,
        eventType,
        outerType,
        sessionId: parsed.sessionId,
        looksPaid,
        metadata: parsed.metadata,
        referenceNumber: parsed.referenceNumber,
      });

      if (!looksPaid) {
        await eventRef.set(
          {
            processed: true,
            ignored: true,
            reason: "event_not_paid",
            type: eventType || outerType,
            rawSnippet: rawBody.slice(0, 600),
            at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return res.status(200).json({ ok: true, paid: false });
      }

      const resolved = await resolveWebhookActivation(parsed);
      let { shopId, planId, sessionId } = resolved;

      // Deep-scan body for cs_ id if metadata still missing
      if ((!shopId || !planId) && rawBody.includes("cs_")) {
        const m = rawBody.match(/cs_[A-Za-z0-9]+/);
        if (m) {
          sessionId = sessionId || m[0];
          try {
            const cs = await paymongoFetch(`/v1/checkout_sessions/${m[0]}`, {
              method: "GET",
            });
            const meta = cs?.data?.attributes?.metadata || {};
            shopId = shopId || meta.shopId || meta.shop_id;
            planId = planId || meta.planId || meta.plan_id;
            const refPlan = parseReferenceShopPlan(
              cs?.data?.attributes?.reference_number
            );
            if (refPlan) {
              shopId = shopId || refPlan.shopId;
              planId = planId || refPlan.planId;
            }
          } catch (e) {
            logger.warn("deep cs_ fetch failed", e.message);
          }
        }
      }

      if ((!shopId || !planId) && sessionId) {
        const pending = await db.collection("checkoutSessions").doc(sessionId).get();
        if (pending.exists) {
          shopId = shopId || pending.data().shopId;
          planId = planId || pending.data().planId;
        }
      }

      if (!shopId || !PLAN_PRICES[planId]) {
        logger.error("Webhook missing shopId/planId after resolve", {
          eventType,
          sessionId,
          metadata: parsed.metadata,
          referenceNumber: parsed.referenceNumber,
        });
        await eventRef.set(
          {
            processed: true,
            ok: false,
            error: "missing_metadata",
            type: eventType,
            sessionId: sessionId || null,
            metadata: parsed.metadata || {},
            referenceNumber: parsed.referenceNumber || null,
            rawSnippet: rawBody.slice(0, 1200),
            at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return res.status(200).json({ ok: false, error: "missing_metadata" });
      }

      const amountCentavos = extractPaidAmount(parsed.attrs || {});
      const activationKey =
        (sessionId && String(sessionId).startsWith("cs_") && sessionId) ||
        parsed.paymentId ||
        eventId;

      await activateShopSubscription(shopId, planId, {
        sessionId: activationKey,
        source: "webhook",
        amountCentavos,
      });

      if (sessionId && String(sessionId).startsWith("cs_")) {
        await db.collection("checkoutSessions").doc(sessionId).set(
          {
            status: "paid",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            activatedBy: "webhook",
            paymentIntentId: parsed.paymentIntentId || null,
          },
          { merge: true }
        );
      }

      await eventRef.set(
        {
          processed: true,
          ok: true,
          shopId,
          planId,
          sessionId: sessionId || null,
          type: eventType,
          at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Webhook activated plan", { shopId, planId, sessionId, eventType });
      return res.status(200).json({ ok: true, paid: true, shopId, planId });
    } catch (err) {
      logger.error("paymongoWebhook error", err);
      return res.status(500).json({ error: err.message || "Webhook failed" });
    }
  }
);

/**
 * Shop self-heal when webhook/redirect was missed.
 * POST { sessionId? } with Bearer token — re-check PayMongo sessions for this shop.
 */
exports.syncMyLatestPayment = onRequest(
  {
    cors: [/^http:\/\/localhost:\d+$/, /^https:\/\/.*$/, true],
    secrets: [paymongoSecret],
    invoker: "public",
  },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    applyCors(req, res);
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;

    const syncLimit = rateLimit(`sync-uid:${decoded.uid}`, {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!syncLimit.ok) {
      return res.status(429).json({
        error: `Too many sync attempts. Retry in ${syncLimit.retryAfterSec}s.`,
      });
    }

    try {
      const shopId = decoded.uid;
      let activated = null;

      const bodySession = req.body?.sessionId;
      if (bodySession && String(bodySession).startsWith("cs_")) {
        const json = await paymongoFetch(`/v1/checkout_sessions/${bodySession}`, {
          method: "GET",
        });
        const attrs = json?.data?.attributes || {};
        const meta = attrs.metadata || {};
        if (meta.shopId && meta.shopId !== shopId) {
          return res.status(403).json({ error: "Session is not for this shop." });
        }
        if (await isCheckoutPaid(attrs)) {
          const planId =
            meta.planId ||
            parseReferenceShopPlan(attrs.reference_number)?.planId;
          if (PLAN_PRICES[planId]) {
            activated = await activateShopSubscription(shopId, planId, {
              sessionId: bodySession,
              source: "sync_explicit",
              amountCentavos: extractPaidAmount(attrs),
            });
          }
        }
      }

      if (!activated?.ok) {
        const snap = await db
          .collection("checkoutSessions")
          .where("shopId", "==", shopId)
          .limit(15)
          .get();

        for (const docSnap of snap.docs) {
          const sid = docSnap.id;
          if (!String(sid).startsWith("cs_")) continue;
          try {
            const json = await paymongoFetch(`/v1/checkout_sessions/${sid}`, {
              method: "GET",
            });
            const attrs = json?.data?.attributes || {};
            if (!(await isCheckoutPaid(attrs))) continue;

            const meta = attrs.metadata || {};
            const planId =
              meta.planId ||
              docSnap.data().planId ||
              parseReferenceShopPlan(attrs.reference_number)?.planId;

            if (!PLAN_PRICES[planId]) continue;

            activated = await activateShopSubscription(shopId, planId, {
              sessionId: sid,
              source: "sync_pending",
              amountCentavos: extractPaidAmount(attrs),
            });

            await docSnap.ref.set(
              {
                status: "paid",
                activatedBy: "sync_pending",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            if (activated?.ok) break;
          } catch (e) {
            logger.warn("sync session failed", sid, e.message);
          }
        }
      }

      if (activated?.ok) {
        return res.status(200).json({
          success: true,
          paid: true,
          planId: activated.planId,
          shopId,
          source: activated.source || "sync",
        });
      }

      const shop = await db.collection("shops").doc(shopId).get();
      const plan = String(shop.data()?.subscriptionPlan || "basic").toLowerCase();
      const status = String(shop.data()?.subscriptionStatus || "").toLowerCase();
      if ((plan === "pro" || plan === "business") && status === "active") {
        return res.status(200).json({
          success: true,
          paid: true,
          planId: plan,
          shopId,
          source: "already_active",
        });
      }

      return res.status(200).json({
        success: true,
        paid: false,
        message:
          "No paid session found. Use Test-mode webhook + event checkout_session.payment.paid, pay again, then click Confirm payment.",
      });
    } catch (err) {
      logger.error("syncMyLatestPayment", err);
      return res.status(500).json({ error: err.message || "Sync failed." });
    }
  }
);

// ── Server OTP ──────────────────────────────────────────────────────────────

exports.requestEmailOtp = onRequest(
  // cors: true → Firebase sets preflight headers (localhost SPA included)
  { cors: true, invoker: "public", timeoutSeconds: 60 },
  async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = normalizeEmailServer(req.body?.email);
    const ownerName = String(req.body?.ownerName || "Shop Owner").slice(0, 80);
    const purpose = String(req.body?.purpose || "register").slice(0, 32);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const ipLim = rateLimit(`otp-ip:${clientIp(req)}`, {
      max: 12,
      windowMs: 15 * 60 * 1000,
    });
    const mailLim = rateLimit(`otp-mail:${email}`, {
      max: 3,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLim.ok || !mailLim.ok) {
      return res.status(429).json({
        error: `Too many OTP requests. Retry in ${Math.max(ipLim.retryAfterSec, mailLim.retryAfterSec)}s.`,
      });
    }

    // For password reset, resolve the display name server-side (Admin SDK) so the
    // web client never has to read the shops/admins collection unauthenticated.
    let toName = ownerName;
    if (purpose === "password_reset") {
      toName = "there";
      let accountExists = false;
      try {
        let snap = await db
          .collection("shops")
          .where("email", "==", email)
          .limit(1)
          .get();
        if (snap.empty) {
          snap = await db
            .collection("admins")
            .where("email", "==", email)
            .limit(1)
            .get();
        }
        if (!snap.empty) {
          accountExists = true;
          const d = snap.docs[0].data() || {};
          toName = d.ownerName || d.displayName || "there";
        }
      } catch (e) {
        // Fail open: a transient Firestore error must not lock real users out.
        logger.warn("password_reset name lookup failed", e.message);
        accountExists = true;
      }
      if (!accountExists) {
        // No account: send nothing, but return the same generic response so the
        // endpoint can't be used to enumerate registered emails.
        logger.info("password_reset for unknown email — no code sent", { email });
        return res.status(200).json({
          success: true,
          expiresInSec: 600,
          message: "If the address is valid, a code was sent.",
        });
      }
    }

    const otp = generateOtpCode();
    const expires = Date.now() + 10 * 60 * 1000;
    const docId = email.replace(/\//g, "_");
    // Ties this OTP to the browser session that started the flow. verify/assert
    // must present the same value, so a third party can't consume the result.
    const flowId = String(req.body?.flowId || "").slice(0, 64) || null;

    await db.collection("otps").doc(docId).set({
      email,
      otpHash: hashOtp(otp),
      // plaintext never stored after transition; keep null for safety
      otp: null,
      expires,
      verified: false,
      purpose,
      flowId,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendOtpViaEmailJs({ toEmail: email, toName, otpCode: otp });

    logger.info("OTP issued", { email, purpose });
    return res.status(200).json({
      success: true,
      expiresInSec: 600,
      message: "If the address is valid, a code was sent.",
    });
  } catch (err) {
    logger.error("requestEmailOtp", err);
    return res.status(500).json({
      error: err.message || "Failed to send verification code.",
    });
  }
});

exports.verifyEmailOtp = onRequest(
  { cors: true, invoker: "public", timeoutSeconds: 60 },
  async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = normalizeEmailServer(req.body?.email);
    const code = String(req.body?.otp || req.body?.code || "").trim();

    if (!email || code.length < 6) {
      return res.status(400).json({ error: "Email and 6-digit code are required." });
    }

    const lim = rateLimit(`otp-verify:${email}`, {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!lim.ok) {
      return res.status(429).json({
        error: `Too many OTP checks. Retry in ${lim.retryAfterSec}s.`,
      });
    }

    const docId = email.replace(/\//g, "_");
    const ref = db.collection("otps").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(400).json({ error: "OTP not found. Please request a new one." });
    }

    const data = snap.data() || {};

    // If this OTP was bound to a flow, the caller must present the same flowId.
    const flowId = String(req.body?.flowId || "").slice(0, 64);
    if (data.flowId && data.flowId !== flowId) {
      return res.status(400).json({
        error: "Verification context mismatch. Restart the form and request a new code.",
      });
    }

    if (data.verified === true && Date.now() <= (data.expires || 0)) {
      return res.status(200).json({ success: true, verified: true });
    }

    if (Date.now() > (data.expires || 0)) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= 8) {
      return res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const okHash = data.otpHash && data.otpHash === hashOtp(code);
    // Legacy client-written plaintext support during transition
    const okLegacy = data.otp && String(data.otp) === code;

    if (!okHash && !okLegacy) {
      await ref.set(
        { attempts: attempts + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      return res.status(400).json({ error: "Incorrect OTP. Please check your email and try again." });
    }

    // Single-use: clear hashes/codes, mark verified until original expiry
    await ref.set(
      {
        verified: true,
        verifiedAt: Date.now(),
        otp: null,
        otpHash: null,
        expires: data.expires,
        attempts: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ success: true, verified: true });
  } catch (err) {
    logger.error("verifyEmailOtp", err);
    return res.status(500).json({ error: err.message || "Verification failed." });
  }
});

/** Server-side register gate — optionally consume verification after success. */
exports.assertEmailOtpVerified = onRequest(
  { cors: true, invoker: "public", timeoutSeconds: 60 },
  async (req, res) => {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const email = normalizeEmailServer(req.body?.email);
    const consume = req.body?.consume === true;
    if (!email) return res.status(400).json({ error: "Email is required." });

    // Unauthenticated (runs before the account exists) — limit per IP and
    // per email, same as requestEmailOtp/verifyEmailOtp, so it can't be
    // hammered to probe verification state or exhaust the OTP doc reads.
    const ipLim = rateLimit(`assertotp-ip:${clientIp(req)}`, {
      max: 30,
      windowMs: 15 * 60 * 1000,
    });
    const mailLim = rateLimit(`assertotp-mail:${email}`, {
      max: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLim.ok || !mailLim.ok) {
      return res.status(429).json({
        error: `Too many attempts. Retry in ${Math.max(ipLim.retryAfterSec, mailLim.retryAfterSec)}s.`,
      });
    }

    const ref = db.collection("otps").doc(email.replace(/\//g, "_"));
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;

    // If this OTP was bound to a flow, the caller must present the same flowId.
    const flowId = String(req.body?.flowId || "").slice(0, 64);
    if (data && data.flowId && data.flowId !== flowId) {
      return res.status(403).json({
        verified: false,
        error: "Verification context mismatch. Restart the form and request a new code.",
      });
    }

    const ok =
      data &&
      data.verified === true &&
      Date.now() <= (data.expires || 0);
    if (!ok) {
      return res.status(403).json({
        verified: false,
        error: "Please verify your email with the OTP before submitting.",
      });
    }
    if (consume) {
      await ref.set(
        {
          verified: false,
          otp: null,
          otpHash: null,
          expires: 0,
          consumedAt: Date.now(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    return res.status(200).json({ verified: true, success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Check failed." });
  }
});

/**
 * Submit a per-line quotation on a project. Used to be a direct client write
 * to Firestore (insertQuotation -> addDoc), which meant nothing about it was
 * actually enforceable server-side — no rate limit, and the Basic plan's
 * "3 quotations per month" cap was a UI-only check anyone could skip by
 * calling the API directly. This function is now the only path (see the
 * locked-down `create` rule on projectPosts/{postId}/quotations), so both
 * are real here.
 */
exports.submitQuotation = onRequest(
  { cors: [/^http:\/\/localhost:\d+$/, true], invoker: "public", timeoutSeconds: 30 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    applyCors(req, res);
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const decoded = await requireAuth(req, res);
    if (!decoded) return;
    const shopId = decoded.uid;

    const ipLimit = rateLimit(`quote-ip:${clientIp(req)}`, {
      max: 60,
      windowMs: 15 * 60 * 1000,
    });
    const uidLimit = rateLimit(`quote-uid:${shopId}`, {
      max: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.ok || !uidLimit.ok) {
      return res.status(429).json({
        error: `Too many quote submissions. Retry in ${Math.max(ipLimit.retryAfterSec, uidLimit.retryAfterSec)}s.`,
      });
    }

    try {
      const shopSnap = await db.collection("shops").doc(shopId).get();
      if (!shopSnap.exists) {
        return res.status(403).json({ error: "Shop not found." });
      }
      const shop = shopSnap.data() || {};
      if (String(shop.status || "").toLowerCase() !== "approved") {
        return res.status(403).json({ error: "Only approved shops can submit quotes." });
      }

      const { projectId, amount, note, items } = req.body || {};
      const amt = Number(amount);
      if (!projectId || typeof projectId !== "string") {
        return res.status(400).json({ error: "Project is required." });
      }
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: "Enter a valid quote amount." });
      }
      const list = Array.isArray(items) ? items.slice(0, 500) : [];
      const safeNote = typeof note === "string" ? note.slice(0, 2000) : "";

      const postRef = db.collection("projectPosts").doc(projectId);
      const postSnap = await postRef.get();
      if (!postSnap.exists) {
        return res.status(404).json({ error: "Project not found." });
      }
      const post = postSnap.data() || {};
      if (String(post.status || "open").toLowerCase() !== "open") {
        return res.status(409).json({ error: "This project is no longer open for quotes." });
      }
      const builderId =
        post.userId || post.builderId || post.ownerId || post.postedBy || "";

      // Basic plan's monthly quota — reads the same admin-editable config the
      // dashboard already shows, so it can't drift from what shops are told.
      const plan = String(shop.subscriptionPlan || "basic").toLowerCase();
      if (plan === "basic") {
        let quotaLimit = 3;
        try {
          const cfgSnap = await db.collection("systemConfig").doc("subscriptionPlans").get();
          const q = cfgSnap.data()?.plans?.basic?.quotaLimit;
          if (q === -1) quotaLimit = Infinity;
          else if (Number.isFinite(Number(q))) quotaLimit = Number(q);
        } catch {
          /* static default already set */
        }

        if (Number.isFinite(quotaLimit)) {
          const monthStartMs = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).getTime();
          // Reuses the existing shopId+createdAt collection-group index — no
          // new index needed. Volume here is inherently small (Basic shops
          // are capped at a few quotes a month), so filtering in memory is
          // cheaper than adding another composite index for one query.
          const usedSnap = await db
            .collectionGroup("quotations")
            .where("shopId", "==", shopId)
            .get();
          const monthCount = usedSnap.docs.filter((d) => {
            const ts = d.data().createdAt;
            const ms = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : 0);
            return ms >= monthStartMs;
          }).length;
          if (monthCount >= quotaLimit) {
            return res.status(403).json({
              error: `Monthly quota reached (${quotaLimit} quotations). Upgrade to Pro for unlimited quoting.`,
            });
          }
        }
      }

      const quotationRef = postRef.collection("quotations").doc();
      const payload = {
        projectId,
        projectTitle: post.projectName || post.title || "Project",
        shopId,
        shopName: shop.shopName || "",
        amount: amt,
        note: safeNote,
        items: list,
        quotedCount: list.filter((i) => i?.status === "quoted" || i?.status == null).length,
        substitutedCount: list.filter((i) => i?.status === "substituted").length,
        declinedCount: list.filter((i) => i?.status === "declined").length,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (builderId) payload.builderId = builderId;

      await db.runTransaction(async (tx) => {
        tx.set(quotationRef, payload);
        tx.update(postRef, {
          quotationCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).json({ success: true, id: quotationRef.id });
    } catch (err) {
      logger.error("submitQuotation error", err);
      return res.status(500).json({ error: err.message || "Failed to submit quote." });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FCM DIRECTION 1:
// Builder posts a project → notify ALL approved shops
//
// Trigger: new document created in projectPosts/{postId}
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyShopsOnNewProject = onDocumentCreated(
  "projectPosts/{postId}",
  async (event) => {
    const post   = event.data.data();
    const postId = event.params.postId;

    const projectName = post.projectName || "New Project";
    const projectType = post.projectType || "Construction";

    logger.info(`[FCM] New project posted: ${postId} — ${projectName}`);

    try {
      const shopsSnap = await db.collection("shops")
        .where("status", "==", "approved")
        .get();

      if (shopsSnap.empty) {
        logger.info("[FCM] No approved shops found.");
        return;
      }

      const tokens = [];
      shopsSnap.forEach((shopDoc) => {
        const shopTokens = shopDoc.data().fcmTokens || [];
        tokens.push(...shopTokens);
      });

      if (tokens.length === 0) {
        logger.info("[FCM] No shop FCM tokens found.");
        return;
      }

      const uniqueTokens = [...new Set(tokens)];
      logger.info(`[FCM] Sending to ${uniqueTokens.length} shop tokens`);

      const message = {
        notification: {
          title: "📋 New Project Posted!",
          body:  `A builder posted a ${projectType} project: "${projectName}". Tap to submit a quotation.`,
        },
        data: {
          type:        "new_project",
          postId:      postId,
          projectName: projectName,
          projectType: projectType,
        },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`[FCM] Sent: ${response.successCount} success, ${response.failureCount} failed`);

      // Clean up invalid tokens
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(uniqueTokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        logger.info(`[FCM] Removing ${invalidTokens.length} invalid tokens`);
        const batch = db.batch();
        shopsSnap.forEach((shopDoc) => {
          const shopTokens = shopDoc.data().fcmTokens || [];
          const cleaned    = shopTokens.filter(t => !invalidTokens.includes(t));
          if (cleaned.length !== shopTokens.length) {
            batch.update(shopDoc.ref, { fcmTokens: cleaned });
          }
        });
        await batch.commit();
      }

    } catch (err) {
      logger.error("[FCM] notifyShopsOnNewProject error:", err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FCM DIRECTION 2:
// Shop submits a quotation → notify the builder
//
// Used to be two triggers: one on projectPosts/{postId} (quotationCount
// increasing) and one on the quotations subcollection being created — the
// idea being each covered a different write path so exactly one fired per
// quote. But submitQuotation() always does both in the same transaction
// (creates the quotation doc AND increments quotationCount), so both fired
// on every single quote and every builder got duplicate push notifications.
// quotationCount is now only ever touched from that one transaction, so the
// create trigger alone is sufficient — removed the redundant one.
// ─────────────────────────────────────────────────────────────────────────────

exports.notifyBuilderOnQuotationSubcollection = onDocumentCreated(
  "projectPosts/{postId}/quotations/{quotationId}",
  async (event) => {
    const postId      = event.params.postId;
    const quotationId = event.params.quotationId;

    logger.info(`[FCM] Quotation created: ${quotationId} on post ${postId}`);

    // Get the parent projectPost to find the builder's userId
    const postSnap = await db.collection("projectPosts").doc(postId).get();
    if (!postSnap.exists) {
      logger.warn(`[FCM] projectPost ${postId} not found.`);
      return;
    }

    const post        = postSnap.data();
    const userId      = post.userId;
    const projectName = post.projectName || "your project";
    const countAfter  = post.quotationCount || 1;

    if (!userId) {
      logger.warn("[FCM] No userId on projectPost — cannot notify builder.");
      return;
    }

    await sendBuilderNotification({ userId, postId, projectName, countAfter });
  }
);

// ── Shared helper: looks up builder's fcmTokens and sends the notification ────
async function sendBuilderNotification({ userId, postId, projectName, countAfter }) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      logger.warn(`[FCM] User ${userId} not found.`);
      return;
    }

    // ✅ FIXED: was .fcmToken (singular string) — Flutter saves an ARRAY called fcmTokens
    const fcmTokens = userSnap.data().fcmTokens || [];

    if (fcmTokens.length === 0) {
      logger.warn(`[FCM] User ${userId} has no fcmTokens. Flutter app may not have saved it yet.`);
      return;
    }

    const uniqueTokens = [...new Set(fcmTokens)];

    const message = {
      notification: {
        title: "💬 New Quotation Received!",
        body:  `A hardware shop submitted a quotation for "${projectName}". Tap to view.`,
      },
      data: {
        type:        "new_quotation",
        postId:      postId,
        projectName: projectName,
        count:       String(countAfter),
      },
      tokens: uniqueTokens, // ✅ FIXED: was token: fcmToken (single send) — now multicast array
    };

    // ✅ FIXED: was admin.messaging().send() — must use sendEachForMulticast for token arrays
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[FCM] Builder ${userId} notified: ${response.successCount} success, ${response.failureCount} failed`);

    // Clean up any invalid tokens from the user's fcmTokens array
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (
          errCode === "messaging/invalid-registration-token" ||
          errCode === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(uniqueTokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      logger.info(`[FCM] Removing ${invalidTokens.length} invalid tokens from user ${userId}`);
      const cleaned = fcmTokens.filter(t => !invalidTokens.includes(t));
      await db.collection("users").doc(userId).update({ fcmTokens: cleaned });
    }

  } catch (err) {
    logger.error("[FCM] sendBuilderNotification error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE ACCEPTED → open shop↔builder chat + notify both sides
// Trigger: projectPosts/{postId}/quotations/{quotationId} status → accepted
// ─────────────────────────────────────────────────────────────────────────────
exports.onQuotationAccepted = onDocumentUpdated(
  "projectPosts/{postId}/quotations/{quotationId}",
  async (event) => {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const postId = event.params.postId;
    const quotationId = event.params.quotationId;

    // A partial acceptance (builder took some lines) also unlocks the chat.
    const WON = ["accepted", "partially_accepted"];
    const wasAccepted = WON.includes(String(before.status || "").toLowerCase());
    const afterStatus = String(after.status || "").toLowerCase();
    const isAccepted = WON.includes(afterStatus);
    const isPartial = afterStatus === "partially_accepted";
    if (wasAccepted || !isAccepted) return;

    const shopId = after.shopId;
    if (!shopId) {
      logger.warn(`[Chat] Accepted quote ${quotationId} missing shopId`);
      return;
    }

    try {
      const postSnap = await db.collection("projectPosts").doc(postId).get();
      const post = postSnap.exists ? postSnap.data() : {};
      const builderId =
        after.builderId ||
        post.userId ||
        post.builderId ||
        post.ownerId ||
        post.postedBy;

      if (!builderId) {
        logger.warn(`[Chat] No builderId for post ${postId} — cannot create conversation`);
        return;
      }

      const conversationId = `${postId}_${shopId}`;
      const projectTitle =
        after.projectTitle || post.projectName || post.title || "Project";
      const shopName = after.shopName || "";
      const builderName =
        post.ownerName || post.builderName || post.userName || "Builder";

      const convRef = db.collection("conversations").doc(conversationId);
      const convSnap = await convRef.get();
      const payload = {
        projectId: postId,
        quotationId,
        shopId,
        shopName,
        builderId,
        builderName,
        projectTitle,
        status: "open",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!convSnap.exists) {
        await convRef.set({
          ...payload,
          lastMessage: "Quote accepted — you can now message each other.",
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSenderId: "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await convRef.collection("messages").add({
          senderId: "system",
          senderRole: "system",
          text: `Quotation accepted for "${projectTitle}". You can now coordinate in this chat.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await convRef.set(payload, { merge: true });
      }

      logger.info(`[Chat] Conversation ${conversationId} ready after accept`);

      // Notify shop
      try {
        const shopSnap = await db.collection("shops").doc(shopId).get();
        const shopTokens = [...new Set((shopSnap.data()?.fcmTokens || []).filter(Boolean))];
        if (shopTokens.length) {
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: isPartial ? "✅ Your quote was partially accepted" : "✅ Your quote was accepted!",
              body: isPartial
                ? `A builder accepted some items in your quotation for "${projectTitle}". Open Messages to chat.`
                : `A builder accepted your quotation for "${projectTitle}". Open Messages to chat.`,
            },
            data: {
              type: "quotation_accepted",
              conversationId,
              postId,
              quotationId,
            },
            tokens: shopTokens,
          });
        }
      } catch (err) {
        logger.warn("[FCM] shop accept notify failed:", err.message);
      }

      // Notify builder — chat unlocked
      try {
        const userSnap = await db.collection("users").doc(builderId).get();
        const tokens = [...new Set((userSnap.data()?.fcmTokens || []).filter(Boolean))];
        if (tokens.length) {
          await admin.messaging().sendEachForMulticast({
            notification: {
              title: "💬 Chat unlocked",
              body: `You accepted ${shopName || "a shop"}'s quote for "${projectTitle}". You can message them now.`,
            },
            data: {
              type: "chat_unlocked",
              conversationId,
              postId,
              quotationId,
            },
            tokens,
          });
        }
      } catch (err) {
        logger.warn("[FCM] builder chat unlock notify failed:", err.message);
      }
    } catch (err) {
      logger.error("[Chat] onQuotationAccepted error:", err);
    }
  }
);

// FCM when a new chat message is sent
exports.onChatMessageCreated = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const msg = event.data.data();
    const conversationId = event.params.conversationId;
    if (!msg || msg.senderRole === "system") return;

    try {
      const convSnap = await db.collection("conversations").doc(conversationId).get();
      if (!convSnap.exists) return;
      const conv = convSnap.data();
      const recipientId =
        msg.senderRole === "shop" ? conv.builderId : conv.shopId;
      if (!recipientId || recipientId === msg.senderId) return;

      let tokens = [];
      if (msg.senderRole === "shop") {
        const userSnap = await db.collection("users").doc(recipientId).get();
        tokens = userSnap.data()?.fcmTokens || [];
      } else {
        const shopSnap = await db.collection("shops").doc(recipientId).get();
        tokens = shopSnap.data()?.fcmTokens || [];
      }
      tokens = [...new Set(tokens.filter(Boolean))];
      if (!tokens.length) return;

      const title =
        msg.senderRole === "shop"
          ? `${conv.shopName || "Shop"} messaged you`
          : `Builder messaged you`;
      const body = String(msg.text || "").slice(0, 120);

      await admin.messaging().sendEachForMulticast({
        notification: { title, body },
        data: {
          type: "chat_message",
          conversationId,
          projectId: conv.projectId || "",
        },
        tokens,
      });
    } catch (err) {
      logger.error("[FCM] onChatMessageCreated error:", err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE: scheduled push notifications
//
// 1) On schedule save → initial push ("maintenance planned for …")
// 2) Every minute → at scheduledStartAt, reminder push + enable maintenanceMode
// ─────────────────────────────────────────────────────────────────────────────

function formatMaintenanceWhen(ts) {
  if (!ts?.toDate) return "soon";
  return ts.toDate().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

async function collectAllFcmTokens() {
  const tokens = [];

  const shopsSnap = await db.collection("shops").get();
  shopsSnap.forEach((shopDoc) => {
    const data = shopDoc.data() || {};
    const status = String(data.status || "").toLowerCase();
    if (status === "deleted" || status === "rejected") return;
    tokens.push(...(data.fcmTokens || []));
  });

  try {
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach((userDoc) => {
      tokens.push(...((userDoc.data() || {}).fcmTokens || []));
    });
  } catch (err) {
    logger.warn("[FCM] users collection read skipped:", err.message);
  }

  return [...new Set(tokens.filter(Boolean))];
}

async function sendMaintenanceMulticast({ title, body, type, scheduleId }) {
  const tokens = await collectAllFcmTokens();
  if (tokens.length === 0) {
    logger.info("[FCM] maintenance — no tokens");
    return { successCount: 0, failureCount: 0 };
  }

  const message = {
    notification: { title, body: String(body || "").slice(0, 240) },
    data: {
      type: type || "maintenance",
      scheduleId: scheduleId || "",
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  logger.info(
    `[FCM] maintenance ${type}: ${response.successCount} ok, ${response.failureCount} fail`
  );
  return response;
}

exports.onMaintenanceScheduled = onDocumentWritten(
  "systemConfig/maintenance",
  async (event) => {
    const after = event.data?.after?.data();
    if (!after?.noticeActive || !after?.scheduleId) return;
    if (after.initialPushSentFor === after.scheduleId) return;

    const when = formatMaintenanceWhen(after.scheduledStartAt);
    const note = String(after.noticeMessage || "").trim();
    const body = note
      ? `Maintenance on ${when}. ${note.slice(0, 120)}`
      : `Maintenance scheduled for ${when}.`;

    try {
      await sendMaintenanceMulticast({
        title: "📅 iConstruct maintenance scheduled",
        body,
        type: "maintenance_scheduled",
        scheduleId: after.scheduleId,
      });

      await event.data.after.ref.update({
        initialPushSentFor: after.scheduleId,
        initialPushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error("[FCM] onMaintenanceScheduled error:", err);
    }
  }
);

exports.maintenanceStartScheduler = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Manila",
    region: "us-central1",
  },
  async () => {
    const ref = db.collection("systemConfig").doc("maintenance");
    const snap = await ref.get();
    if (!snap.exists) return;

    const data = snap.data();
    if (!data.noticeActive || data.maintenanceMode) return;

    const startMs = data.scheduledStartAt?.toMillis?.();
    if (!startMs) return;

    const scheduleId = data.scheduleId || String(startMs);
    if (Date.now() < startMs) return;
    if (data.reminderPushSentFor === scheduleId) return;

    const note = String(data.noticeMessage || "").trim();

    try {
      await sendMaintenanceMulticast({
        title: "🔧 Maintenance starting now",
        body:
          note ||
          "iConstruct is entering maintenance mode. Please save your work.",
        type: "maintenance_start",
        scheduleId,
      });

      await ref.update({
        maintenanceMode: true,
        noticeActive: false,
        reminderPushSentFor: scheduleId,
        reminderPushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`[FCM] Maintenance activated at scheduleId ${scheduleId}`);
    } catch (err) {
      logger.error("[FCM] maintenanceStartScheduler error:", err);
      throw err;
    }
  }
);