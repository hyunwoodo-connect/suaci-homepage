import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import type { LimeBox } from "./limebox";
import type { HideSpot } from "./tuning";

// 숨는 애(상자 하나)의 처지와, 나와 숨은 상자 사이를 재는 것

/** 숨는 애 하나의 처지 */
export interface Seeker {
  box: LimeBox;
  spot: HideSpot;
  /** 숨음 · 톡에 맞음(미스트가 날아가고 내가 뛰어가는 중) · 굴러떨어지는 중(높이 숨은 상자) · 들켜 뛰는 중 · 내 뒤 줄에 섬 */
  state: "hidden" | "struck" | "falling" | "caught" | "line";
  /** 달려갈 곳(숨으러 갈 때는 숨는 자리의 땅 위 자리, 해가 진 뒤에는 내 둘레)과 빠르기(m/s, 0 이면 서 있다) */
  to: THREE.Vector3;
  speed: number;
  /** 마지막 재채기 시각(게임 초) */
  sneezedAt: number;
  /** 이번 프레임 화면 안에 있나 */
  seen: boolean;
  /** 내가 바로 곁까지 왔었나(지나쳐 멀어지면 '휴') */
  wasClose: boolean;
  /** 전설의 생물이 곁을 지나갈 때 움찔했나(한 번만) */
  flinched: boolean;
  /** 찾은 차례(칸 번호이자 줄에서의 차례) */
  slot: number;
}

/** 나와 상자 사이: 3차원 거리(m) · 수평 거리(m) */
interface Reach {
  dist: number;
  flat: number;
}

/** 말풍선을 상자 머리 위로 띄우는 높이(m) */
const BUBBLE_OVER = 0.5;

const at = new THREE.Vector3();

/** reachOf 가 돌려 쓰는 칸(프레임마다 새로 만들지 않는다) */
const REACH: Reach = { dist: 0, flat: 0 };

/** 새 숨는 애 */
export function createSeeker(box: LimeBox, spot: HideSpot): Seeker {
  return {
    box,
    spot,
    state: "hidden",
    to: new THREE.Vector3(),
    speed: 0,
    sneezedAt: -1e9,
    seen: false,
    wasClose: false,
    flinched: false,
    slot: 0,
  };
}

/** 판을 새로 시작한다: 숨는 자리를 바꾸고 처지를 처음으로 */
export function resetSeeker(k: Seeker, spot: HideSpot) {
  k.spot = spot;
  k.state = "hidden";
  k.speed = 0;
  k.sneezedAt = -1e9;
  k.seen = false;
  k.wasClose = false;
  k.flinched = false;
}

/** 나와 상자 사이를 잰다(돌려 쓰는 칸에 담아 준다 — 다음 reachOf 전까지만 쓴다) */
export function reachOf(k: Seeker, player: Services["player"]): Reach {
  const center = k.box.center(at);
  REACH.dist = center.distanceTo(player.P);
  REACH.flat = k.box.v.angleTo(player.p) * S.R;
  return REACH;
}

/** 나에게서 가장 가까운(3차원 거리) 숨은 상자 */
export function nearestHidden(seekers: readonly Seeker[], P: Readonly<THREE.Vector3>) {
  let best: Seeker | null = null,
    bestD = Infinity;
  for (const k of seekers) {
    if (k.state !== "hidden") continue;
    const d = k.box.center(at).distanceTo(P);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** 나에게서 가장 먼(땅 위 거리) 숨은 상자 */
export function farthestHidden(seekers: readonly Seeker[], p: Readonly<THREE.Vector3>) {
  let best: Seeker | null = null,
    bestD = -1;
  for (const k of seekers) {
    if (k.state !== "hidden") continue;
    const d = k.box.v.angleTo(p);
    if (d > bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** 말풍선 자리: 상자 머리 위(지금 크기대로) */
export function overBox(k: Seeker, out: THREE.Vector3): THREE.Vector3 {
  const lift = k.box.hh * k.box.size + BUBBLE_OVER;
  return k.box.center(out).addScaledVector(k.box.v, lift);
}
