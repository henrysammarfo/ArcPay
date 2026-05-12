revoke all on table public.user_workspace_settings from anon;
grant select, insert, update, delete on table public.user_workspace_settings to authenticated;

drop policy if exists "Users can delete their own workspace settings" on public.user_workspace_settings;
create policy "Users can delete their own workspace settings"
on public.user_workspace_settings for delete
to authenticated
using (auth.uid() = user_id);
