alter table public.business_map_nodes
  add column if not exists automated_work boolean not null default false;

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
  if jsonb_typeof(p_nodes) <> 'array' or jsonb_typeof(p_connections) <> 'array' then
    raise exception 'Nodes and connections must be JSON arrays';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_nodes) as input(id text)
    join public.business_map_nodes existing on existing.id = input.id
    where existing.map_id <> p_map_id
  ) then
    raise exception 'A node ID is already owned by another map';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_nodes) as child(id text, parent_id text)
    where child.parent_id is not null
      and not exists (
        select 1 from jsonb_to_recordset(p_nodes) as parent(id text)
        where parent.id = child.parent_id
      )
  ) then
    raise exception 'Every parent must belong to the saved map state';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_connections) as input(id text)
    join public.business_map_connections existing on existing.id = input.id
    where existing.map_id <> p_map_id
  ) then
    raise exception 'A connection ID is already owned by another map';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_connections) as connection(source_id text, target_id text)
    where connection.source_id = connection.target_id
      or not exists (
        select 1 from jsonb_to_recordset(p_nodes) as source(id text)
        where source.id = connection.source_id
      )
      or not exists (
        select 1 from jsonb_to_recordset(p_nodes) as target(id text)
        where target.id = connection.target_id
      )
  ) then
    raise exception 'Every connection endpoint must belong to the saved map state';
  end if;

  insert into public.business_maps (id, title, updated_at)
  values (p_map_id, p_title, now())
  on conflict (id) do update set title = excluded.title, updated_at = now();

  insert into public.business_map_nodes (
    id, map_id, parent_id, heading, description, sort_order, position_x,
    position_y, collapsed, ai_solution, repeated_work, human_branch, human_ai_mix,
    automated_work, tool_node, standalone_node, node_shape, node_color, placement,
    position_locked, updated_at
  )
  select
    node.id, p_map_id, null, node.heading, node.description, node.sort_order,
    node.position_x, node.position_y, node.collapsed, node.ai_solution,
    node.repeated_work, node.human_branch, node.human_ai_mix, node.automated_work,
    node.tool_node, node.standalone_node, node.node_shape, node.node_color,
    node.placement, node.position_locked, now()
  from jsonb_to_recordset(p_nodes) as node(
    id text, parent_id text, heading text, description text, sort_order integer,
    position_x real, position_y real, collapsed boolean, ai_solution boolean,
    repeated_work boolean, human_branch boolean, human_ai_mix boolean,
    automated_work boolean, tool_node boolean, standalone_node boolean,
    node_shape text, node_color text, placement text, position_locked boolean
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
    human_ai_mix = excluded.human_ai_mix,
    automated_work = excluded.automated_work,
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
      select 1 from jsonb_to_recordset(p_nodes) as node(id text)
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
  on conflict (id) do update set
    source_id = excluded.source_id,
    target_id = excluded.target_id,
    source_handle = excluded.source_handle,
    target_handle = excluded.target_handle,
    updated_at = now();

  delete from public.business_map_connections existing
  where existing.map_id = p_map_id
    and not exists (
      select 1 from jsonb_to_recordset(p_connections) as connection(id text)
      where connection.id = existing.id
    );
end;
$$;

revoke execute on function public.save_business_map_state(uuid, text, jsonb, jsonb) from public;
grant execute on function public.save_business_map_state(uuid, text, jsonb, jsonb) to anon, authenticated;

create or replace function public.copy_business_map_into(
  p_source_map_id uuid,
  p_target_map_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  id_map jsonb;
  copied_count integer;
  offset_x real := 0;
  offset_y real := 0;
begin
  if p_source_map_id = p_target_map_id then
    raise exception 'Source and target maps must be different';
  end if;
  if not exists (select 1 from public.business_maps where id = p_source_map_id) then
    raise exception 'Source map does not exist';
  end if;
  if not exists (select 1 from public.business_maps where id = p_target_map_id) then
    raise exception 'Target map does not exist';
  end if;

  select jsonb_object_agg(source.id, 'node-' || gen_random_uuid()::text), count(*)::integer
  into id_map, copied_count
  from public.business_map_nodes source
  where source.map_id = p_source_map_id;

  if copied_count = 0 then return 0; end if;

  if exists (select 1 from public.business_map_nodes where map_id = p_target_map_id) then
    select
      coalesce((select max(position_x) from public.business_map_nodes where map_id = p_target_map_id), 0)
        + 420 - coalesce((select min(position_x) from public.business_map_nodes where map_id = p_source_map_id), 0),
      coalesce((select min(position_y) from public.business_map_nodes where map_id = p_target_map_id), 0)
        - coalesce((select min(position_y) from public.business_map_nodes where map_id = p_source_map_id), 0)
    into offset_x, offset_y;
  end if;

  insert into public.business_map_nodes (
    id, map_id, parent_id, heading, description, sort_order, position_x,
    position_y, collapsed, ai_solution, repeated_work, human_branch, human_ai_mix,
    automated_work, tool_node, standalone_node, node_shape, node_color, placement,
    position_locked, updated_at
  )
  select
    id_map ->> source.id, p_target_map_id, null, source.heading, source.description,
    source.sort_order, source.position_x + offset_x, source.position_y + offset_y,
    source.collapsed, source.ai_solution, source.repeated_work, source.human_branch,
    source.human_ai_mix, source.automated_work, source.tool_node,
    source.standalone_node, source.node_shape, source.node_color, source.placement,
    true, now()
  from public.business_map_nodes source
  where source.map_id = p_source_map_id;

  update public.business_map_nodes copied
  set parent_id = id_map ->> source.parent_id
  from public.business_map_nodes source
  where source.map_id = p_source_map_id
    and source.parent_id is not null
    and copied.id = id_map ->> source.id
    and copied.map_id = p_target_map_id;

  insert into public.business_map_connections (
    id, map_id, source_id, target_id, source_handle, target_handle, updated_at
  )
  select
    'relation-' || gen_random_uuid()::text, p_target_map_id,
    id_map ->> connection.source_id, id_map ->> connection.target_id,
    connection.source_handle, connection.target_handle, now()
  from public.business_map_connections connection
  where connection.map_id = p_source_map_id;

  update public.business_maps set updated_at = now() where id = p_target_map_id;
  return copied_count;
end;
$$;

revoke execute on function public.copy_business_map_into(uuid, uuid) from public;
grant execute on function public.copy_business_map_into(uuid, uuid) to anon, authenticated;
