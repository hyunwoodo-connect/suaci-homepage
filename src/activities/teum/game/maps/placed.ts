import * as THREE from "three";

import { sphereAt } from "../hideseek/spots";
import type { HalfWidthOf, StageZone } from "../hideseek/stageZones";
import { stageZones } from "../hideseek/stageZones";
import { stampedParts } from "../models/girth";
import { S } from "../settings";
import type { Footprint } from "./check";
import { footprintsOf } from "./check";
import type { GameMap } from "./map";
import type { Body, BodyPart, Layer } from "./tangles";

// 놓인 것 하나하나의 몸(높이 토막마다 반지름) — 한 곳에서 정한다.
// 놓을 때(엉키면 놓지 않는다 — world/bodyField)와 점검할 때(maps/worldBodies)가 같은 몸을 본다

/** 손으로 놓은 것의 키(m — 겹치는 높이를 가릴 때만 쓴다): 장소 한가운데 것 · 놀이기구와 길의 마디 · 납작한 놀이 자리. 랜드마크는 자리표의 크기 */
const TALL = { place: 25, ride: 8, field: 1 } as const;
/** 장소 한가운데 것의 몸 반지름(m — 소원 나무의 갓까지) */
const PLACE_BODY = 9;
/** 납작한 놀이 자리(그 위에 선 것은 올라탄 것이다) · 타는 곳이 아닌 것 */
const FIELDS = ["seed"],
  NOT_RIDES = ["place", "site", "funnel", "seed", "pipe"];
/** 큰 풍선 꽃: 이 몫의 높이부터는 잎과 꽃송이(무른 것) */
const BLOOM_FROM = 0.18;
/** 꼬마 라임의 몸(m): 반지름 · 키 */
const BABY = { r: 0.7, tall: 1.4 } as const;
/** 한 자리에 여럿 놓이는 놀이기구의 한 개 몸 반지름(m) · 한 자리의 무리로 치는 거리(m) */
const MEMBER_BODY = 1.5,
  SPREAD_REACH = 12;
/** 통통 구름 위 물건이 그 밑의 놀이기구를 찾는 거리(m) */
const PERCH_REACH = 3;

/** 한 자리에 여럿 놓이는 놀이기구(범퍼·별·통통 구름)의 놓인 목록을 묻는 창구: 자리표 갈래 → 놓인 것들 */
export type MembersOf = (kind: string) => readonly { v: THREE.Vector3 }[];

/**
 * 손으로 놓은 것(자리표)의 몸 — 키 큰 나무는 뺀다(심긴 나무 목록에서 줄기와 갓으로 본다).
 * 한 자리에 여럿 놓이는 놀이기구는 무리 전체를 덮는 반지름으로 본다(자리표의 한 점에서 가장 먼 것까지)
 */
export function handBodies(map: GameMap, membersOf: MembersOf): Body[] {
  return footprintsOf(map)
    .filter((f) => !f.owner.startsWith("tree#"))
    .map((f) => {
      const [kind, rest] = f.owner.split("#"),
        index = parseInt(rest, 10);
      let r = f.r;
      for (const member of membersOf(kind)) {
        const d = member.v.angleTo(f.v) * S.R;
        const reach = d + MEMBER_BODY;
        if (d < SPREAD_REACH) r = Math.max(r, reach);
      }
      const site = kind === "site" ? map.layout.site[index] : undefined;
      return handBody(f, r, site?.size);
    });
}

/** 숨바꼭질 무대의 몸(후보 물건·탑·통통 구름 위 물건·버섯·구경꾼 자리·출발 줄). hand: 얹힌 물건이 밑의 놀이기구를 찾을 목록 */
export function stageBodies(
  hub: THREE.Vector3,
  halfWidthOf: HalfWidthOf,
  hand: readonly Body[],
): Body[] {
  return stageZones(halfWidthOf).map((zone) => stageBody(zone, hub, hand));
}

