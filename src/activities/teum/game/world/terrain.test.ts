import { describe, expect, it } from "vitest";

import { V78_MAP } from "../maps/v78";
import { V79_MAP } from "../maps/v79";
import { S } from "../settings";
import { from } from "./sphere";
import { Terrain } from "./terrain";

describe("Terrain 흩뿌림 둘레", () => {
  it("v79 → 꽃은 꽃밭 마을 둘레(360m) 안에만, 뭉게구름은 구름 마을 둘레 안에만", () => {
    const L = V79_MAP.layout;
    const t = new Terrain(V79_MAP.seed, V79_MAP.terrain, L.hill, L.hub);
    const flowerHub = from(L.hub[3].dist, L.hub[3].bear),
      cloudHub = from(L.hub[4].dist, L.hub[4].bear);
    for (const v of t.flowers.v) expect(v.angleTo(flowerHub) * S.R).toBeLessThanOrEqual(360 + 1e-6);
    for (const v of t.clouds.v) expect(v.angleTo(cloudHub) * S.R).toBeLessThanOrEqual(380 + 1e-6);
    expect(t.flowers.v).toHaveLength(V79_MAP.terrain.flowers);
  });

  it("v78(둘레 없음) → 행성 전체에 흩는다", () => {
    const L = V78_MAP.layout;
    const t = new Terrain(V78_MAP.seed, V78_MAP.terrain, L.hill, L.hub);
    const south = t.flowers.v.filter((v) => v.y < -0.5).length;
    expect(south).toBeGreaterThan(100);
  });
});
