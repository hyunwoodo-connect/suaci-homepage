import * as THREE from "three";

import type { Game } from "../state";
import { LIME, S } from "../state";
import { grey } from "../world/materials";
import { clamp, FWD } from "../world/sphere";

// 나: 자리(me)와 기울기(tiltG) 안에 몸. 뼈대 있는 아바타가 오기 전까지는 도형 몸과 라임 공 고양이가 대신 선다

/** 내 몸과 그림자 */
export interface Me {
  me: THREE.Group;
  tiltG: THREE.Group;
  body: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  nose: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
  cat: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /** 뼈대가 있는 아바타가 들어오면 여기에 몸짓 함수가 걸린다 */
  avFrame: ((dt: number, tot: number, vy: number, air: number) => void) | null;
}

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4();

/** 내 도형 몸·고양이·그림자를 만든다(등의 날개도 같이 단다) */
export function createMe(g: Game): Me {
  const me = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 14), grey(g.mats, 0x8f9493));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 12), grey(g.mats, 0x6f7473));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.12, 0.34);
  const cat = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 10),
    new THREE.MeshBasicMaterial({ color: LIME }),
  );
  cat.position.set(-0.95, 0.55, -0.45);
  const tiltG = new THREE.Group();
  tiltG.add(body, nose);
  me.add(tiltG, cat, g.wings.mine);
  g.scene.add(me);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  g.scene.add(shadow);
  return { me, tiltG, body, nose, cat, shadow, avFrame: null };
}

/** 나를 이번 프레임 자리에 놓는다: 둥실, 앞을 보고, 빠를수록 눕고, 대포·구멍에선 작아진다 */
export function meFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, P } = pl,
    dt = t.dt,
    M = g.me;
  const bob = Math.sin(time * 1.7) * 0.08;
  P.copy(p).multiplyScalar(S.R + t.alt + bob);
  bx.crossVectors(p, h).normalize();
  m4.makeBasis(bx, p, h);
  M.me.quaternion.setFromRotationMatrix(m4);
  M.me.position.copy(P);
  pl.tilt += (clamp(t.tot, 0, 2.4) * 0.42 - pl.vy * 0.05 - pl.tilt) * (1 - Math.exp(-5 * dt));
  M.tiltG.rotation.x = pl.tilt;
  if (M.avFrame) M.avFrame(dt, t.tot, pl.vy, pl.air);
  M.cat.position.y = 0.55 + Math.sin(time * 2.3 + 1) * 0.07;
  const warp = g.rides.warp,
    sT = warp.on && !warp.done ? 0.05 : g.rides.cannon.on ? 0.6 : 1;
  M.me.scale.setScalar(M.me.scale.x + (sT - M.me.scale.x) * (1 - Math.exp(-18 * dt)));
}

/** 그림자는 땅에 붙어 높이 뜰수록 넓고 옅어진다 */
export function shadowFrame(g: Game) {
  const { pl, t } = g,
    sh = g.me.shadow;
  sh.position.copy(pl.p).multiplyScalar(S.R + t.gNow + 0.06);
  sh.quaternion.setFromUnitVectors(FWD, pl.p);
  sh.scale.setScalar(1 + pl.air * 0.08);
  sh.material.opacity = 0.12 / (1 + pl.air * 0.12);
}
