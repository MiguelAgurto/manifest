-- Fixes for Supabase database-linter warnings (run once in the SQL editor).
-- Scopes all rows to the owning user instead of blanket `true` policies.

-- 1. Add ownership columns. `default auth.uid()` stamps new rows automatically,
--    so the app code doesn't need to change.
alter table items add column if not exists user_id uuid
  references auth.users (id) default auth.uid();
alter table item_events add column if not exists user_id uuid
  references auth.users (id) default auth.uid();

-- Backfill existing rows to the single existing user.
update items set user_id = (select id from auth.users limit 1) where user_id is null;
update item_events set user_id = (select id from auth.users limit 1) where user_id is null;

alter table items alter column user_id set not null;
alter table item_events alter column user_id set not null;

-- 2. Replace the always-true policies with owner-scoped ones.
drop policy if exists "authenticated read items"   on items;
drop policy if exists "authenticated insert items" on items;
drop policy if exists "authenticated update items" on items;
drop policy if exists "authenticated read events"  on item_events;
drop policy if exists "authenticated log events"   on item_events;

create policy "own items read"   on items for select to authenticated
  using (user_id = auth.uid());
create policy "own items insert" on items for insert to authenticated
  with check (user_id = auth.uid());
create policy "own items update" on items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own events read"  on item_events for select to authenticated
  using (user_id = auth.uid());
create policy "own events insert" on item_events for insert to authenticated
  with check (user_id = auth.uid());

-- 3. Lock down the rls_auto_enable() SECURITY DEFINER function.
--    NOTE: this function is not part of the Manifest schema — something else
--    created it. Revoking execute silences the warning without breaking
--    whatever installed it. If you don't recognize it, you can also run:
--      drop function if exists public.rls_auto_enable() cascade;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
