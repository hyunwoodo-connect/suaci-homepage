import { describe, expect, it } from "vitest";

import { DEFAULT_MOTION } from "../player/motion";
import { CANDY_ZONE } from "./candy";
import { V79_ZONES } from "./index";
import type { ZoneConfig } from "./zone";
import { DEFAULT_ZONE_COLORS, fogOf, modelKeyIn, motionOf, regionOfZone } from "./zone";

const EMPTY: ZoneConfig = { id: "empty", name: "빈 존", hub: 3 };

describe("존 설정", () => {
  it("빈 존 → 기본 땅·하늘, 흩뿌림·생물 없음", () => {
    const r = regionOfZone(EMPTY);
    expect(r.ground).toEqual(DEFAULT_ZONE_COLORS.ground);
    expect(r.sky).toBe(DEFAULT_ZONE_COLORS.sky);
    expect(r.big).toEqual([]);
    expect(r.tree).toBeNull();
    expect(r.residents).toEqual([]);
    expect(r.checker).toBeUndefined();
  });

  it("간식 존 → 키컬러(바닥·체크 칸·러너·하늘)가 지역으로", () => {
    const r = regionOfZone(CANDY_ZONE);
    expect(r.name).toBe("간식 존");
    expect(r.ground).toEqual([0xffd6e6, 0xfffafc]);
    expect(r.checker).toBe(12);
    expect(r.road).toBe(0xffecd6);
    expect(r.sky).toBe(0xc9b8ff);
  });

  it("몸놀림: 정하지 않은 값 → 지금 큰 행성 값, 정한 값만 바뀐다", () => {
    expect(motionOf(EMPTY)).toEqual(DEFAULT_MOTION);
    expect(motionOf(undefined)).toEqual(DEFAULT_MOTION);
    const floaty = motionOf({ ...EMPTY, motion: { gravity: 1 } });
    expect(floaty.gravity).toBe(1);
    expect(floaty.speed).toBe(DEFAULT_MOTION.speed);
  });

  it("안개: 정하면 그 색, 아니면 하늘색", () => {
    expect(fogOf(CANDY_ZONE)).toBe(0xc9b8ff);
    expect(fogOf({ ...EMPTY, colors: { sky: 0x123456 } })).toBe(0x123456);
  });

  it("모델: 존이 고른 변형이 있으면 그것, 없으면 원래 모델", () => {
    const all = () => true,
      none = () => false;
    expect(modelKeyIn(CANDY_ZONE, "flower_pink", all)).toBe("flower_pink@candy");
    expect(modelKeyIn(CANDY_ZONE, "flower_pink", none)).toBe("flower_pink");
    expect(modelKeyIn(CANDY_ZONE, "teacup", all)).toBe("teacup");
    expect(modelKeyIn(undefined, "teacup", all)).toBe("teacup");
  });

  it("v79 존 여섯 → 마을 번호가 겹치지 않고 0~5", () => {
    const hubs = V79_ZONES.map((z) => z.hub).sort();
    expect(hubs).toEqual([0, 1, 2, 3, 4, 5]);
    const ids = new Set(V79_ZONES.map((z) => z.id));
    expect(ids.size).toBe(6);
  });
});
