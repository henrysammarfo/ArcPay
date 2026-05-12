alter table public.arcpay_invoices
add column if not exists network text;

update public.arcpay_invoices
set network = 'mainnet'
where network is null;

alter table public.arcpay_invoices
alter column network set default 'mainnet';

alter table public.arcpay_invoices
alter column network set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arcpay_invoices_network_check'
  ) then
    alter table public.arcpay_invoices
    add constraint arcpay_invoices_network_check
    check (network in ('devnet', 'mainnet'));
  end if;
end $$;

alter table public.arcpay_contractors
add column if not exists network text;

update public.arcpay_contractors
set network = 'devnet'
where network is null;

alter table public.arcpay_contractors
alter column network set default 'devnet';

alter table public.arcpay_contractors
alter column network set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arcpay_contractors_network_check'
  ) then
    alter table public.arcpay_contractors
    add constraint arcpay_contractors_network_check
    check (network in ('devnet', 'mainnet'));
  end if;
end $$;

alter table public.arcpay_privacy_events
add column if not exists network text;

update public.arcpay_privacy_events
set network = 'devnet'
where network is null;

alter table public.arcpay_privacy_events
alter column network set default 'devnet';

alter table public.arcpay_privacy_events
alter column network set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arcpay_privacy_events_network_check'
  ) then
    alter table public.arcpay_privacy_events
    add constraint arcpay_privacy_events_network_check
    check (network in ('devnet', 'mainnet'));
  end if;
end $$;

create index if not exists arcpay_invoices_user_network_idx
on public.arcpay_invoices (user_id, network, created_at desc);

create index if not exists arcpay_contractors_user_network_idx
on public.arcpay_contractors (user_id, network, created_at desc);

create index if not exists arcpay_privacy_events_user_network_idx
on public.arcpay_privacy_events (user_id, network, created_at desc);
