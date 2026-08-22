# Recommendation Engine — status

**Scope: web only.** The Flutter app / AI assistant does **not** need to implement this.

## Where it runs today

| Surface | Role |
|---|---|
| Super Admin → System Settings → Recommendation Engine | Edit formulas + reference prices; live preview |
| Shop → Quote modal | Shows a rough platform total when the project has `totalAreaSqm` (reference only) |

## Firestore (optional reference)

| | |
|---|---|
| Path | `systemConfig/recommendationEngine` |
| Read | Public |
| Write | Admins only |
| Schema | `{ schemaVersion: 1, formula, pricing, updatedAt }` |

Math lives in `src/utils/recommendationEngine.js`.

If the mobile AI assistant later needs the same numbers, it can read this doc — that is optional and out of scope for the current web release.
