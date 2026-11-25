import type * as THREE from "three";

import type { Manifest } from "@/lib/asset-kit/manifest";
import { CREATURES, SCULPTURES, TREE_CROWN_BASE } from "../../assets/settings";
import { S } from "../settings";
import type { Path } from "../world/paths";
import {
  afterStreamAt,
  archPath,
  chainPath,
  hopPath,
  railPath,
  rowPath,
  streamPath,
} from "../world/paths";
import { from, heading } from "../world/sphere";
import type { Spot } from "./layout";
import type { GameMap, HubScatter, Span } from "./map";

// 지도 점검: 지도 값만 보고(게임을 짓지 않고) 잘못 놓인 것을 찾는다. 시험(maps.test)과 지도 점검 명령이 부른다.
// ① 겹침 — 땅 위에 자리를 차지하는 것끼리 몸이 겹친다(하늘에 뜬 것·한 길의 마디끼리·바람길 끝에 잇는 것은 뺀다)
// ② 물 위 — 땅에 서는 것의 가운데가 호수 안이다
// ③ 범위 밖 — 거리·방향이 행성 밖이거나 숫자가 아니다, 차례(마을·장소·바람길)가 없는 것을 가리킨다
// ④ 에셋 없음 — 지도가 부르는 모델이 manifest 에 없다(게임은 말없이 빼거나 도형으로 둔다)
// ⑤ 모양 — 장소 넷의 차례, 등대 산 자리처럼 코드가 기대는 약속

/** 찾은 문제 하나 */
export interface MapProblem {
  kind: "겹침" | "물 위" | "범위 밖" | "에셋 없음" | "모양";
  what: string;
}

/** 땅 위에 자리를 차지하는 것 하나 */
interface Footprint {
  /** 무엇(자리표 갈래#차례, 길이면 마디까지) */
  name: string;
  /** 한 덩어리(한 길의 마디들은 같다) — 서로는 겹쳐도 된다 */
  owner: string;
  /** 이어 붙는 덩어리(바람길 끝에 잇는 고리 줄·회오리의 그 바람길) — 그것과는 겹쳐도 된다 */
  attached?: string;
  v: THREE.Vector3;
  /** 몸 반지름(m) */
  r: number;
}

/** 몸 반지름(m): 놓이는 것의 실제 크기 — 둘레를 비워 두는 거리(occ)보다 작다 */
const BODY = {
  /** 점 하나에 서는 놀이기구(대포·범퍼·별…) */
  ride: 4,
  /** 길의 마디(바람길·레일·다리·징검 구름·고리·꽃 기둥) */
  node: 3,
  /** 키 큰 나무 줄기 */
  trunk: 3,
  /** 구름 골짜기: 양쪽 벽까지(길이 방향으로는 셋으로 나눠 본다) */
  pipe: 12,
  /** 깔때기 그릇 */
  funnel: 23,
  /** 씨앗밭 */
  seedField: 25,
} as const;

/** 구름 골짜기의 길이 방향 마디(가운데에서 m) — 벽 쿠션이 ±28m 까지 놓인다 */
const PIPE_ALONG = [-18, 0, 18];

/** 행성 위에서 가장 먼 자리표 거리(출발점의 맞은편) */
const FAR_DIST = (Math.PI * S.R) / S.wide;

/** 지도 점검. 문제가 없으면 빈 목록 */
export function checkMap(map: GameMap, manifest: Manifest): MapProblem[] {
  const out: MapProblem[] = [];
  checkBounds(map, out);
  // 자리를 셀 수 없으면(차례가 틀렸으면) 겹침·물은 보지 않는다
  if (out.length) return out;
  checkShape(map, out);
  checkAssets(map, manifest, out);
  const prints = footprintsOf(map);
  checkWater(map, prints, out);
  checkOverlaps(prints, out);
  return out;
}

