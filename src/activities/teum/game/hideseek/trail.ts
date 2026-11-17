import * as THREE from "three";

import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import { UP } from "../world/sphere";
import { FIND } from "./findTuning";
import type { Candidate } from "./props";
import { sphereAt, startPoint } from "./spots";
import { HIDE } from "./tuning";

// 길 끝(패턴 B)의 꽃 길: 풍선꽃 trail.count 송이가 한 줄로 놓여 길을 만들고, 그 끝에 상자가 든 물건이 있다.
// 길은 물건에서 출발 자리(사람이 다니는 쪽) 방향으로 뻗는다 — 그쪽이 막혔으면 조금씩 틀어서 빈 쪽으로.
// 꽃은 trail.gap 간격, 끝(물건 쪽)으로 갈수록 커진다. 화살표가 아니라 '뭔가 이어져 있네' 정도.
// 상자가 이사 가면 꽃들도 새 물건 앞으로 옮겨 다시 핀다

/** 꽃 하나 */
interface Bloom {
  root: THREE.Group;
  /** 다 피었을 때의 크기(m) · 피기 시작할 때까지(초) · 핀 정도(0..1) */
  size: number;
  wait: number;
  k: number;
  isOn: boolean;
}

/** 꽃 모델(번갈아 놓는다) */
const BLOOM_KEYS = ["flower_pink", "flower_blue"] as const;
/** 길 방향을 틀어 보는 각(도, 출발 쪽에서 좌우로) */
const TURNS = [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180];
/** 꽃 둘레에 비워 둘 자리(m) · 다른 물건에서 띄울 거리(m) · 차례로 피는 간격(초) · 피는 빠르기 */
const BLOOM_ROOM = 0.9,
  PROP_ROOM = 2,
  STAGGER = 0.07,
  GROW = 9;

const at = new THREE.Vector3(),
  q = new THREE.Quaternion();

/** 꽃 길 */
export class FlowerTrail {
  private readonly blooms: Bloom[] = [];

  /** hub: 무대 마을 중심 */
  constructor(
    private readonly s: Services,
    private readonly hub: THREE.Vector3,
  ) {
    const most = FIND.trail.count[1];
    for (let i = 0; i < most; i++) {
      const key = BLOOM_KEYS[i % BLOOM_KEYS.length];
      s.models.need(key);
      const hold: Hold = s.models.fit(key, 1, "h"),
        root = new THREE.Group();
      hold.position.y = hold.userData.hh;
      root.add(hold);
      root.visible = false;
      s.scene.add(root);
      this.blooms.push({ root, size: 1, wait: 0, k: 0, isOn: false });
    }
  }

  /** 길을 거둔다 */
  clear() {
    for (const b of this.blooms) {
      b.isOn = false;
      b.k = 0;
      b.root.visible = false;
    }
  }

  /**
   * end(길 끝 물건) 앞에 꽃 길을 놓는다(others: 피해 갈 다른 물건들). 놓을 데가 없으면 false.
   * 꽃은 길의 시작에서 끝 쪽으로 차례로 핀다
   */
  show(end: Candidate, others: readonly Candidate[], rand: () => number): boolean {
    const T = FIND.trail,
      spanCount = T.count[1] - T.count[0] + 1,
      extra = rand() * spanCount,
      wanted = T.count[0] + Math.floor(extra),
      gap = T.gap[0] + (T.gap[1] - T.gap[0]) * rand();
    this.clear();
    for (let count = wanted; count >= T.count[0]; count--) {
      const spots = this.lay(end, others, count, gap);
      if (!spots) continue;
      spots.forEach(([x, y], i) => {
        // i = 0 이 물건 쪽(가장 크다), 마지막이 길의 시작(가장 작다)
        const share = count > 1 ? i / (count - 1) : 0,
          b = this.blooms[i];
        b.size = T.size[1] + (T.size[0] - T.size[1]) * share;
        b.wait = (count - 1 - i) * STAGGER;
        b.k = 0;
        b.isOn = true;
        this.put(b, x, y, rand);
      });
      return true;
    }
    return false;
  }

  /** 한 프레임: 차례로 핀다 */
  update(dt: number) {
    for (const b of this.blooms) {
      if (!b.isOn) continue;
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      b.root.visible = true;
      b.k += (1 - b.k) * ease(GROW, dt);
      const scale = b.size * b.k;
      b.root.scale.setScalar(scale);
    }
  }

  dispose() {
    for (const b of this.blooms) b.root.removeFromParent();
  }

  /* ─── 내부 ─────────────────────────── */

  // 꽃 count 송이의 자리(광장 가운데 기준 평면 m): 물건에서 출발 쪽으로, 막혔으면 방향을 틀어 본다. 다 막혔으면 null
  private lay(
    end: Candidate,
    others: readonly Candidate[],
    count: number,
    gap: number,
  ): [number, number][] | null {
    const start = startPoint(),
      { x, y } = end.spec,
      dx = start.x - x,
      dy = start.y - y,
      toward = Math.atan2(dy, dx),
      first = end.wide + FIND.trail.fromEnd;
    for (const turn of TURNS) {
      const angle = toward + THREE.MathUtils.degToRad(turn),
        ux = Math.cos(angle),
        uy = Math.sin(angle),
        spots: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const along = first + i * gap,
          px = x + ux * along,
          py = y + uy * along;
        spots.push([px, py]);
      }
      if (spots.every(([px, py]) => this.isOpen(px, py, end, others))) return spots;
    }
    return null;
  }

  // 그 자리에 꽃을 놓을 수 있나: 무대 안이고, 놓인 것이 없고, 다른 물건과 떨어져 있다
  private isOpen(x: number, y: number, end: Candidate, others: readonly Candidate[]): boolean {
    if (Math.hypot(x, y) > HIDE.stage.radius) return false;
    sphereAt(at, this.hub, x, y);
    if (!this.s.occ.isFree(at, BLOOM_ROOM)) return false;
    return others.every((c) => {
      if (c === end) return true;
      const dx = c.spec.x - x,
        dy = c.spec.y - y;
      return Math.hypot(dx, dy) >= c.wide + PROP_ROOM;
    });
  }

  private put(b: Bloom, x: number, y: number, rand: () => number) {
    sphereAt(at, this.hub, x, y);
    const ground = this.s.terrain.groundAt(at),
      radius = S.R + ground,
      yaw = rand() * Math.PI * 2;
    q.setFromAxisAngle(UP, yaw);
    b.root.quaternion.setFromUnitVectors(UP, at).multiply(q);
    b.root.position.copy(at).multiplyScalar(radius);
    b.root.scale.setScalar(0.001);
  }
}
