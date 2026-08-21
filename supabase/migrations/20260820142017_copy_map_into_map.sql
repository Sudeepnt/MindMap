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

  if copied_count = 0 then
    return 0;
  end if;

  if exists (select 1 from public.business_map_nodes where map_id = p_target_map_id) then
    select
      coalesce((select max(position_x) from public.business_map_nodes where map_id = p_target_map_id), 0)
        + 420
        - coalesce((select min(position_x) from public.business_map_nodes where map_id = p_source_map_id), 0),
      coalesce((select min(position_y) from public.business_map_nodes where map_id = p_target_map_id), 0)
        - coalesce((select min(position_y) from public.business_map_nodes where map_id = p_source_map_id), 0)
    into offset_x, offset_y;
  end if;

  insert into public.business_map_nodes (
    id, map_id, parent_id, heading, description, sort_order, position_x,
    position_y, collapsed, ai_solution, repeated_work, human_branch, tool_node,
    standalone_node, node_shape, node_color, placement, position_locked, updated_at
  )
  select
    id_map ->> source.id,
    p_target_map_id,
    null,
    source.heading,
    source.description,
    source.sort_order,
    source.position_x + offset_x,
    source.position_y + offset_y,
    source.collapsed,
    source.ai_solution,
    source.repeated_work,
    source.human_branch,
    source.tool_node,
    source.standalone_node,
    source.node_shape,
    source.node_color,
    source.placement,
    true,
    now()
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
    'relation-' || gen_random_uuid()::text,
    p_target_map_id,
    id_map ->> connection.source_id,
    id_map ->> connection.target_id,
    connection.source_handle,
    connection.target_handle,
    now()
  from public.business_map_connections connection
  where connection.map_id = p_source_map_id;

  update public.business_maps
  set updated_at = now()
  where id = p_target_map_id;

  return copied_count;
end;
$$;

revoke execute on function public.copy_business_map_into(uuid, uuid) from public;
grant execute on function public.copy_business_map_into(uuid, uuid) to anon, authenticated;
