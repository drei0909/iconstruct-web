// src/hooks/useLatestPayment.js
import { useEffect, useState } from "react";
import { watchMyLatestPayment } from "../controllers/shopController";

/**
 * The signed-in shop's most recent payment request, kept live.
 *   payment: undefined while loading, null if none, else the request doc
 *   pending: true while a manual payment is waiting for admin review — the
 *            moment the admin confirms or rejects it, this flips back.
 */
export function useLatestPayment() {
  const [payment, setPayment] = useState(undefined);

  useEffect(() => {
    const unsub = watchMyLatestPayment(
      (p) => setPayment(p),
      () => setPayment(null)
    );
    return () => unsub();
  }, []);

  return {
    payment,
    loading: payment === undefined,
    pending: String(payment?.status || "").toLowerCase() === "pending",
  };
}
