-- ============================================================
-- Inboxproof: email deliverability monitoring
-- Applied to project qupnbuhijoivjoqdbwxk on 2026-08-31.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  plan text not null default 'free' check (plan in ('free','pro','agency')),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_renews_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- domains ----------
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  label text,
  monitoring_enabled boolean not null default true,
  last_score int,
  last_grade text,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, domain)
);

create index domains_user_idx on public.domains(user_id);
alter table public.domains enable row level security;

create policy "own domains" on public.domains
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- scans ----------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.domains(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  domain text not null,
  score int not null,
  grade text not null,
  results jsonb not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index scans_domain_idx on public.scans(domain_id, created_at desc);
create index scans_user_idx on public.scans(user_id, created_at desc);
create index scans_ip_idx on public.scans(ip_hash, created_at desc);

alter table public.scans enable row level security;

create policy "own scans read" on public.scans
  for select using (auth.uid() = user_id);
create policy "public scan insert" on public.scans
  for insert with check (true);

-- ---------- alerts ----------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete cascade,
  domain text not null,
  severity text not null check (severity in ('critical','warning','info')),
  title text not null,
  detail text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index alerts_user_idx on public.alerts(user_id, created_at desc);
alter table public.alerts enable row level security;

create policy "own alerts" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- leads ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  domain text,
  score int,
  source text default 'scanner',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "anyone can submit a lead" on public.leads
  for insert with check (true);

-- ============================================================
-- Security-definer RPCs, so the app needs no service-role key
-- ============================================================

create or replace function public.get_scan_report(p_id uuid)
returns table (id uuid, domain text, score int, grade text, results jsonb, created_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.domain, s.score, s.grade, s.results, s.created_at
  from public.scans s
  where s.id = p_id
  limit 1;
$$;

create or replace function public.check_scan_quota(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.scans
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';
  return recent < 12;
end;
$$;

create or replace function public.plan_domain_limit(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'agency' then 50
    when 'pro' then 10
    else 1
  end;
$$;

create or replace function public.enforce_domain_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count int;
  cap int;
  user_plan text;
begin
  select plan into user_plan from public.profiles where id = new.user_id;
  cap := public.plan_domain_limit(coalesce(user_plan, 'free'));
  select count(*) into current_count from public.domains where user_id = new.user_id;
  if current_count >= cap then
    raise exception 'DOMAIN_LIMIT_REACHED: your plan allows % monitored domain(s)', cap
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger domains_enforce_limit
  before insert on public.domains
  for each row execute function public.enforce_domain_limit();

grant execute on function public.get_scan_report(uuid) to anon, authenticated;
grant execute on function public.check_scan_quota(text) to anon, authenticated;
grant execute on function public.plan_domain_limit(text) to anon, authenticated;
