/**
 * The plans, in one place.
 *
 * These used to be written out three times — the landing page, the pricing
 * page and the dashboard's LIMITS map — which is how the landing page ended
 * up with CTAs that dropped the upgrade intent while /pricing handled it.
 * The domain caps here must stay in step with `public.plan_domain_limit()`
 * in supabase/migrations/0001; that function is the one that actually
 * enforces them, this is only what we promise.
 */

export type PlanId = "free" | "pro" | "agency";
export type PaidPlanId = Exclude<PlanId, "free">;

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  /** Who the plan is for, in one line. */
  line: string;
  features: string[];
  cta: string;
  /** Where a signed-out visitor goes. Signed-in users get Stripe instead. */
  href: string;
  featured: boolean;
  /** Monitored domains allowed. Mirrors plan_domain_limit() in Postgres. */
  domainLimit: number;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    line: "For checking a domain right now.",
    features: [
      "Unlimited manual scans",
      "Full record-level breakdown",
      "Copy-paste fixes for every failure",
      "1 saved domain with scan history",
      "Shareable report links",
    ],
    cta: "Start scanning",
    href: "/login?mode=signup",
    featured: false,
    domainLimit: 1,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    cadence: "per month",
    line: "For a company that sends email that matters.",
    features: [
      "10 monitored domains",
      "Daily automatic re-scans",
      "Email alerts on any record change",
      "Full scan history and diffs",
      "PDF audit reports",
      "Priority support",
    ],
    cta: "Start free, upgrade anytime",
    href: "/login?mode=signup&plan=pro",
    featured: true,
    domainLimit: 10,
  },
  {
    id: "agency",
    name: "Agency",
    price: "$99",
    cadence: "per month",
    line: "For anyone answerable for other people's domains.",
    features: [
      "50 monitored domains",
      "White-label client reports",
      "Team seats",
      "Scan API access",
      "Bulk domain import",
      "Slack and webhook alerts",
    ],
    cta: "Start free, upgrade anytime",
    href: "/login?mode=signup&plan=agency",
    featured: false,
    domainLimit: 50,
  },
];

export const COMPARE: { label: string; free: string; pro: string; agency: string }[] = [
  { label: "Manual scans", free: "Unlimited", pro: "Unlimited", agency: "Unlimited" },
  { label: "Saved domains", free: "1", pro: "10", agency: "50" },
  { label: "Automatic re-scans", free: "—", pro: "Daily", agency: "Daily" },
  { label: "Change alerts", free: "—", pro: "Email", agency: "Email, Slack, webhook" },
  { label: "Scan history", free: "Last 10", pro: "Unlimited", agency: "Unlimited" },
  { label: "White-label reports", free: "—", pro: "—", agency: "Included" },
  { label: "API access", free: "—", pro: "—", agency: "Included" },
];

export function domainLimitFor(plan: string): number {
  return PLANS.find((p) => p.id === plan)?.domainLimit ?? 1;
}

export function planName(plan: string): string {
  return PLANS.find((p) => p.id === plan)?.name ?? "Free";
}
