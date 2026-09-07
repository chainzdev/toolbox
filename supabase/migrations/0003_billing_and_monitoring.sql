-- ============================================================
-- Billing (Stripe) and daily monitoring (cron), applied 2026-08-31.
--
-- Neither the Stripe webhook nor the cron job runs with a user session, so
-- they cannot rely on RLS the normal way and there is no service-role key
-- in this project. The pattern here matches handle_new_user() and
-- enforce_domain_limit() from the init migration: a security definer
-- function, owned by the migration role, does the privileged write after
-- checking a shared secret that only server-side code (never the browser
-- bundle) holds.
--
-- app_secrets deliberately has RLS left OFF and all privileges revoked from
-- anon/authenticated/public, so PostgREST can never read it directly —
-- only a security definer function (running as its owner) can.
-- ============================================================

create table public.app_secrets (
  key text primary key,
  value text not null
);

revoke all on public.app_secrets from anon, authenticated, public;

-- The secret is NOT seeded here. Committing it put the live credential in
-- source control, which is what migration 0004 exists to undo: it generates
-- the value inside the database and stores only its digest. Apply 0004
-- immediately after this one.

create or replace function public._check_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.app_secrets
    where key = 'internal_rpc_secret' and value = p_secret
  );
$$;

-- ------------------------------------------------------------
-- Stripe webhook -> profile. Keyed by stripe_customer_id, which the
-- checkout route stamps onto the caller's own profile beforehand (that
-- write goes through normal RLS, since it happens inside the user's
-- own authenticated request).
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
begin
  if not public._check_secret(p_secret) then
    raise exception 'unauthorized';
  end if;
  if p_plan not in ('free', 'pro', 'agency') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  update public.profiles
  set plan = p_plan,
      stripe_subscription_id = p_subscription_id,
      plan_renews_at = p_renews_at
  where stripe_customer_id = p_customer_id;
end;
$$;

grant execute on function public.apply_stripe_subscription(text, text, text, text, timestamptz)
  to anon, authenticated;

-- ------------------------------------------------------------
-- Daily cron: which domains to re-scan, and where to write results.
-- Monitoring is a paid feature, so only pro/agency owners are returned —
-- a downgrade to free silently stops that domain's daily re-scans.
-- ------------------------------------------------------------

create or replace function public.list_monitored_domains(p_secret text)
returns table (id uuid, user_id uuid, domain text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public._check_secret(p_secret) then
    raise exception 'unauthorized';
  end if;

  return query
    select d.id, d.user_id, d.domain
    from public.domains d
    join public.profiles p on p.id = d.user_id
    where d.monitoring_enabled
      and p.plan in ('pro', 'agency');
end;
$$;

grant execute on function public.list_monitored_domains(text) to anon;

create or replace function public.record_scan_result(
  p_secret text,
  p_domain_id uuid,
  p_score int,
  p_grade text,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d record;
  sev text;
begin
  if not public._check_secret(p_secret) then
    raise exception 'unauthorized';
  end if;

  select id, user_id, domain, last_score, last_grade into d
  from public.domains where id = p_domain_id;

  if not found then
    return;
  end if;

  insert into public.scans (domain_id, user_id, domain, score, grade, results)
  values (p_domain_id, d.user_id, d.domain, p_score, p_grade, p_results);

  update public.domains
  set last_score = p_score, last_grade = p_grade, last_scanned_at = now()
  where id = p_domain_id;

  -- A drop worth waking someone up for, not day-to-day noise.
  if d.last_score is not null and p_score < d.last_score - 4 then
    sev := case when p_score < 60 then 'critical' else 'warning' end;
    insert into public.alerts (user_id, domain_id, domain, severity, title, detail)
    values (
      d.user_id, p_domain_id, d.domain, sev,
      format('%s score dropped from %s to %s', d.domain, d.last_score, p_score),
      format(
        'Grade changed %s -> %s. Check whether SPF, DKIM or DMARC records changed recently.',
        coalesce(d.last_grade, '-'), p_grade
      )
    );
  elsif d.last_grade is not null and d.last_grade <> p_grade and p_score > coalesce(d.last_score, 0) then
    insert into public.alerts (user_id, domain_id, domain, severity, title, detail)
    values (
      d.user_id, p_domain_id, d.domain, 'info',
      format('%s improved to grade %s', d.domain, p_grade),
      'Score increased since the last scan.'
    );
  end if;
end;
$$;

grant execute on function public.record_scan_result(text, uuid, int, text, jsonb) to anon;
