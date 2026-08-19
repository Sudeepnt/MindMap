alter table public.business_map_nodes drop constraint if exists business_map_nodes_placement_check;

alter table public.business_map_nodes add constraint business_map_nodes_placement_check
check (placement in ('right', 'below', 'left', 'above', 'top-right', 'bottom-right', 'bottom-left', 'top-left'));
