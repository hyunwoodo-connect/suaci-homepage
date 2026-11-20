import { describe, expect, it } from "vitest";

import { DEFAULT_MAP, lazyMapName } from "./index";
import { scatterHubs } from "./map";
import { V79_MAP } from "./v79";

describe("지도 고르기", () => {
  it("?map=v79 → 고를 때만 받는 지도 v79(운영에서도)", () => {
    expect(lazyMapName("?map=v79")).toBe("v79");
  });

  it("?map 없음·모르는 이름·v78 → null(기본 지도 v78 은 그대로)", () => {
    expect(lazyMapName("")).toBeNull();
    expect(lazyMapName("?map=nope")).toBeNull();
    expect(lazyMapName("?map=v78")).toBeNull();
    expect(DEFAULT_MAP.name).toBe("v78");
  });
});

describe("scatterHubs", () => {
  it("hubs 가 없으면 → 모든 마을", () => {
    expect(scatterHubs(DEFAULT_MAP.bigFlowers, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("v79 → 큰 꽃은 꽃밭(3)에만, 비눗방울은 물가(5)에만, 꼬마 라임은 없다", () => {
    expect(scatterHubs(V79_MAP.bigFlowers, 6)).toEqual([3]);
    expect(scatterHubs(V79_MAP.bubbles, 6)).toEqual([5]);
    expect(V79_MAP.babyLimes.perHub).toBe(0);
  });
});

describe("지도 v2(v79) 지역", () => {
  it("마을 0 은 간식 존(존 설정의 이름) — 출발은 늘 간식 존, 숨바꼭질 판은 띄우지 않는다", () => {
    expect(V79_MAP.regions.map((r) => r.name)).toEqual([
      "간식 존",
      "밤 존",
      "놀이 존",
      "청량의 숲",
      "낮잠 존",
      "휴가 존",
    ]);
    expect(V79_MAP.startHub).toBe(0);
    expect(V79_MAP.hideSeek).toBe(false);
  });

  it("전설: 왕관은 장난감 궁전(2)에만, 사슴은 꽃밭(3)에만", () => {
    const crowns = V79_MAP.creatures.legends.c_wcrown.map(([hub]) => hub);
    const deer = V79_MAP.creatures.legends.c_deer.map(([hub]) => hub);
    expect(new Set(crowns)).toEqual(new Set([2]));
    expect(new Set(deer)).toEqual(new Set([3]));
  });

  it("한 조형물·나무는 한 지역에만", () => {
    const seen = new Map<string, number>();
    V79_MAP.regions.forEach((r, i) => {
      for (const k of [...r.big, ...r.small]) {
        expect(seen.get(k) ?? i).toBe(i);
        seen.set(k, i);
      }
    });
  });
});
