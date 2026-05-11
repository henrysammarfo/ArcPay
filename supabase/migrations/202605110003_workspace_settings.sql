create table if not exists public.user_workspace_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_name text not null default 'Multi-agent agency',
  default_network text not null default 'devnet' check (default_network in ('devnet', 'mainnet')),
  email_notifications boolean not null default true,
  risk_alerts boolean not null default true,
  auto_yield_sweeps boolean not null default false,
  require_wallet_for_actions boolean not null default true,
  enabled_integrations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_workspace_settings enable row level security;

drop policy if exists "Users can read their own workspace settings" on public.user_workspace_settings;
create policy "Users can read their own workspace settings"
on public.user_workspace_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workspace settings" on public.user_workspace_settings;
create policy "Users can insert their own workspace settings"
on public.user_workspace_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workspace settings" on public.user_workspace_settings;
create policy "Users can update their own workspace settings"
on public.user_workspace_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop trigger if exists set_user_workspace_settings_updated_at on public.user_workspace_settings;
create trigger set_user_workspace_settings_updated_at
before update on public.user_workspace_settings
for each row
execute function public.set_updated_at();
