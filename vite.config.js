import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLAN_PRICES = {
  pro: { amount: 99900, currency: "PHP", name: "iConstruct Pro Plan", interval: "month" },
  business: { amount: 499900, currency: "PHP", name: "iConstruct Business Plan", interval: "month" },
};

/** Load admin price from Firestore REST (systemConfig is public-readable). */
async function resolvePlanPriceLocal(planId) {
  const fallback = PLAN_PRICES[planId];
  if (!fallback) return null;
  try {
    const url =
      "https://firestore.googleapis.com/v1/projects/iconstruct-58a87/databases/(default)/documents/systemConfig/subscriptionPlans";
    const res = await fetch(url);
    if (!res.ok) return { ...fallback };
    const json = await res.json();
    const plansMap = json?.fields?.plans?.mapValue?.fields || {};
    const planFields = plansMap[planId]?.mapValue?.fields || {};
    const priceField = planFields.price;
    let php = null;
    if (priceField?.integerValue != null) php = Number(priceField.integerValue);
    else if (priceField?.doubleValue != null) php = Number(priceField.doubleValue);
    else if (priceField?.stringValue != null) php = Number(priceField.stringValue);
    if (php != null && Number.isFinite(php) && php >= 0) {
      const label =
        planFields.label?.stringValue ||
        (planId === "pro" ? "Pro" : "Business");
      return {
        amount: Math.round(php * 100),
        currency: "PHP",
        name: `iConstruct ${label}`,
        interval: "month",
      };
    }
  } catch (e) {
    console.warn("[PayMongo] plan price from Firestore failed:", e.message);
  }
  return { ...fallback };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(payload));
}

/** Simple in-memory rate limit for local Vite PayMongo proxy */
const localRate = new Map();
function localRateLimit(key, max, windowMs) {
  const now = Date.now();
  const stamps = (localRate.get(key) || []).filter((t) => t > now - windowMs);
  if (stamps.length >= max) return false;
  stamps.push(now);
  localRate.set(key, stamps);
  return true;
}

async function paymongoFetch(secret, apiPath, options = {}) {
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
    throw new Error(msg);
  }
  return json;
}

function decodeUidFromBearer(authHeader) {
  try {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(
      Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

function isCheckoutPaidAttrs(attrs = {}) {
  const payments = attrs.payments || [];
  return (
    payments.some(
      (p) => p?.attributes?.status === "paid" || p?.status === "paid"
    ) ||
    attrs.payment_intent?.attributes?.status === "succeeded" ||
    attrs.status === "paid"
  );
}

async function getAdminDb() {
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const admin = require("./functions/node_modules/firebase-admin/lib/index.js");
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: "iconstruct-58a87" });
    }
    return admin;
  } catch (err) {
    console.warn("[PayMongo] firebase-admin unavailable:", err.message);
    return null;
  }
}

async function activateShopLocal(admin, shopId, planId, sessionId, source) {
  const shopRef = admin.firestore().collection("shops").doc(shopId);
  const shopSnap = await shopRef.get();
  if (!shopSnap.exists) throw new Error("Shop not found.");

  let baseMs = Date.now();
  const exp = shopSnap.data()?.subscriptionExpiry;
  if (exp) {
    const d = typeof exp.toDate === "function" ? exp.toDate() : new Date(exp);
    if (!Number.isNaN(d.getTime()) && d.getTime() > baseMs) baseMs = d.getTime();
  }
  const newExpiry = new Date(baseMs + 30 * 24 * 60 * 60 * 1000);

  await shopRef.set(
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

  if (sessionId) {
    await admin.firestore().collection("checkoutSessions").doc(sessionId).set(
      {
        shopId,
        planId,
        status: "paid",
        activatedBy: source,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    success: true,
    paid: true,
    planId,
    shopId,
    source,
    expiry: newExpiry.toISOString(),
  };
}

async function activateViaCloudVerify(authHeader, sessionId) {
  let last = { paid: false };
  const delays = [0, 1200, 2500];
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(
      "https://us-central1-iconstruct-58a87.cloudfunctions.net/verifyPaymentSession",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ sessionId }),
      }
    );
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    last = data;
    if (res.ok && data.paid) {
      return {
        success: true,
        paid: true,
        planId: data.planId,
        shopId: data.shopId,
        source: data.source || "cloud_verify",
      };
    }
    // Don't throw on unpaid — caller may retry after PayMongo confirms
    if (!res.ok && res.status !== 400) {
      console.warn("[PayMongo] verifyPaymentSession:", res.status, data.error);
    }
  }
  return last;
}

