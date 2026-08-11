-- Run this entire file once in Supabase SQL Editor.
-- It is safe to run again if setup was only partially completed.

create extension if not exists pgcrypto;

create table if not exists public.business_maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
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
  node_shape text not null default 'box',
  node_color text not null default 'default',
  placement text not null default 'right',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_maps add column if not exists description text not null default '';
alter table public.business_map_nodes add column if not exists repeated_work boolean not null default false;
alter table public.business_map_nodes add column if not exists node_shape text not null default 'box';
alter table public.business_map_nodes add column if not exists node_color text not null default 'default';
alter table public.business_map_nodes add column if not exists placement text not null default 'right';

alter table public.business_map_nodes drop constraint if exists business_map_nodes_node_shape_check;
alter table public.business_map_nodes add constraint business_map_nodes_node_shape_check
  check (node_shape in ('box', 'diamond', 'rounded'));
alter table public.business_map_nodes drop constraint if exists business_map_nodes_node_color_check;
alter table public.business_map_nodes add constraint business_map_nodes_node_color_check
  check (node_color in ('default', 'blue', 'yellow', 'rose', 'lavender', 'slate'));
alter table public.business_map_nodes drop constraint if exists business_map_nodes_placement_check;
alter table public.business_map_nodes add constraint business_map_nodes_placement_check
  check (placement in ('right', 'below'));

create index if not exists business_map_nodes_map_id_idx on public.business_map_nodes(map_id);
create index if not exists business_map_nodes_parent_id_idx on public.business_map_nodes(parent_id);

insert into public.business_maps (id, title)
values ('00000000-0000-4000-8000-000000000001', 'Digital Marketing Agency')
on conflict (id) do nothing;

alter table public.business_maps enable row level security;
alter table public.business_map_nodes enable row level security;

drop policy if exists "prototype map read" on public.business_maps;
drop policy if exists "prototype maps insert" on public.business_maps;
drop policy if exists "prototype maps update" on public.business_maps;
drop policy if exists "prototype maps delete" on public.business_maps;
drop policy if exists "prototype nodes read" on public.business_map_nodes;
drop policy if exists "prototype nodes insert" on public.business_map_nodes;
drop policy if exists "prototype nodes update" on public.business_map_nodes;
drop policy if exists "prototype nodes delete" on public.business_map_nodes;

create policy "prototype map read" on public.business_maps for select using (true);
create policy "prototype maps insert" on public.business_maps for insert with check (true);
create policy "prototype maps update" on public.business_maps for update using (true) with check (true);
create policy "prototype maps delete" on public.business_maps for delete
  using (id <> '00000000-0000-4000-8000-000000000001');

create policy "prototype nodes read" on public.business_map_nodes for select using (true);
create policy "prototype nodes insert" on public.business_map_nodes for insert with check (true);
create policy "prototype nodes update" on public.business_map_nodes for update using (true) with check (true);
create policy "prototype nodes delete" on public.business_map_nodes for delete using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.business_maps to anon, authenticated;
grant select, insert, update, delete on public.business_map_nodes to anon, authenticated;

create table if not exists public.app_heartbeats (
  id bigint generated always as identity primary key,
  message text not null check (message = 'hi'),
  created_at timestamptz not null default now()
);

alter table public.app_heartbeats enable row level security;
revoke all on public.app_heartbeats from anon, authenticated;
