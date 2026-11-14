import * as THREE from "three";

import type { GreyMesh, Mats } from "./materials";
import { grey } from "./materials";

/** 이름표 그림(가까이 가면 뜨는 둥근 띠) */
export function label(text: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 80;
  const g = cv.getContext("2d")!;
  g.fillStyle = "rgba(43,46,45,.86)";
  g.beginPath();
  g.roundRect(8, 12, 240, 56, 28);
  g.fill();
  g.fillStyle = "#fff";
  g.font = '600 30px -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.9, 0.6, 1);
  return s;
}

/** 상자 도형(바닥이 y=0 에 닿게) */
export function box(mats: Mats, w: number, h: number, d: number, c: number, y = h / 2): GreyMesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = grey(mats, c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** 원기둥 도형(바닥이 y=0 에 닿게) */
export function cyl(mats: Mats, r: number, h: number, c: number, y = h / 2): GreyMesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 28);
  const mat = grey(mats, c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** 공 도형 */
export function ball(mats: Mats, r: number, c: number, y: number): GreyMesh {
  const geo = new THREE.SphereGeometry(r, 24, 16);
  const mat = grey(mats, c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}
