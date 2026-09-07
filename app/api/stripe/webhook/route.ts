import { NextRequest, NextResponse } from "next/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Applies a subscription's current state to the owning profile via a
 * security-definer RPC (see supabase/migrations/0003). This route has no
 * Supabase session — it authenticates to Postgres with a shared secret
 * instead, the same way the cron route does.
 */
async function applySubscription(sub: Stripe.Subscription) {
  const secret = process.env.INTERNAL_RPC_SECRET;
  if (!secret) throw new Error("INTERNAL_RPC_SECRET is not set");

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? planForPriceId(priceId) : null;

  const active = sub.status === "active" || sub.status === "trialing";
  const resolvedPlan = active && plan ? plan : "free";

  const periodEndSeconds =
    sub.items.data[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const renewsAt = periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null;

  const db = createAnonClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await db.rpc("apply_stripe_subscription", {
    p_secret: secret,
    p_customer_id: customerId,
    p_subscription_id: active ? sub.id : null,
    p_plan: resolvedPlan,
    p_renews_at: renewsAt,
  });
  if (error) throw new Error(error.message);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing signature");
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          await applySubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Stripe retries on non-2xx, which is what we want if our DB write failed.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
