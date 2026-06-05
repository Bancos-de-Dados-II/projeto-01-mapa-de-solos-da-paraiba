export function createMunicipalityRepository(pool) {
  return {
    async listMunicipalities() {
      const { sql, values } = buildMunicipalityQuery();
      const result = await pool.query(sql, values);
      return result.rows;
    },
    async findMunicipalityByCoordinate({ lat, lon }) {
      const result = await pool.query(
        `
          select code_muni, name_muni, abbrev_state
          from public.soil_municipalities
          where ST_Intersects(
            geom,
            ST_SetSRID(ST_Point($1, $2), 4326)
          )
          limit 1
        `,
        [lon, lat]
      );

      return result.rows[0] ?? null;
    },
    async findSoilPoint({ lat, lon }) {
      const result = await pool.query(
        `
          select
            lat,
            lon,
            ph,
            fertility_class as fertility,
            texture_class as texture,
            clay_percent as clay,
            sand_percent as sand,
            nitrogen_g_kg as nitrogen,
            cec_cmolc_kg as cec,
            soc_g_kg as soc
          from public.soil_point_cache
          where lat = $1 and lon = $2
          limit 1
        `,
        [lat, lon]
      );

      return result.rows[0] ?? null;
    },
    async saveSoilPoint(row) {
      await pool.query(
        `
          insert into public.soil_point_cache (
            lat,
            lon,
            ph,
            clay_percent,
            sand_percent,
            nitrogen_g_kg,
            cec_cmolc_kg,
            soc_g_kg,
            texture_class,
            fertility_class
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          on conflict (lat, lon) do update set
            ph = excluded.ph,
            clay_percent = excluded.clay_percent,
            sand_percent = excluded.sand_percent,
            nitrogen_g_kg = excluded.nitrogen_g_kg,
            cec_cmolc_kg = excluded.cec_cmolc_kg,
            soc_g_kg = excluded.soc_g_kg,
            texture_class = excluded.texture_class,
            fertility_class = excluded.fertility_class,
            updated_at = now()
        `,
        [
          row.lat,
          row.lon,
          row.ph,
          row.clay,
          row.sand,
          row.nitrogen,
          row.cec,
          row.soc,
          row.texture,
          row.fertility
        ]
      );
    }
  };
}

export function buildMunicipalityQuery() {
  return {
    sql: `
      select
        code_muni,
        name_muni,
        abbrev_state,
        ph,
        fertility_class as fertility,
        clay_percent as clay,
        sand_percent as sand,
        nitrogen_g_kg as nitrogen,
        cec_cmolc_kg as cec,
        soc_g_kg as soc,
        texture_class as texture,
        centroid_lat,
        centroid_lon,
        ST_AsGeoJSON(geom)::json as geometry
      from public.soil_municipalities
      order by name_muni asc
    `,
    values: []
  };
}
