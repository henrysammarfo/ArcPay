create table if not exists public.user_policy_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_policy_settings_settings_object'
      and conrelid = 'public.user_policy_settings'::regclass
  ) then
    alter table public.user_policy_settings
      add constraint user_policy_settings_settings_object
      check (jsonb_typeof(settings) = 'object');
  end if;
end;
$$;

alter table public.user_policy_settings enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on table public.user_policy_settings from anon;
grant select, insert, update, delete on table public.user_policy_settings to authenticated;

drop trigger if exists set_user_policy_settings_updated_at on public.user_policy_settings;
create trigger set_user_policy_settings_updated_at
before update on public.user_policy_settings
for each row
execute function public.set_updated_at();

drop policy if exists "Users can read own policy settings" on public.user_policy_settings;
create policy "Users can read own policy settings"
on public.user_policy_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own policy settings" on public.user_policy_settings;
create policy "Users can insert own policy settings"
on public.user_policy_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own policy settings" on public.user_policy_settings;
create policy "Users can update own policy settings"
on public.user_policy_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own policy settings" on public.user_policy_settings;
create policy "Users can delete own policy settings"
on public.user_policy_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.user_policy_settings is
  'ArcPay per-user treasury policy settings. RLS restricts every row to the authenticated owner.';

comment on column public.user_policy_settings.settings is
  'JSON policy object persisted by the ArcPay frontend policies page.';