/** 지도의 땅 위 자리들(겹침을 셀 때 보는 것) */
function footprintsOf(map: GameMap): Footprint[] {
  const L = map.layout,
    out: Footprint[] = [];
  const add = (owner: string, v: THREE.Vector3, r: number, name = owner, attached?: string) =>
    out.push({ name, owner, attached, v, r });
  const addSpots = (kind: string, list: readonly Spot[], r: number) =>
    list.forEach((o, i) => add(`${kind}#${i}`, from(o.dist, o.bear), r));
  const addPath = (owner: string, path: Path, attached?: string) =>
    path.points.forEach(({ v }, j) => add(owner, v, BODY.node, `${owner}.${j}`, attached));
  L.place.forEach((pl, i) => add(`place#${i}(${pl.name})`, from(pl.dist, pl.bear), pl.r));
  L.site.forEach((st, i) => {
    if (st.sky || st.lift) return;
    const r = st.kind === "land" ? st.size * 0.4 : st.r,
      at = from(st.dist, st.bear);
    add(`site#${i}(${st.k})`, at, r);
  });
  addSpots("tree", L.tree, BODY.trunk);
  for (const kind of RIDE_SPOTS) addSpots(kind, L[kind], BODY.ride);
  addSpots("funnel", L.funnel, BODY.funnel);
  addSpots("seed", L.seed, BODY.seedField);
  L.pipe.forEach((pp, i) => {
    const v = from(pp.dist, pp.bear),
      d = heading(v, pp.head);
    for (const m of PIPE_ALONG) {
      const step = m / S.R;
      const at = v.clone().addScaledVector(d, step).normalize();
      add(`pipe#${i}`, at, BODY.pipe);
    }
  });
  const streams = L.stream.map((st) => streamPath(st));
  streams.forEach((path, i) => addPath(`stream#${i}`, path));
  L.rail.forEach((rl, i) => addPath(`rail#${i}`, railPath(rl)));
  L.arch.forEach((a, i) => addPath(`arch#${i}`, archPath(a)));
  L.hop.forEach((hp, i) => addPath(`hop#${i}`, hopPath(hp)));
  L.row.forEach((r, i) => addPath(`row#${i}`, rowPath(r)));
  L.chain.forEach((c, i) => {
    const attached = c.afterStream != null ? `stream#${c.afterStream}` : undefined,
      path = chainPath(c, streams);
    addPath(`chain#${i}`, path, attached);
  });
  L.whirl.forEach((w, i) => {
    if (w.afterStream == null) {
      const at = from(w.dist!, w.bear!);
      add(`whirl#${i}`, at, BODY.ride);
      return;
    }
    const at = afterStreamAt(streams[w.afterStream]);
    add(`whirl#${i}`, at, BODY.ride, `whirl#${i}`, `stream#${w.afterStream}`);
  });
  return out;
}

/* ─── 내부 ─────────────────────────── */

/** 점 하나에 서는 놀이기구 갈래(자리표 이름) */
const RIDE_SPOTS = [
  "bumper",
  "star",
  "chime",
  "thermal",
  "cannon",
  "sling",
  "swing",
  "rocket",
  "balloon",
  "wing",
  "pad",
  "ball",
  "hole",
] as const;

