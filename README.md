# Inboxprooff

Email authentication auditing and monitoring. Reads the DNS records that decide
whether a domain's mail is trusted — SPF, DKIM, DMARC, MX, MTA-STS, TLS-RPT and
BIMI — scores them out of 100, and hands back the exact record to publish.

## Why this is a business

Since February 2024 Google and Yahoo require SPF, DKIM and DMARC from senders
above ~5,000 messages a day; Microsoft followed at Outlook.com in May 2025. Most
domains are still misconfigured, and the failure is silent — nothing bounces,
the mail just stops landing.

- **Zero marginal cost.** Every check is a DNS lookup. No AI spend, no per-seat
  vendor fees.
- **The free scan is the funnel.** It delivers real value in three seconds, which
  is what earns the signup.
- **Monitoring is inherently recurring.** DNS drifts; a one-time answer expires.
- **Agencies buy in bulk.** One seat covers 50 client domains.

## Stack

- Next.js 15 (App Router) on Vercel
- Supabase for Postgres + auth, with RLS on every table
- DNS-over-HTTPS via Cloudflare, falling back to Google

No service-role key is used anywhere. Privileged reads go through
`security definer` RPCs (`get_scan_report`, `check_scan_quota`), so the only
credential the app ships is the publishable key — which is public by design.

