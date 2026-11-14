import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutJet } from "../world/layout";
import { from, heading, START, step } from "../world/sphere";

// 제트 기류 — 높은 하늘의 빠른 바람길. 들어가면 아주 멀리 실려 간다.
// 하늘을 가로지르는 분홍 유리 관으로 보이고, 그 안을 흰 줄이 빠르게 흘러간다. 먼 마을에서 광장으로 이어지는 오로라 길은 라임빛

/** 길 위 마디 하나(자리·방향·옆·땅 높이·흐르는 줄의 위상) */
export interface JetNode {
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  g: number;
  ph: number;
}

/** 제트 기류 하나 */
export interface Jet extends LayoutJet {
  nodes: JetNode[];
  tube: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
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

/** 제트 기류 전체 */
export class Jets implements Thing {
  readonly list: Jet[];
  readonly jnodes: JetNode[] = [];
  /** 관 속을 흐르는 흰 줄(마디마다 둘) */
  private readonly jetM: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly tubeMats: THREE.MeshStandardMaterial[];
  private jetCool = 0;
  private wasJet = false;

  constructor(private readonly s: Services) {
    const extraJets = s.layout.jet || [];
    const data = SKY_JETS.concat(extraJets).map((jt) => {
      const nodes: JetNode[] = [];
      for (let i = 0; i < jt.n; i++) {
        const nd: JetNode = {
          v: new THREE.Vector3(),
          d: new THREE.Vector3(),
          side: new THREE.Vector3(),
          g: 0,
          ph: this.jnodes.length * 1.3,
        };
        nodes.push(nd);
        this.jnodes.push(nd);
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
    const streakCount = this.jnodes.length * 2;
    this.jetM = new THREE.InstancedMesh(streakGeo, streakMat, streakCount);
    this.jetM.frustumCulled = false;
    s.scene.add(this.jetM);
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
    this.tubeMats = [jetTubeMat, auroraMat];
    this.list = data.map((jt) => {
      const tubeGeo = new THREE.BufferGeometry();
      const tubeMat = jt.aurora ? auroraMat : jetTubeMat;
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      // 관은 하늘을 길게 가로질러 한 자리로 거를 수 없다(늘 그린다)
      tube.frustumCulled = false;
      s.scene.add(tube);
      return { ...jt, tube };
    });
  }

  /** 자리: 마디를 잇고 그 길을 따라 관을 만든다 */
  layout() {
    const terrain = this.s.terrain;
    for (const jt of this.list) {
      let v = from(jt.dist, jt.bear),
        d = heading(v, jt.head),
        i = 0;
      for (const nd of jt.nodes) {
        nd.v.copy(v);
        nd.d.copy(d);
        nd.side.crossVectors(v, d).normalize();
        nd.g = terrain.featGround(v);
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

  /** 자리 차지: 높은 하늘의 길이라 땅 자리는 비워 두고 비행 통로만 */
  claim() {
    for (const nd of this.jnodes) this.s.occ.addCorridor(nd.v, 13);
  }

  /** 높이 떠서 들어가면 멀리 실려 가고, 옆으로 세게 끌면 빠져나온다 */
  update(f: Frame) {
    const { player, hud } = this.s,
      dt = f.dt,
      time = f.time,
      p = player.p;
    let inJet = false;
    if (this.jetCool > 0) this.jetCool -= dt;
    else if (!player.held && player.air > 20)
      for (const nd of this.jnodes) {
        const altOffset = player.alt - (nd.g + JH);
        if (p.angleTo(nd.v) * S.R >= 6.5 || Math.abs(altOffset) >= 9) continue;
        inJet = true;
        const velPull = ease(5, dt);
        player.turnTo(nd.d, velPull);
        const headPull = ease(2, dt);
        player.lookTo(nd.d, headPull);
        player.boostAtLeast(3.2);
        const jetAir = nd.g + JH - player.floor - S.hover;
        const targetAir = Math.max(0.01, jetAir);
        const airPull = ease(3, dt);
        player.glide(targetAir, airPull);
        if (player.m0 > 0.7 && Math.abs(player.fx) > 0.8) this.jetCool = 1.5; // 옆으로 세게 끌면 빠져나온다
        break;
      }
    if (inJet && !this.wasJet) {
      const isFarFromPlaza = p.angleTo(START) * S.R > 560;
      const message = isFarFromPlaza
        ? "오로라 길 — 광장 쪽으로 실려 갑니다. 옆으로 끌면 빠져나옵니다"
        : "제트 기류 — 하늘에서 멀리 실려 갑니다. 옆으로 끌면 빠져나옵니다";
      hud.say(message);
    }
    this.wasJet = inJet;
    let ji = 0;
    for (const jt of this.list)
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
          this.jetM.setMatrixAt(ji, m4);
          ji++;
        }
    this.jetM.instanceMatrix.needsUpdate = true;
  }

  /** 치운다 */
  dispose() {
    for (const jt of this.list) {
      jt.tube.removeFromParent();
      jt.tube.geometry.dispose();
    }
    for (const m of this.tubeMats) m.dispose();
    this.jetM.removeFromParent();
    this.jetM.geometry.dispose();
    this.jetM.material.dispose();
    this.jetM.dispose();
  }
}