// ③ 범위 밖: 모든 자리의 거리·방향, 길의 마디 수·간격, 차례로 가리키는 것
function checkBounds(map: GameMap, out: MapProblem[]) {
  const L = map.layout;
  const bad = (what: string) => out.push({ kind: "범위 밖", what });
  for (const [kind, list] of Object.entries(L)) {
    (list as Partial<Spot & { head: number; n: number; gap: number }>[]).forEach((o, i) => {
      const name = `${kind}#${i}`;
      if (o.dist !== undefined && !(o.dist >= 0 && o.dist <= FAR_DIST))
        bad(`${name}: 거리 ${o.dist} (0~${FAR_DIST.toFixed(1)})`);
      if (o.bear !== undefined && !(o.bear >= 0 && o.bear <= 360))
        bad(`${name}: 방향 ${o.bear} (0~360)`);
      if (o.head !== undefined && !Number.isFinite(o.head)) bad(`${name}: 놓이는 방향 ${o.head}`);
      if (o.n !== undefined && !(Number.isInteger(o.n) && o.n >= 1)) bad(`${name}: 마디 수 ${o.n}`);
      if (o.gap !== undefined && !(o.gap > 0)) bad(`${name}: 마디 간격 ${o.gap}`);
    });
  }
  const isIndex = (i: number | undefined, n: number) =>
    i === undefined || (Number.isInteger(i) && i >= 0 && i < n);
  L.chain.forEach((c, i) => {
    if (!isIndex(c.afterStream, L.stream.length)) bad(`chain#${i}: 없는 바람길 ${c.afterStream}`);
    if (c.afterStream == null && (c.dist === undefined || c.head === undefined))
      bad(`chain#${i}: 바람길에 잇지 않으면 자리(dist·bear·head)가 있어야 한다`);
  });
  L.whirl.forEach((w, i) => {
    if (!isIndex(w.afterStream, L.stream.length)) bad(`whirl#${i}: 없는 바람길 ${w.afterStream}`);
    if (w.afterStream == null && w.dist === undefined)
      bad(`whirl#${i}: 바람길에 잇지 않으면 자리(dist·bear)가 있어야 한다`);
  });
  map.placeSpots.forEach(([pi], k) => {
    if (!isIndex(pi, L.place.length)) bad(`placeSpots#${k}: 없는 장소 ${pi}`);
  });
  for (const [key, spots] of Object.entries(map.creatures.legends))
    spots.forEach(([hk], k) => {
      if (!isIndex(hk, L.hub.length)) bad(`legends.${key}#${k}: 없는 마을 ${hk}`);
    });
  for (const [d, b] of map.creatures.jellies.at)
    if (!(d >= 0 && d <= FAR_DIST && b >= 0 && b <= 360)) bad(`jellies.at: [${d}, ${b}]`);
  const scatters: [string, HubScatter][] = [
    ["bigFlowers", map.bigFlowers],
    ["bubbles", map.bubbles],
    ["babyLimes", map.babyLimes],
  ];
  for (const [name, sc] of scatters) {
    if (!(sc.perHub >= 0 && sc.tries >= sc.perHub))
      bad(`${name}: perHub ${sc.perHub} · tries ${sc.tries}`);
    checkSpan(name, sc.dist, bad);
  }
  checkSpan("creatures.herds", map.creatures.herds.dist, bad);
  const ratio = (x: number) => x >= 0 && x <= 1;
  map.regions.forEach((r, i) => {
    const name = `regions#${i}(${r.name})`;
    if (![r.skip, r.treeSkip, r.balloonSkip].every(ratio)) bad(`${name}: 솎는 비율은 0~1`);
    if (!(r.treeHeight > 0)) bad(`${name}: 나무 키 배율 ${r.treeHeight}`);
    if (!(r.flocks >= 0 && r.jellies >= 0)) bad(`${name}: 하늘 무리·해파리 수`);
    if (r.skyBalloons) {
      checkSpan(`${name}.skyBalloons.dist`, r.skyBalloons.dist, bad);
      checkSpan(`${name}.skyBalloons.alt`, r.skyBalloons.alt, bad);
      checkSpan(`${name}.skyBalloons.size`, r.skyBalloons.size, bad);
    }
  });
  const edge = map.regionEdge;
  if (!(edge.width > 0 && edge.from > -1 && edge.from + edge.width <= 1))
    bad(`regionEdge: ${edge.from} + ${edge.width}`);
  for (const z of map.zones)
    if (!(z.from >= 0 && z.from < z.to && z.to <= 360)) bad(`구역 ${z.name}: ${z.from}~${z.to}`);
}

// 범위: 숫자이고 작은 쪽이 먼저
function checkSpan(name: string, span: Span, bad: (what: string) => void) {
  const [lo, hi] = span;
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi))
    bad(`${name}: 범위 [${lo}, ${hi}]`);
}

// ⑤ 모양: 장소는 넷이고 첫째(광장)는 출발점, 첫 큰 언덕(등대 산)은 등대 자리, 구름 구멍은 짝수, 마을이 있다
function checkShape(map: GameMap, out: MapProblem[]) {
  const L = map.layout;
  const bad = (what: string) => out.push({ kind: "모양", what });
  if (L.place.length !== 4) bad(`장소는 넷(광장·분수·뽑기터·등대)이어야 한다: ${L.place.length}`);
  else {
    if (L.place[0].dist !== 0) bad("첫 장소(광장)는 출발점(dist 0)이어야 한다");
    const lighthouse = L.place[3],
      mountain = L.hill[0];
    const isUnder =
      mountain && mountain.dist === lighthouse.dist && mountain.bear === lighthouse.bear;
    if (!isUnder) bad("첫 큰 언덕(등대 산)은 등대(place#3)와 같은 자리여야 한다");
  }
  if (L.hole.length % 2)
    bad(`구름 구멍은 둘씩 짝이어야 한다(짝 없는 구멍은 나올 곳이 없다): ${L.hole.length}`);
  if (!L.hub.length) bad("마을(hub)이 하나는 있어야 한다");
  if (map.regions.length !== L.hub.length)
    bad(`지역은 마을과 같은 수여야 한다(지역 ${map.regions.length} · 마을 ${L.hub.length})`);
}