The privileged *write* RPCs used by the Stripe webhook and the cron job
(`apply_stripe_subscription`, `list_monitored_domains`, `record_scan_result`)
are reachable by `anon` and gated only by `INTERNAL_RPC_SECRET`. That secret is
therefore load-bearing: it must never be committed, and it is generated inside
the database by migration `0004` for exactly that reason. See
[Security notes](#security-notes).

## Running locally

```bash
npm install
npm run dev
```

`lib/supabase/config.ts` falls back to the live project, so it runs with no
env file. To point at your own Supabase project, set:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

and apply `supabase/migrations/0001_init_inboxproof_schema.sql`.

## Deployment

Not currently deployed — there is no Vercel project under the connected
account, so nothing is serving this and the daily cron in `vercel.json` never
fires. Deploying creates the project; after the first deploy:

> **One manual step:** each new Vercel project defaults to Vercel Authentication,
> so only logged-in team members can reach it. To make it public:
> Vercel dashboard -> the project -> Settings -> Deployment Protection ->
> set Vercel Authentication to **Disabled** -> Save.

Set `NEXT_PUBLIC_SITE_URL` once a custom domain is attached; canonical URLs,
`sitemap.xml`, `robots.txt` and Open Graph tags all resolve against it (falling
back to `VERCEL_PROJECT_PRODUCTION_URL`).

### Keep Next.js current

Vercel refuses to build Next.js releases carrying a critical CVE, failing with
"Vulnerable version of Next.js detected". This bit us on `next@15.1.6`
(CVE-2025-29927, a middleware authorization bypass). The build passes locally
either way, because it is a Vercel policy check rather than a compile error.
Pinned to `next@15.5.25`. That CVE is worth caring about here on its own merits:
the auth guard in `middleware.ts` is exactly the surface it bypasses.

## Layout

```
app/
  page.tsx              landing page; the scanner is the hero
  pricing/              plans and comparison table
  login/                email + password auth
  dashboard/            monitored domains, scores, scan history
  report/[id]/          shareable public report for one scan
  reset-password/       lands the emailed password-reset link
  error.tsx             route-level failure state
  not-found.tsx         404
  global-error.tsx      root-layout failure (inline styles; no CSS to rely on)
  robots.ts sitemap.ts  generated from lib/site.ts
  api/scan/             the scan endpoint (rate limited, persists results)
  api/lead/             email capture — built, not yet wired to any UI
lib/
  dns.ts                DoH resolver, TXT normalization, domain parsing
  scanner.ts            the scoring engine
  plans.ts              plans, prices and domain caps — single source of truth
  site.ts               canonical public origin
  session-hint.ts       cookie-only signed-in guess for marketing pages
components/
  Scanner.tsx           the hero input and scan sequence
  Results.tsx           per-check readout + the ranked "fix these first" list
  Record.tsx            DNS record rendering with semantic highlighting
  Meter.tsx             segmented score readout
  Specimen.tsx          worked example shown above the fold
```

`lib/plans.ts` is the only place plan pricing and domain caps are written. The
caps must stay in step with `public.plan_domain_limit()` in migration 0001,
which is what actually enforces them.

## Design system

`app/globals.css` holds the tokens. Two things worth knowing before adding UI:

- **Two colour ramps per state.** `pass/warn/fail` are fill colours (meter
  segments, dots, bars) and need 3:1. `pass-ink/warn-ink/fail-ink` are the text
  colours and clear 4.5:1 on both white and their own wash. Do not set small
  type in a fill colour.
- **One type scale.** `text-2xs` … `text-2xl` for UI, `text-d1` … `text-d5` for
  display, plus `text-readout` for the grade letter. There were 32 distinct
  ad-hoc font sizes before these existed; adding a 33rd is how that happens
  again.

## Scoring

| Check | Points | What moves the number |
|---|---|---|
| DMARC | 35 | `p=reject` 15, `p=quarantine` 10, `p=none` 3; `rua` 5; `pct=100` 3 |
| SPF | 25 | `-all` 13, `~all` 9, `?all` 3, `+all` 0; −8 past 10 DNS lookups |
| DKIM | 25 | key found 20; 2048-bit +5; revoked key drops to 4 |
| MX | 5 | records present, provider identified |
| Hardening | 10 | MTA-STS 4, TLS-RPT 3, BIMI 3 |

Totals 100. The landing page's "what we check" grid mirrors these weights, so
change both together — it previously advertised six records adding up to 97.

The SPF check resolves nested `include:` trees to count real lookups, which is
how a record that looks valid turns out to be a PERMERROR.

## Turning on billing and monitoring

The code for both is built and deployed. Three things only a human can do are
what stand between this and the first real dollar:

1. **Stripe.** Create two subscription Products — Pro $29/mo, Agency $99/mo —
   and copy their Price IDs (`price_...`). Create a webhook endpoint pointing
   at `https://<your-domain>/api/stripe/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, and copy
   its signing secret.

2. **Vercel project env vars** (Settings -> Environment Variables), Production:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_AGENCY=price_...
   INTERNAL_RPC_SECRET=<from the step below>
   CRON_SECRET=<openssl rand -hex 24>
   ```
   `INTERNAL_RPC_SECRET` is generated inside the database by migration
   `0004` and handed over once via `public.app_secret_handover` — read it in
   the Supabase SQL editor, paste it here, then drop that table. It is what
   lets the Stripe webhook and the cron job write through `security definer`
   RPCs with no service-role key, and it must never be committed: the
   publishable key is public by design, so this secret is the whole lock.
   Generate `CRON_SECRET` yourself with `openssl rand -hex 24`; Vercel Cron
   reads it automatically (`vercel.json`) and sends it as the `Authorization`
   header, and without it `/api/cron/rescan` stays locked. Redeploy after
   saving — Vercel only picks up new env vars on the next build.

3. **Supabase email confirmation.** Done — "Confirm email" is off
   (`mailer_autoconfirm: true`), so signup returns a session immediately and
   the plan-intent handoff into Stripe Checkout works.

   SMTP is still not wired, though, and that is not the same thing. Supabase's
   built-in mailer is rate limited and intended for testing only, so anything
   that actually has to *deliver* a message is unreliable: password reset
   (`/reset-password`) and the Pro plan's change alerts both need real SMTP
   under Authentication -> Settings -> SMTP Settings.

How the money actually moves once this is done: `/pricing` calls
`POST /api/stripe/checkout`, which opens a Stripe Checkout session for the
signed-in user. Stripe's webhook then calls the `apply_stripe_subscription`
RPC to set `profiles.plan`. Vercel Cron hits `/api/cron/rescan` once a day,
which calls `list_monitored_domains` (pro/agency owners only) and
`record_scan_result` for each — populating `scans` and, on a real change,
`alerts`, which the dashboard now renders.

## Security notes

- `INTERNAL_RPC_SECRET` is the single credential protecting three `anon`-callable
  write RPCs. Migration `0004` generates it in-database, stores only its SHA-256,
  and hands the plaintext over once through `public.app_secret_handover`. Never
  put the value in a file. If it leaks, anyone can set any account's plan, list
  every monitored domain, and forge scan results and alerts.
- The anonymous scan quota is enforced on an IP hash the server computes, but the
  route authenticates to Postgres with the publishable key. Anyone holding that
  key can insert `scans` rows directly with any chosen `ip_hash` and sidestep the
  hourly limit. Closing this properly needs a service-role key or an edge
  function; the current limit stops casual abuse, not a determined one.
- `public.leads` accepts inserts from anyone (`with check (true)`). `/api/lead`
  bounds the field values but not the volume, and nothing in the UI calls it yet.

## Not built yet

- PDF export and the Agency white-label/API features.
- RUA/DMARC aggregate report ingestion — the harder, stickier feature that
  the larger competitors in this space actually charge for; the scanner here
  only reads live DNS state, not mail-flow history.
