import * as THREE from "three";

import type { Frame } from "../core/frame";
import { ease } from "../core/frame";
import { S } from "../settings";
import { clamp } from "../world/sphere";
import type { Terrain } from "../world/terrain";
import type { Player } from "./player";

// 카메라 — 뒤에서 따라간다. 빨라지거나 높이 뜨면 물러나고, 등대에 닿으면 올라 둘러본다.
// 놀이기구는 카메라를 직접 옮기지 않고 섞는 정도만 부탁한다: 회오리·깔때기(spin), 고래·혜성(ride), 등대(overlook)

const cdir = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  want = new THREE.Vector3(),
  cn = new THREE.Vector3(),
  look = new THREE.Vector3();

/** 따라가는 카메라 */
export class CameraRig {
  private over = 0;
  private spin = 0;
  private ride = 0;
  /** 회오리·깔때기에 들어올 때의 보는 쪽(안에서 화면이 같이 돌지 않게) */
  private readonly h0 = new THREE.Vector3();

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly player: Player,
    private readonly terrain: Terrain,
  ) {}

  /** 회오리·깔때기에 실린 정도를 target 쪽으로 */
  easeSpin(target: number, k: number) {
    this.spin += (target - this.spin) * k;
  }
  /** 고래·혜성에 탄 정도를 target 쪽으로 */
  easeRide(target: number, k: number) {
    this.ride += (target - this.ride) * k;
  }
  /** 등대에서 둘러보는 정도를 target 쪽으로 */
  easeOverlook(target: number, k: number) {
    this.over += (target - this.over) * k;
  }
  /** 지금 보는 쪽을 붙잡아 둔다(회오리·깔때기에 들어서는 순간) */
  lockHeading(h: THREE.Vector3) {
    this.h0.copy(h);
  }

  /** 카메라를 이번 프레임 자리에 놓는다 */
  update(f: Frame) {
    const pl = this.player,
      camera = this.camera,
      p = pl.p,
      P = pl.P,
      over = this.over,
      wB = this.spin,
      rB = this.ride;
    cdir.copy(pl.h);
    if (wB > 0.01) {
      // 회오리 안에서는 화면이 같이 돌지 않게, 들어올 때의 방향을 유지한다
      const h0Radial = this.h0.dot(p);
      tmp.copy(this.h0).addScaledVector(p, -h0Radial).normalize();
      cdir.lerp(tmp, wB);
      if (cdir.lengthSq() < 1e-4) cdir.copy(tmp);
      const cdirRadial = cdir.dot(p);
      cdir.addScaledVector(p, -cdirRadial).normalize();
    }
    const orbit = 2.6 * over;
    cdir.applyAxisAngle(p, orbit);
    const sp = clamp(pl.tot, 0, 2.2);
    // 빠를수록·높이 뜰수록·회오리(wB)·놀이기구(rB)에 탈수록 위로 올라가고 뒤로 물러난다
    const rise = S.camH + 24 * over + pl.air * 0.22 + 5 * wB + 4 * rB;
    const back = -S.camD * (1 + 0.22 * sp) - 20 * over - pl.air * 0.35 - 9 * wB - 10 * rB;
    want.copy(P).addScaledVector(p, rise).addScaledVector(cdir, back);
    if (pl.takeSnap()) camera.position.copy(want);
    else {
      const follow = ease(6, f.dt);
      camera.position.lerp(want, follow);
    }
    cn.copy(camera.position).normalize();
    const minR = S.R + this.terrain.groundAt(cn) + 1.2;
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

  /** 치울 것이 없다(카메라는 무대가 치운다) */
  dispose() {}

  /** 창 크기에 맞춘다 */
  resize(renderer: THREE.WebGLRenderer) {
    renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
