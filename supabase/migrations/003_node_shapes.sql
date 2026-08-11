alter table public.business_map_nodes
add column if not exists node_shape text not null default 'box';

alter table public.business_map_nodes
drop constraint if exists business_map_nodes_node_shape_check;

alter table public.business_map_nodes
add constraint business_map_nodes_node_shape_check
check (node_shape in ('box', 'diamond', 'rounded'));