/** 나무: 줄기와 갓(무른 것) */
export function treeBody(
  i: number,
  key: string,
  layer: Layer,
  v: THREE.Vector3,
  tree: { H: number; tr: number; cr: number; cb: number },
): Body {
  const parts: BodyPart[] = [
    { r: tree.tr, lo: 0, hi: tree.cb },
    { r: tree.cr, lo: tree.cb, hi: tree.H, isSoft: true },
  ];
  return { name: `tree#${i}(${key})`, owner: `tree#${i}`, kin: "tree", layer, v, parts };
}

/** 조형물·작은 소품·열기구(lo: 바닥이 땅에서 뜬 높이) */
export function sculptureBody(
  i: number,
  key: string,
  halfWide: number,
  v: THREE.Vector3,
  H: number,
  lo: number,
  isGate: boolean,
): Body {
  return {
    name: `sculpture#${i}(${key})`,
    owner: `sculpture#${i}`,
    layer: "흩뿌림",
    v,
    parts: stampedParts(key, halfWide, H, lo),
    isGate,
  };
}

/** 큰 풍선 꽃: 줄기는 단단하고 잎과 꽃송이는 무르다 */
export function bigFlowerBody(
  i: number,
  key: string,
  halfWide: number,
  v: THREE.Vector3,
  H: number,
): Body {
  return {
    name: `bigflower#${i}(${key})`,
    owner: `bigflower#${i}`,
    layer: "흩뿌림",
    v,
    parts: stampedParts(key, halfWide, H, 0, BLOOM_FROM),
  };
}

/** 비눗방울(무른 공) — 한 무리끼리는 한 덩어리다 */
export function bubbleBody(
  i: number,
  cluster: number,
  v: THREE.Vector3,
  r: number,
  alt: number,
): Body {
  const parts: BodyPart[] = [{ r, lo: alt - r, hi: alt + r, isSoft: true }];
  return { name: `bubble#${i}`, owner: `bubbles#${cluster}`, layer: "흩뿌림", v, parts };
}

/** 꼬마 라임 */
export function babyLimeBody(i: number, v: THREE.Vector3): Body {
  const parts: BodyPart[] = [{ r: BABY.r, lo: 0, hi: BABY.tall }];
  return { name: `babylime#${i}`, owner: `babylime#${i}`, layer: "흩뿌림", v, parts };
}

/* ─── 내부 ─────────────────────────── */

// 장소의 r 은 터의 넓이(광장 26m)라, 몸은 한가운데 것(소원 나무·분수·뽑기·등대)의 굵기까지만 본다 — 터 안은 서도 되는 빈 땅이다
function handBody(f: Footprint, spread: number, siteSize: number | undefined): Body {
  const kind = f.owner.split("#")[0],
    flat = FIELDS.includes(kind) ? TALL.field : TALL.ride,
    low = kind === "place" ? TALL.place : flat,
    hi = siteSize ?? low,
    r = kind === "place" ? Math.min(spread, PLACE_BODY) : spread;
  return {
    name: f.name,
    owner: f.owner,
    attached: f.attached,
    layer: "손",
    v: f.v,
    parts: [{ r, lo: 0, hi }],
    isAccess: !NOT_RIDES.includes(kind),
  };
}

// 숨바꼭질 자리 하나. 통통 구름 위 물건은 그 밑의 놀이기구에 얹힌 것이다(겹쳐도 된다)
function stageBody(zone: StageZone, hub: THREE.Vector3, hand: readonly Body[]): Body {
  const v = new THREE.Vector3();
  sphereAt(v, hub, zone.x, zone.y);
  let attached: string | undefined;
  if (zone.kind === "perch") {
    const under = hand.find((b) => b.v.angleTo(v) * S.R < PERCH_REACH);
    attached = under?.owner;
  }
  return {
    name: `${zone.kind}(${zone.id})`,
    owner: `hideseek(${zone.id})`,
    attached,
    layer: "숨바꼭질",
    v,
    parts: [{ r: zone.r, lo: zone.lo, hi: zone.hi }],
  };
}
