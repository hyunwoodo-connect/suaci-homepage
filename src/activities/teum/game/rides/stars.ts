import * as THREE from "three";

import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { LIME, S } from "../state";
import { from, offset, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 별 — 스치면 뒤에 줄줄이 따라붙는다. 칙 하면 불꽃처럼 터졌다가 제자리로 돌아간다

/** 별 하나. st: 0 제자리, 1 따라옴, 2 터짐 */
export interface Star {
  m: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  g: number;
  st: number;
  t: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  model?: Hold;
}

/** 별 전체와 따라오는 줄 */
export interface Stars {
  list: Star[];
  followers: Star[];
}

const tmp = new THREE.Vector3(),
  right = new THREE.Vector3(),
  yq = new THREE.Quaternion();

/** 별을 만든다(자리마다 여덟) */
export function createStars(g: Game): Stars {
  const list: Star[] = [];
  for (const { dist, bear } of g.L.star)
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42),
        new THREE.MeshBasicMaterial({ color: 0x9ea3a2 }),
      );
      g.scene.add(m);
      list.push({
        m,
        dist,
        bear,
        k,
        v: new THREE.Vector3(),
        g: 0,
        st: 0,
        t: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
      });
    }
  return { list, followers: [] };
}

/** 별 자리: 자리 둘레에 흩어 놓고 제자리 상태로 */
export function layoutStars(g: Game, keep: THREE.Vector3[]) {
  for (const st of g.stars.list) {
    st.v.copy(offset(from(st.dist, st.bear), 4 + ((st.k * 5.3) % 12), st.k * 47));
    st.g = featGround(g, st.v);
    st.st = 0;
    st.m.material.color.set(0x9ea3a2);
    keep.push(st.v);
  }
}

/** 별: 제자리에서 반짝이다가, 스치면 꼬리를 따라오고, 칙 하면 터졌다 돌아간다 */
export function starsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, P } = pl,
    dt = t.dt,
    { list, followers } = g.stars,
    trailPos = g.trail.pos,
    TRAIL = g.trail.N;
  for (const st of list) {
    if (st.st === 0) {
      st.pos.copy(st.v).multiplyScalar(S.R + st.g + 1.7 + Math.sin(time * 1.6 + st.k) * 0.25);
      st.m.scale.setScalar(Math.min(1, st.m.scale.x + dt * 2));
      if (!t.held && p.angleTo(st.v) * S.R < 2.8 && Math.abs(t.alt - (st.g + 1.7)) < 4.5) {
        st.st = 1;
        followers.push(st);
        st.m.material.color.set(LIME);
        if (!g.said.star) {
          g.said.star = true;
          say(g, "별 — 뒤에 따라붙습니다. 칙 하면 터집니다");
        }
      }
    } else if (st.st === 1) {
      const i = Math.min(TRAIL - 1, 4 + followers.indexOf(st) * 2) * 3;
      tmp.set(trailPos[i], trailPos[i + 1], trailPos[i + 2]);
      {
        const fi = followers.indexOf(st),
          need = 2.3 + fi * 0.55;
        if (tmp.distanceTo(P) < need) {
          // 멈춰 있으면 꼬리가 한 점에 뭉친다: 그럴 땐 몸 둘레를 천천히 도는 고리로 펼친다
          const a = time * 0.7 + fi * 2.4,
            rr = 2.3 + (fi % 3) * 0.7 + Math.floor(fi / 3) * 0.5;
          right.crossVectors(h, p).normalize();
          tmp
            .copy(P)
            .addScaledVector(h, Math.cos(a) * rr)
            .addScaledVector(right, Math.sin(a) * rr)
            .addScaledVector(p, 0.5 + 0.5 * Math.sin(time * 1.3 + fi));
        }
      }
      st.pos.lerp(tmp, 1 - Math.exp(-(tmp.distanceTo(st.pos) > 6 ? 9 : 4) * dt));
    } else {
      st.t += dt;
      st.pos.addScaledVector(st.vel, dt);
      st.vel.multiplyScalar(Math.exp(-1.3 * dt));
      st.m.scale.setScalar(Math.max(0.01, 1.7 * (1 - st.t / 2.4)));
      if (st.t > 2.4) {
        st.st = 0;
        st.m.material.color.set(0x9ea3a2);
        st.m.scale.setScalar(0.01);
      }
    }
    st.m.position.copy(st.pos);
    st.m.rotation.y += dt * 2;
  }
}

/** 별 모델이 별 도형을 따라 돌며 빛난다 */
export function starModelsFrame(g: Game) {
  const time = g.time;
  for (const st of g.stars.list) {
    if (!st.model) continue;
    const u = st.model.userData;
    st.model.position.copy(st.pos);
    st.model.scale.setScalar(u.k * st.m.scale.x);
    u.uLime.value = st.st > 0 ? 1 : 0;
    yq.setFromUnitVectors(UP, st.v);
    st.model.quaternion.copy(yq).multiply(u.yq.setFromAxisAngle(UP, time * 1.5 + st.k));
  }
}
