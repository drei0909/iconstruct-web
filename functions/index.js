require("dotenv").config();
// iConstruct — Cloud Functions: Stripe + FCM Notifications

const { onRequest }        = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger               = require("firebase-functions/logger");
const stripe               = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors                 = require("cors")({ origin: true });
const admin                = require("firebase-admin");

// Initialize Firebase Admin (required for FCM + Firestore access)
admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

// ─────────────────────────────────────────────────────────────────────────────
// PLAN PRICES
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_PRICES = {
  pro:      { amount: 49900,  currency: "php", name: "iConstruct Pro Plan",     interval: "month" },
  business: { amount: 449900, currency: "php", name: "iConstruct Business Plan", interval: "year"  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE: CREATE CHECKOUT SESSION
// ─────────────────────────────────────────────────────────────────────────────
exports.createCheckoutSession = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { planId, shopId, shopEmail, successUrl, cancelUrl } = req.body;
      if (!planId || !PLAN_PRICES[planId]) return res.status(400).json({ error: "Invalid plan selected." });

      const plan    = PLAN_PRICES[planId];
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{
          price_data: {
            currency:     plan.currency,
            product_data: {
              name:        plan.name,
              description: `iConstruct ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan subscription`,
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        }],
        customer_email: shopEmail || undefined,
        metadata: { shopId: shopId || "", planId, source: "iconstruct-web" },
        success_url: successUrl || `${req.headers.origin}/shop/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  cancelUrl  || `${req.headers.origin}/shop/dashboard`,
      });

      logger.info("Checkout session created", { sessionId: session.id, planId, shopId });
      return res.status(200).json({ url: session.url, sessionId: session.id });
    } catch (err) {
      logger.error("Stripe checkout error", err);
      return res.status(500).json({ error: err.message || "Failed to create checkout session." });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE: VERIFY PAYMENT SESSION
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPaymentSession = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: "Session ID is required." });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        return res.status(200).json({
          success: true, paid: true,
          planId:  session.metadata?.planId,
          shopId:  session.metadata?.shopId,
          email:   session.customer_email,
          amountPaid: session.amount_total,
        });
      } else {
        return res.status(200).json({ success: true, paid: false });
      }
    } catch (err) {
      logger.error("Verify session error", err);
      return res.status(500).json({ error: err.message || "Failed to verify payment." });
    }
  });
});

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
// Shop submits a quotation → notify the builder (Flutter app)
//
// TWO triggers work together:
//   A) projectPosts/{postId} updated (quotationCount increases) — from web app
//   B) projectPosts/{postId}/quotations/{quotationId} created  — from Flutter app
//
// Both end up notifying the builder via their fcmTokens array.
// ─────────────────────────────────────────────────────────────────────────────

// ── Trigger A: Web app increments quotationCount on the projectPost ───────────
exports.notifyBuilderOnQuotation = onDocumentUpdated(
  "projectPosts/{postId}",
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    const postId = event.params.postId;

    // Only fire when quotationCount actually increases
    const countBefore = before.quotationCount || 0;
    const countAfter  = after.quotationCount  || 0;

    if (countAfter <= countBefore) return;

    const userId      = after.userId;
    const projectName = after.projectName || "your project";

    logger.info(`[FCM-A] Web quotation on post ${postId} for user ${userId}`);

    if (!userId) {
      logger.warn("[FCM-A] No userId on projectPost — cannot notify builder.");
      return;
    }

    await sendBuilderNotification({ userId, postId, projectName, countAfter });
  }
);

// ── Trigger B: Flutter app writes directly to the quotations subcollection ────
exports.notifyBuilderOnQuotationSubcollection = onDocumentCreated(
  "projectPosts/{postId}/quotations/{quotationId}",
  async (event) => {
    const postId      = event.params.postId;
    const quotationId = event.params.quotationId;

    logger.info(`[FCM-B] Flutter quotation created: ${quotationId} on post ${postId}`);

    // Get the parent projectPost to find the builder's userId
    const postSnap = await db.collection("projectPosts").doc(postId).get();
    if (!postSnap.exists) {
      logger.warn(`[FCM-B] projectPost ${postId} not found.`);
      return;
    }

    const post        = postSnap.data();
    const userId      = post.userId;
    const projectName = post.projectName || "your project";
    const countAfter  = post.quotationCount || 1;

    if (!userId) {
      logger.warn("[FCM-B] No userId on projectPost — cannot notify builder.");
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