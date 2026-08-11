alter table public.business_maps
add column if not exists description text not null default '';

drop policy if exists "prototype maps insert" on public.business_maps;
drop policy if exists "prototype maps update" on public.business_maps;
drop policy if exists "prototype maps delete" on public.business_maps;

create policy "prototype maps insert"
on public.business_maps for insert
with check (true);

create policy "prototype maps update"
on public.business_maps for update
using (true)
with check (true);

create policy "prototype maps delete"
on public.business_maps for delete
using (id <> '00000000-0000-4000-8000-000000000001');

grant insert, update, delete on public.business_maps to anon, authenticated;

create table if not exists public.app_heartbeats (
  id bigint generated always as identity primary key,
  message text not null check (message = 'hi'),
  created_at timestamptz not null default now()
);

alter table public.app_heartbeats enable row level security;

-- No anon policies are intentional. Only the server-side service role can
-- read or write heartbeat records.
revoke all on public.app_heartbeats from anon, authenticated;
