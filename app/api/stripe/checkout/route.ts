import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, priceIdForPlan, type PaidPlan } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const plan = body.plan as PaidPlan;
  if (plan !== "pro" && plan !== "agency") {
    return NextResponse.json({ error: "plan must be pro or agency" }, { status: 400 });
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Try again shortly." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan === plan) {
    return NextResponse.json({ error: `You are already on the ${plan} plan.` }, { status: 400 });
  }

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    // Own-row update, allowed by the "own profile update" RLS policy.
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
