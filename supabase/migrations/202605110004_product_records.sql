create extension if not exists pgcrypto;

create table if not exists public.arcpay_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_id text not null unique default ('pay_' || encode(gen_random_bytes(8), 'hex')),
  amount numeric(20, 8) not null check (amount > 0),
  token text not null check (token in ('USDC', 'AUDD', 'PUSD', 'SOL')),
  memo text not null default '',
  route_to text not null default 'operating',
  status text not null default 'pending' check (status in ('pending', 'settled', 'failed', 'cancelled')),
  payment_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arcpay_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_id text not null unique default ('inv_' || encode(gen_random_bytes(8), 'hex')),
  client text not null,
  email text not null,
  amount numeric(20, 8) not null check (amount > 0),
  token text not null check (token in ('USDC', 'AUDD', 'PUSD', 'SOL')),
  due date not null,
  memo text not null default '',
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue', 'failed', 'cancelled')),
  payment_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arcpay_contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  wallet text not null,
  currency text not null default 'USDC' check (currency in ('USDC', 'AUDD', 'PUSD', 'SOL')),
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  risk_status text not null default 'unscored' check (risk_status in ('approve', 'review', 'reject', 'unscored', 'error')),
  risk_reasons jsonb not null default '[]'::jsonb,
  private_route boolean not null default false,
  paid_30 numeric(20, 8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arcpay_privacy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('shield', 'viewing_key')),
  provider text not null,
  amount numeric(20, 8),
  token text not null default 'USDC',
  recipient_name text not null default '',
  recipient_email text not null default '',
  scope text not null default '',
  status text not null default 'pending' check (status in ('pending', 'ready_to_sign', 'submitted', 'failed', 'configured')),
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.arcpay_payment_requests enable row level security;
alter table public.arcpay_invoices enable row level security;
alter table public.arcpay_contractors enable row level security;
alter table public.arcpay_privacy_events enable row level security;

revoke all on table public.arcpay_payment_requests from anon;
revoke all on table public.arcpay_invoices from anon;
revoke all on table public.arcpay_contractors from anon;
revoke all on table public.arcpay_privacy_events from anon;

grant select, insert, update, delete on table public.arcpay_payment_requests to authenticated;
grant select, insert, update, delete on table public.arcpay_invoices to authenticated;
grant select, insert, update, delete on table public.arcpay_contractors to authenticated;
grant select, insert, update, delete on table public.arcpay_privacy_events to authenticated;

drop trigger if exists set_arcpay_payment_requests_updated_at on public.arcpay_payment_requests;
create trigger set_arcpay_payment_requests_updated_at
before update on public.arcpay_payment_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_arcpay_invoices_updated_at on public.arcpay_invoices;
create trigger set_arcpay_invoices_updated_at
before update on public.arcpay_invoices
for each row execute function public.set_updated_at();

drop trigger if exists set_arcpay_contractors_updated_at on public.arcpay_contractors;
create trigger set_arcpay_contractors_updated_at
before update on public.arcpay_contractors
for each row execute function public.set_updated_at();

drop trigger if exists set_arcpay_privacy_events_updated_at on public.arcpay_privacy_events;
create trigger set_arcpay_privacy_events_updated_at
before update on public.arcpay_privacy_events
for each row execute function public.set_updated_at();

drop policy if exists "Users can manage own payment requests" on public.arcpay_payment_requests;
create policy "Users can manage own payment requests"
on public.arcpay_payment_requests
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoices" on public.arcpay_invoices;
create policy "Users can manage own invoices"
on public.arcpay_invoices
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own contractors" on public.arcpay_contractors;
create policy "Users can manage own contractors"
on public.arcpay_contractors
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own privacy events" on public.arcpay_privacy_events;
create policy "Users can manage own privacy events"
on public.arcpay_privacy_events
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
