// src/controllers/stripeController.js

const CREATE_CHECKOUT_URL = "https://createcheckoutsession-ydwnagtinq-uc.a.run.app";
const VERIFY_PAYMENT_URL  = "https://verifypaymentsession-ydwnagtinq-uc.a.run.app";

export async function redirectToStripeCheckout({ planId, shopId, shopEmail }) {
  const res = await fetch(CREATE_CHECKOUT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId,
      shopId,
      shopEmail,
      successUrl: `${window.location.origin}/shop/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${window.location.origin}/shop/dashboard`,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Failed to start Stripe checkout.");
  }
  window.location.href = data.url;
}

export async function verifyStripePayment(sessionId) {
  const res = await fetch(VERIFY_PAYMENT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to verify payment.");
  }
  return data;
}