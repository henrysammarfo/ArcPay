create table if not exists public.wallet_identities (
  wallet_address text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallet_identities enable row level security;

revoke all on table public.wallet_identities from anon;
grant select, insert, update on table public.wallet_identities to authenticated;

drop policy if exists "Users can read their own wallet identities" on public.wallet_identities;
create policy "Users can read their own wallet identities"
on public.wallet_identities for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own wallet identities" on public.wallet_identities;
create policy "Users can insert their own wallet identities"
on public.wallet_identities for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own wallet identities" on public.wallet_identities;
create policy "Users can update their own wallet identities"
on public.wallet_identities for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists wallet_identities_user_id_idx
on public.wallet_identities (user_id);

drop trigger if exists set_wallet_identities_updated_at on public.wallet_identities;
create trigger set_wallet_identities_updated_at
before update on public.wallet_identities
for each row execute function public.set_updated_at();
