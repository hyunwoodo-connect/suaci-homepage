import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import type { LayoutPath } from "../world/layout";
import { FWD, from, heading, step } from "../world/sphere";
import { featGround } from "../world/terrain";

// 바람길 — 들어가면 흐름에 실려 굽이굽이 간다. 그 위로 꽃잎이 구르며 흘러간다

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

/** 바람길 전체 */
export interface Streams {
  list: Stream[];
  nodes: PathNode[];
  streaks: THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
  wasS: boolean;
}

const ps = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  yq3 = new THREE.Quaternion();

/** 바람길과 흘러가는 꽃잎을 만든다 */
export function createStreams(g: Game): Streams {
  const nodes: PathNode[] = [];
  const list = g.L.stream.map((st) => {
    const s: Stream = { ...st, nodes: [], endV: new THREE.Vector3(), endD: new THREE.Vector3() };
    for (let i = 0; i < st.n; i++) {
      const nd = {
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        side: new THREE.Vector3(),
        g: 0,
        ph: nodes.length * 1.7,
      };
      s.nodes.push(nd);
      nodes.push(nd);
    }
    return s;
  });
  const streakGeo = new THREE.SphereGeometry(1, 8, 6);
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff }) as THREE.Material;
  const streakCount = nodes.length * 2;
  const streaks = new THREE.InstancedMesh(streakGeo, streakMat, streakCount);
  streaks.frustumCulled = false;
  g.scene.add(streaks);
  return { list, nodes, streaks, wasS: false };
}

/** 바람길 자리: 굽이굽이 휘며 마디를 놓는다 */
export function layoutStreams(g: Game, keep: THREE.Vector3[]) {
  for (const st of g.streams.list) {
    let v = from(st.dist, st.bear),
      d = heading(v, st.head);
    for (let i = 0; i < st.n; i++) {
      const nd = st.nodes[i];
      nd.v.copy(v);
      nd.d.copy(d);
      nd.side.crossVectors(v, d).normalize();
      nd.g = featGround(g, v);
      keep.push(nd.v);
      const bendPhase = i * 0.55;
      const bend = st.wig * Math.sin(bendPhase);
      [v, d] = step(v, d, st.gap, bend);
    }
    st.endV = v;
    st.endD = d;
  }
}

/** 바람길: 들어가면 흐름에 실리고, 꽃잎이 구르며 흘러간다 */
export function streamsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    S0 = g.streams;
  let inS = false;
  if (!t.held)
    for (const nd of S0.nodes) {
      if (p.angleTo(nd.v) * S.R < 4.4 && t.alt - nd.g < 8) {
        inS = true;
        const velDecay = -5 * dt;
        const velPull = 1 - Math.exp(velDecay);
        vel.lerp(nd.d, velPull).normalize();
        const headDecay = -2.2 * dt;
        const headPull = 1 - Math.exp(headDecay);
        h.lerp(nd.d, headPull);
        const hUp = h.dot(p);
        h.addScaledVector(p, -hUp).normalize();
        pl.boost = Math.max(pl.boost, 1.15);
        if (pl.air < 1.6) {
          pl.vy = Math.max(pl.vy, 1.6);
          if (pl.air <= 0) pl.air = 0.01;
        }
        break;
      }
    }
  if (inS && !S0.wasS) say(g, "바람길 — 흐름에 실려 갑니다");
  S0.wasS = inS;
  let si = 0;
  for (const st of S0.list)
    for (const nd of st.nodes)
      for (let k = 0; k < 2; k++) {
        const al = ((time * 5.5 + (k * st.gap) / 2 + nd.ph) % st.gap) - st.gap / 2,
          fade = 1 - Math.abs(al) / (st.gap / 2);
        const alongStep = al / S.R;
        const sideStep = (k ? 1.2 : -1.2) / S.R;
        ps.copy(nd.v)
          .addScaledVector(nd.d, alongStep)
          .addScaledVector(nd.side, sideStep)
          .normalize();
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
        S0.streaks.setMatrixAt(si, m4); // 꽃잎이 구르며 흘러간다
        si++;
      }
  S0.streaks.instanceMatrix.needsUpdate = true;
}
