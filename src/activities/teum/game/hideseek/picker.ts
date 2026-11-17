import * as THREE from "three";

// 손가락으로 톡 친 것 고르기: 세계의 것(상자·생물·전설)을 화면에 비춰 그려진 네모를 구하고, 사방 pad(px) 넓히고
// 적어도 min(px) 네모로 받는다 — 귀만 삐져나와 있어도 그 귀를 누르면 된다. 여러 개가 겹치면 카메라에서 가까운 것.
// 높이나 물건 너머는 따지지 않는다(보인 것을 누르는 놀이다). 카메라 뒤와 화면 밖은 고르지 않는다

/** 누를 수 있는 것 하나: 세계 자리(가운데)와 반높이·반너비(m) */
export interface PickTarget<T> {
  item: T;
  center: THREE.Vector3;
  halfH: number;
  halfW: number;
}

/** 화면 크기(px) */
export interface View {
  w: number;
  h: number;
}

const ndc = new THREE.Vector3(),
  eye = new THREE.Vector3();

/** 화면 (x, y)(px)를 누른 자리에 걸린 것 가운데 카메라에서 가장 가까운 것과 그 거리(m, 카메라에서). 없으면 null */
export function pickAt<T>(
  x: number,
  y: number,
  targets: readonly PickTarget<T>[],
  camera: THREE.PerspectiveCamera,
  view: View,
  pad: number,
  min: number,
): T | null {
  camera.getWorldPosition(eye);
  const halfFov = (camera.fov * Math.PI) / 360,
    span = 2 * Math.tan(halfFov);
  let best: T | null = null,
    bestD = Infinity;
  for (const t of targets) {
    ndc.copy(t.center).project(camera);
    if (ndc.z >= 1) continue;
    const cx = (ndc.x + 1) * 0.5 * view.w,
      cy = (1 - ndc.y) * 0.5 * view.h,
      dist = eye.distanceTo(t.center),
      perMeter = view.h / (span * dist);
    const least = min * 0.5,
      drawnW = t.halfW * perMeter + pad,
      drawnH = t.halfH * perMeter + pad,
      halfW = Math.max(least, drawnW),
      halfH = Math.max(least, drawnH),
      offX = x - cx,
      offY = y - cy;
    const isInside = Math.abs(offX) <= halfW && Math.abs(offY) <= halfH;
    if (!isInside || dist >= bestD) continue;
    bestD = dist;
    best = t.item;
  }
  return best;
}

/** 세계 키 h(m)가 거리 dist(m)에서 화면에 그려지는 키(px) */
export function screenHeight(
  h: number,
  dist: number,
  camera: THREE.PerspectiveCamera,
  viewH: number,
) {
  const halfFov = (camera.fov * Math.PI) / 360,
    span = 2 * Math.tan(halfFov) * dist;
  return (h / span) * viewH;
}
