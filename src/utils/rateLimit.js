// src/utils/rateLimit.js
// Client-side rate limiting (localStorage). Not a substitute for server limits,
// but slows OTP spam, login brute-force, and checkout abuse from the SPA.

const PREFIX = "ic_rl_";

function key(bucket) {
  return PREFIX + bucket;
}

function read(bucket) {
  try {
    const raw = localStorage.getItem(key(bucket));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(bucket, stamps) {
  try {
    localStorage.setItem(key(bucket), JSON.stringify(stamps));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {string} bucket - e.g. "otp:email@x.com" or "login:ip-or-email"
 * @param {{ max: number, windowMs: number }} opts
 * @returns {{ allowed: boolean, retryAfterSec: number, remaining: number }}
 */
export function checkRateLimit(bucket, { max, windowMs }) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = read(bucket).filter((t) => t > cutoff);

  if (stamps.length >= max) {
    const oldest = Math.min(...stamps);
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  return { allowed: true, retryAfterSec: 0, remaining: max - stamps.length };
}

/** Record a successful/attempted action after checkRateLimit allowed it. */
export function hitRateLimit(bucket, { max, windowMs }) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = read(bucket).filter((t) => t > cutoff);
  stamps.push(now);
  write(bucket, stamps.slice(-max));
}

/**
 * Throws Error with user-facing message if over limit; otherwise records a hit.
 */
export function assertRateLimit(bucket, opts, label = "Too many attempts") {
  const result = checkRateLimit(bucket, opts);
  if (!result.allowed) {
    throw new Error(
      `${label}. Please wait ${result.retryAfterSec}s and try again.`
    );
  }
  hitRateLimit(bucket, opts);
  return result;
}

/** Presets used across the app */
export const RATE = {
  otp: { max: 3, windowMs: 10 * 60 * 1000 }, // 3 OTPs / 10 min / email
  login: { max: 6, windowMs: 15 * 60 * 1000 }, // 6 tries / 15 min / email
  register: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 register / hour
  checkout: { max: 4, windowMs: 15 * 60 * 1000 }, // 4 checkouts / 15 min
  passwordReset: { max: 3, windowMs: 30 * 60 * 1000 },
};
