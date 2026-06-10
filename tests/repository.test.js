import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMunicipalityQuery } from "../src/server/repository.js";

describe("municipality repository query builder", () => {
  it("adds pH, texture and municipality name filters", () => {
    const query = buildMunicipalityQuery({
      phMin: 6,
      phMax: 7.2,
      texture: "Textura media",
      municipality: "Campina"
    });

    assert.match(query.sql, /ph >= \$1/);
    assert.match(query.sql, /ph <= \$2/);
    assert.match(query.sql, /texture_class = \$3/);
    assert.match(query.sql, /lower\(name_muni\) like lower\(\$4\)/);
    assert.deepEqual(query.values, [6, 7.2, "Textura media", "%Campina%"]);
  });

  it("filters by IBGE code when municipality is numeric", () => {
    const query = buildMunicipalityQuery({ municipality: "2507507" });

    assert.match(query.sql, /code_muni = \$1/);
    assert.deepEqual(query.values, [2507507]);
  });
});
