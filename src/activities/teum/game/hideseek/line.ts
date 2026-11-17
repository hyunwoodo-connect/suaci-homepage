import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { LimeBox } from "./limebox";
import { HIDE } from "./tuning";

// 찾은 상자의 줄: 내 바로 뒤가 아니라 뒤쪽 좌우로 비스듬히 선다(V자) — 첫째는 왼쪽 뒤, 둘째는 오른쪽 뒤, 셋째는 더 왼쪽 뒤….
// 몸 가운데가 카메라와 나를 잇는 선에서 좌우 line.side(m) 밖에 선다(세로 폰은 그 깊이에서 화면 반폭이 1.3m 남짓이라 상자는 화면 아래 모서리에 걸린다).
// 첫 줄이 line.first(m) 뒤라 서 있을 때 폰 화면 아래 4분의 1 안에 든다. 나를 가리면 더 바깥으로 벌린다. 줄에 서면 line.scale 로 작아지고 귀도 원래 길이다. 종종걸음으로 따라오고, 멈추면 앞에서부터 차례로 폴짝.
// 높이는 지금의 나를 따른다 — 땅에 붙고, 내가 뜨면 같이 뜬다

/** 지나온 자리(줄 대신 이제는 아닌 척 '내 줄에 끼기'가 뒤에서 다가올 때 쓴다) */
export interface LineTrail {
  behind(meters: number, out: THREE.Vector3): void;
}

/**
 * 따라붙는 빠르기(거리의 몇 배 m/s)와 가장 빠르게 · 서 있다가 이만큼(m) 벌어지면 다시 걷고, 걷다가 이만큼(m) 안에 들면 선다 ·
 * 멈춘 뒤 폴짝까지(초)와 차례 사이(초) · 내가 이만큼(m) 넘게 솟으면 같이 뜬다 · 높이를 따라붙는 빠르기
 */
const CHASE = 9,
  CHASE_MAX = 26,
  GO_GAP = 0.3,
  STOP_GAP = 0.06,
  REST = 0.2,
  REST_WAVE = 0.12,
  GROUNDED = 0.2,
  LIFT_EASE = 10;
/** V 자: 한 줄 물러날 때 더 벌어지는 거리(m) · 나를 가리면 비키는 빠르기(m/s)·가장 많이(m)·돌아오는 빠르기(m/s) */
const RANK_SPREAD = 0.3,
  PUSH = 4,
  PUSH_MAX = 3,
  RELAX = 0.8;

const spot = new THREE.Vector3(),
  fwd = new THREE.Vector3(),
  right = new THREE.Vector3(),
  top = new THREE.Vector3(),
  me = new THREE.Vector3();

/** 줄에 선 상자 하나: 자리(찾은 차례) · 멈춰 선 뒤 흐른 시간(초 — 0 이면 걷는 중) · 멈춘 뒤의 폴짝을 했나 · 땅에서 떠 있는 높이(m) · 더 벌린 거리(m) */
interface Member {
  box: LimeBox;
  slot: number;
  still: number;
  hasHopped: boolean;
  lift: number;
  spread: number;
}

/** 찾은 상자의 줄 */
export class BoxLine {
  private readonly members: Member[] = [];

  constructor(private readonly s: Services) {}

  /** box 가 slot 번째(찾은 차례) 자리에 선다. 떠 있던 높이에서 시작해 내 높이로 내려온다 */
  join(box: LimeBox, slot: number) {
    const ground = this.s.terrain.groundAt(box.v),
      above = box.a - ground,
      lift = Math.max(0, above);
    this.members.push({ box, slot, still: 0, hasHopped: true, lift, spread: 0 });
    box.setSize(HIDE.line.scale);
    box.setLongEars(false);
    box.setOutline(false);
  }

  /** 줄을 푼다(새 판) */
  clear() {
    this.members.length = 0;
  }

