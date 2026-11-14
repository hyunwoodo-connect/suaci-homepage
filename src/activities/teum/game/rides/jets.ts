import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import type { LayoutJet } from "../world/layout";
import { from, heading, START, step } from "../world/sphere";
import { featGround } from "../world/terrain";
import type { PathNode } from "./streams";

// 제트 기류 — 높은 하늘의 빠른 바람길. 들어가면 아주 멀리 실려 간다.
// 하늘을 가로지르는 분홍 유리 관으로 보이고, 그 안을 흰 줄이 빠르게 흘러간다. 먼 마을에서 광장으로 이어지는 오로라 길은 라임빛

/** 제트 기류 하나 */
export interface Jet extends LayoutJet {
  nodes: PathNode[];
  tube: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
}

/** 제트 기류 전체 */
export interface Jets {
  list: Jet[];
  jnodes: PathNode[];
  jetM: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  jetCool: number;
  wasJet: boolean;
}

/** 높은 하늘에서 시계 방향으로 도는 세 줄(오로라 길은 자리표에서) */
const SKY_JETS: LayoutJet[] = [
  { dist: 40, bear: 140, head: 85, n: 60, gap: 10, wig: 5 },
  { dist: 150, bear: 20, head: 95, n: 60, gap: 10, wig: -4 },
  { dist: 110, bear: 250, head: 90, n: 60, gap: 10, wig: 6 },
];

/** 제트 기류가 흐르는 높이 */
export const JH = 44;

const ps = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3();

/** 제트 기류를 만든다 */
export function createJets(g: Game): Jets {
  const jnodes: PathNode[] = [];
  const extraJets = g.L.jet || [];
  const data = SKY_JETS.concat(extraJets).map((jt) => {
    const nodes: PathNode[] = [];
    for (let i = 0; i < jt.n; i++) {
      const nd = {
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        side: new THREE.Vector3(),
        g: 0,
        ph: jnodes.length * 1.3,
      };
      nodes.push(nd);
      jnodes.push(nd);
    }
    return { ...jt, nodes };
  });
  const streakGeo = new THREE.SphereGeometry(1, 8, 6);
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    fog: false,
  });
  const streakCount = jnodes.length * 2;
  const jetM = new THREE.InstancedMesh(streakGeo, streakMat, streakCount);
  jetM.frustumCulled = false;
  g.scene.add(jetM);
  const jetTubeMat = new THREE.MeshStandardMaterial({
    color: 0xff7fc0,
    transparent: true,
    opacity: 0.34,
    roughness: 0.04,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.6,
    fog: false,
  });
  const auroraMat = new THREE.MeshStandardMaterial({
    color: 0xa9ff39,
    emissive: 0x7fe02a,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.4,
    fog: false,
  }); // 오로라 길은 라임빛
  const list: Jet[] = data.map((jt) => {
    const tubeGeo = new THREE.BufferGeometry();
    const tubeMat = jt.aurora ? auroraMat : jetTubeMat;
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.frustumCulled = false;
    g.scene.add(tube);
    return { ...jt, tube };
  });
  return { list, jnodes, jetM, jetCool: 0, wasJet: false };
}

/** 제트 기류 자리: 마디를 잇고 그 길을 따라 관을 만든다 */
export function layoutJets(g: Game) {
  for (const jt of g.jets.list) {
    let v = from(jt.dist, jt.bear),
      d = heading(v, jt.head),
      i = 0;
    for (const nd of jt.nodes) {
      nd.v.copy(v);
      nd.d.copy(d);
      nd.side.crossVectors(v, d).normalize();
      nd.g = featGround(g, v);
      const bendPhase = i * 0.21;
      i++;
      const bend = jt.wig * Math.sin(bendPhase);
      [v, d] = step(v, d, jt.gap, bend);
    }
    jt.tube.geometry.dispose();
    const tubePoints = jt.nodes.map((nd) => nd.v.clone().multiplyScalar(S.R + nd.g + JH));
    const tubePath = new THREE.CatmullRomCurve3(tubePoints);
    const tubeSegments = jt.nodes.length * 4;
    jt.tube.geometry = new THREE.TubeGeometry(tubePath, tubeSegments, 3.4, 18, false);
  }
}

/** 제트 기류: 높이 떠서 들어가면 멀리 실려 가고, 옆으로 세게 끌면 빠져나온다 */
export function jetsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    J = g.jets;
  let inJet = false;
  if (J.jetCool > 0) J.jetCool -= dt;
  else if (!t.held && pl.air > 20)
    for (const nd of J.jnodes) {
      const altOffset = t.alt - (nd.g + JH);
      if (p.angleTo(nd.v) * S.R < 6.5 && Math.abs(altOffset) < 9) {
        inJet = true;
        const velDecay = -5 * dt;
        const velPull = 1 - Math.exp(velDecay);
        vel.lerp(nd.d, velPull).normalize();
        const headDecay = -2 * dt;
        const headPull = 1 - Math.exp(headDecay);
        h.lerp(nd.d, headPull);
        const hUp = h.dot(p);
        h.addScaledVector(p, -hUp).normalize();
        pl.boost = Math.max(pl.boost, 3.2);
        pl.vy = 0;
        const groundNow = t.gNow - 0.4;
        const floorAlt = Math.max(pl.gh, groundNow);
        const jetAir = nd.g + JH - floorAlt - S.hover;
        const targetAir = Math.max(0.01, jetAir);
        const airDecay = -3 * dt;
        const airPull = 1 - Math.exp(airDecay);
        pl.air += (targetAir - pl.air) * airPull;
        if (t.m0 > 0.7 && Math.abs(t.fx) > 0.8) J.jetCool = 1.5; // 옆으로 세게 끌면 빠져나온다
        break;
      }
    }
  if (inJet && !J.wasJet) {
    const isFarFromPlaza = p.angleTo(START) * S.R > 560;
    const message = isFarFromPlaza
      ? "오로라 길 — 광장 쪽으로 실려 갑니다. 옆으로 끌면 빠져나옵니다"
      : "제트 기류 — 하늘에서 멀리 실려 갑니다. 옆으로 끌면 빠져나옵니다";
    say(g, message);
  }
  J.wasJet = inJet;
  {
    let ji = 0;
    for (const jt of J.list)
      for (const nd of jt.nodes)
        for (let k = 0; k < 2; k++) {
          const al = ((time * 14 + (k * jt.gap) / 2 + nd.ph) % jt.gap) - jt.gap / 2,
            fade = 1 - Math.abs(al) / (jt.gap / 2);
          const alongStep = al / S.R;
          const sideStep = (k ? 1.4 : -1.4) / S.R;
          ps.copy(nd.v)
            .addScaledVector(nd.d, alongStep)
            .addScaledVector(nd.side, sideStep)
            .normalize();
          m4.makeBasis(nd.side, nd.v, nd.d);
          q.setFromRotationMatrix(m4);
          const swayPhase = time * 1.5 + nd.ph;
          const radius = S.R + nd.g + JH + Math.sin(swayPhase) * 0.8;
          ps.multiplyScalar(radius);
          const streakLength = 0.6 + 2.6 * fade;
          sc.set(0.16, 0.16, streakLength);
          m4.compose(ps, q, sc);
          J.jetM.setMatrixAt(ji, m4);
          ji++;
        }
    J.jetM.instanceMatrix.needsUpdate = true;
  }
}
