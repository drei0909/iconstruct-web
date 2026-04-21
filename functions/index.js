require("dotenv").config();
// iConstruct — Stripe Cloud Functions Backend

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors")({ origin: true });

setGlobalOptions({ maxInstances: 10 });

// ─── PLAN PRICES (in Philippine Peso, converted to centavos for Stripe) ───────
// Stripe uses smallest currency unit: PHP uses centavos (1 PHP = 100 centavos)
const PLAN_PRICES = {
  pro:      { amount: 49900,  currency: "php", name: "iConstruct Pro Plan",      interval: "month" },
  business: { amount: 449900, currency: "php", name: "iConstruct Business Plan",  interval: "year"  },
};

// ─── CREATE STRIPE CHECKOUT SESSION ──────────────────────────────────────────
// Called from frontend: creates a Stripe Checkout session and returns the URL
exports.createCheckoutSession = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { planId, shopId, shopEmail, successUrl, cancelUrl } = req.body;

      if (!planId || !PLAN_PRICES[planId]) {
        return res.status(400).json({ error: "Invalid plan selected." });
      }

      const plan = PLAN_PRICES[planId];

      const session = await stripe.checkout.sessions.create({
       payment_method_types: ["card"],
        mode: "payment", // one-time payment (manual renewal)
        line_items: [
          {
            price_data: {
              currency: plan.currency,
              product_data: {
                name: plan.name,
                description: `iConstruct ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan subscription`,
              },
              unit_amount: plan.amount,
            },
            quantity: 1,
          },
        ],
        customer_email: shopEmail || undefined,
        metadata: {
          shopId:  shopId  || "",
          planId:  planId,
          source:  "iconstruct-web",
        },
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

// ─── VERIFY STRIPE PAYMENT SESSION ───────────────────────────────────────────
// Called after redirect from Stripe to verify the payment was successful
exports.verifyPaymentSession = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required." });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        return res.status(200).json({
          success:  true,
          paid:     true,
          planId:   session.metadata?.planId,
          shopId:   session.metadata?.shopId,
          email:    session.customer_email,
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