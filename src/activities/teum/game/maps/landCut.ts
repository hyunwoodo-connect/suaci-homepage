import type * as THREE from "three";

import { Land } from "../world/land";
import type { Path } from "../world/paths";
import {
  afterStreamAt,
  archPath,
  chainPath,
  hopPath,
  jetPath,
  railPath,
  rowPath,
  streamPath,
} from "../world/paths";
import { from, offset } from "../world/sphere";
import type { Layout, LayoutJet, Spot } from "./layout";
import type { GameMap, MapLand, MapRegion } from "./map";

// 지도를 뭍만 남기고 자른다: 놀이기구·랜드마크·나무·호수·언덕은 뭍에 있는 것만(자리는 하나도 옮기지 않는다),
// 길(바람길·레일·다리…)은 마디가 모두 뭍에 있는 것만 남긴다. 마을 중심은 그대로 둔다 — 지역의 차례가 마을의 차례라서,
// 바다에 잠긴 마을은 아무도 살지 않는 바다 지역이 된다. 남은 것의 차례가 바뀌므로 바람길을 가리키는 번호(afterStream)는 새 번호로 고친다

/** 물가에서 이만큼(m) 안쪽에 있어야 남긴다: 점 하나에 서는 것 · 길의 마디 · 키 큰 나무 */
const INLAND = { ride: 12, node: 8, tree: 6 } as const;
/** 깔때기 그릇·씨앗밭·구름 골짜기는 몸이 넓다(반지름 m) */
const WIDE_BODY = { funnel: 23, seed: 25, pipe: 20 } as const;
/** 제트 기류가 끝나는 자리는 물가에서 이만큼(m) 안쪽 · 이 마디 수보다 짧아지면 뺀다 */
const JET_END_INLAND = 250,
  JET_MIN_NODES = 15;
/** 바다 지역의 하늘빛 */
const SEA_SKY = 0x7fd6f2;

/** map 을 land 만 남기고 자른 지도(이름은 그대로 — 부르는 쪽이 새 이름을 준다) */
export function cutToLand(map: GameMap, spec: MapLand): GameMap {
  const land = new Land(spec);
  const L = map.layout;
  const onLand = (inland: number) => (o: Spot) => keeps(land, o, inland);
  const isRide = onLand(INLAND.ride),
    isTree = onLand(INLAND.tree),
    isPipe = onLand(WIDE_BODY.pipe),
    isFunnel = onLand(WIDE_BODY.funnel),
    isSeed = onLand(WIDE_BODY.seed),
    // 언덕은 가운데가 뭍이면 남긴다(물가에 걸친 언덕은 곶이 된다)
    isHill = onLand(0);
  const streamPaths = L.stream.map((st) => streamPath(st));
  const streamKept = streamPaths.map((path) => pathOnLand(land, path));
  // 남은 바람길의 새 번호(없어진 것은 -1)
  let next = 0;
  const streamIndex = streamKept.map((kept) => (kept ? next++ : -1));
  const chains = L.chain.filter((c) => {
    if (c.afterStream != null && !streamKept[c.afterStream]) return false;
    const path = chainPath(c, streamPaths);
    return pathOnLand(land, path);
  });
  const whirls = L.whirl.filter((w) => {
    if (w.afterStream == null) return keeps(land, w as Spot, INLAND.ride);
    if (!streamKept[w.afterStream]) return false;
    const at = afterStreamAt(streamPaths[w.afterStream]);
    return land.has(at, INLAND.ride);
  });
  const layout: Layout = {
    place: L.place,
    site: L.site.filter((o) => keeps(land, o, o.r)),
    tree: L.tree.filter(isTree),
    lake: L.lake.filter((o) => keeps(land, o, o.r)),
    pipe: L.pipe.filter(isPipe),
    funnel: L.funnel.filter(isFunnel),
    seed: L.seed.filter(isSeed),
    stream: L.stream.filter((_, i) => streamKept[i]),
    rail: L.rail.filter((o) => pathOnLand(land, railPath(o))),
    arch: L.arch.filter((o) => pathOnLand(land, archPath(o))),
    hop: L.hop.filter((o) => pathOnLand(land, hopPath(o))),
    chain: chains.map((c) =>
      c.afterStream == null ? c : { ...c, afterStream: streamIndex[c.afterStream] },
    ),
    row: L.row.filter((o) => pathOnLand(land, rowPath(o))),
    bumper: L.bumper.filter(isRide),
    star: L.star.filter(isRide),
    whirl: whirls.map((w) =>
      w.afterStream == null ? w : { ...w, afterStream: streamIndex[w.afterStream] },
    ),
    chime: L.chime.filter(isRide),
    thermal: L.thermal.filter(isRide),
    cannon: L.cannon.filter(isRide),
    sling: L.sling.filter(isRide),
    swing: L.swing.filter(isRide),
    rocket: L.rocket.filter(isRide),
    balloon: L.balloon.filter(isRide),
    wing: L.wing.filter(isRide),
    pad: L.pad.filter(isRide),
    ball: L.ball.filter(isRide),
    hole: L.hole.filter(isRide),
    jet: jetsOnLand(land, L.jet),
    hill: L.hill.filter(isHill),
    hub: L.hub,
  };
  const hubs = L.hub.map((h) => from(h.dist, h.bear));
  const legends: Record<string, GameMap["creatures"]["legends"][string]> = {};
  for (const [key, spots] of Object.entries(map.creatures.legends)) {
    legends[key] = spots.filter(([hk, d, b]) => {
      const at = offset(hubs[hk], d, b);
      return land.has(at, INLAND.ride);
    });
  }
  return {
    ...map,
    land: spec,
    layout,
    regions: map.regions.map((r, i) => (land.has(hubs[i]) ? r : seaRegion(r))),
    skyJets: jetsOnLand(land, map.skyJets),
    creatures: {
      ...map.creatures,
      jellies: {
        ...map.creatures.jellies,
        at: map.creatures.jellies.at.filter(([d, b]) => keeps(land, { dist: d, bear: b }, 0)),
      },
      legends,
    },
    brand: { ...map.brand, objects: map.brand.objects.filter(isRide) },
  };
}

