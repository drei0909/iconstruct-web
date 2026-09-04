# iConstruct — Second security scan (2026-09-01)

Findings beyond the original 7-item review (#1–#7 already fixed/tracked).
Severity is relative — nothing here is as severe as the original unsigned-webhook
issue. Most are Medium / hardening.

---

## HIGH-ish

### A. `subscriptionPayments` create rule has no field validation
**Where:** `firestore.rules` →
```
match /subscriptionPayments/{paymentId} {
  allow create: if signedIn() && request.resource.data.shopId == request.auth.uid;
}
```
**Impact:** a signed-in shop can write a payment doc with **any** `status`
(e.g. `"confirmed"`), any `planName` / `planPrice`, an oversized
`screenshotBase64`, and unlimited such docs. It does **not** self-grant a plan
(plan fields on `shops` are admin-only), but it:
- pollutes admin metrics (`getPaymentStats` counts "confirmed"),
- makes the shop's own dashboard show "plan active",
- is a latent privilege-escalation if any future code trusts
  `subscriptionPayments.status == "confirmed"`,
- allows spamming the collection.

**Fix:** in the create rule, require
`request.resource.data.status == "pending"`,
`request.resource.data.planName in ["pro","business"]`,
`request.resource.data.screenshotBase64.size() < 400000`, and
`request.resource.data.keys().hasOnly([...])`.

### B. Manual-payment approval trusts the shop's submitted `planName` / `planPrice`
**Where:** `AdminDashboardPage.handleConfirmPayment(p.id, p.planName, p.shopId)` →
`adminController.confirmPayment` → `updateShopSubscription(shopId, planName, expiry)`.
`planName` comes straight from the shop-created `subscriptionPayments` doc.
**Impact:** a shop submits `planName: "business"` with a fake / low reference and
no real screenshot; a careless admin clicking **Confirm & Activate** grants
Business. The modal even displays the attacker-supplied plan + price as if
authoritative.
**Fix:** in the admin review modal, make the admin pick the plan from a fixed
dropdown and show the canonical price from `planConfig`; don't echo the submitted
value. Ideally move activation into a Cloud Function that recomputes the price and
verifies the screenshot exists.

---

## MEDIUM

### C. `shops` owner-update rule lets a shop freely mutate `email` / `documents` / `fcmTokens`
**Where:** `firestore.rules` `match /shops/{shopId}` `allow update` — only
`subscriptionPlan/Status/Expiry/status` are frozen.
**Impact (approved shop):**
- change own `email` field → the new server-side forgot-password lookup
  (`requestEmailOtp` purpose `password_reset`) matches that shop and emails an OTP
  + the shop's owner name to the victim address (nuisance / mild phishing aid).
- rewrite / clear own `documents[]` after approval → destroys the KYC audit trail.
- bloat `fcmTokens` with thousands of entries → `notifyShopsOnNewProject` fans out
  to all of them on every new project → wasted FCM quota / cost (amplification).

**Fix:** in the update rule also freeze `email`, `documents`, `uid`, `createdAt`;
cap `fcmTokens` size (`request.resource.data.fcmTokens.size() <= 20`).

### D. Server-side rate limiting gaps
**Where:** `src/utils/rateLimit.js` is `localStorage`-only (trivially bypassed).
The OTP Cloud Functions have their own IP/in-memory limits (good), but
`submitContactMessage`, `submitQuotation`, `submitPaymentRequest` rely **only** on
the client limiter.
**Impact:** contact-form spam, quotation spam, payment-doc spam are unthrottled at
the server.
**Fix:** enforce in rules where feasible (per-email throttle doc), or move these
writes behind Cloud Functions with real limiting.

### E. `registerShop` can orphan a Firebase Auth user
**Where:** `authController.registerShop` — creates the Auth user, uploads docs,
then `setDoc(shops/{uid})`. Only the *upload* failure path calls
`cred.user.delete()`.
**Impact:** if `setDoc` throws after uploads succeed, you get an Auth account with
no `shops` doc + orphaned Storage files; the person can't re-register
(email taken) and can't log in (`no-shop`).
**Fix:** wrap `setDoc` in try/catch with `cred.user.delete()` + best-effort
Storage cleanup, or do registration entirely in a Cloud Function.

### F. Client-side admin creation hijacks the session and isn't rules-enforceable
**Where:** `settingsController.createAdmin` →
`createUserWithEmailAndPassword(auth, …)` on the shared client `auth`.
**Impact:** signs the current admin OUT and into the new account, then
`setDoc(admins/{uid})` runs as the brand-new user (not yet an admin) — the
`admins` write rule `if isAdmin()` should reject it, so the new "admin" likely
ends up with an Auth account but **no** `admins` doc (silent partial failure).
**Fix:** create admins via a Cloud Function (Admin SDK / secondary app).

### G. PayMongo amount is recorded but never verified
**Where:** `functions/index.js` `activateShopSubscription` — grants the plan from
`metadata.planId` / `reference_number`; stores `amountCentavos` but never compares
it to `PLAN_PRICES[planId].amount`.
**Impact:** low now that the webhook signature is verified and the checkout amount
is server-set, but a partial capture / mismatched amount would still activate.
**Fix:** if `amountCentavos != null && amountCentavos < PLAN_PRICES[planId].amount`
→ refuse + log.

---

## LOW / HARDENING

### H. Storage rules: no size / content-type limit on `products/` and `user_profile_images/`
`storage.rules` — `shop-documents/` caps at 8 MB, but `products/{userId}/**` and
`user_profile_images/**` allow any authenticated write with no size or MIME check.
**Fix:** add
`request.resource.size < 5 * 1024 * 1024 && request.resource.contentType.matches('image/.*')`.

### I. Transactional emails still sent from the browser
`emailService.js` — OTP is server-side (good), but approval / rejection / payment /
contact-reply / maintenance emails send client-side via EmailJS with the public
key + template IDs in the bundle. Abusable against your EmailJS quota.
**Fix:** move remaining transactional emails to Cloud Functions.

### J. `shops` read still exposes PII to every logged-in user
Item #2's fix (`signedIn() && status=="approved"`) stopped anonymous scraping but
`email`, `phone`, `address`, `documents[]` (ID/permit/selfie URLs), `fcmTokens`
are still readable by **any** authenticated user, including every Flutter builder.
**Fix (still outstanding):** a `publicShops/{shopId}` projection with only safe
fields, synced by a Cloud Function trigger; lock `shops` to owner/admin. Needs
mobile-team coordination.

### K. OTP attempt counter resets on resend
`verifyEmailOtp` caps at 8 wrong guesses per OTP doc, but a resend
(`requestEmailOtp`, limited 3/10min/email + 12/IP/15min) issues a fresh doc with
`attempts: 0`. Combined limits keep brute-force impractical, but the reset weakens
it slightly.
**Fix:** track cumulative failed attempts per email across resends, or lower the
per-doc cap.

### L. No security headers on Firebase Hosting
`firebase.json` has no `headers` block. Add `Content-Security-Policy`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, and `Strict-Transport-Security`. Shrinks XSS blast radius.

### M. Verbose infra hints in user-facing errors
`authController` OTP errors instruct the user to run
`firebase deploy --only functions:…`; admin toasts mention "Check Firestore
rules". Minor info disclosure — soften for production.

### N. Housekeeping
- `docs.zip` sits in the repo root; `dist/` was historically tracked.
- `functions/.env` was committed in history with a **Stripe test key**
  (`sk_test_…`) — rotate it in the Stripe dashboard (Stripe is unused now).
  No PayMongo secret was ever committed.

---

## Not vulnerabilities (checked, OK)
- No `dangerouslySetInnerHTML` / `eval` / `innerHTML` anywhere in the client.
- `projectPosts` / `quotations` / `conversations` create rules are well-constrained
  (owner binding, length caps, no price fields, status forced).
- `otps` / `paymongo*` / `checkoutSessions` collections are `read,write: if false`
  (Admin SDK only).
- Admin `onRequest` endpoints (`runSubscriptionExpiryNow`, etc.) check
  `requireAuth` + `admins/{uid}` existence.
- `systemConfig` public read is fine (plans / maintenance notice / notif toggles —
  nothing sensitive).
- App Check is live in monitor mode (#5).
