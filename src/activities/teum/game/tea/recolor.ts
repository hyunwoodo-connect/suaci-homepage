import * as THREE from "three";

// 색 규칙 1: "라임은 상자와 리본만 — 맵에 라임·연두·초록·노랑을 쓰지 않는다". 모델은 그림(텍스처) 하나로 칠해져 있어서,
// 받은 그림의 노랑~초록 칸만 다른 색으로 바꿔 다시 건다(한 번, 받을 때). 흰색·회색처럼 색이 옅은 칸은 그대로 둔다

/** 바꿀 색(HSL, 0~1)을 돌려주거나 그대로 두면 null */
export type HueRule = (h: number, s: number, l: number) => readonly [number, number, number] | null;

/** 노랑~초록(색상 45°~170°)을 라벤더로 — 맵의 물건 */
export const LIME_TO_LAVENDER: HueRule = (h, s, l) => {
  const isLimeFamily = h > 45 / 360 && h < 170 / 360 && s > 0.28 && l > 0.12 && l < 0.94;
  if (!isLimeFamily) return null;
  const sat = s * 0.8;
  return [258 / 360, sat, l];
};

/** 버섯 갓: 빨강·분홍·노랑~초록을 라벤더로(기획 '버섯 갓 → 라벤더') */
export const CAP_TO_LAVENDER: HueRule = (h, s, l) => {
  const isRedFamily = (h < 20 / 360 || h > 320 / 360) && s > 0.35 && l < 0.85;
  if (isRedFamily) return [258 / 360, s * 0.7, l];
  return LIME_TO_LAVENDER(h, s, l);
};

/** 노랑~초록을 크림색으로 — 이 행성의 고양이 */
export const LIME_TO_CREAM: HueRule = (h, s, l) => {
  const isLimeFamily = h > 45 / 360 && h < 170 / 360 && s > 0.2;
  if (!isLimeFamily) return null;
  const light = 0.8 + l * 0.15;
  return [35 / 360, 0.75, light];
};

/** 모델의 그림을 규칙대로 다시 칠한다(그림이 없거나 읽을 수 없으면 그대로) */
export function recolorModel(root: THREE.Object3D, rule: HueRule) {
  const done = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (!map || done.has(map)) continue;
      done.add(map);
      recolorTexture(map, rule);
    }
  });
}

/* ─── 내부 ─────────────────────────── */

// 그림을 캔버스에 옮겨 칸마다 바꾸고 그 캔버스를 그림으로 건다(그림의 다른 설정은 그대로)
function recolorTexture(tex: THREE.Texture, rule: HueRule) {
  const image = tex.image as CanvasImageSource & { width: number; height: number };
  if (!image || !image.width || !image.height) return;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return;
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hsl = { h: 0, s: 0, l: 0 };
  const c = new THREE.Color();
  let changed = false;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255,
      gr = px[i + 1] / 255,
      b = px[i + 2] / 255;
    c.setRGB(r, gr, b, THREE.LinearSRGBColorSpace);
    c.getHSL(hsl, THREE.LinearSRGBColorSpace);
    const next = rule(hsl.h, hsl.s, hsl.l);
    if (!next) continue;
    c.setHSL(next[0], next[1], next[2], THREE.LinearSRGBColorSpace);
    px[i] = toByte(c.r);
    px[i + 1] = toByte(c.g);
    px[i + 2] = toByte(c.b);
    changed = true;
  }
  if (!changed) return;
  g.putImageData(data, 0, 0);
  tex.image = canvas;
  tex.needsUpdate = true;
}

// 0~1 → 0~255
function toByte(v: number): number {
  const scaled = v * 255;
  return Math.round(scaled);
}
