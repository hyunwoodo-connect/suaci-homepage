import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutArch } from "../world/layout";
import { from, heading, step } from "../world/sphere";
import type { PathNode } from "./streams";

// 구름 다리 — 끝에서 올라타면 높은 아치를 타고 넘어간다. 마디마다 방석 같은 발판이 놓인다

/** 다리 마디: 아치 높이(hh), 그 마디 발판의 자리·돌림·크기(M) */
export interface ArchNode extends Omit<PathNode, "ph"> {
  hh: number;
  a: LayoutArch;
  M: THREE.Matrix4;
}

/** 구름 다리 하나 */
export interface Arch extends LayoutArch {
  nodes: ArchNode[];
}

const tmp = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  ps = new THREE.Vector3(),
  sc = new THREE.Vector3();
/** 다리에 붙는 거리(3.4m)보다 확실히 먼 마디는 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const ON_ARC = 3.4 / S.R;
const COS_ON = Math.cos(ON_ARC) - 1e-9;

/** 구름 다리 전체 */
export class Arches implements Thing {
  readonly list: Arch[];
  readonly anodes: ArchNode[] = [];
  /** 방석 같은 발판(마디마다 하나, 한 번에 그린다) */
  readonly planks: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private wasR = false;

  constructor(private readonly s: Services) {
    this.list = s.layout.arch.map((a) => {
      const arch: Arch = { ...a, nodes: [] };
      for (let i = 0; i < a.n; i++) {
        const archPhase = (Math.PI * i) / (a.n - 1);
        const nd: ArchNode = {
          v: new THREE.Vector3(),
          d: new THREE.Vector3(),
          side: new THREE.Vector3(),
          g: 0,
          hh: a.arch * Math.sin(archPhase),
          a: arch,
          M: new THREE.Matrix4(),
        };
        arch.nodes.push(nd);
        this.anodes.push(nd);
      }
      return arch;
    });
    const plankGeo = new THREE.SphereGeometry(0.5, 16, 12);
    const plankMat = s.mats.grey(0xffffff);
    plankMat.color.copy(s.mats.toy.plank);
    const count = this.anodes.length;
    this.planks = new THREE.InstancedMesh(plankGeo, plankMat, count);
    // 발판은 다리 전체에 걸쳐 있어 한 덩어리의 상자로 거르면 엉뚱하게 사라진다
    this.planks.frustumCulled = false;
    s.scene.add(this.planks);
  }

  /** 자리: 마디마다 아치 높이로 발판을 놓는다. 그 뒤로는 가까운 다리의 발판만 칸에 채운다 */
  layout(keep: THREE.Vector3[]) {
    for (const a of this.list) {
      let v = from(a.dist, a.bear),
        d = heading(v, a.head);
      for (const nd of a.nodes) {
        nd.v.copy(v);
        nd.d.copy(d);
        nd.side.crossVectors(v, d).normalize();
        nd.g = this.s.terrain.featGround(v);
        keep.push(nd.v);
        m4.makeBasis(nd.side, nd.v, nd.d);
        q.setFromRotationMatrix(m4);
        const radius = S.R + nd.g + nd.hh + 0.1;
        ps.copy(v).multiplyScalar(radius);
        const plankLength = a.gap * 0.95;
        sc.set(3.2, 0.8, plankLength);
        nd.M.compose(ps, q, sc);
        [v, d] = step(v, d, a.gap, a.curve);
      }
    }
    // 발판은 다리마다 흩어져 있어 가까이·시야 안의 것만 그린다
    const planks = this.planks;
    this.anodes.forEach((nd, i) => planks.setMatrixAt(i, nd.M));
    planks.count = this.anodes.length;
    this.s.models.pack(planks).capture();
  }

  /** 자리 차지: 마디 둘레, 그리고 다리 길(비행 통로) */
  claim() {
    for (const nd of this.anodes) {
      this.s.occ.fill(nd.v, 5);
      this.s.occ.addCorridor(nd.v, 10);
    }
  }

  /** 마디 높이에 붙어 넘어간다 */
  update(f: Frame) {
    const { player, hud } = this.s,
      dt = f.dt,
      p = player.p;
    let onRail = false;
    if (!player.held && !player.isHanging)
      for (const nd of this.anodes) {
        if (p.dot(nd.v) <= COS_ON) continue;
        const altOffset = player.alt - (nd.g + nd.hh + S.hover);
        if (p.angleTo(nd.v) * S.R < 3.4 && Math.abs(altOffset) < 3.2) {
          onRail = true;
          const sg = player.vel.dot(nd.d) >= 0 ? 1 : -1;
          tmp.copy(nd.d).multiplyScalar(sg);
          const velPull = ease(6, dt),
            airPull = ease(9, dt);
          player.turnTo(tmp, velPull);
          player.boostAtLeast(0.9);
          const railAir = nd.g + nd.hh + 0.35 - player.floor;
          const targetAir = Math.max(0.01, railAir);
          player.glide(targetAir, airPull);
          break;
        }
      }
    if (onRail && !this.wasR) hud.say("구름 다리 — 타고 넘어갑니다");
    this.wasR = onRail;
  }

  /** 치운다 */
  dispose() {
    this.planks.removeFromParent();
    this.planks.geometry.dispose();
    this.planks.material.dispose();
    this.planks.dispose();
  }
}
