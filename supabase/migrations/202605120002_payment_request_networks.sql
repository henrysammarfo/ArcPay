alter table public.arcpay_payment_requests
add column if not exists network text;

update public.arcpay_payment_requests
set network = 'devnet'
where network is null;

alter table public.arcpay_payment_requests
alter column network set default 'devnet';

alter table public.arcpay_payment_requests
alter column network set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'arcpay_payment_requests_network_check'
  ) then
    alter table public.arcpay_payment_requests
    add constraint arcpay_payment_requests_network_check
    check (network in ('devnet', 'mainnet'));
  end if;
end $$;

create index if not exists arcpay_payment_requests_user_network_idx
on public.arcpay_payment_requests (user_id, network, created_at desc);
