alter table public.business_map_nodes
add column if not exists standalone_node boolean not null default false;
