import * as THREE from "three";

import { S } from "../settings";
import type { Creature } from "./creature";

// 주민: 숨바꼭질 판 영역에 사는 생물. 구조물이 아니라 이웃이다 — 저마다 하루 세 가지를 돌려 가며 하고, 나를 알아보고 인사하고,
// 서로 마주치면 까딱하고, 판에서 일어난 일에 반응한다. 여기에는 주민 하나의 상태와, 값만으로 정해지는 규칙(무엇을 고르나·어디에 설 수 있나)이 있다.
// 움직이는 것은 town, 종마다의 하루는 days

/** 주민이 지금 하는 것 */
export type Act =
  /** 하루의 한 가지 */
  | "chore"
  /** 나에게 인사한다 · 길을 비켜 준다 */
  | "greet"
  | "yield"
  /** 다른 생물과 마주 보고 까딱 */
  | "nod"
  /** 숨은 상자를 힐끗거린다 · 들켜서 딴청 */
  | "peek"
  | "caught"
  /** 찾았다(좋아한다) · 꽝(갸웃) · 꽝(돌아서서 웃음 참기) */
  | "cheer"
  | "puzzle"
  | "giggle"
  /** 무언가를 쳐다본다(종소리) · 폴짝 좋아한다(배달·차) */
  | "look"
  | "joy"
  /** "꼭꼭 숨어라" — 등을 돌린다 */
  | "away"
  /** 다 찾았다 — 금색 상자 둘레에 둘러선다 */
  | "gather"
  /** 종마다의 버릇(뒤집힘·물러남·화냄) */
  | "quirk";

/** 주민 하나의 상태. 모든 칸을 처음부터 채운다(프레임 중에 칸이 늘지 않게) */
export interface Resident {
  act: Act;
  /** 지금 하는 것을 한 시간(초)과 끝나는 때(초 — 0 이면 스스로 끝낸다) */
  actT: number;
  actFor: number;
  /**
   * 지금 하는 것(인사·반응·버릇)만 쓰는 값: 보는 곳 · 수 하나(갸웃하는 쪽·돌아서는 시간) · 단계 · 그 단계가 시작된 때(초) · 다음 폴짝까지(초).
   * 하루의 일이 쓰는 값(aim·u·w·n·mark·clock·goal·step)은 건드리지 않는다 — 반응이 끝나면 하던 일이 그 자리에서 그대로 이어진다
   */
  actAim: THREE.Vector3;
  actU: number;
  actStep: number;
  actClock: number;
  actBeat: number;
  /** 하루의 일이 보는 곳(행성 위 자리 — 케이크·랜드마크·우체통, 하트 궤적의 옆 방향) */
  aim: THREE.Vector3;
  /** 하루의 몇째 일인가(-1 이면 아직 없다) · 남은 시간(초) · 그 일을 한 시간(초) · 그 일의 단계와 단계에 든 시간(초) */
  chore: number;
  choreT: number;
  choreAge: number;
  step: number;
  stepT: number;
  /** 가는 곳 · 같이 하는 상대 · 따르는 앞장(무리 일) · 무리에서의 차례 */
  goal: THREE.Vector3;
  mate: Creature | null;
  lead: Creature | null;
  slot: number;
  /** 같이 앉은 무리의 번호와 마릿수(0 이면 혼자) */
  squad: number;
  size: number;
  /** 사는 자리(여기서 멀리 가지 않는다) · 하늘 생물이 떠 있는 높이(m) */
  seat: THREE.Vector3;
  alt: number;
  /** 다시 인사할 때까지 · 다시 까딱할 때까지 · 마지막에 까딱한 상대 */
  greetCd: number;
  nodCd: number;
  nodWith: Creature | null;
  /** 다음 힐끗까지(초 — 숨은 상자 곁에 있는 동안만 준다) */
  peekWait: number;
  /** 몸이 멈춰 있은 시간(초 — 숨쉬기 말고는 아무 움직임이 없은 시간. npc.stillMax 에 닿기 전에 꼼지락거린다)과 지난 프레임의 자리 */
  stillT: number;
  lastAt: THREE.Vector3;
  /** 종마다의 버릇이 세는 시간 · 버릇을 다시 할 때까지 */
  tick: number;
  quirkCd: number;
  /** 하루의 일이 쓰는 값: 수 둘 · 횟수 · 표시 · 그 일이 세는 시간(초) */
  u: number;
  w: number;
  n: number;
  mark: number;
  clock: number;
  /** 길이 막혀 못 간 시간(초)과 그때의 남은 거리 */
  stuckT: number;
  lastD: number;
  /** 서면 안 되는 자리를 끼고 도는 쪽(1·-1, 0 이면 아직 없다)과 그쪽을 지키는 남은 시간(초) */
  hand: number;
  handT: number;
  /** 땅에서 떠 있는 높이(m — 남의 머리 위에 앉은 모자) · 출렁임이 남은 시간(초) · 반응이 늦는 시간(초) */
  lift: number;
  wobble: number;
  late: number;
  /** 부드럽게 따라간 숙임(rad — 구르는 각은 여기에 더한다) · 구르는 빠르기(rad/s, 주사위가 굴러 보일 때) */
  lean: number;
  spin: number;
  /** 길을 비켜 주지 않는 남은 시간(초 — 급히 지나가는 회중시계) */
  bold: number;
  /** 통통 뛰는 걸음을 쉬나(미끄러지듯 가는 일) · 방금 움직이고 있었나 · 조형물 위에 내려앉는 중인가 */
  isGliding: boolean;
  wasMoving: boolean;
  isPerching: boolean;
}

