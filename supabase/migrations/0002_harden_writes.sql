-- ============================================================
-- Hardening pass, applied 2026-08-31 after live testing found that
-- anyone holding the publishable key could write arbitrary rows into
-- public.scans. The key ships in the browser bundle, so this was
-- reachable by anyone who viewed source.
-- ============================================================

-- Omitting user_id previously failed with a confusing
-- "violates row-level security policy" error. Defaulting it to the caller
-- makes the column impossible to forget, and RLS still rejects any attempt
-- to set it to somebody else.
alter table public.domains alter column user_id set default auth.uid();

-- For scans this also does the right thing for the anonymous scanner:
-- auth.uid() is null when signed out, which is exactly the value we want.
alter table public.scans alter column user_id set default auth.uid();

-- ------------------------------------------------------------
-- Make the anonymous scan quota enforceable by the database itself,
-- not just by the API route. check_scan_quota is SECURITY DEFINER, so it
-- can count rows the anon role cannot read -- which is what lets an RLS
-- policy apply the limit.
-- ------------------------------------------------------------

drop policy if exists "public scan insert" on public.scans;

create policy "rate limited scan insert" on public.scans
  for insert with check (
    -- signed in: may only write scans attributed to themselves
    (auth.uid() is not null and user_id = auth.uid())
    -- anonymous: unattributed, and only while under the hourly quota
    or (
      auth.uid() is null
      and user_id is null
      and ip_hash is not null
      and public.check_scan_quota(ip_hash)
    )
  );

-- ------------------------------------------------------------
-- Trigger functions must not be reachable over the REST API.
-- ------------------------------------------------------------

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.enforce_domain_limit() from anon, authenticated, public;

-- ------------------------------------------------------------
-- Pin the search_path on the last function missing it.
-- ------------------------------------------------------------

create or replace function public.plan_domain_limit(p_plan text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_plan
    when 'agency' then 50
    when 'pro' then 10
    else 1
  end;
$$;
