create extension if not exists postgis;

create table if not exists public.soil_municipalities (
  code_muni integer primary key,
  name_muni text not null,
  abbrev_state char(2) not null default 'PB',
  centroid_lat double precision not null,
  centroid_lon double precision not null,
  ph numeric(4, 2),
  clay_percent numeric(5, 2),
  sand_percent numeric(5, 2),
  nitrogen_g_kg numeric(6, 3),
  cec_cmolc_kg numeric(6, 2),
  soc_g_kg numeric(6, 2),
  texture_class text not null,
  fertility_class text not null,
  soil_source text not null default 'SoilGrids 2.0 mean 0-30cm via municipality centroid',
  geom geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz not null default now()
);

create index if not exists soil_municipalities_geom_idx
  on public.soil_municipalities using gist (geom);

alter table public.soil_municipalities enable row level security;

create policy soil_municipalities_app_select
  on public.soil_municipalities
  for select
  to mapa_solos_app
  using (true);

create policy soil_municipalities_app_insert
  on public.soil_municipalities
  for insert
  to mapa_solos_app
  with check (true);

create policy soil_municipalities_app_update
  on public.soil_municipalities
  for update
  to mapa_solos_app
  using (true)
  with check (true);

create table if not exists public.soil_point_cache (
  lat double precision not null,
  lon double precision not null,
  ph numeric(4, 2),
  clay_percent numeric(5, 2),
  sand_percent numeric(5, 2),
  nitrogen_g_kg numeric(6, 3),
  cec_cmolc_kg numeric(6, 2),
  soc_g_kg numeric(6, 2),
  texture_class text not null,
  fertility_class text not null,
  soil_source text not null default 'SoilGrids 2.0 mean 0-30cm via selected coordinate',
  updated_at timestamptz not null default now(),
  primary key (lat, lon)
);

alter table public.soil_point_cache enable row level security;

create policy soil_point_cache_app_select
  on public.soil_point_cache
  for select
  to mapa_solos_app
  using (true);

create policy soil_point_cache_app_insert
  on public.soil_point_cache
  for insert
  to mapa_solos_app
  with check (true);

create policy soil_point_cache_app_update
  on public.soil_point_cache
  for update
  to mapa_solos_app
  using (true)
  with check (true);

revoke execute on function public.st_estimatedextent(text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text) from public;
revoke execute on function public.st_estimatedextent(text, text, text) from public;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from public;

-- The frontend never queries Supabase directly. The Render API uses DATABASE_URL.
-- RLS remains enabled and no anon/authenticated policies are created for these tables.
