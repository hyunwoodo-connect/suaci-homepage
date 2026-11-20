import * as THREE from "three";

import type { TopDecorName } from "./zone";

// 랜드마크 꼭대기 장식(존 설정 landmark.top): 존마다 다른 장식을 이름으로 고른다. 장식은 꼭대기 윗면(높이 0)에 서는 무리 하나와
// 매 프레임 움직임 — 새 장식은 아래 TOP_DECOR 에 한 줄(만드는 함수)

/** 꼭대기 장식 하나: 랜드마크가 꼭대기 윗면 높이에 올려 둔다 */
export interface TopDecor {
  root: THREE.Group;
  /** 장식이 서는 둘레 반지름(m) — 그 반지름의 윗면 높이에 올린다 */
  ring: number;
  update(t: number): void;
  dispose(): void;
}

/** 장식 이름 → 만드는 함수 */
export const TOP_DECOR: Readonly<Record<TopDecorName, () => TopDecor>> = {
  candles: makeCandles,
};

/* ─── 내부 ─────────────────────────── */

/** 초: 수 · 둘레 반지름(m) · 키(m) · 굵기(반지름 m) */
const CANDLE = { count: 5, ring: 6.5, height: 6, radius: 0.7 } as const;
/** 불꽃 색: 복숭아 · 흰(노랑 금지 — MAP-03) */
const FLAME = { peach: 0xffb48a, white: 0xffffff } as const;

// 간식 존: 흰 바탕 분홍 줄무늬 초 다섯과 살랑이는 불꽃
function makeCandles(): TopDecor {
  const root = new THREE.Group();
  const tex = stripeTexture();
  const bodyGeo = new THREE.CylinderGeometry(CANDLE.radius, CANDLE.radius, CANDLE.height, 18);
  const halfCandle = CANDLE.height / 2;
  bodyGeo.translate(0, halfCandle, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  const outerGeo = new THREE.SphereGeometry(0.75, 16, 12);
  const innerGeo = new THREE.SphereGeometry(0.38, 12, 8);
  const outerMat = new THREE.MeshBasicMaterial({
    color: FLAME.peach,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
  });
  const innerMat = new THREE.MeshBasicMaterial({ color: FLAME.white, fog: false });
  const owned = [tex, bodyGeo, bodyMat, outerGeo, innerGeo, outerMat, innerMat];
  const flames: THREE.Group[] = [];
  for (let i = 0; i < CANDLE.count; i++) {
    const a = (i / CANDLE.count) * Math.PI * 2;
    const x = Math.cos(a) * CANDLE.ring,
      z = Math.sin(a) * CANDLE.ring;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 0, z);
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.scale.set(1, 1.9, 1);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.scale.set(1, 1.6, 1);
    inner.position.y = -0.2;
    flame.add(outer, inner);
    const flameY = CANDLE.height + 1.1;
    flame.position.set(x, flameY, z);
    flames.push(flame);
    root.add(body, flame);
  }
  return {
    root,
    ring: CANDLE.ring,
    update(t: number) {
      flames.forEach((fl, i) => {
        const wave = t * 11 + i * 1.7;
        const stretch = 1 + Math.sin(wave) * 0.14;
        fl.scale.set(1, stretch, 1);
        const sway = t * 3.1 + i;
        fl.rotation.z = Math.sin(sway) * 0.12;
      });
    },
    dispose() {
      root.removeFromParent();
      for (const o of owned) o.dispose();
    },
  };
}

// 초 몸통: 흰 바탕에 분홍 사선 줄
function stripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 64, 128);
  c.strokeStyle = "#ff6fa5";
  c.lineWidth = 12;
  for (let y = -64; y < 192; y += 32) {
    c.beginPath();
    c.moveTo(0, y);
    const end = y + 64;
    c.lineTo(64, end);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
