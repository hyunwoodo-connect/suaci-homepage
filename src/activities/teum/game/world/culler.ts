import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Player } from "../player/player";
import { S } from "../settings";

// 가까운 것만 장면에 둔다. 공이 휘어 있어서 먼 것은 어차피 땅에 가리거나 안개에 묻힌다.
// 먼 것은 장면에서 아예 떼어 낸다 — 보이지 않게(visible) 두기만 하면 three 가 매 프레임 행렬을 다시 셈하고 훑는다.
// 기준은 시제품의 '가까운 것만 그리기'와 같다: 20 프레임마다, 높이 뜰수록 더 멀리까지(cos(min(1.45, 0.95 + 높이/260)))

/** 맡긴 것 하나: 그 물체와 행성 위 자리 */
interface Tracked {
  o: THREE.Object3D;
  v: THREE.Vector3;
}

/** 다시 고르는 간격(프레임) */
const EVERY = 20;

/** 가까운 것만 그리기에 쓰는 거리(cos) — 높이 altA 에서 */
export function reachCos(altA: number): number {
  const reach = 0.95 + altA / 260,
    reachAngle = Math.min(1.45, reach);
  return Math.cos(reachAngle);
}

/** 가까운 것만 장면에 둔다 */
export class Culler {
  private readonly list: Tracked[] = [];
  private readonly holder = new THREE.Group();
  private tick = 0;
  /** 지금 기준(cos). 찍어 둔 묶음(Instancer)도 같은 기준으로 칸을 채운다 */
  cut = -1;
  private readonly listeners: ((cut: number) => void)[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly player: Player,
  ) {
    this.holder.name = "near";
    scene.add(this.holder);
  }

  /** 이 물체를 자리 v 로 맡긴다(다른 부모 밑에 있으면 떼어 온다) */
  track(o: THREE.Object3D, v: THREE.Vector3) {
    o.removeFromParent();
    this.list.push({ o, v });
    o.parent = this.holder;
    this.holder.children.push(o);
  }

  /** 기준을 다시 정할 때마다 부른다(찍어 둔 묶음·꽃처럼 칸을 따로 채우는 것) */
  onCull(fn: (cut: number) => void) {
    this.listeners.push(fn);
  }

  /** 20 프레임마다 가까운 것만 남긴다 */
  update(f: Frame) {
    void f;
    if (--this.tick > 0) return;
    this.tick = EVERY;
    const P = this.player.P,
      p = this.player.p;
    const altA = P.length() - S.R;
    const cut = reachCos(altA);
    this.cut = cut;
    const kids = this.holder.children;
    kids.length = 0;
    for (const t of this.list) {
      if (t.v.dot(p) > cut) {
        t.o.parent = this.holder;
        kids.push(t.o);
      } else t.o.parent = null;
    }
    for (const fn of this.listeners) fn(cut);
  }

  /** 맡긴 것을 모두 놓는다 */
  dispose() {
    for (const t of this.list) t.o.parent = null;
    this.holder.children.length = 0;
    this.holder.removeFromParent();
  }
}
