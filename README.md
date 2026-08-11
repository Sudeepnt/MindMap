# deepmap.ai

A Supabase-backed library of left-to-right business operation maps with unlimited children, automatic layout, AI and repeated-work markers, branch collapse, drag persistence, pan, zoom, and undo/redo.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Enable Supabase sync

The supplied project URL and publishable key are already in `.env.local`. In the Supabase SQL editor, run these migrations in order:

`supabase/migrations/001_business_map.sql`

`supabase/migrations/002_library_and_heartbeat.sql`

`supabase/migrations/003_node_shapes.sql`

`supabase/migrations/004_node_colors.sql`

`supabase/migrations/005_vertical_children.sql`

Until the schema is installed, the app automatically saves the full map to local browser storage and displays `Local draft` in the toolbar.

The prototype policies allow publishable-key users to create and edit maps. Add Supabase Auth and owner-scoped RLS before exposing the app as a multi-user product.

## Heartbeat deployment

The heartbeat must run outside Supabase so it can reach an inactive project. Deploy to Vercel and set:

`SUPABASE_SERVICE_ROLE_KEY` - Supabase Dashboard > Project Settings > API Keys. Never expose this value with a `NEXT_PUBLIC_` prefix.

`CRON_SECRET` - a random value with at least 16 characters.

Vercel invokes `/api/heartbeat` daily. The secured endpoint queries Supabase each day and inserts the message `hi` only when the previous heartbeat is at least 48 hours old.

Free Supabase projects can still be paused when activity is considered insufficient. A paid Supabase plan is the only documented guarantee against inactivity pausing.
