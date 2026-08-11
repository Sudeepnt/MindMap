alter table public.business_map_nodes
add column if not exists node_color text not null default 'default';

alter table public.business_map_nodes
drop constraint if exists business_map_nodes_node_color_check;

alter table public.business_map_nodes
add constraint business_map_nodes_node_color_check
check (node_color in ('default', 'blue', 'yellow', 'rose', 'lavender', 'slate'));
