import { describe, expect, it } from "vitest";

import { V79_MAP } from "./v79";

describe("지도 v79(티파티 정원 — MAP-03)", () => {
  const L = V79_MAP.layout;

  it("자리표 v3 의 쉼터 14 → 이름·종류를 붙이고 높이 그대로(키우지 않는다)", () => {
    expect(L.site).toHaveLength(14);
    const carousel = L.site.find((st) => st.k === "carousel")!;
    expect(carousel).toMatchObject({ name: "회전목마", kind: "land", size: 18, by: "h", sc: 1 });
    const sofa = L.site.find((st) => st.k === "sofa")!;
    expect(sofa.kind).toBe("rest");
  });

  it("꾸밈 837·숨는 자리 12 → 그대로, 기획용 갈래(garden·playground) → 뺀다", () => {
    expect(L.decor).toHaveLength(837);
    expect(L.hideSpot).toHaveLength(12);
    expect("garden" in L).toBe(false);
    expect(L.playground).toBeUndefined();
  });

  it("다른 지역은 비었다: 별·나무·대포·레일 없음, 정원 기구만", () => {
    expect(L.star).toEqual([]);
    expect(L.tree).toEqual([]);
    expect(L.cannon).toEqual([]);
    expect(L.rail).toEqual([]);
    expect(L.bumper).toHaveLength(10);
  });

  it("정원 바닥: 분홍·흰 체크(한 칸 12m), 큰 길은 테이블 러너, 하늘 라벤더", () => {
    const garden = V79_MAP.regions[0];
    expect(garden.ground).toEqual([0xffd6e6, 0xfffafc]);
    expect(garden.road).toBe(0xffecd6);
    expect(garden.sky).toBe(0xc9b8ff);
    expect(V79_MAP.checker).toBe(12);
  });

  it("거인의 케이크 → 모델 cake, 높이 70m", () => {
    const cake = L.landmark?.find((m) => m.model);
    expect(cake).toMatchObject({ model: "cake", height: 70, region: 0 });
  });
});
