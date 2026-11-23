import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { Land } from "./land";
import { from } from "./sphere";

/** 출발점을 가운데로 한 반구가 뭍 */
const HALF = { dist: 0, bear: 0, reach: 90 };
/** 물가까지의 거리(자리표 거리): 행성 둘레의 4분의 1 */
const COAST = (Math.PI * S.R) / 2 / S.wide;

describe("Land", () => {
  it("지도가 뭍을 정하지 않으면 → 온 행성이 뭍", () => {
    const land = new Land();
    const far = from(COAST * 2, 0);
    expect([land.has(far), land.has(far, 500), land.coast(far)]).toEqual([true, true, Infinity]);
  });

  it("반구가 뭍이면 → 물가 안쪽은 뭍, 바깥은 바다", () => {
    const land = new Land(HALF);
    const inside = from(COAST - 10, 40),
      outside = from(COAST + 10, 40);
    expect([land.has(inside), land.has(outside)]).toEqual([true, false]);
  });

  it("inland 를 주면 → 물가에서 그만큼 들어온 자리만 뭍", () => {
    const land = new Land(HALF);
    const nearCoast = from(COAST - 10, 200);
    const metres = land.coast(nearCoast);
    expect(metres).toBeCloseTo(10 * S.wide, 3);
    expect([land.has(nearCoast, 20), land.has(nearCoast, 25)]).toEqual([true, false]);
  });
});
