create index if not exists business_map_connections_source_id_idx
  on public.business_map_connections(source_id);

create index if not exists business_map_connections_target_id_idx
  on public.business_map_connections(target_id);
