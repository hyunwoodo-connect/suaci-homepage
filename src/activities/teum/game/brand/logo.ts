import * as THREE from "three";

// suaci 워드마크 그림: 사이트의 로고 파일(public/brand/logo-black.svg)을 그대로 받아 캔버스에 그린다.
// 풍선은 키컬러 라임 바탕에 먹색 워드마크(라임 위 글자는 먹색 — 브랜드 규칙), 잔디·도장은 워드마크 모양만 남긴 흰 글자에 재질 색(라임)을 곱한다

/** 로고 파일 주소(사이트 public/) */
const LOGO_URL = "/brand/logo-black.svg";
/** 로고 viewBox 크기 */
const LW = 1608,
  LH = 400;

/** 풍선에 두르는 그림과 잔디에 깎는 그림 */
export interface LogoTextures {
  balloon: THREE.CanvasTexture;
  lawn: THREE.CanvasTexture;
}

/**
 * 두 그림을 만든다. 풍선 그림은 바로 라임으로 칠해 두고, 로고 파일이 오면 워드마크를 얹는다(잔디 그림은 그때까지 비어 있다).
 * 받지 못하면 풍선은 무늬 없는 라임, 잔디·도장은 보이지 않는다
 */
export function createLogoTextures(): LogoTextures {
  const cb = document.createElement("canvas");
  cb.width = 1024;
  cb.height = 512;
  const bg = cb.getContext("2d")!;
  bg.fillStyle = "#a9ff39";
  bg.fillRect(0, 0, 1024, 512);
  const balloon = new THREE.CanvasTexture(cb);
  balloon.colorSpace = THREE.SRGBColorSpace;
  balloon.anisotropy = 4;
  const cl = document.createElement("canvas");
  cl.width = 1024;
  cl.height = 256;
  const lawn = new THREE.CanvasTexture(cl);
  lawn.anisotropy = 8;
  loadLogo()
    .then((img) => {
      if (!img) return;
      drawBalloon(bg, img);
      balloon.needsUpdate = true;
      const lg = cl.getContext("2d")!;
      drawLawn(lg, img);
      lawn.needsUpdate = true;
    })
    .catch(() => {});
  return { balloon, lawn };
}

/* ─── 내부 ─────────────────────────── */

// 시제품처럼 SVG 글자를 data: 주소로 바꿔 그린다(같은 그림 크기·비율이 나오게)
async function loadLogo(): Promise<HTMLImageElement | null> {
  const res = await fetch(LOGO_URL);
  if (!res.ok) return null;
  const svg = await res.text();
  const encoded = encodeURIComponent(svg);
  const src = "data:image/svg+xml;charset=utf-8," + encoded;
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });
}

// 라임 바탕에 워드마크를 앞뒤로 한 번씩
function drawBalloon(g: CanvasRenderingContext2D, img: HTMLImageElement) {
  const w = 330,
    hh = (w * LH) / LW;
  for (const u of [0.25, 0.75]) {
    const x = u * 1024 - w / 2,
      y = 0.46 * 512 - hh / 2;
    g.drawImage(img, x, y, w, hh);
  }
}

// 워드마크 모양만 남긴 흰 글자(바탕은 비움)
function drawLawn(g: CanvasRenderingContext2D, img: HTMLImageElement) {
  const h = (1000 * LH) / LW,
    y = (256 - h) / 2;
  g.drawImage(img, 12, y, 1000, h);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 1024, 256);
}