  /** slot 번째 자리(땅 위 단위 벡터) — 아닌 척 '내 줄에 끼기'가 줄 끝에 선다. spread: 더 벌린 거리(m) */
  spotFor(slot: number, out: THREE.Vector3, spread = 0): THREE.Vector3 {
    const { player, camera } = this.s,
      L = HIDE.line,
      p = player.p as THREE.Vector3;
    // 카메라에서 나를 보는 쪽(땅에 붙인)이 앞, 그 오른쪽
    fwd.copy(player.P).sub(camera.camera.position);
    const up = fwd.dot(p);
    fwd.addScaledVector(p, -up);
    if (fwd.lengthSq() < 1e-8) fwd.copy(player.h);
    fwd.normalize();
    right.crossVectors(fwd, p).normalize();
    const pairs = slot / 2,
      rank = Math.floor(pairs),
      sign = slot % 2 === 0 ? -1 : 1,
      back = L.first + L.gap * rank,
      side = L.side + RANK_SPREAD * rank + spread,
      backArc = -back / S.R,
      sideArc = (sign * side) / S.R;
    return out.copy(p).addScaledVector(fwd, backArc).addScaledVector(right, sideArc).normalize();
  }

  /** 한 프레임 */
  update(dt: number) {
    const { terrain, player } = this.s,
      soar = player.air - GROUNDED,
      lift = Math.max(0, soar),
      rise = ease(LIFT_EASE, dt);
    for (const m of this.members) {
      const b = m.box;
      this.spotFor(m.slot, spot, m.spread);
      // 서 있을 때는 제법 벌어져야 다시 걷는다 — 천천히 움직일 때 걷다 서다를 되풀이하며 떨지 않게
      const gap = b.v.angleTo(spot) * S.R,
        isResting = m.still > 0,
        slack = isResting ? GO_GAP : STOP_GAP;
      if (gap > slack) {
        const chase = gap * CHASE,
          speed = Math.min(CHASE_MAX, chase);
        b.stepToward(spot, speed, dt);
        b.setScurry(1);
        m.still = 0;
        m.hasHopped = false;
      } else {
        b.setScurry(0);
        m.still += dt;
        const turn = REST + REST_WAVE * m.slot;
        if (!m.hasHopped && m.still >= turn) {
          m.hasHopped = true;
          const small = b.hh * HIDE.line.scale;
          b.hop(small);
        }
      }
      m.lift += (lift - m.lift) * rise;
      b.a = terrain.groundAt(b.v) + m.lift;
      this.keepClear(m, dt);
    }
  }

  // 화면에서 나를 가리면 더 바깥으로 벌리고, 아니면 천천히 돌아온다
  private keepClear(m: Member, dt: number) {
    const b = m.box,
      cam = this.s.camera.camera,
      tall = b.hh * 2 * b.size,
      halfTall = tall * 0.5;
    b.center(top).addScaledVector(b.v, halfTall).project(cam);
    const topY = (1 - top.y) * 0.5,
      isBehindCam = top.z >= 1;
    me.copy(this.s.player.P).project(cam);
    const meX = me.x,
      meY = (1 - me.y) * 0.5;
    b.center(spot).project(cam);
    const boxX = spot.x,
      apart = boxX - meX,
      isOverMe = Math.abs(apart) < 0.18 && topY < meY + 0.08;
    const push = PUSH * dt,
      relax = RELAX * dt,
      isBlocking = isOverMe && !isBehindCam;
    m.spread = nudge(m.spread, isBlocking, push, relax);
  }
}

/* ─── 내부 ─────────────────────────── */

// 비키는 거리: 막히면 push 만큼 늘고(PUSH_MAX 까지), 아니면 relax 만큼 줄어든다(0 까지)
function nudge(now: number, isBlocked: boolean, push: number, relax: number): number {
  const grown = now + push,
    shrunk = now - relax;
  return isBlocked ? Math.min(PUSH_MAX, grown) : Math.max(0, shrunk);
}
