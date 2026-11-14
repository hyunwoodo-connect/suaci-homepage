import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { LayoutArch } from "../world/layout";
import { grey } from "../world/materials";
import { from, heading, step } from "../world/sphere";
import { featGround } from "../world/terrain";
import type { PathNode } from "./streams";

// 구름 다리 — 끝에서 올라타면 높은 아치를 타고 넘어간다

/** 다리 마디: 아치 높이(hh) */
export interface ArchNode extends Omit<PathNode, "ph"> {
  hh: number;
  a: LayoutArch;
}

/** 구름 다리 하나 */
export interface Arch extends LayoutArch {
  nodes: ArchNode[];
}

/** 구름 다리 전체. 발판(planks)은 자리만 잡고 장면에 넣지 않는다(시제품 그대로 — 마디만 탄다) */
export interface Arches {
  list: Arch[];
  anodes: ArchNode[];
  planks: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  wasR: boolean;
}

const tmp = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  ps = new THREE.Vector3(),
  sc = new THREE.Vector3();

/** 구름 다리를 만든다 */
export function createArches(g: Game): Arches {
  const anodes: ArchNode[] = [];
  const list = g.L.arch.map((a) => {
    const arch: Arch = { ...a, nodes: [] };
    for (let i = 0; i < a.n; i++) {
      const archPhase = (Math.PI * i) / (a.n - 1);
      const nd = {
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        side: new THREE.Vector3(),
        g: 0,
        hh: a.arch * Math.sin(archPhase),
        a: arch,
      };
      arch.nodes.push(nd);
      anodes.push(nd);
    }
    return arch;
  });
  const plankGeo = new THREE.SphereGeometry(0.5, 16, 12);
  const plankMat = grey(g.mats, GREY_TOY);
  const planks = new THREE.InstancedMesh(plankGeo, plankMat, anodes.length); // 방석 같은 발판
  return { list, anodes, planks, wasR: false };
}

/** 구름 다리 자리: 마디마다 아치 높이로 */
export function layoutArches(g: Game, keep: THREE.Vector3[]) {
  const planks = g.arches.planks;
  let ai = 0;
  for (const a of g.arches.list) {
    let v = from(a.dist, a.bear),
      d = heading(v, a.head);
    for (const nd of a.nodes) {
      nd.v.copy(v);
      nd.d.copy(d);
      nd.side.crossVectors(v, d).normalize();
      nd.g = featGround(g, v);
      keep.push(nd.v);
      m4.makeBasis(nd.side, nd.v, nd.d);
      q.setFromRotationMatrix(m4);
      const radius = S.R + nd.g + nd.hh + 0.1;
      ps.copy(v).multiplyScalar(radius);
      const plankLength = a.gap * 0.95;
      sc.set(3.2, 0.8, plankLength);
      m4.compose(ps, q, sc);
      planks.setMatrixAt(ai, m4);
      ai++;
      [v, d] = step(v, d, a.gap, a.curve);
    }
  }
  planks.instanceMatrix.needsUpdate = true;
}

/** 구름 다리: 마디 높이에 붙어 넘어간다 */
export function archesFrame(g: Game) {
  const { pl, t } = g,
    { p, vel } = pl,
    dt = t.dt,
    A = g.arches;
  let onRail = false;
  if (!t.held && !g.rides.balloon.on)
    for (const nd of A.anodes) {
      const altOffset = t.alt - (nd.g + nd.hh + S.hover);
      if (p.angleTo(nd.v) * S.R < 3.4 && Math.abs(altOffset) < 3.2) {
        onRail = true;
        const sg = vel.dot(nd.d) >= 0 ? 1 : -1;
        tmp.copy(nd.d).multiplyScalar(sg);
        const velDecay = -6 * dt;
        const velPull = 1 - Math.exp(velDecay);
        vel.lerp(tmp, velPull).normalize();
        pl.boost = Math.max(pl.boost, 0.9);
        pl.vy = 0;
        const groundNow = t.gNow - 0.4;
        const floorAlt = Math.max(pl.gh, groundNow);
        const railAir = nd.g + nd.hh + 0.35 - floorAlt;
        const targetAir = Math.max(0.01, railAir);
        const airDecay = -9 * dt;
        const airPull = 1 - Math.exp(airDecay);
        pl.air += (targetAir - pl.air) * airPull;
        break;
      }
    }
  if (onRail && !A.wasR) say(g, "구름 다리 — 타고 넘어갑니다");
  A.wasR = onRail;
}