async function localSyncPayment(secretKey, authHeader, body) {
  if (!secretKey) {
    throw new Error(
      "PAYMONGO_SECRET_KEY missing in functions/.env.local (use sk_test_… for Test mode). Restart npm run dev."
    );
  }

  const uid = decodeUidFromBearer(authHeader);
  if (!uid) throw new Error("Invalid session. Sign out and log in again.");

  const trySession = async (sessionId) => {
    if (!sessionId || !String(sessionId).startsWith("cs_")) return null;

    // 1) Prefer Cloud Function (has service credentials to write Pro/Business)
    const cf = await activateViaCloudVerify(authHeader, sessionId);
    if (cf?.paid) {
      return {
        success: true,
        paid: true,
        planId: cf.planId,
        shopId: cf.shopId || uid,
        source: cf.source || "cloud_verify",
      };
    }

    // 2) Confirm status with PayMongo using test secret (no ADC needed)
    const json = await paymongoFetch(
      secretKey,
      `/v1/checkout_sessions/${sessionId}`,
      { method: "GET" }
    );
    const attrs = json?.data?.attributes || {};
    if (!isCheckoutPaidAttrs(attrs)) return null;

    const meta = attrs.metadata || {};
    if (meta.shopId && meta.shopId !== uid) {
      throw new Error("This payment belongs to another shop account.");
    }
    const planId = meta.planId;
    if (!PLAN_PRICES[planId]) return null;

    // 3) One more cloud verify after we know PayMongo marks paid
    const cf2 = await activateViaCloudVerify(authHeader, sessionId);
    if (cf2?.paid) {
      return {
        success: true,
        paid: true,
        planId: cf2.planId || planId,
        shopId: uid,
        source: "cloud_verify_after_paid",
      };
    }

    throw new Error(
      "PayMongo shows this session is paid, but the cloud function could not activate your plan. Run: firebase deploy --only functions:verifyPaymentSession — then click Confirm again while signed in."
    );
  };

  if (body?.sessionId) {
    const hit = await trySession(body.sessionId);
    if (hit) return hit;
  }

  // Try recent session ids from pending cloud / can't list without admin —
  // Ask client to pay again if no sessionId
  return {
    success: true,
    paid: false,
    message:
      "No session id to confirm. Click Pay with PayMongo again, authorize test payment, then Confirm (session is saved when checkout starts).",
  };
}

const OTP_CF = {
  "/api/otp/request": "https://us-central1-iconstruct-58a87.cloudfunctions.net/requestEmailOtp",
  "/api/otp/verify": "https://us-central1-iconstruct-58a87.cloudfunctions.net/verifyEmailOtp",
  "/api/otp/assert": "https://us-central1-iconstruct-58a87.cloudfunctions.net/assertEmailOtpVerified",
};

/** Same-origin OTP proxy — avoids browser CORS on localhost register. */
function otpDevApiPlugin() {
  return {
    name: "otp-dev-api",
    configureServer(server) {
      const otpHandler = async function otpProxyMiddleware(req, res, next) {
        const raw = String(req.url || "");
        const url = raw.split("?")[0];
        const target = OTP_CF[url];
        if (!target) return next();

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          return res.end();
        }

        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "Method not allowed" });
        }

        try {
          const body = await readJsonBody(req);
          console.log("[OTP] proxy →", target);
          const cfRes = await fetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {}),
          });
          let data = {};
          try {
            data = await cfRes.json();
          } catch {
            /* ignore */
          }
          if (!cfRes.ok) {
            return sendJson(res, cfRes.status, {
              error:
                data.error ||
                `OTP function error (${cfRes.status}). Deploy: firebase deploy --only functions:requestEmailOtp,functions:verifyEmailOtp,functions:assertEmailOtpVerified`,
            });
          }
          return sendJson(res, 200, data);
        } catch (err) {
          console.warn("[OTP] proxy error:", err.message);
          return sendJson(res, 502, {
            error:
              err.message ||
              "Cannot reach OTP Cloud Function. Check deploy and network.",
          });
        }
      };

      // Register early (before HTML fallback) — Vite default use() is fine if registered
      // in configureServer without returning a post-hook.
      server.middlewares.use(otpHandler);
    },
  };
}

