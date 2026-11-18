import { describe, expect, it } from "vitest";

import manifest from "../../assets/manifest.v10.json";
import { STAGE_HUB } from "../hideseek/spots";
import { halfWidthFromBoxes } from "../hideseek/stageZones";
import { from } from "../world/sphere";
import { handBodies, stageBodies } from "./placed";
import { findTangles } from "./tangles";
import { V78_MAP } from "./v78";

// 자리표(손으로 놓은 것)와 숨바꼭질 자리(값)만으로 보는 점검 — 게임을 짓지 않는다.
// 숨바꼭질 값(hideseek.data.json)이나 자리표를 고쳐 물건이 놀이기구·랜드마크에 엉키면 여기서 걸린다

const halfWidthOf = halfWidthFromBoxes((key) => {
  const box = (manifest.assets as Record<string, { box?: number[] }>)[key]?.box;
  if (!box) throw new Error(`manifest 에 ${key} 의 크기 상자가 없다`);
  return box;
});

describe("숨바꼭질 자리 × 자리표(v78)", () => {
  const spot = V78_MAP.layout.hub[STAGE_HUB],
    hub = from(spot.dist, spot.bear),
    hand = handBodies(V78_MAP, () => []),
    stage = stageBodies(hub, halfWidthOf, hand);

  it("후보 물건·탑·버섯·구경꾼 자리·출발 줄이 손으로 놓은 것과 엉키지 않는다", () => {
    const ponds = V78_MAP.layout.lake.map((l, i) => ({
        name: `lake#${i}`,
        v: from(l.dist, l.bear),
        r: l.r,
      })),
      found = findTangles([...hand, ...stage], ponds).filter(
        (t) => t.a.layer === "숨바꼭질" || t.b?.layer === "숨바꼭질",
      ),
      lines = found.map((t) => `${t.kind}: ${t.a.name} · ${t.b?.name ?? t.pond}`);
    expect(lines).toEqual([]);
  });

  it("통통 구름 위 물건은 그 밑의 통통 구름에 얹힌 것으로 본다", () => {
    const perches = stage.filter((b) => b.name.startsWith("perch("));
    expect(perches.length).toBeGreaterThan(0);
    for (const perch of perches) expect(perch.attached, perch.name).toMatch(/^pad#/);
  });
});
