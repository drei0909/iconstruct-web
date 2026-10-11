// src/components/shop/PendingPaymentNotice.jsx
// Shown wherever PayMongo is offered while a manual payment awaits admin
// review — a second payment on top would charge the shop twice.

import { formatDateTime } from "../../utils/dateTime";

export default function PendingPaymentNotice({ payment, compact = false }) {
  if (!payment) return null;
  const plan = String(payment.planName || "").toUpperCase();
  return (
    <div
      role="status"
      style={{
        background: "#FFFBEB",
        border: "1px solid #FCD34D",
        borderRadius: 12,
        padding: compact ? "10px 12px" : "14px 16px",
        marginBottom: compact ? 12 : 18,
        fontSize: 12.5,
        color: "#92400E",
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>
        Payment under review — PayMongo is paused
      </div>
      Your manual payment{plan ? ` for the ${plan} plan` : ""}
      {payment.submittedAt ? ` (submitted ${formatDateTime(payment.submittedAt)})` : ""} is
      waiting for admin confirmation. To avoid paying twice, PayMongo checkout is unavailable until
      the admin accepts or rejects it. This updates automatically.
    </div>
  );
}
