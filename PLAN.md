# Manifest — work correspondence tracker

A single-user tracker for daily work correspondence and follow-ups. Items are
captured once and move between buckets — never rewritten, never deleted.

## Buckets

- **Inbound** — raw capture, unsorted
- **In hand** — actively working today
- **Standing by** — waiting on a specific person (who + optional chase-by date; flagged overdue once passed)
- **Parked** — set aside for later (e.g. next voyage)
- **Closed** — done; kept in history forever

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
`chase_by`, timestamps. No deletes.

`item_events` — append-only log of every bucket move
(`item_id`, `from_bucket`, `to_bucket`, `at`).

"Overdue" is computed in the UI: `bucket = 'standing_by' AND chase_by < today`.

## Offline behavior

- App shell precached by the service worker — the app opens with no signal.
- Last-fetched items cached locally so the board renders offline.
- Captures made offline queue in localStorage and flush on reconnect
  (visible "queued" indicator). Edits/moves require being online in v1.

## Setup

1. Create a Supabase project → SQL editor → paste `supabase/schema.sql`.
2. Authentication → create your user; disable new sign-ups.
3. Copy `.env.example` to `.env`, fill in the project URL and anon key.
4. `npm install && npm run dev` for local; connect the repo to Netlify and set
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars to deploy.
5. On your phone, open the Netlify URL → Add to Home Screen.
