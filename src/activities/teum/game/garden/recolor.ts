import * as THREE from "three";

// 맵에 초록·노랑 없음(MAP-03 6장): 모델 재질에서 초록·노랑(색상 45°~170°, 채도가 있는 것)을 흰색으로 칠한다.
// 색이 그림(map)에 있으면 그림을 한 번 다시 그리고, 재질 색에 있으면 색을 바꾼다

/** 초록·노랑으로 치는 색상 범위(도) · 이보다 채도가 낮으면 그대로(흰색·회색) */
const HUE = { from: 45, to: 170 } as const;
const SAT_MIN = 0.22;

/** 재질의 초록·노랑을 white 로 */
export function whitenGreenYellow(mat: THREE.MeshStandardMaterial, white: number) {
  const hsl = { h: 0, s: 0, l: 0 };
  if (mat.color) {
    mat.color.getHSL(hsl, THREE.SRGBColorSpace);
    if (isGreenYellow(hsl.h, hsl.s)) mat.color.setHex(white);
  }
  const map = mat.map;
  const image = map?.image as CanvasImageSource | undefined;
  if (!map || !image) return;
  const repainted = repaint(image, white);
  if (!repainted) return;
  repainted.flipY = map.flipY;
  repainted.colorSpace = map.colorSpace;
  repainted.wrapS = map.wrapS;
  repainted.wrapT = map.wrapT;
  repainted.channel = map.channel;
  mat.map = repainted;
  mat.needsUpdate = true;
}

/** 색상(0..1)·채도가 초록·노랑인가 */
export function isGreenYellow(h: number, s: number): boolean {
  const deg = h * 360;
  return s >= SAT_MIN && deg >= HUE.from && deg <= HUE.to;
}

/* ─── 내부 ─────────────────────────── */

// 그림의 초록·노랑 픽셀을 white 로(밝기만큼 섞어 그림자는 남긴다)
function repaint(image: CanvasImageSource, white: number): THREE.CanvasTexture | null {
  const w = (image as { width?: number }).width ?? 0,
    h = (image as { height?: number }).height ?? 0;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const target = new THREE.Color(white);
  const tr = target.r * 255,
    tg = target.g * 255,
    tb = target.b * 255;
  const c = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255,
      g = px[i + 1] / 255,
      b = px[i + 2] / 255;
    c.setRGB(r, g, b, THREE.SRGBColorSpace);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    if (!isGreenYellow(hsl.h, hsl.s)) continue;
    // 원래 밝기를 조금 남겨 굴곡이 보이게
    const shade = 0.82 + 0.18 * hsl.l;
    px[i] = tr * shade;
    px[i + 1] = tg * shade;
    px[i + 2] = tb * shade;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
