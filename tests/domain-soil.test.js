import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyFertility,
  classifyTexture,
  convertSoilGridsValue,
  parseSoilGridsLayers,
  weightedTopsoilMean
} from "../src/domain/soil.js";

describe("soil domain helpers", () => {
  it("converts SoilGrids mapped values to conventional units", () => {
    assert.equal(convertSoilGridsValue("phh2o", 66), 6.6);
    assert.equal(convertSoilGridsValue("clay", 154), 15.4);
    assert.equal(convertSoilGridsValue("sand", 640), 64);
    assert.equal(convertSoilGridsValue("nitrogen", 150), 1.5);
    assert.equal(convertSoilGridsValue("cec", 73), 7.3);
    assert.equal(convertSoilGridsValue("soc", 86), 8.6);
    assert.equal(convertSoilGridsValue("phh2o", null), null);
  });

  it("calculates weighted 0-30cm mean using SoilGrids layer depths", () => {
    const depths = [
      { label: "0-5cm", values: { mean: 66 } },
      { label: "5-15cm", values: { mean: 65 } },
      { label: "15-30cm", values: { mean: 63 } }
    ];

    assert.equal(weightedTopsoilMean(depths), 64.17);
  });

  it("classifies texture from clay and sand percentages", () => {
    assert.equal(classifyTexture({ clay: 12, sand: 78 }), "Arenoso");
    assert.equal(classifyTexture({ clay: 42, sand: 38 }), "Argiloso");
    assert.equal(classifyTexture({ clay: 24, sand: 45 }), "Textura media");
    assert.equal(classifyTexture({ clay: 30, sand: 62 }), "Mista");
  });

  it("classifies fertility from pH, CEC, SOC and nitrogen", () => {
    assert.equal(
      classifyFertility({ ph: 6.6, cec: 13, soc: 18, nitrogen: 1.4 }),
      "Alta"
    );
    assert.equal(
      classifyFertility({ ph: 5.8, cec: 7, soc: 9, nitrogen: 0.8 }),
      "Media"
    );
    assert.equal(
      classifyFertility({ ph: 8.4, cec: 3, soc: 4, nitrogen: 0.3 }),
      "Baixa"
    );
  });

  it("parses SoilGrids API layers into normalized soil attributes", () => {
    const payload = {
      properties: {
        layers: [
          layer("phh2o", [66, 65, 63]),
          layer("clay", [154, 146, 232]),
          layer("sand", [640, 642, 576]),
          layer("nitrogen", [150, 135, 72]),
          layer("cec", [73, 80, 91]),
          layer("soc", [86, 60, 40])
        ]
      }
    };

    const parsed = parseSoilGridsLayers(payload);

    assert.deepEqual(parsed, {
      ph: 6.42,
      clay: 19.03,
      sand: 60.87,
      nitrogen: 1.06,
      cec: 8.43,
      soc: 5.43,
      texture: "Textura media",
      fertility: "Media"
    });
  });
});

function layer(name, means) {
  return {
    name,
    depths: ["0-5cm", "5-15cm", "15-30cm"].map((label, index) => ({
      label,
      values: { mean: means[index] }
    }))
  };
}