/** 서지도 지나가지도 않는 둥근 자리: 가운데(단위 벡터)와 가장자리까지의 반지름(m) */
export interface Circle {
  v: THREE.Vector3;
  r: number;
}

/** 숨쉬기: 크기가 변하는 폭과 주기(초) */
export const BREATH = 0.03,
  BREATH_SECONDS = 2;
/** 두리번: 좌우로 돌리는 각(rad — 20도)과 한 번 오가는 시간(초) */
export const LOOK_SWING = 0.35,
  LOOK_SECONDS = 3.4;
/** 자리가 필요한 일(케이크·벤치·큰 꽃)과 짝이 필요한 일이 찾는 거리(m) */
export const PLACE_REACH = 20;
/** 서로 까딱: 마주 보는 시간(초) · 다시 까딱하기까지(초) · 같은 상대와 다시 까딱하기까지(초) */
export const NOD_SECONDS = 1.1,
  NOD_COOLDOWN = 14,
  NOD_SAME_AGAIN = 45;
/** 리본 달린 물건에서 떨어지는 거리에 더 두는 여유(m) */
export const ROOM_MARGIN = 0.3;
/** 몸짓을 따라가는 빠르기(1/초): 보통 · 탁 끊기는 몸짓 */
export const SMOOTH = 11,
  SNAPPY = 34;

/** 새 주민 상태(자리는 앉힐 때 정한다) */
export function createResident(): Resident {
  return {
    act: "chore",
    actT: 0,
    actFor: 0,
    actAim: new THREE.Vector3(),
    actU: 0,
    actStep: 0,
    actClock: 0,
    actBeat: 0,
    aim: new THREE.Vector3(),
    chore: -1,
    choreT: 0,
    choreAge: 0,
    step: 0,
    stepT: 0,
    goal: new THREE.Vector3(),
    mate: null,
    lead: null,
    slot: 0,
    squad: 0,
    size: 1,
    seat: new THREE.Vector3(),
    alt: 0,
    greetCd: 0,
    nodCd: 0,
    nodWith: null,
    peekWait: 0,
    stillT: 0,
    lastAt: new THREE.Vector3(),
    tick: 0,
    quirkCd: 0,
    u: 0,
    w: 0,
    n: 0,
    mark: 0,
    clock: 0,
    stuckT: 0,
    lastD: 0,
    hand: 0,
    handT: 0,
    lift: 0,
    wobble: 0,
    late: 0,
    lean: 0,
    spin: 0,
    bold: 0,
    isGliding: false,
    wasMoving: false,
    isPerching: false,
  };
}

