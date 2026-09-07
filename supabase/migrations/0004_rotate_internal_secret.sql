-- ============================================================
-- Rotate and contain the internal RPC secret.
--
-- WHY THIS EXISTS
--
-- Migration 0003 inserted the shared secret as a string literal, and the
-- README repeated it in the "Vercel project env vars" block. That secret is
-- the ONLY thing standing between the public REST API and three privileged
-- SECURITY DEFINER functions that anon may execute:
--
--   apply_stripe_subscription  -> set any customer's plan to 'agency'
--   list_monitored_domains     -> enumerate every monitored domain + owner
--   record_scan_result         -> forge scan results and alerts
--
-- The Supabase publishable key ships in the browser bundle by design, so
-- anyone who read the repository held both halves of the credential. This
-- migration closes that off:
--
--   1. app_secrets stores the SHA-256 of the secret, never the secret.
--   2. A fresh 32-byte secret is generated inside the database, so no
--      plaintext ever passes through a file that can be committed.
--   3. _check_secret is revoked from anon/authenticated/public. It was
--      reachable at /rest/v1/rpc/_check_secret, which made it a free
--      online oracle for brute-forcing the secret one guess at a time.
--   4. Comparison happens over digests rather than the raw text, so the
--      byte-at-a-time timing signal of comparing the plaintext is gone.
--
-- APPLYING THIS (order matters — 2 and 3 break the webhook until done)
--
--   1. Run this migration.
--   2. In the Supabase SQL editor:   select * from public.app_secret_handover;
--      Copy the value. It is shown once and never appears in the repo.
--   3. Set INTERNAL_RPC_SECRET to that value in Vercel (Production +
--      Preview), then redeploy so the new value is picked up.
--   4. Back in the SQL editor:      drop table public.app_secret_handover;
--
-- Between steps 1 and 3 the Stripe webhook and the daily cron will return
-- 'unauthorized'. Stripe retries failed webhooks, so nothing is lost.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Generate the new secret and store only its digest.
-- ------------------------------------------------------------

create table if not exists public.app_secret_handover (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

revoke all on public.app_secret_handover from anon, authenticated, public;

comment on table public.app_secret_handover is
  'One-time plaintext hand-off for INTERNAL_RPC_SECRET. Read it, put it in '
  'the Vercel env, then: drop table public.app_secret_handover;';

do $$
declare
  new_secret text := encode(gen_random_bytes(32), 'hex');
begin
  insert into public.app_secret_handover (key, value)
  values ('internal_rpc_secret', new_secret)
  on conflict (key) do update set value = excluded.value, created_at = now();

  -- app_secrets now holds the digest, so a read of this table no longer
  -- yields a usable credential.
  insert into public.app_secrets (key, value)
  values ('internal_rpc_secret_sha256', encode(digest(new_secret, 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;

  -- Retire the plaintext row shipped by migration 0003.
  delete from public.app_secrets where key = 'internal_rpc_secret';
end;
$$;

-- ------------------------------------------------------------
-- 2. Check against the digest, and take the function off the public API.
-- ------------------------------------------------------------

-- `extensions` is on the search_path because digest() comes from pgcrypto,
-- which Supabase installs into the extensions schema. Pinning only
-- `public, pg_temp` would make every call fail with "function digest does
-- not exist" -- and _check_secret returning an error rather than false is a
-- broken webhook, not a safe default.
create or replace function public._check_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(p_secret, '') <> ''
     and exists (
       select 1 from public.app_secrets
       where key = 'internal_rpc_secret_sha256'
         and value = encode(digest(p_secret, 'sha256'), 'hex')
     );
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function by default, which
-- is how this ended up exposed as a REST endpoint in the first place.
revoke execute on function public._check_secret(text) from anon, authenticated, public;

-- ------------------------------------------------------------
-- 3. Stop handing user_id to the cron job. It never used the column, and
--    an RPC that leaks auth.users ids to anon on a correct-secret guess is
--    strictly worse than one that does not.
-- ------------------------------------------------------------

drop function if exists public.list_monitored_domains(text);

create function public.list_monitored_domains(p_secret text)
returns table (id uuid, domain text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public._check_secret(p_secret) then
    raise exception 'unauthorized';
  end if;

  return query
    select d.id, d.domain
    from public.domains d
    join public.profiles p on p.id = d.user_id
    where d.monitoring_enabled
      and p.plan in ('pro', 'agency');
end;
$$;

grant execute on function public.list_monitored_domains(text) to anon;

-- ------------------------------------------------------------
-- 4. Refuse a null/blank customer id explicitly. `where col = null` matches
--    nothing today, so this is belt-and-braces rather than a live bug — but
--    a billing write that silently no-ops is worth making loud.
-- ------------------------------------------------------------

create or replace function public.apply_stripe_subscription(
  p_secret text,
  p_customer_id text,
  p_subscription_id text,
  p_plan text,
  p_renews_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touched int;
begin
  if not public._check_secret(p_secret) then
    raise exception 'unauthorized';
  end if;
  if coalesce(p_customer_id, '') = '' then
    raise exception 'customer id is required';
  end if;
  if p_plan not in ('free', 'pro', 'agency') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  update public.profiles
  set plan = p_plan,
      stripe_subscription_id = p_subscription_id,
      plan_renews_at = p_renews_at
  where stripe_customer_id = p_customer_id;

  get diagnostics touched = row_count;

  -- Raising makes the webhook 500, which makes Stripe retry — the right
  -- outcome when a paid plan failed to land on anyone. A downgrade that
  -- matches nothing is not worth retrying: the usual cause is a deleted
  -- account, and the profile row is already gone.
  if touched = 0 and p_plan <> 'free' then
    raise exception 'no profile for stripe customer %', p_customer_id;
  end if;
end;
$$;

grant execute on function public.apply_stripe_subscription(text, text, text, text, timestamptz)
  to anon, authenticated;
