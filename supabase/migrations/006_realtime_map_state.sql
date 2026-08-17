create extension if not exists pgcrypto;

create table if not exists public.business_maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  viewport_x real,
  viewport_y real,
  viewport_zoom real,
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
  human_branch boolean not null default false,
  standalone_node boolean not null default false,
  node_shape text not null default 'box',
  node_color text not null default 'default',
  placement text not null default 'right',
  position_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_map_connections (
  id text primary key,
  map_id uuid not null references public.business_maps(id) on delete cascade,
  source_id text not null references public.business_map_nodes(id) on delete cascade,
  target_id text not null references public.business_map_nodes(id) on delete cascade,
  source_handle text,
  target_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_id <> target_id)
);

alter table public.business_maps add column if not exists description text not null default '';
alter table public.business_maps add column if not exists viewport_x real;
alter table public.business_maps add column if not exists viewport_y real;
alter table public.business_maps add column if not exists viewport_zoom real;
alter table public.business_map_nodes add column if not exists repeated_work boolean not null default false;
alter table public.business_map_nodes add column if not exists human_branch boolean not null default false;
alter table public.business_map_nodes add column if not exists standalone_node boolean not null default false;
alter table public.business_map_nodes add column if not exists node_shape text not null default 'box';
alter table public.business_map_nodes add column if not exists node_color text not null default 'default';
alter table public.business_map_nodes add column if not exists placement text not null default 'right';
alter table public.business_map_nodes add column if not exists position_locked boolean not null default false;

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
create index if not exists business_map_connections_map_id_idx on public.business_map_connections(map_id);
drop index if exists public.business_map_connections_pair_idx;
create unique index business_map_connections_pair_idx
  on public.business_map_connections(map_id, source_id, target_id);

insert into public.business_maps (id, title)
values ('00000000-0000-4000-8000-000000000001', 'Digital Marketing Agency')
on conflict (id) do nothing;

alter table public.business_maps enable row level security;
alter table public.business_map_nodes enable row level security;
alter table public.business_map_connections enable row level security;
alter table public.business_maps replica identity full;
alter table public.business_map_nodes replica identity full;
alter table public.business_map_connections replica identity full;

drop policy if exists "prototype map read" on public.business_maps;
drop policy if exists "prototype maps insert" on public.business_maps;
drop policy if exists "prototype maps update" on public.business_maps;
drop policy if exists "prototype maps delete" on public.business_maps;
drop policy if exists "prototype nodes read" on public.business_map_nodes;
drop policy if exists "prototype nodes insert" on public.business_map_nodes;
drop policy if exists "prototype nodes update" on public.business_map_nodes;
drop policy if exists "prototype nodes delete" on public.business_map_nodes;
drop policy if exists "prototype connections read" on public.business_map_connections;
drop policy if exists "prototype connections insert" on public.business_map_connections;
drop policy if exists "prototype connections update" on public.business_map_connections;
drop policy if exists "prototype connections delete" on public.business_map_connections;

create policy "prototype map read" on public.business_maps for select using (true);
create policy "prototype maps insert" on public.business_maps for insert with check (true);
create policy "prototype maps update" on public.business_maps for update using (true) with check (true);
create policy "prototype maps delete" on public.business_maps for delete
  using (id <> '00000000-0000-4000-8000-000000000001');
create policy "prototype nodes read" on public.business_map_nodes for select using (true);
create policy "prototype nodes insert" on public.business_map_nodes for insert with check (true);
create policy "prototype nodes update" on public.business_map_nodes for update using (true) with check (true);
create policy "prototype nodes delete" on public.business_map_nodes for delete using (true);
create policy "prototype connections read" on public.business_map_connections for select using (true);
create policy "prototype connections insert" on public.business_map_connections for insert with check (true);
create policy "prototype connections update" on public.business_map_connections for update using (true) with check (true);
create policy "prototype connections delete" on public.business_map_connections for delete using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.business_maps to anon, authenticated;
grant select, insert, update, delete on public.business_map_nodes to anon, authenticated;
grant select, insert, update, delete on public.business_map_connections to anon, authenticated;

create or replace function public.save_business_map_state(
  p_map_id uuid,
  p_title text,
  p_nodes jsonb,
  p_connections jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.business_maps (id, title, updated_at)
  values (p_map_id, p_title, now())
  on conflict (id) do update set title = excluded.title, updated_at = now();

  insert into public.business_map_nodes (
    id, map_id, parent_id, heading, description, sort_order, position_x,
    position_y, collapsed, ai_solution, repeated_work, human_branch, standalone_node, node_shape,
    node_color, placement, position_locked, updated_at
  )
  select
    node.id, p_map_id, null, node.heading, node.description, node.sort_order,
    node.position_x, node.position_y, node.collapsed, node.ai_solution,
    node.repeated_work, node.human_branch, node.standalone_node, node.node_shape, node.node_color, node.placement,
    node.position_locked, now()
  from jsonb_to_recordset(p_nodes) as node(
    id text, parent_id text, heading text, description text, sort_order integer,
    position_x real, position_y real, collapsed boolean, ai_solution boolean,
    repeated_work boolean, human_branch boolean, standalone_node boolean, node_shape text, node_color text, placement text,
    position_locked boolean
  )
  on conflict (id) do update set
    heading = excluded.heading,
    description = excluded.description,
    sort_order = excluded.sort_order,
    position_x = excluded.position_x,
    position_y = excluded.position_y,
    collapsed = excluded.collapsed,
    ai_solution = excluded.ai_solution,
    repeated_work = excluded.repeated_work,
    human_branch = excluded.human_branch,
    standalone_node = excluded.standalone_node,
    node_shape = excluded.node_shape,
    node_color = excluded.node_color,
    placement = excluded.placement,
    position_locked = excluded.position_locked,
    updated_at = now();

  update public.business_map_nodes target
  set parent_id = source.parent_id
  from jsonb_to_recordset(p_nodes) as source(id text, parent_id text)
  where target.id = source.id and target.map_id = p_map_id;

  delete from public.business_map_connections where map_id = p_map_id;

  insert into public.business_map_connections (
    id, map_id, source_id, target_id, source_handle, target_handle, updated_at
  )
  select
    connection.id, p_map_id, connection.source_id, connection.target_id,
    connection.source_handle, connection.target_handle, now()
  from jsonb_to_recordset(p_connections) as connection(
    id text, source_id text, target_id text, source_handle text, target_handle text
  );

  delete from public.business_map_nodes
  where map_id = p_map_id
    and not (id = any(select jsonb_array_elements(p_nodes)->>'id'));
end;
$$;

grant execute on function public.save_business_map_state(uuid, text, jsonb, jsonb) to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['business_maps', 'business_map_nodes', 'business_map_connections']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
