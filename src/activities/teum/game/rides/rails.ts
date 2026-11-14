import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutPath } from "../world/layout";
import { from, heading, step } from "../world/sphere";

// 무지개 레일 — 닿으면 붙어 점점 빠르게 미끄러지고, 칙 하면 뛰어오른다. 레일은 구슬을 꿴 것 같은 마디(한 번에 그리는 묶음)

/** 레일 마디: 자리·방향·옆·땅 높이, 오르내리는 높이(hh) */
export interface RailNode {
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  g: number;
  hh: number;
}

/** 레일 하나 */
export interface Rail extends LayoutPath {
  nodes: RailNode[];
}

const tmp = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  ps = new THREE.Vector3(),
  sc = new THREE.Vector3();

/** 무지개 레일 전체 */
export class Rails implements Thing, Tappable {
  readonly list: Rail[];
  readonly rnodes: RailNode[] = [];
  /** 구슬을 꿴 것 같은 레일 */
  readonly railM: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  /** 레일 위에 있다 */
  railOn = false;
  private railSp = 1.3;
  private railCool = 0;
  private wasOn = false;

  constructor(private readonly s: Services) {
    this.list = s.layout.rail.map((rl) => {
      const rail: Rail = { ...rl, nodes: [] };
      for (let i = 0; i < rl.n; i++) {
        // 처음부터 끝까지 두 번 솟았다 내려온다(높이 2~9)
        const wavePhase = (Math.PI * 4 * i) / (rl.n - 1);
        const hh = 2 + 7 * (0.5 - 0.5 * Math.cos(wavePhase));
        const nd: RailNode = {
          v: new THREE.Vector3(),
          d: new THREE.Vector3(),
          side: new THREE.Vector3(),
          g: 0,
          hh,
        };
        rail.nodes.push(nd);
        this.rnodes.push(nd);
      }
      return rail;
    });
    const beadGeo = new THREE.SphereGeometry(0.5, 12, 10);
    const railHex = s.mats.toy.rail.getHex();
    const beadMat = s.mats.grey(railHex);
    this.railM = new THREE.InstancedMesh(beadGeo, beadMat, this.rnodes.length);
    // 구슬 레일이 실제로 보이게 장면에 넣는다(타기만 되고 레일이 안 보이던 것을 바로잡음)
    this.railM.frustumCulled = false;
    s.scene.add(this.railM);
  }

  /** 자리: 마디를 휘며 잇고 구슬을 놓는다 */
  layout(keep: THREE.Vector3[]) {
    const terrain = this.s.terrain;
    let rli = 0;
    for (const rl of this.list) {
      let v = from(rl.dist, rl.bear),
        d = heading(v, rl.head),
        i = 0;
      for (const nd of rl.nodes) {
        nd.v.copy(v);
        nd.d.copy(d);
        nd.side.crossVectors(v, d).normalize();
        nd.g = terrain.featGround(v);
        keep.push(nd.v);
        m4.makeBasis(nd.side, nd.v, nd.d);
        q.setFromRotationMatrix(m4);
        const nodeR = S.R + nd.g + nd.hh;
        ps.copy(v).multiplyScalar(nodeR);
        const beadLen = rl.gap * 1.35;
        sc.set(0.75, 0.6, beadLen);
        m4.compose(ps, q, sc);
        this.railM.setMatrixAt(rli, m4);
        rli++;
        const wigglePhase = i * 0.33;
        const wiggle = rl.wig * Math.sin(wigglePhase);
        [v, d] = step(v, d, rl.gap, wiggle);
        i++;
      }
    }
    this.railM.instanceMatrix.needsUpdate = true;
    // 구슬 972 개는 행성 곳곳에 흩어져 있어 가까이·시야 안의 것만 그린다
    this.s.models.pack(this.railM).capture();
  }

  /** 자리 차지: 마디 둘레, 그리고 레일 길(비행 통로) */
  claim() {
    for (const nd of this.rnodes) {
      this.s.occ.fill(nd.v, 5);
      this.s.occ.addCorridor(nd.v, 10);
    }
  }

  /** 레일 위에서 칙 하면 뛰어오른다 */
  onTap() {
    if (!this.railOn) return;
    this.s.player.bounce(9);
    this.railCool = 1.0;
  }

  /** 붙어서 점점 빠르게 미끄러진다 */
  update(f: Frame) {
    const { player, hud, fx } = this.s,
      dt = f.dt,
      p = player.p;
    let onRail = false;
    if (this.railCool > 0) this.railCool -= dt;
    else if (!player.held && !player.isHanging)
      for (const nd of this.rnodes) {
        const railAlt = nd.g + nd.hh + S.hover * 0.5;
        const altGap = player.alt - railAlt;
        if (p.angleTo(nd.v) * S.R >= 3.4 || Math.abs(altGap) >= 3.4) continue;
        onRail = true;
        const sg = player.vel.dot(nd.d) >= 0 ? 1 : -1;
        player.keepOnLine(nd.v, nd.d);
        tmp.copy(nd.d).multiplyScalar(sg);
        // 진행 방향과 높이는 빠르게(10), 시선은 천천히(2) 레일을 따라간다
        const snap = ease(10, dt);
        player.turnTo(tmp, snap);
        const look = ease(2, dt);
        player.lookTo(tmp, look);
        const fasterSp = this.railSp + dt * 0.35;
        this.railSp = Math.min(2.8, fasterSp);
        player.boostAtLeast(this.railSp);
        const railAir = nd.g + nd.hh + 0.8 - player.floor - S.hover + 0.6;
        const targetAir = Math.max(0.01, railAir);
        player.glide(targetAir, snap);
        break;
      }
    if (!onRail) {
      const slowerSp = this.railSp - dt * 1.5;
      this.railSp = Math.max(1.3, slowerSp);
    }
    if (onRail && !this.wasOn) hud.say("무지개 레일 — 미끄러지다 칙 하면 뛰어오릅니다");
    this.wasOn = onRail;
    this.railOn = onRail;
    if (onRail) fx.glow(player.P, 3.2, 0.8);
  }

  /** 치운다 */
  dispose() {
    this.railM.removeFromParent();
    this.railM.geometry.dispose();
    this.railM.material.dispose();
    this.railM.dispose();
  }
}
