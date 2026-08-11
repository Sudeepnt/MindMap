create table if not exists public.business_maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_map_nodes (
  id text primary key,
  map_id uuid not null references public.business_maps(id) on delete cascade,
  parent_id text references public.business_map_nodes(id) on delete cascade,
  heading text not null check (char_length(heading) between 1 and 90),
  description text not null default '' check (char_length(description) <= 320),
  sort_order integer not null default 0,
  position_x real not null default 0,
  position_y real not null default 0,
  collapsed boolean not null default false,
  ai_solution boolean not null default false,
  repeated_work boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_map_nodes_map_id_idx on public.business_map_nodes(map_id);
create index if not exists business_map_nodes_parent_id_idx on public.business_map_nodes(parent_id);

alter table public.business_map_nodes
add column if not exists repeated_work boolean not null default false;

insert into public.business_maps (id, title)
values ('00000000-0000-4000-8000-000000000001', 'Digital Marketing Agency')
on conflict (id) do nothing;

alter table public.business_maps enable row level security;
alter table public.business_map_nodes enable row level security;

-- Prototype policy: publishable-key users can edit this map. Replace with
-- authenticated owner policies before inviting multiple organizations.
create policy "prototype map read" on public.business_maps for select using (true);
create policy "prototype nodes read" on public.business_map_nodes for select using (true);
create policy "prototype nodes insert" on public.business_map_nodes for insert with check (map_id = '00000000-0000-4000-8000-000000000001');
create policy "prototype nodes update" on public.business_map_nodes for update using (map_id = '00000000-0000-4000-8000-000000000001');
create policy "prototype nodes delete" on public.business_map_nodes for delete using (map_id = '00000000-0000-4000-8000-000000000001');

grant usage on schema public to anon, authenticated;
grant select on public.business_maps to anon, authenticated;
grant select, insert, update, delete on public.business_map_nodes to anon, authenticated;
