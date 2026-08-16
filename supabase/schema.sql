-- Manifest schema. Paste into the Supabase SQL editor.

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text,
  bucket      text not null default 'inbound'
              check (bucket in ('inbound','in_hand','standing_by','parked','closed')),
  waiting_on  text,          -- who we're waiting on (standing_by)
  chase_by    date,          -- optional chase date (standing_by)
  tags        text[] not null default '{}',
  priority    smallint not null default 1     -- 2 high, 1 normal, 0 low
              check (priority between 0 and 2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz,
  deleted_at  timestamptz,  -- soft delete; row survives in the Trash view
  user_id     uuid not null references auth.users (id) default auth.uid()
);

create table if not exists item_events (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references items(id) on delete cascade,
  from_bucket text,
  to_bucket   text not null,
  note        text,
  at          timestamptz not null default now(),
  user_id     uuid not null references auth.users (id) default auth.uid()
);

create index if not exists items_bucket_idx on items (bucket);
create index if not exists items_tags_idx on items using gin (tags);
create index if not exists items_deleted_at_idx on items (deleted_at);
create index if not exists items_priority_idx on items (priority);
create index if not exists item_events_item_idx on item_events (item_id);

alter table items enable row level security;
alter table item_events enable row level security;

-- Rows are scoped to their owner via user_id (stamped by default auth.uid()).
-- Deleting is a two-step road: the UI only ever sets deleted_at (an update),
-- moving the item to Trash. A real delete happens only on an explicit purge
-- from there, which cascades the item's events out with it.
create policy "own items read"    on items       for select to authenticated using (user_id = auth.uid());
create policy "own items insert"  on items       for insert to authenticated with check (user_id = auth.uid());
create policy "own items update"  on items       for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own items delete"  on items       for delete to authenticated using (user_id = auth.uid());
create policy "own events read"   on item_events for select to authenticated using (user_id = auth.uid());
create policy "own events insert" on item_events for insert to authenticated with check (user_id = auth.uid());

-- Housekeeping, not part of the Manifest schema: the database also carries a
-- SECURITY DEFINER function `public.rls_auto_enable()` that something else
-- created. Its execute grant was revoked to silence a linter warning:
--   revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- If you don't recognize it, `drop function if exists public.rls_auto_enable() cascade;`
-- is safe as far as Manifest is concerned.
