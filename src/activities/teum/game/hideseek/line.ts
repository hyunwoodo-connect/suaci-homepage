import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { LimeBox } from "./limebox";
import { HIDE } from "./tuning";

// 찾은 상자의 줄: 내 지나온 길을 그대로 밟으며 바짝 붙어 종종걸음으로 따라온다(간격은 hideseek.data.json 의 line).
// 높이는 지나온 길이 아니라 지금의 나를 따른다 — 땅에 붙고, 내가 뜨면 같이 뜬다(따로 오르내리지 않는다).
// 멈추면 앞에서부터 차례로 폴짝 한 번씩 하고 선다. 줄에 서면 line.scale 로 작아진다(커다란 상자가 나를 가리지 않게)

/** 줄이 밟는 길: 내 뒤로 지나온 길을 meters 만큼 되짚은 자리(out) */
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

const spot = new THREE.Vector3();

/** 줄에 선 상자 하나: 자리(찾은 차례) · 멈춰 선 뒤 흐른 시간(초 — 0 이면 걷는 중) · 멈춘 뒤의 폴짝을 했나 · 땅에서 떠 있는 높이(m) */
interface Member {
  box: LimeBox;
  slot: number;
  still: number;
  hasHopped: boolean;
  lift: number;
}

/** 찾은 상자의 줄 */
export class BoxLine {
  private readonly members: Member[] = [];

  constructor(
    private readonly s: Services,
    private readonly trail: LineTrail,
  ) {}

  /** box 가 slot 번째(찾은 차례) 자리에 선다. 떠 있던 높이에서 시작해 내 높이로 내려온다 */
  join(box: LimeBox, slot: number) {
    const ground = this.s.terrain.groundAt(box.v),
      above = box.a - ground,
      lift = Math.max(0, above);
    this.members.push({ box, slot, still: 0, hasHopped: true, lift });
    box.setSize(HIDE.line.scale);
  }

  /** 줄을 푼다(새 판) */
  clear() {
    this.members.length = 0;
  }

  /** 한 프레임 */
  update(dt: number) {
    const { terrain, player } = this.s,
      L = HIDE.line,
      soar = player.air - GROUNDED,
      lift = Math.max(0, soar),
      rise = ease(LIFT_EASE, dt);
    for (const m of this.members) {
      const b = m.box,
        back = L.first + L.gap * m.slot;
      this.trail.behind(back, spot);
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
          b.hop(b.hh);
        }
      }
      m.lift += (lift - m.lift) * rise;
      b.a = terrain.groundAt(b.v) + m.lift;
    }
  }
}
