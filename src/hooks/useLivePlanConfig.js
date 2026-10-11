// src/hooks/useLivePlanConfig.js
import { useEffect, useState } from "react";
import { getLivePlanConfig, peekLivePlanConfig } from "../config/planConfig";

/**
 * The admin-configured plan (price, label, features…). Returns null until the
 * real values are known — callers show a placeholder instead of the static
 * defaults, which is what made the wrong price flash on the Billing page.
 * Instant (no null at all) when the plan doc is already cached.
 */
export function useLivePlanConfig(planKey) {
  const [cfg, setCfg] = useState(() => peekLivePlanConfig(planKey));

  useEffect(() => {
    let cancelled = false;
    getLivePlanConfig(planKey).then((live) => {
      if (!cancelled) setCfg(live);
    });
    return () => {
      cancelled = true;
    };
  }, [planKey]);

  return cfg;
}
