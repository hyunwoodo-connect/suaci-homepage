import type { GameMap, MapRegion } from "../maps/map";

// 떠도는 무리를 지역마다 무엇으로 몇이나 둘지(놓는 자리와 옮기는 셈은 Creatures 에 있다).
// 그 지역에 사는 갈래만 둔다: 땅 무리가 사는 지역은 그 지역의 땅 종을 돌려 가며 한 마리·두 마리를 번갈아,
// 하늘 무리가 사는 지역은 그 지역에 사는 하늘 종을(없으면 하늘 종 모두를) 돌려 가며 셋씩, 해파리가 사는 지역은 해파리

/** 한 지역의 떠도는 무리 */
export interface RoamPlan {
  /** 땅 무리: 종과 마릿수 */
  herds: { key: string; count: number }[];
  /** 하늘 무리(셋씩 도는 무리)의 종 */
  flocks: string[];
  /** 해파리 수 */
  jellies: number;
}

/** 지역 region 의 떠도는 무리. skyKeys: 하늘 무리로 나오는 종 모두(설정표 차례) */
export function roamPlan(
  region: MapRegion,
  roaming: GameMap["creatures"]["roaming"],
  skyKeys: readonly string[],
): RoamPlan {
  const herds: RoamPlan["herds"] = [],
    flocks: string[] = [];
  if (region.herds.length)
    for (let i = 0; i < roaming.herds; i++) {
      const key = region.herds[i % region.herds.length],
        count = 1 + (i % 2);
      herds.push({ key, count });
    }
  if (region.flocks > 0) {
    const own = skyKeys.filter((key) => region.residents.includes(key)),
      kinds = own.length ? own : skyKeys;
    for (let i = 0; i < roaming.flocks && kinds.length; i++) {
      const key = kinds[i % kinds.length];
      flocks.push(key);
    }
  }
  const jellies = region.jellies > 0 ? roaming.jellies : 0;
  return { herds, flocks, jellies };
}
