# Manifest — work correspondence tracker

A single-user tracker for daily work correspondence and follow-ups. Items are
captured once and move between buckets — never rewritten, and never lost to a
stray tap: deleting sends an item to Trash, where it can be restored.

Phone-first, installable as a PWA, and usable with no signal.

## Buckets

- **📥 Inbound** — raw capture, unsorted
- **⚡ In hand** — actively working today
- **⏳ Standing by** — waiting on a specific person (who + optional chase-by date; flagged overdue once passed)
- **📦 Parked** — set aside for later (e.g. next voyage)
- **✅ Closed** — done; kept in history forever

**🗑️ Trash** is not a bucket but a view of items with `deleted_at` set. They keep
their original bucket, so restoring puts them back where they were. Purging from
Trash is the only real delete in the app.

## Priority

Orthogonal to bucket: 🔴 High, ⚪ Normal (the default), 🔵 Low — set from the
expanded card. High and low carry a marker on the card; normal stays unmarked so
only the exceptions draw the eye. Priority floats items to the top of whatever
bucket they're in, ahead of the existing ordering, and the header counts
outstanding high-priority items once nothing is overdue.

For *when* rather than *how urgent* — this voyage vs the next — use `Parked` for
things that can wait, or tags like `#nextvoyage` to mark items that stay in play
but only matter later.

## Tags

Free-form tags live in a `text[]` column on the item (normalized lowercase, no
`#`). Tags are added from the card with autocomplete from tags already in use,
and tapping one filters the board.

## Stack

- **Frontend:** Vite + React + TypeScript, installable PWA (`vite-plugin-pwa`).
  Phone-first UI; app shell cached for offline use.
- **Backend:** none — `@supabase/supabase-js` talks directly to Supabase.
- **Storage:** Supabase (Postgres). Schema in `supabase/schema.sql`.
- **Auth:** Supabase email/password, single account, sign-ups disabled.
  Needed because the anon key ships publicly in the static site; RLS restricts
  all data access to authenticated users.
- **Hosting:** Netlify free tier, static deploy of `dist/`.

## Data model

`items` — one row per item: `title`, `notes`, `bucket`
(`inbound | in_hand | standing_by | parked | closed`), `waiting_on`,
`chase_by`, `tags`, `priority` (2 high / 1 normal / 0 low), timestamps,
`deleted_at`. Deleting is an update that stamps
`deleted_at`; a hard delete only happens on an explicit purge from Trash, which
cascades that item's events out with it.

`item_events` — append-only log of every bucket move
(`item_id`, `from_bucket`, `to_bucket`, `at`).

"Overdue" is computed in the UI: `bucket = 'standing_by' AND chase_by < today`.

`supabase/schema.sql` is the hand-maintained source of truth for the database —
keep it in step with any change applied to the live project.

## Offline behavior

- App shell precached by the service worker — the app opens with no signal.
- Last-fetched items cached locally so the board renders offline.
- Captures made offline queue in localStorage and flush on reconnect
  (visible "queued" indicator). Edits, moves, and deletes require being online.

## Setup

1. Create a Supabase project → SQL editor → paste `supabase/schema.sql`.
2. Authentication → create your user; disable new sign-ups.
3. Copy `.env.example` to `.env`, fill in the project URL and anon key.
4. `npm install && npm run dev` for local; connect the repo to Netlify and set
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars to deploy.
5. On your phone, open the Netlify URL → Add to Home Screen.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run lint` | Oxlint |
