import * as THREE from "three";

import type { StandShape } from "./stand";
import data from "./tea.spots.json";

// 숨는 자리 후보(기획서 v3.1 6장 "자리 데이터"): tea.spots.json 을 읽어 모양을 확인하고 세계 자리로 바꾼다.
// 붙는 면: top 그 층 윗면 · under 그 층 접시 밑면에 거꾸로 매달림 · wall 기둥 바깥벽(그 층 접시 위로 WALL_RISE m)

/** 물건 종류 */
export type SpotKind = "flowerpot" | "teacup" | "jar" | "basket" | "gift" | "macaron";
/** 붙는 면 */
export type SpotMount = "top" | "under" | "wall";

/** 후보 자리 하나(값 파일 그대로) */
export interface SpotSpec {
  tier: number;
  bear: number;
  dist: number;
  kind: SpotKind;
  mount: SpotMount;
}

/** 세계에 놓인 후보 자리 */
export interface Spot extends SpotSpec {
  /** 값 파일의 차례(디버그 번호) */
  index: number;
  /** 물건 바닥 가운데(밑면에 매달리면 물건 꼭대기가 붙는 곳) */
  base: THREE.Vector3;
  /** 물건의 위(매달린 것은 아래를 본다, 벽에 걸린 것은 바깥을 본다) */
  up: THREE.Vector3;
}

/** 물건 종류 → 모델 키 */
export const KIND_MODEL: Readonly<Record<SpotKind, string>> = {
  flowerpot: "flowerpot",
  teacup: "hide_teacup",
  jar: "hide_jar",
  basket: "hide_basket",
  gift: "gift_pile",
  macaron: "d_macaron",
};

/** 기둥 벽에 걸린 물건이 그 층 접시 윗면에서 떠 있는 높이(m) */
const WALL_RISE = 3.5;
const KINDS = Object.keys(KIND_MODEL) as SpotKind[];
const MOUNTS: readonly SpotMount[] = ["top", "under", "wall"];

/** 값 파일을 읽어 모양을 확인한다(틀리면 칸과 까닭을 알리며 멈춘다) */
export function readSpots(raw: unknown, tiers: number): SpotSpec[] {
  const root = raw as { spots?: unknown };
  if (!Array.isArray(root?.spots)) throw new Error("tea.spots.json spots: 목록이어야 한다");
  return root.spots.map((v: unknown, i: number) => spotOf(v, `spots[${i}]`, tiers));
}

/** 후보 자리를 세계에 놓는다 */
export function placeSpots(stand: StandShape, specs: readonly SpotSpec[]): Spot[] {
  return specs.map((s, index) => {
    const base = new THREE.Vector3(),
      up = new THREE.Vector3();
    if (s.mount === "top") {
      stand.spotPoint(s, base);
      stand.upAt(base, up);
    } else if (s.mount === "under") {
      const plate = stand.plates[s.tier - 1];
      const h = plate.bottom - stand.R;
      stand.airAt(h, s.dist, s.bear, base);
      up.set(0, -1, 0);
    } else {
      const plate = stand.plates[s.tier - 1];
      const h = plate.h + WALL_RISE;
      const reach = stand.columnR + 0.05;
      stand.airAt(h, reach, s.bear, base);
      up.set(base.x, 0, base.z).normalize();
    }
    return { ...s, index, base, up };
  });
}

/** 지금 값 파일의 후보 자리(층 수는 스탠드 접시 셋) */
export const SPOT_SPECS: readonly SpotSpec[] = readSpots(data, 3);

/* ─── 내부 ─────────────────────────── */

function spotOf(v: unknown, path: string, tiers: number): SpotSpec {
  const s = v as Record<string, unknown>;
  const fail = (why: string): never => {
    throw new Error(`tea.spots.json ${path}.${why}`);
  };
  const tier = s?.tier;
  const isTier = typeof tier === "number" && Number.isInteger(tier) && tier >= 0 && tier <= tiers;
  if (!isTier) fail(`tier: 0(땅)~${tiers} 이어야 한다`);
  const bear = s.bear,
    dist = s.dist;
  if (typeof bear !== "number" || !Number.isFinite(bear)) fail("bear: 수여야 한다");
  if (typeof dist !== "number" || !Number.isFinite(dist) || dist < 0)
    fail("dist: 0 이상 수여야 한다");
  const kind = s.kind as SpotKind,
    mount = s.mount as SpotMount;
  if (!KINDS.includes(kind)) fail(`kind: ${KINDS.join("·")} 중 하나여야 한다`);
  if (!MOUNTS.includes(mount)) fail("mount: top·under·wall 중 하나여야 한다");
  const isHigh = mount !== "top";
  if (isHigh && tier === 0) fail("mount: 땅(층 0)은 top 만 된다");
  return { tier: tier as number, bear: bear as number, dist: dist as number, kind, mount };
}
