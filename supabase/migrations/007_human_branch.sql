alter table public.business_map_nodes
add column if not exists human_branch boolean not null default false;
