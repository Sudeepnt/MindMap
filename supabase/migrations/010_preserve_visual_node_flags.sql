alter table public.business_map_nodes add column if not exists human_branch boolean not null default false;
alter table public.business_map_nodes add column if not exists standalone_node boolean not null default false;
alter table public.business_map_nodes add column if not exists tool_node boolean not null default false;

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
    position_y, collapsed, ai_solution, repeated_work, human_branch, tool_node, standalone_node, node_shape,
    node_color, placement, position_locked, updated_at
  )
  select
    node.id, p_map_id, null, node.heading, node.description, node.sort_order,
    node.position_x, node.position_y, node.collapsed, node.ai_solution,
    node.repeated_work, node.human_branch, node.tool_node, node.standalone_node, node.node_shape, node.node_color, node.placement,
    node.position_locked, now()
  from jsonb_to_recordset(p_nodes) as node(
    id text, parent_id text, heading text, description text, sort_order integer,
    position_x real, position_y real, collapsed boolean, ai_solution boolean,
    repeated_work boolean, human_branch boolean, tool_node boolean, standalone_node boolean, node_shape text, node_color text, placement text,
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
    tool_node = excluded.tool_node,
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

  delete from public.business_map_nodes existing
  where existing.map_id = p_map_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_nodes) as node(id text)
      where node.id = existing.id
    );

  insert into public.business_map_connections (
    id, map_id, source_id, target_id, source_handle, target_handle, updated_at
  )
  select
    connection.id, p_map_id, connection.source_id, connection.target_id,
    connection.source_handle, connection.target_handle, now()
  from jsonb_to_recordset(p_connections) as connection(
    id text, source_id text, target_id text, source_handle text, target_handle text
  )
  where connection.source_id <> connection.target_id
  on conflict (id) do update set
    source_id = excluded.source_id,
    target_id = excluded.target_id,
    source_handle = excluded.source_handle,
    target_handle = excluded.target_handle,
    updated_at = now();

  delete from public.business_map_connections existing
  where existing.map_id = p_map_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_connections) as connection(id text)
      where connection.id = existing.id
    );
end;
$$;

grant execute on function public.save_business_map_state(uuid, text, jsonb, jsonb) to anon, authenticated;
