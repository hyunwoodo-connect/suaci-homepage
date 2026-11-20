import { describe, expect, it } from "vitest";

import { RegionNamer } from "./regionName";

describe("RegionNamer", () => {
  it("처음 서 있는 지역 → 이름을 띄우지 않는다", () => {
    const namer = new RegionNamer(0, 10);
    expect(namer.step(0, 1, 0)).toBeNull();
  });

  it("섞임 띠 가운데(0.5)를 넘기 전 → 아직 아니다, 넘으면 → 그 지역", () => {
    const namer = new RegionNamer(0, 10);
    expect(namer.step(1, 0.4, 1)).toBeNull();
    expect(namer.step(1, 0.6, 2)).toBe(1);
  });

  it("들어선 지역에 머무는 동안 → 다시 띄우지 않는다", () => {
    const namer = new RegionNamer(0, 10);
    namer.step(1, 1, 1);
    expect(namer.step(1, 1, 2)).toBeNull();
  });

  it("같은 경계를 10초 안에 되넘으면 → 띄우지 않는다, 10초 뒤면 → 띄운다", () => {
    const namer = new RegionNamer(0, 10);
    expect(namer.step(1, 1, 0)).toBe(1);
    expect(namer.step(0, 1, 4)).toBeNull();
    expect(namer.step(1, 1, 8)).toBeNull();
    expect(namer.step(0, 1, 19)).toBe(0);
  });

  it("다른 경계 → 바로 띄운다", () => {
    const namer = new RegionNamer(0, 10);
    namer.step(1, 1, 0);
    expect(namer.step(2, 1, 1)).toBe(2);
  });
});
