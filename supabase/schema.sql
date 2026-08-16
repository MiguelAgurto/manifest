-- Manifest schema. Paste into the Supabase SQL editor.

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text,
  bucket      text not null default 'inbound'
              check (bucket in ('inbound','in_hand','standing_by','parked','closed')),
  waiting_on  text,          -- who we're waiting on (standing_by)
  chase_by    date,          -- optional chase date (standing_by)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz,
  user_id     uuid not null references auth.users (id) default auth.uid()
);

create table if not exists item_events (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references items(id),
  from_bucket text,
  to_bucket   text not null,
  note        text,
  at          timestamptz not null default now(),
  user_id     uuid not null references auth.users (id) default auth.uid()
);

create index if not exists items_bucket_idx on items (bucket);
create index if not exists item_events_item_idx on item_events (item_id);

alter table items enable row level security;
alter table item_events enable row level security;

-- Rows are scoped to their owner via user_id (stamped by default auth.uid()).
-- No delete policy on items — closed items are permanent history.
create policy "own items read"    on items       for select to authenticated using (user_id = auth.uid());
create policy "own items insert"  on items       for insert to authenticated with check (user_id = auth.uid());
create policy "own items update"  on items       for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own events read"   on item_events for select to authenticated using (user_id = auth.uid());
create policy "own events insert" on item_events for insert to authenticated with check (user_id = auth.uid());
