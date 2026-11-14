import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Services } from "../services";
import { S } from "../settings";
import { from, UP } from "../world/sphere";

// 풍선 — 잡으면 천천히 떠오른다. 끌면 방향을 잡을 수 있고, 칙 하면 놓는다.
// 붙잡히는 것이 아니라 매달리는 것이라(끌기가 먹는다) 나를 붙잡지 않고 매달림(hang)으로 부탁한다

/** 풍선 하나 */
export interface Balloon {
  g: THREE.Group;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  gnd: number;
  cool: number;
}

/** 풍선 전체 */
export class Balloons implements Thing, Tappable {
  readonly list: Balloon[];
  /** 풍선 모양: 잡은 것은 머리 위에 작게, 나머지는 제자리에서 둥실(나를 놓은 뒤에) */
  readonly pose: Thing;
  /** 매달린 풍선과 매달린 뒤 시간 */
  private ride: { b: Balloon; t: number } | null = null;
  private readonly ballGeo = new THREE.SphereGeometry(1.5, 20, 14);
  private readonly strGeo = new THREE.CylinderGeometry(0.04, 0.04, 4, 6);
  private readonly ballMat: THREE.MeshStandardMaterial;
  private readonly strMat: THREE.MeshStandardMaterial;

  constructor(private readonly s: Services) {
    this.ballMat = s.mats.grey(0xc9cdcc);
    this.strMat = s.mats.grey(0x9a9f9e);
    this.list = s.layout.balloon.map(({ dist, bear }) => {
      const gr = new THREE.Group();
      const b = new THREE.Mesh(this.ballGeo, this.ballMat);
      b.scale.y = 1.15;
      const str = new THREE.Mesh(this.strGeo, this.strMat);
      str.position.y = -3.4;
      gr.add(b, str);
      s.scene.add(gr);
      return { g: gr, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
    });
    this.pose = { update: (f) => this.placeAll(f), dispose: () => {} };
  }

  /** 자리 */
  layout(keep: THREE.Vector3[]) {
    for (const b of this.list) {
      const spot = from(b.dist, b.bear);
      b.v.copy(spot);
      b.gnd = this.s.terrain.featGround(b.v);
      keep.push(b.v);
      b.cool = 0;
    }
  }

  /** 자리 차지: 풍선 둘레, 그리고 끌어 올리는 길(비행 통로) */
  claim() {
    for (const b of this.list) {
      this.s.occ.fill(b.v, 5);
      this.s.occ.addCorridor(b.v, 8);
    }
  }

  /** 풍선 모델. 먼 것은 장면에서 뗀다 */
  fitModels() {
    const { models, culler } = this.s;
    for (const b of this.list) {
      culler.track(b.g, b.v);
      if (!models.has("balloon")) continue;
      const m = models.fit("balloon", 6, "h");
      m.position.y = -0.4;
      const prim = b.g.children.slice();
      b.g.add(m);
      models.swapWhenReady("balloon", prim);
    }
  }

  /** 칙 하면(하늘을 눌러도) 잡고 있던 풍선을 놓는다 */
  onTap() {
    if (this.ride) this.letGo(6);
  }

  /** 잡으면 떠오르다 한참 뒤나 높이 오르면 놓는다 */
  update(f: Frame) {
    const { player, hud } = this.s,
      dt = f.dt;
    for (const b of this.list) {
      if (b.cool > 0) b.cool -= dt;
      else if (!player.held && !this.ride && player.air < 7 && player.p.angleTo(b.v) * S.R < 3) {
        this.ride = { b, t: 0 };
        player.hang(b);
        hud.say("풍선 — 천천히 떠오릅니다. 칙 하면 놓습니다");
      }
    }
    const ride = this.ride;
    if (!ride) return;
    ride.t += dt;
    player.lift(2.4);
    if (ride.t > 11 || player.air > 84) this.letGo(6);
  }

  /** 치운다 */
  dispose() {
    for (const b of this.list) b.g.removeFromParent();
    this.ballGeo.dispose();
    this.strGeo.dispose();
    this.ballMat.dispose();
    this.strMat.dispose();
  }

  // 놓는다: 그 풍선은 한동안(cool) 다시 잡히지 않는다
  private letGo(cool: number) {
    const ride = this.ride;
    if (!ride) return;
    this.ride = null;
    ride.b.cool = cool;
    this.s.player.letGo(ride.b);
  }

  private placeAll(f: Frame) {
    const player = this.s.player,
      p = player.p,
      P = player.P;
    for (const b of this.list) {
      const mine = this.ride !== null && this.ride.b === b;
      b.g.visible = mine || b.cool <= 0;
      const size = mine ? 0.6 : 1; // 잡고 있을 때는 시야를 가리지 않게 작게
      b.g.scale.setScalar(size);
      if (mine) {
        b.g.position.copy(P).addScaledVector(p, 3.1);
        b.g.quaternion.setFromUnitVectors(UP, p);
      } else {
        const bobPhase = f.time * 1.1 + b.dist;
        const radius = S.R + b.gnd + 5.6 + Math.sin(bobPhase) * 0.3;
        b.g.position.copy(b.v).multiplyScalar(radius);
        b.g.quaternion.setFromUnitVectors(UP, b.v);
      }
    }
  }
}
