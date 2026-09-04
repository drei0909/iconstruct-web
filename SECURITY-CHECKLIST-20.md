# iConstruct — 20-point security checklist (2026-09-01)

Status of the 20-item list against the codebase, and what was changed this pass.

Legend: ✅ done · 🟡 partial / needs follow-up · 🔄 in progress · ⚠️ needs a person / coordination

---

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Hide API keys | ✅ | The Firebase **web** API key in `src/services/firebase.js` is *meant* to be public — security is Rules + App Check, not key secrecy. PayMongo secret lives in Secret Manager + gitignored `functions/.env.local`. EmailJS public key + reCAPTCHA **site** key are public by design. No real secret ships in the client bundle. |
| 2 | Purge Git secrets | ⚠️ | A Stripe **test** key (`sk_test_51TNqw3…`) is in git *history* (old `functions/.env`). Not in any tracked file today. Stripe isn't used → **rotate it in the Stripe dashboard** (Developers → API keys → roll). A full history purge (`git filter-repo` / BFG + force-push) needs every clone re-cloned — coordinate with your classmate first. No Firebase/PayMongo secret was ever committed. |
| 3 | Use public DB key | ✅ | Exactly the pattern in use — public Firebase config, all enforcement in Security Rules. |
| 4 | Enable row-level security | ✅ | Firestore Security Rules are per-document (row-level) and cover every collection, incl. subcollections and collection-group queries. |
| 5 | Encrypt sensitive data | ✅ | At rest: Google encrypts Firestore + Storage automatically. In transit: HTTPS enforced + HSTS added this pass. OTP codes stored **hashed** (SHA-256), never plaintext. Passwords handled by Firebase Auth (scrypt). |
| 6 | Enforce server-side auth | ✅ | Cloud Functions verify Firebase ID tokens (`requireAuth` / `verifyIdToken`); Rules gate on `request.auth`; the dev proxy now verifies tokens too (review item #4). |
| 7 | Lock record access | 🟡 | Rules restrict per owner/admin (fixed in review #2/#3). **Remaining:** an approved `shops` doc is still readable by any *logged-in* user (incl. Flutter builders) — full fix is a `publicShops` projection with only safe fields; needs mobile-team coordination. |
| 8 | Block field tampering | ✅ | **Changed this pass.** `shops` update rule now also freezes `email`, `uid`, `createdAt`, `documents*`, and caps `fcmTokens ≤ 30` (was: only plan/status frozen). `subscriptionPayments` create now forces `status == "pending"` + `planName ∈ {pro,business}` + size caps (was: no validation). `projectPosts`/`quotations` already used `diff().affectedKeys().hasOnly()`. |
| 9 | Secure session cookies | ✅ | N/A by architecture — no server session cookies. Firebase Auth uses short-lived (1 h) ID tokens + refresh tokens in IndexedDB, sent as `Authorization: Bearer`. |
| 10 | Hash passwords | ✅ | Firebase Auth (scrypt). The app never sees or stores a raw password. |
| 11 | Rate limit login | 🟡 | Firebase Auth has built-in server-side `auth/too-many-requests` throttling. The app adds a client-side (`localStorage`) limiter for defense-in-depth — bypassable. Real app-level server limiting would need a Cloud Function. |
| 12 | Add bot protection | ✅ | App Check with reCAPTCHA Enterprise is **live in monitor mode** (review #5). Flip APIs to *Enforce* once the Flutter app also sends App Check tokens. |
| 13 | Parameterize queries | ✅ | Firestore SDK uses structured/typed queries. Zero SQL, no string-built queries anywhere — no injection surface. |
| 14 | Validate all input | ✅ | **Improved this pass.** Client: form validation + `clean()` sanitizers. Server: Cloud Functions validate email / OTP / planId; Rules validate `projectPosts` (types + length) and now `subscriptionPayments`. Could still add amount bounds to `quotations` in Rules. |
| 15 | Escape user content | ✅ | React auto-escapes. **No** `dangerouslySetInnerHTML` / `innerHTML` / `eval` anywhere. The one SweetAlert `html:` call manually HTML-escapes its user value (`shopName`). |
| 16 | Restrict file uploads | ✅ | **Changed this pass.** `products/{uid}` Storage rule now caps **5 MB + `image/*` only** (was unrestricted). `shop-documents/` already capped 8 MB. `user_profile_images/` (Flutter-owned) left untouched — flag for your classmate to add a size/MIME cap. RegisterForm also validates type/size client-side. |
| 17 | Trim API responses | 🟡 | Cloud Functions return tight JSON. But `shops` reads still return the full doc incl. PII (same as #7), and a few error messages leak infra hints (e.g. "redeploy Cloud Functions"). Soften those for production. |
| 18 | Add security headers | ✅ | **Added this pass** in `firebase.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a **CSP in `Content-Security-Policy-Report-Only` mode**. Deploy hosting, open the site, watch DevTools console for CSP violation reports for a day, fix any, then rename the header to `Content-Security-Policy` to enforce. |
| 19 | Force HTTPS | ✅ | Firebase Hosting auto-redirects HTTP→HTTPS; now also emits HSTS (`max-age=1y; includeSubDomains; preload`). |
| 20 | Scan dependencies | 🔄 | `npm audit` couldn't finish here (slow connection). Run when your connection is stable:<br>`npm audit --omit=dev` (root) and `npm --prefix functions audit --omit=dev`.<br>Then enable **GitHub Dependabot** (`.github/dependabot.yml`) or add an `npm audit` step to CI so it runs on every push. |

---

## Files changed this pass (not yet deployed)

- `firestore.rules` — #8 / #14 (shops field freeze + fcmTokens cap; subscriptionPayments create validation)
- `storage.rules` — #16 (products/ size + image-type cap)
- `firebase.json` — #18 / #19 (security headers + HSTS + Report-Only CSP + asset caching)

**Deploy** (rules + storage + hosting deploy fine even while the *functions* billing issue is unresolved):
```bash
npm run build
firebase deploy --only firestore:rules,storage,hosting
```

## Still open (need a person, not code)
- **#2** rotate the Stripe test key.
- **#7 / #17** `publicShops` projection — coordinate with the Flutter dev.
- **#12** flip App Check to *Enforce* once Flutter sends tokens.
- **#16** `user_profile_images/` size cap — Flutter-owned, coordinate.
- **#20** run `npm audit` + set up Dependabot/CI.
- Plus the billing account fix so Cloud Functions (and review #6) can deploy.