// ④ 에셋 없음: 랜드마크·키 큰 나무·브랜드 오브젝트·전설의 손님
function checkAssets(map: GameMap, manifest: Manifest, out: MapProblem[]) {
  const has = (k: string) => Object.hasOwn(manifest.assets, k);
  const missing = (what: string) => out.push({ kind: "에셋 없음", what });
  map.layout.site.forEach((st, i) => {
    if (!has(st.k)) missing(`site#${i}: ${st.k}`);
  });
  map.layout.tree.forEach((t, i) => {
    if (!Object.hasOwn(TREE_CROWN_BASE, t.t)) missing(`tree#${i}: ${t.t} — 나무 종류 표에 없다`);
    else if (!has(t.t)) missing(`tree#${i}: ${t.t}`);
  });
  map.brand.objects.forEach((b, i) => {
    if (!has(b.key)) missing(`brand.objects#${i}: ${b.key}`);
    else if (manifest.assets[b.key].category !== "brand")
      missing(`brand.objects#${i}: ${b.key} — 분류가 brand 가 아니다`);
  });
  map.regions.forEach((r, i) => {
    const name = `regions#${i}(${r.name})`;
    for (const k of [...r.big, ...r.small]) {
      if (!Object.hasOwn(SCULPTURES, k)) missing(`${name}: ${k} — 조형물 설정표에 없다`);
      else if (!has(k)) missing(`${name}: ${k}`);
    }
    if (!Object.hasOwn(TREE_CROWN_BASE, r.tree))
      missing(`${name}: ${r.tree} — 나무 종류 표에 없다`);
    for (const k of new Set([...r.herds, ...r.residents])) {
      if (!Object.hasOwn(CREATURES, k)) missing(`${name}: ${k} — 생물 설정표에 없다`);
      else if (!has(k)) missing(`${name}: ${k}`);
    }
    for (const k of r.herds)
      if (Object.hasOwn(CREATURES, k) && !CREATURES[k].herd)
        missing(`${name}: ${k} — 땅 위 무리로 나오는 종이 아니다`);
  });
  for (const key of Object.keys(map.creatures.legends)) {
    if (!CREATURES[key]?.legend) missing(`legends.${key} — 생물 설정표에 legend 가 없다`);
    else if (!has(key)) missing(`legends.${key}`);
  }
}

// ② 물 위: 땅에 서는 것의 가운데가 호수 안
function checkWater(map: GameMap, prints: readonly Footprint[], out: MapProblem[]) {
  const lakes = map.layout.lake.map((l, i) => ({ i, v: from(l.dist, l.bear), r: l.r }));
  const wet = new Set<string>();
  for (const f of prints)
    for (const l of lakes) {
      const d = f.v.angleTo(l.v) * S.R;
      if (d >= l.r || wet.has(f.owner)) continue;
      wet.add(f.owner);
      out.push({
        kind: "물 위",
        what: `${f.name}: lake#${l.i} 안(가운데에서 ${d.toFixed(1)}m, 호수 ${l.r}m)`,
      });
    }
}

// ① 겹침: 몸끼리(반지름 합보다 가깝다). 덩어리 둘마다 가장 깊이 겹친 한 번만 적는다
function checkOverlaps(prints: readonly Footprint[], out: MapProblem[]) {
  const worst = new Map<string, { gap: number; a: Footprint; b: Footprint; d: number }>();
  let maxR = 0;
  for (const f of prints) maxR = Math.max(maxR, f.r);
  const reachAngle = (2 * maxR) / S.R;
  const minDot = Math.cos(reachAngle);
  for (let i = 0; i < prints.length; i++)
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i],
        b = prints[j];
      if (a.v.dot(b.v) < minDot || isTogether(a, b)) continue;
      const d = a.v.angleTo(b.v) * S.R,
        gap = d - a.r - b.r;
      if (gap >= 0) continue;
      const pair = [a.owner, b.owner].sort().join(" · ");
      const was = worst.get(pair);
      if (!was || gap < was.gap) worst.set(pair, { gap, a, b, d });
    }
  for (const { a, b, d } of worst.values()) {
    const reach = a.r + b.r;
    out.push({
      kind: "겹침",
      what: `${a.name} · ${b.name}: ${d.toFixed(1)}m 떨어짐(몸 ${reach}m)`,
    });
  }
}

// 한 덩어리거나 이어 붙은 것
function isTogether(a: Footprint, b: Footprint): boolean {
  return a.owner === b.owner || a.attached === b.owner || b.attached === a.owner;
}
