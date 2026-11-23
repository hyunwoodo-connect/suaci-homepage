import { describe, expect, it } from "vitest";

import type { Manifest } from "../../assets/manifest";
import manifestJson from "../../assets/manifest.v4.json";
import { checkMap } from "./check";
import { MAPS } from "./index";
import type { GameMap } from "./map";
import { V78_MAP } from "./v78";

// 지도 점검: 등록된 지도는 모두 깨끗하고, 흔한 실수(겹치게·물 위·행성 밖·없는 에셋·차례 바꿈)는 잡는다

const manifest = manifestJson as unknown as Manifest;

// v78 을 복사해 한 군데만 고친 지도
function edited(change: (m: GameMap) => void): GameMap {
  const m = structuredClone(V78_MAP);
  change(m);
  return m;
}

function kindsOf(map: GameMap): string[] {
  const kinds = checkMap(map, manifest).map((p) => p.kind);
  return [...new Set(kinds)];
}

describe("checkMap", () => {
  it.each(Object.entries(MAPS))("등록된 지도 %s → 문제 없음", (_, map) => {
    expect(checkMap(map, manifest)).toEqual([]);
  });

  it("대포 둘을 한 자리에 → 겹침", () => {
    const map = edited((m) => {
      const [a, b] = m.layout.cannon;
      b.dist = a.dist;
      b.bear = a.bear;
    });
    expect(kindsOf(map)).toEqual(["겹침"]);
  });

  it("범퍼를 바람길 마디 위에 → 겹침(길은 마디마다 본다)", () => {
    const map = edited((m) => {
      const st = m.layout.stream[0];
      m.layout.bumper[0].dist = st.dist;
      m.layout.bumper[0].bear = st.bear;
    });
    const problems = checkMap(map, manifest);
    expect(problems.some((p) => p.kind === "겹침" && p.what.includes("stream#0"))).toBe(true);
  });

  it("랜드마크를 호수 가운데로 → 물 위", () => {
    const map = edited((m) => {
      const lake = m.layout.lake[0],
        site = m.layout.site.find((s) => !s.sky && !s.lift)!;
      site.dist = lake.dist;
      site.bear = lake.bear;
    });
    expect(kindsOf(map)).toContain("물 위");
  });

  it("거리가 행성 맞은편보다 멀다 → 범위 밖", () => {
    const map = edited((m) => {
      m.layout.star[0].dist = 900;
    });
    expect(kindsOf(map)).toEqual(["범위 밖"]);
  });

  it("없는 바람길에 잇는 고리 줄 → 범위 밖", () => {
    const map = edited((m) => {
      m.layout.chain[0].afterStream = 99;
    });
    expect(kindsOf(map)).toEqual(["범위 밖"]);
  });

  it("없는 마을의 전설 → 범위 밖", () => {
    const map = edited((m) => {
      m.creatures.legends = { c_deer: [[9, 300, 0]] };
    });
    expect(kindsOf(map)).toEqual(["범위 밖"]);
  });

  it("manifest 에 없는 랜드마크·나무·브랜드 키 → 에셋 없음", () => {
    const map = edited((m) => {
      m.layout.site[0].k = "no_such_site";
      m.layout.tree[0].t = "no_such_tree";
      m.brand.objects = [{ key: "no_such_logo", dist: 0, bear: 0, size: 5, by: "h" }];
    });
    const missing = checkMap(map, manifest).filter((p) => p.kind === "에셋 없음");
    expect(missing).toHaveLength(3);
  });

  it("legend 가 없는 종을 전설로 → 에셋 없음", () => {
    const map = edited((m) => {
      m.creatures.legends = { teapot: [[0, 300, 0]] };
    });
    expect(kindsOf(map)).toEqual(["에셋 없음"]);
  });

  it("등대를 옮기고 등대 산은 두면 → 모양", () => {
    const map = edited((m) => {
      m.layout.place[3].bear += 10;
    });
    expect(kindsOf(map)).toEqual(["모양"]);
  });
});
