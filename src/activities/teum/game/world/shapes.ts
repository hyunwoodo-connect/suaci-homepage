import * as THREE from "three";

import type { GreyMesh, Mats } from "../look";

// 모델이 오기 전에 자리를 지키는 도형과 이름표

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
  const mat = mats.grey(c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** 원기둥 도형(바닥이 y=0 에 닿게) */
export function cyl(mats: Mats, r: number, h: number, c: number, y = h / 2): GreyMesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 28);
  const mat = mats.grey(c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** 공 도형 */
export function ball(mats: Mats, r: number, c: number, y: number): GreyMesh {
  const geo = new THREE.SphereGeometry(r, 24, 16);
  const mat = mats.grey(c);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

/** 버릴 수 있는 것(지오메트리·재질·그림) */
interface Disposable {
  dispose(): void;
}

/**
 * 만든 도형의 지오메트리·재질·그림을 모아 두었다가 한꺼번에 버린다.
 * 모델 틀이 끼워지기 전에 모아 두므로 모델 것(여러 틀이 같이 쓰는 재질)은 섞이지 않는다
 */
export class Bin {
  private readonly items = new Set<Disposable>();

  /** 물체 아래 지금 있는 도형을 모두 모은다 */
  keep(root: THREE.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points))
        return;
      this.items.add(o.geometry);
      const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) this.add(m);
    });
  }

  /** 하나를 모은다(재질이면 그림까지) */
  add(x: Disposable) {
    this.items.add(x);
    if (!(x instanceof THREE.Material)) return;
    for (const v of Object.values(x)) if (v instanceof THREE.Texture) this.items.add(v);
  }

  /** 모은 것을 모두 버린다 */
  dispose() {
    for (const x of this.items) x.dispose();
    this.items.clear();
  }
}
