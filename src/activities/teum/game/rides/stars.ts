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
      const starGeo = new THREE.OctahedronGeometry(0.42);
      const starMat = new THREE.MeshBasicMaterial({ color: 0x9ea3a2 });
      const m = new THREE.Mesh(starGeo, starMat);
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
    const center = from(st.dist, st.bear);
    const spread = 4 + ((st.k * 5.3) % 12);
    const bearing = st.k * 47;
    const spot = offset(center, spread, bearing);
    st.v.copy(spot);
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
      const bobPhase = time * 1.6 + st.k;
      const hoverR = S.R + st.g + 1.7 + Math.sin(bobPhase) * 0.25;
      st.pos.copy(st.v).multiplyScalar(hoverR);
      const grownScale = st.m.scale.x + dt * 2;
      const restScale = Math.min(1, grownScale);
      st.m.scale.setScalar(restScale);
      const altGap = t.alt - (st.g + 1.7);
      if (!t.held && p.angleTo(st.v) * S.R < 2.8 && Math.abs(altGap) < 4.5) {
        st.st = 1;
        followers.push(st);
        st.m.material.color.set(LIME);
        if (!g.said.star) {
          g.said.star = true;
          say(g, "별 — 뒤에 따라붙습니다. 칙 하면 터집니다");
        }
      }
    } else if (st.st === 1) {
      // 따라오는 순서(fi)대로 꼬리 기록의 뒤쪽 점에 줄을 선다
      const fi = followers.indexOf(st);
      const lastSlot = TRAIL - 1;
      const wantSlot = 4 + fi * 2;
      const i = Math.min(lastSlot, wantSlot) * 3;
      tmp.fromArray(trailPos, i);
      const need = 2.3 + fi * 0.55;
      if (tmp.distanceTo(P) < need) {
        // 멈춰 있으면 꼬리가 한 점에 뭉친다: 그럴 땐 몸 둘레를 천천히 도는 고리로 펼친다
        const ringRowRaw = fi / 3;
        const ringRow = Math.floor(ringRowRaw);
        const a = time * 0.7 + fi * 2.4,
          rr = 2.3 + (fi % 3) * 0.7 + ringRow * 0.5;
        right.crossVectors(h, p).normalize();
        const ahead = Math.cos(a) * rr;
        const aside = Math.sin(a) * rr;
        const liftPhase = time * 1.3 + fi;
        const lift = 0.5 + 0.5 * Math.sin(liftPhase);
        tmp
          .copy(P)
          .addScaledVector(h, ahead)
          .addScaledVector(right, aside)
          .addScaledVector(p, lift);
      }
      const followRate = tmp.distanceTo(st.pos) > 6 ? 9 : 4;
      const followDecay = -followRate * dt;
      const follow = 1 - Math.exp(followDecay);
      st.pos.lerp(tmp, follow);
    } else {
      st.t += dt;
      st.pos.addScaledVector(st.vel, dt);
      const dragRate = -1.3 * dt;
      const drag = Math.exp(dragRate);
      st.vel.multiplyScalar(drag);
      const shrinking = 1.7 * (1 - st.t / 2.4);
      const burstScale = Math.max(0.01, shrinking);
      st.m.scale.setScalar(burstScale);
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
    const modelScale = u.k * st.m.scale.x;
    st.model.scale.setScalar(modelScale);
    u.uLime.value = st.st > 0 ? 1 : 0;
    yq.setFromUnitVectors(UP, st.v);
    st.model.quaternion.copy(yq);
    const spinAngle = time * 1.5 + st.k;
    const spin = u.yq.setFromAxisAngle(UP, spinAngle);
    st.model.quaternion.multiply(spin);
  }
}
