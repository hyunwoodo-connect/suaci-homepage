import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import { LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutPath } from "../world/layout";
import { from, FWD, heading, step } from "../world/sphere";

// 바람길 — 들어가면 흐름에 실려 굽이굽이 간다. 그 위로 꽃잎이 구르며 흘러간다.
// 꽃잎은 마디마다 둘. 가까운 마디의 것만 칸에 채워 그린다(멀리 있는 것은 어차피 안개에 묻힌다)

/** 길 위 마디 하나(자리·방향·옆·땅 높이) */
export interface PathNode {
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  g: number;
  ph: number;
}

/** 바람길 하나: 마디들과 끝 자리·방향(고리 줄·회오리가 이어 붙는다) */
export interface Stream extends LayoutPath {
  nodes: PathNode[];
  endV: THREE.Vector3;
  endD: THREE.Vector3;
}

/** 꽃잎 모양·재질(상승 기류와 같이 쓴다) */
export interface PetalLook {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** 마디 하나의 꽃잎(어느 바람길의 몇 번째, 그 순서의 색) */
interface Streak {
  st: Stream;
  nd: PathNode;
  k: number;
  color: THREE.Color;
}

const ps = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  yq3 = new THREE.Quaternion();
/** 바람길에 실리는 거리(4.4m)보다 확실히 먼 마디는 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const IN_ARC = 4.4 / S.R;
const COS_IN = Math.cos(IN_ARC) - 1e-9;

/** 바람길 전체 */
export class Streams implements Thing {
  readonly list: Stream[];
  readonly nodes: PathNode[] = [];
  private readonly streaks: Streak[] = [];
  /** 가까운 마디의 꽃잎(그리는 칸 차례) */
  private readonly near: Streak[] = [];
  private mesh: THREE.InstancedMesh | null = null;
  private wasS = false;

  constructor(private readonly s: Services) {
    this.list = s.layout.stream.map((st) => {
      const stream: Stream = {
        ...st,
        nodes: [],
        endV: new THREE.Vector3(),
        endD: new THREE.Vector3(),
      };
      for (let i = 0; i < st.n; i++) {
        const ph = this.nodes.length * 1.7;
        const nd: PathNode = {
          v: new THREE.Vector3(),
          d: new THREE.Vector3(),
          side: new THREE.Vector3(),
          g: 0,
          ph,
        };
        stream.nodes.push(nd);
        this.nodes.push(nd);
      }
      return stream;
    });
    // 꽃잎 색은 놓인 차례대로 톤의 꽃 색을 돌려 쓴다
    for (const st of this.list)
      for (const nd of st.nodes)
        for (let k = 0; k < 2; k++) {
          const order = this.streaks.length * 3;
          const hex = LOOK.fl[order % LOOK.fl.length];
          const color = new THREE.Color(hex);
          const streak: Streak = { st, nd, k, color };
          this.streaks.push(streak);
        }
  }

  /** 자리: 굽이굽이 휘며 마디를 놓는다 */
  layout(keep: THREE.Vector3[]) {
    for (const st of this.list) {
      let v = from(st.dist, st.bear),
        d = heading(v, st.head);
      for (let i = 0; i < st.n; i++) {
        const nd = st.nodes[i];
        nd.v.copy(v);
        nd.d.copy(d);
        nd.side.crossVectors(v, d).normalize();
        nd.g = this.s.terrain.featGround(v);
        keep.push(nd.v);
        const bendPhase = i * 0.55;
        const bend = st.wig * Math.sin(bendPhase);
        [v, d] = step(v, d, st.gap, bend);
      }
      st.endV = v;
      st.endD = d;
    }
    this.near.push(...this.streaks);
    this.s.culler.onCull((cut) => this.pickNear(cut));
  }

  /** 자리 차지: 마디 둘레, 그리고 실어 가는 길(비행 통로) */
  claim() {
    for (const st of this.list)
      for (const nd of st.nodes) {
        this.s.occ.fill(nd.v, 5);
        this.s.occ.addCorridor(nd.v, 10);
      }
  }

  /** 흘러가는 꽃잎에 꽃잎 모양을 쓴다(상승 기류와 같은 것) */
  usePetals(petals: PetalLook) {
    const count = this.streaks.length;
    const mesh = new THREE.InstancedMesh(petals.geo, petals.mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.s.scene.add(mesh);
    this.mesh = mesh;
    this.paint();
  }

  /** 들어가면 흐름에 실리고, 꽃잎이 구르며 흘러간다 */
  update(f: Frame) {
    const { player, hud } = this.s,
      dt = f.dt,
      p = player.p;
    let inS = false;
    if (!player.held)
      for (const nd of this.nodes) {
        if (p.dot(nd.v) <= COS_IN) continue;
        if (p.angleTo(nd.v) * S.R < 4.4 && player.alt - nd.g < 8) {
          inS = true;
          const velPull = ease(5, dt),
            headPull = ease(2.2, dt);
          player.turnTo(nd.d, velPull);
          player.lookTo(nd.d, headPull);
          player.boostAtLeast(1.15);
          if (player.air < 1.6) player.lift(1.6);
          break;
        }
      }
    if (inS && !this.wasS) hud.say("바람길 — 흐름에 실려 갑니다");
    this.wasS = inS;
    const mesh = this.mesh;
    if (!mesh) return;
    const time = f.time;
    for (let i = 0; i < this.near.length; i++) {
      const { st, nd, k } = this.near[i];
      const al = ((time * 5.5 + (k * st.gap) / 2 + nd.ph) % st.gap) - st.gap / 2,
        fade = 1 - Math.abs(al) / (st.gap / 2);
      const alongStep = al / S.R;
      const sideStep = (k ? 1.2 : -1.2) / S.R;
      ps.copy(nd.v).addScaledVector(nd.d, alongStep).addScaledVector(nd.side, sideStep).normalize();
      m4.makeBasis(nd.side, nd.v, nd.d);
      q.setFromRotationMatrix(m4);
      const swayPhase = time * 2 + nd.ph;
      const radius = S.R + nd.g + 2.3 + Math.sin(swayPhase) * 0.25;
      ps.multiplyScalar(radius);
      const rollAngle = time * 2.2 + nd.ph + k * 2;
      yq3.setFromAxisAngle(FWD, rollAngle);
      q.multiply(yq3);
      const pw = 0.55 + 0.45 * fade;
      sc.set(pw, pw, pw);
      m4.compose(ps, q, sc);
      mesh.setMatrixAt(i, m4); // 꽃잎이 구르며 흘러간다
    }
    mesh.count = this.near.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** 치운다(꽃잎 모양·재질은 같이 쓰는 쪽 것이라 두고 간다) */
  dispose() {
    if (!this.mesh) return;
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }

  // 가까운 마디의 꽃잎만 고른다(칸이 바뀌면 그 칸의 색도 다시 칠한다)
  private pickNear(cut: number) {
    const p = this.s.player.p,
      near = this.near;
    near.length = 0;
    for (const x of this.streaks) if (x.nd.v.dot(p) > cut) near.push(x);
    this.paint();
  }

  private paint() {
    const mesh = this.mesh;
    if (!mesh) return;
    for (let i = 0; i < this.near.length; i++) mesh.setColorAt(i, this.near[i].color);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
