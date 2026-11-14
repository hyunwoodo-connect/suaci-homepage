import * as THREE from "three";

import type { Game } from "./state";
import { S } from "./state";
import { clamp } from "./world/sphere";
import { groundAt } from "./world/terrain";

// 카메라 — 뒤에서 따라간다. 빨라지거나 높이 뜨면 물러나고, 등대에 닿으면 올라 둘러본다

const cdir = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  want = new THREE.Vector3(),
  cn = new THREE.Vector3(),
  look = new THREE.Vector3();

/** 카메라를 이번 프레임 자리에 놓는다 */
export function cameraFrame(g: Game) {
  const { pl, t, camera } = g,
    { p, h, P } = pl,
    over = pl.over,
    wB = pl.wB,
    rB = pl.rB,
    whirl = g.rides.whirl;
  cdir.copy(h);
  if (wB > 0.01) {
    // 회오리 안에서는 화면이 같이 돌지 않게, 들어올 때의 방향을 유지한다
    const h0Radial = whirl.h0.dot(p);
    tmp.copy(whirl.h0).addScaledVector(p, -h0Radial).normalize();
    cdir.lerp(tmp, wB);
    if (cdir.lengthSq() < 1e-4) cdir.copy(tmp);
    const cdirRadial = cdir.dot(p);
    cdir.addScaledVector(p, -cdirRadial).normalize();
  }
  const orbit = 2.6 * over;
  cdir.applyAxisAngle(p, orbit);
  const sp = clamp(t.tot, 0, 2.2);
  // 빠를수록·높이 뜰수록·회오리(wB)·놀이기구(rB)에 탈수록 위로 올라가고 뒤로 물러난다
  const rise = S.camH + 24 * over + pl.air * 0.22 + 5 * wB + 4 * rB;
  const back = -S.camD * (1 + 0.22 * sp) - 20 * over - pl.air * 0.35 - 9 * wB - 10 * rB;
  want.copy(P).addScaledVector(p, rise).addScaledVector(cdir, back);
  if (pl.snap) {
    camera.position.copy(want);
    pl.snap = false;
  } else {
    const followDecay = -6 * t.dt;
    const follow = 1 - Math.exp(followDecay);
    camera.position.lerp(want, follow);
  }
  cn.copy(camera.position).normalize();
  const minR = S.R + groundAt(g, cn) + 1.2;
  if (camera.position.length() < minR) camera.position.setLength(minR);
  camera.up.copy(p);
  const lookRise = 0.8 - 6 * over;
  const lookAhead = 5 + 45 * over;
  look.copy(P).addScaledVector(p, lookRise).addScaledVector(cdir, lookAhead);
  camera.lookAt(look);
  const fov = S.fov + 9 * Math.min(1.6, sp);
  // 조금씩 바뀔 때마다 투영 행렬을 다시 만들지 않는다
  const fovDelta = camera.fov - fov;
  if (Math.abs(fovDelta) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

/** 창 크기에 맞춘다 */
export function resize(g: Game) {
  g.renderer.setSize(innerWidth, innerHeight, false);
  g.camera.aspect = innerWidth / innerHeight;
  g.camera.updateProjectionMatrix();
}
