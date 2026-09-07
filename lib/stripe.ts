import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazy on purpose: the Stripe SDK throws at construction time if the key is
 * empty, and STRIPE_SECRET_KEY legitimately won't exist until billing is
 * configured. Constructing eagerly at module scope would crash Next's
 * page-data collection during `next build` even for routes that are never
 * called.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });
  }
  return cached;
}

export type PaidPlan = "pro" | "agency";

/** Env-driven so the two Stripe Price IDs never need to live in code. */
export function priceIdForPlan(plan: PaidPlan): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "agency") return process.env.STRIPE_PRICE_AGENCY ?? null;
  return null;
}

export function planForPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  return null;
}