function paymongoDevApiPlugin(secretKey) {
  return {
    name: "paymongo-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (
          url !== "/api/paymongo/create" &&
          url !== "/api/paymongo/verify" &&
          url !== "/api/paymongo/sync"
        ) {
          return next();
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
          );
          return res.end();
        }

        if (req.method !== "POST") {
          return sendJson(res, 405, { error: "Method not allowed" });
        }

        const authHeader = req.headers.authorization || "";
        if (!/^Bearer\s+\S+/i.test(authHeader)) {
          return sendJson(res, 401, {
            error: "Missing auth token. Sign out and log in again.",
          });
        }

        if (!localRateLimit(`pm:${authHeader.slice(-24)}`, 15, 15 * 60 * 1000)) {
          return sendJson(res, 429, {
            error: "Too many attempts. Wait a minute and try again.",
          });
        }

        try {
          const body = await readJsonBody(req);

          // Confirm payment: CF first, always fall back to local (no CORS / no deploy required)
          if (url === "/api/paymongo/sync") {
            try {
              const cfRes = await fetch(
                "https://us-central1-iconstruct-58a87.cloudfunctions.net/syncMyLatestPayment",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                  },
                  body: JSON.stringify(body || {}),
                }
              );
              let data = {};
              try {
                data = await cfRes.json();
              } catch {
                /* ignore */
              }
              if (cfRes.ok && data.paid) {
                return sendJson(res, 200, data);
              }
            } catch (proxyErr) {
              console.warn("[PayMongo] CF sync proxy:", proxyErr.message);
            }

            try {
              const local = await localSyncPayment(
                secretKey,
                authHeader,
                body || {}
              );
              return sendJson(res, 200, local);
            } catch (err) {
              return sendJson(res, 500, {
                error: err.message || "Confirm payment failed.",
                paid: false,
              });
            }
          }

          if (!secretKey) {
            return sendJson(res, 500, {
              error:
                "PAYMONGO_SECRET_KEY missing. Put sk_test_… in functions/.env.local and restart npm run dev.",
            });
          }

          if (url === "/api/paymongo/create") {
            const { planId, shopId, shopEmail, successUrl, cancelUrl } = body;
            if (!planId || !PLAN_PRICES[planId]) {
              return sendJson(res, 400, { error: "Invalid plan selected." });
            }
            const plan = await resolvePlanPriceLocal(planId);
            const origin = "http://localhost:5173";
            const uid = shopId || decodeUidFromBearer(authHeader) || "";
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
                  success_url: successUrl || `${origin}/shop/payment-success`,
                  cancel_url: cancelUrl || `${origin}/shop/dashboard`,
                  reference_number: uid ? `ic|${uid}|${planId}` : undefined,
                  metadata: {
                    shopId: uid,
                    planId,
                    source: "iconstruct-web-local",
                  },
                },
              },
            };
            if (shopEmail) {
              payload.data.attributes.billing = { email: shopEmail };
            }

            const json = await paymongoFetch(secretKey, "/v1/checkout_sessions", {
              method: "POST",
              body: JSON.stringify(payload),
            });

            const sessionId = json?.data?.id;
            const checkoutUrl = json?.data?.attributes?.checkout_url;
            if (!checkoutUrl || !sessionId) {
              throw new Error("PayMongo did not return a checkout URL.");
            }

            try {
              const admin = await getAdminDb();
              if (admin && uid) {
                await admin
                  .firestore()
                  .collection("checkoutSessions")
                  .doc(sessionId)
                  .set(
                    {
                      shopId: uid,
                      planId,
                      status: "pending",
                      email: String(shopEmail || "").toLowerCase(),
                      amount: plan.amount,
                      source: "local_vite",
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                  );
              }
            } catch (e) {
              console.warn("[PayMongo] checkoutSessions write skipped:", e.message);
            }

            return sendJson(res, 200, { url: checkoutUrl, sessionId });
          }

          // verify — activate via Cloud Function (has credentials); never pretend paid without shop write
          const { sessionId } = body;
          if (!sessionId) {
            return sendJson(res, 400, { error: "Session ID is required." });
          }

          const cfVerify = await activateViaCloudVerify(authHeader, sessionId);
          if (cfVerify?.paid) {
            return sendJson(res, 200, {
              success: true,
              paid: true,
              planId: cfVerify.planId,
              shopId: cfVerify.shopId,
              source: cfVerify.source || "cloud_verify",
            });
          }

          if (cfVerify?.error) {
            return sendJson(res, 500, {
              error: cfVerify.error,
              paid: false,
            });
          }

          return sendJson(res, 200, { success: true, paid: false });
        } catch (err) {
          return sendJson(res, 500, {
            error: err.message || "PayMongo request failed.",
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "functions"), "");
  const paymongoKey = (
    env.PAYMONGO_SECRET_KEY ||
    process.env.PAYMONGO_SECRET_KEY ||
    ""
  ).trim();

  if (!paymongoKey) {
    console.warn(
      "[PayMongo] PAYMONGO_SECRET_KEY missing in functions/.env.local — local checkout will fail."
    );
  } else {
    console.log("[PayMongo] Test secret loaded for local /api/paymongo/*");
  }

  console.log("[OTP] Local proxies: /api/otp/request|verify|assert → Cloud Functions");

  const otpCfBase = "https://us-central1-iconstruct-58a87.cloudfunctions.net";

  return {
    plugins: [react(), otpDevApiPlugin(), paymongoDevApiPlugin(paymongoKey)],
    server: {
      // Built-in proxy (reliable); custom plugin is a fallback
      proxy: {
        "/api/otp/request": {
          target: otpCfBase,
          changeOrigin: true,
          secure: true,
          rewrite: () => "/requestEmailOtp",
        },
        "/api/otp/verify": {
          target: otpCfBase,
          changeOrigin: true,
          secure: true,
          rewrite: () => "/verifyEmailOtp",
        },
        "/api/otp/assert": {
          target: otpCfBase,
          changeOrigin: true,
          secure: true,
          rewrite: () => "/assertEmailOtpVerified",
        },
      },
      headers: {
        "Service-Worker-Allowed": "/",
      },
    },
    preview: {
      headers: {
        "Service-Worker-Allowed": "/",
      },
    },
  };
});