/* ─── 내부 ─────────────────────────── */

// 자리 o 가 물가에서 inland(m) 안쪽의 뭍인가
function keeps(land: Land, o: Spot, inland: number): boolean {
  const v = from(o.dist, o.bear);
  return land.has(v, inland);
}

// 길의 마디가 모두(끝 다음 자리까지) 뭍인가
function pathOnLand(land: Land, path: Path): boolean {
  const spots: THREE.Vector3[] = path.points.map((pt) => pt.v);
  spots.push(path.end.v);
  return spots.every((v) => land.has(v, INLAND.node));
}

// 제트 기류는 타면 길 끝까지 실려 가고, 끝에서 놓인 뒤에도 그 빠르기로 한참 미끄러진다 — 바다로 내보내지 않게
// 뭍 위를 지나는 앞부분 가운데 물가에서 넉넉히(JET_END_INLAND) 안쪽에서 끝나는 데까지만 남긴다
// (마디는 앞에서부터 차례로 놓이므로 뒤를 잘라도 남은 마디의 자리는 그대로다). 너무 짧아지면 뺀다
function jetsOnLand<J extends LayoutJet>(land: Land, jets: readonly J[]): J[] {
  const out: J[] = [];
  for (const jt of jets) {
    const points = jetPath(jt).points;
    const firstAtSea = points.findIndex((pt) => !land.has(pt.v, INLAND.node));
    const overLand = firstAtSea < 0 ? points : points.slice(0, firstAtSea);
    const lastInland = overLand.findLastIndex((pt) => land.has(pt.v, JET_END_INLAND));
    const n = lastInland + 1;
    if (n >= JET_MIN_NODES) out.push({ ...jt, n });
  }
  return out;
}

// 바다에 잠긴 마을의 지역: 아무도 살지 않고 하늘에 띄우는 것도 없다
function seaRegion(r: MapRegion): MapRegion {
  return {
    ...r,
    name: "바다",
    sky: SEA_SKY,
    skyBalloons: undefined,
    residents: [],
    herds: [],
    flocks: 0,
    jellies: 0,
  };
}