/**
 * 하루의 다음 일을 고른다: 할 수 있는 것(can) 가운데, 방금 한 것(last)은 다른 것이 있으면 빼고, roll(0..1)로.
 * 할 수 있는 것이 하나도 없으면 -1
 */
export function pickChore(can: readonly boolean[], last: number, roll: number): number {
  let open = 0,
    fresh = 0;
  for (let i = 0; i < can.length; i++) {
    if (!can[i]) continue;
    open++;
    if (i !== last) fresh++;
  }
  if (!open) return -1;
  const skipLast = fresh > 0,
    pool = skipLast ? fresh : open,
    scaled = roll * pool,
    lastOne = pool - 1,
    capped = Math.min(lastOne, scaled);
  let want = Math.floor(capped);
  for (let i = 0; i < can.length; i++) {
    if (!can[i] || (skipLast && i === last)) continue;
    if (want === 0) return i;
    want--;
  }
  return -1;
}

/** 나에게 인사할 때인가: 인사하는 거리 안이고(높이 차도), 지난 인사에서 충분히 지났다 */
export function shouldGreet(
  dist: number,
  heightGap: number,
  cooldown: number,
  reach: number,
): boolean {
  return cooldown <= 0 && dist < reach && Math.abs(heightGap) < GREET_HEIGHT;
}

/**
 * 남의 무리 일에 끼어도 되나: 제 하루를 사는 중이고(인사·반응 중이 아니다), 이미 남의 일에 끼지 않았고,
 * 제 일을 시작한 지 least 초가 지났다(한 가지를 적어도 그만큼은 한다 — 막 시작한 일을 이웃이 가로채지 않는다). 아직 일이 없으면 된다
 */
export function canJoin(r: Resident, least: number): boolean {
  if (r.act !== "chore" || r.lead !== null) return false;
  return r.chore < 0 || r.choreAge >= least;
}

/** 둘이 까딱할 사이인가: 서로 다른 무리이고, 같이 하는 일의 짝이 아니고, 둘 다 쉴 만큼 쉬었고, 방금 그 상대가 아니다 */
export function canNod(a: Creature, b: Creature): boolean {
  const ra = a.res,
    rb = b.res;
  if (!ra || !rb) return false;
  if (ra.act !== "chore" || rb.act !== "chore") return false;
  if (ra.nodCd > 0 || rb.nodCd > 0) return false;
  if (ra.squad !== 0 && ra.squad === rb.squad) return false;
  if (ra.mate === b || rb.mate === a || ra.lead === b || rb.lead === a) return false;
  if (ra.lead !== null && ra.lead === rb.lead) return false;
  return true;
}

/** 자리 v 에서 가장 가까운 둥근 자리의 가장자리까지(m — 안이면 음수). 없으면 Infinity */
export function clearance(v: THREE.Vector3, circles: readonly Circle[]): number {
  let least = Infinity;
  for (const circle of circles) {
    const gap = v.angleTo(circle.v) * S.R - circle.r;
    if (gap < least) least = gap;
  }
  return least;
}

/**
 * 자리 v 를 둥근 자리들의 가장자리에서 room(m) 밖으로 밀어낸다(겹친 자리는 몇 번 되풀이해 빠져나온다).
 * 밀려났으면 true. side 를 주면 마지막으로 민 자리를 끼고 도는 쪽(접선)을 거기 담는다
 */
export function pushOut(
  v: THREE.Vector3,
  circles: readonly Circle[],
  room: number,
  side?: THREE.Vector3,
): boolean {
  let pushed = false;
  for (let pass = 0; pass < PUSH_PASSES; pass++) {
    let moved = false;
    for (const circle of circles) {
      const least = circle.r + room,
        // 가까운 것만 정확히 잰다(멀면 내적만으로 넘어간다)
        along = v.dot(circle.v);
      if (along < FAR_COS) continue;
      const capped = Math.min(1, along),
        dist = Math.acos(capped) * S.R;
      if (dist >= least) continue;
      out.copy(v).addScaledVector(circle.v, -along);
      // 한가운데면 아무 쪽으로나
      if (out.lengthSq() < 1e-12) out.set(circle.v.y, circle.v.z, circle.v.x).cross(circle.v);
      out.normalize();
      const arc = (least + PUSH_EPS) / S.R,
        near = Math.cos(arc),
        far = Math.sin(arc);
      v.copy(circle.v).multiplyScalar(near).addScaledVector(out, far).normalize();
      if (side) side.crossVectors(circle.v, out).normalize();
      moved = true;
      pushed = true;
    }
    if (!moved) break;
  }
  return pushed;
}

/** center 둘레 radius(m)에 count 가 둘러설 때 index 번째 자리(first: 첫 자리의 방위, 도) */
export function ringSpot(
  into: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  index: number,
  count: number,
  first = 20,
): THREE.Vector3 {
  const bearing = ((first + (index * 360) / Math.max(1, count)) * Math.PI) / 180,
    arc = radius / S.R;
  // 가운데에서의 기준 접선을 방위만큼 돌린 쪽으로 간다
  const pole = Math.abs(center.y) > 0.9 ? X_AXIS : Y_AXIS;
  out.crossVectors(center, pole).normalize().applyAxisAngle(center, bearing);
  return into.copy(center).applyAxisAngle(out, arc).normalize();
}

/** x 가 a~b 를 지나는 동안 0→1 */
export function between(x: number, a: number, b: number): number {
  const k = (x - a) / (b - a),
    floored = Math.max(0, k);
  return Math.min(1, floored);
}

/** 0→1→0 으로 부드럽게 다녀온다(k: 0..1) */
export function arch(k: number): number {
  const capped = Math.max(0, k),
    turn = Math.min(1, capped) * Math.PI;
  return Math.sin(turn);
}

/** 1초에 hz 번 울리는 박자가 이번 프레임(now 에서 dt 전까지) 사이에 지나갔나 — 효과를 일정한 간격으로 낼 때 */
export function pulse(now: number, dt: number, hz: number): boolean {
  const beat = now * hz,
    before = (now - dt) * hz;
  return Math.floor(beat) !== Math.floor(before);
}

/** now 가 이번 프레임에 그 시각(at)을 막 지났나 — 한 번만 일어나는 일에 */
export function crossed(now: number, dt: number, at: number): boolean {
  return now >= at && now - dt < at;
}

/** 하트 모양 궤적의 한 점(t: 0 꼭대기 가운데 → 1 아래 끝, half: 오른쪽 1 · 왼쪽 -1). x 옆(m)·y 위(m), 너비 약 width */
export function heartPoint(t: number, half: number, width: number, into: { x: number; y: number }) {
  const turn = t * Math.PI,
    twice = 2 * turn,
    thrice = 3 * turn,
    fourfold = 4 * turn,
    sine = Math.sin(turn),
    k = width / 32,
    x = 16 * sine * sine * sine,
    y = 13 * Math.cos(turn) - 5 * Math.cos(twice) - 2 * Math.cos(thrice) - Math.cos(fourfold);
  into.x = half * x * k;
  into.y = y * k;
  return into;
}

/* ─── 내부 ─────────────────────────── */

/** 인사는 높이 차가 이 안일 때만(m — 하늘 높이 날 때 땅의 생물이 멈춰 서지 않게) */
const GREET_HEIGHT = 9;
/** 밀어내기를 되풀이하는 횟수 · 가장자리에서 더 미는 만큼(m) · 이보다 먼 것은 재지 않는다(내적 — 약 31m) */
const PUSH_PASSES = 4,
  PUSH_EPS = 0.02,
  FAR_COS = 0.9982;
const X_AXIS = new THREE.Vector3(1, 0, 0),
  Y_AXIS = new THREE.Vector3(0, 1, 0);
const out = new THREE.Vector3();
