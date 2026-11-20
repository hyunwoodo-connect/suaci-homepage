import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { HUD_FONT } from "../hud";
import type { MinimapValues } from "../maps/map";
import type { Services } from "../services";
import type { GlobeData, GlobePoint, GlobeView } from "./globe";
import {
  aimView,
  dragView,
  drawMe,
  drawRoads,
  GLOBE_INK,
  globeDataOf,
  paintRegions,
  project,
} from "./globe";

// 미니맵(기획 MINIMAP-01 — 지도 값 minimap 이 있는 지도에만, 지금은 v79):
// 1) 왼쪽 위 작은 지구본 — 내가 늘 가운데, 위가 늘 내가 보는 쪽. 지역 색·경계·바다·큰 길·랜드마크 점(아직 안 한 게임은 천천히 깜빡)
// 2) 새 지역에 들어서면 화면 위 가운데에 지역 이름(글자 규칙의 예외 — 이름 여섯만). 언제 띄울지는 존 넘나들기(zones/tracker)가 정한다
// 3) 지구본을 톡 → 큰 지도(끌면 돈다, 지역 이름·랜드마크 아이콘·이동 구멍·큰 길·나). 바깥이나 지구본을 다시 톡 하면 닫힌다.
//    판 중(숨바꼭질)에는 열리지 않는다. 열려 있어도 게임 시간은 흐른다

/** 화면 가장자리에서 떨어진 거리(px) — 오른쪽 위 소리 단추와 대칭 */
const EDGE = 16;
/** 그림 해상도 배율의 끝(폰 3배 화면도 2배로 — 칠하는 픽셀 수를 줄인다) · 큰 지도 픽셀 칠하기의 최대 변(px) */
const DPR_MAX = 2;
const BIG_RASTER_MAX = 380;
/** 작은 지구본: 랜드마크 점 지름 · 나 점 반지름 · 길 굵기(px) */
const MINI = { landmark: 6, me: 4, road: 1.2 } as const;
/** 큰 지도: 랜드마크 아이콘 반지름 · 이동 구멍 점 반지름 · 나 점 반지름 · 길 굵기(px) · 이름 글자 크기(px) */
const BIG = { icon: 9, hole: 3.2, me: 5.5, road: 2.2, name: 14 } as const;
/** 랜드마크 깜빡임: 한 바퀴(초) · 가장 옅을 때 */
const BLINK = { period: 2.6, low: 0.35 } as const;
/** 큰 지도에서 이름·아이콘을 쓰는 앞면 깊이(가장자리에 눌린 것은 쓰지 않는다) */
const FRONT_FOR_TEXT = 0.25;

/** 미니맵 */
export class Minimap implements Thing {
  private readonly data: GlobeData;
  private readonly dpr: number;
  // ---- 작은 지구본 ----
  private readonly button: HTMLButtonElement;
  private readonly miniCtx: CanvasRenderingContext2D;
  private readonly miniImg: ImageData;
  private readonly miniView: GlobeView = newView();
  // ---- 큰 지도 ----
  private readonly overlay: HTMLDivElement;
  private readonly big: HTMLCanvasElement;
  private readonly bigCtx: CanvasRenderingContext2D;
  private readonly raster: HTMLCanvasElement;
  private readonly bigView: GlobeView = newView();
  private isOpen = false;
  private isBigDirty = true;
  private drag: { id: number; x: number; y: number } | null = null;
  // ---- 지역 이름 ----
  private readonly nameEl: HTMLDivElement;
  private nameT = 0;
  // ---- 셈에 쓰는 값 ----
  private readonly forward = new THREE.Vector3();
  private readonly pt: GlobePoint = { x: 0, y: 0, z: 0 };
  private time = 0;
  /** 랜드마크 게임을 했나(없으면 아무것도 안 했다) */
  private isDone: (landmark: number) => boolean = () => false;

  /** parent: 게임 화면(캔버스의 부모) · camera: 보는 쪽 · canOpen: 큰 지도를 열어도 되나(판 중이면 아니다) */
  constructor(
    private readonly s: Services,
    private readonly values: MinimapValues,
    parent: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly canOpen: () => boolean,
  ) {
    this.data = globeDataOf(s.layout, s.map.regions, s.occ.hubs);
    const ratio = window.devicePixelRatio || 1;
    this.dpr = Math.min(DPR_MAX, ratio);
    // ---- 작은 지구본: 누를 수 있는 단추 안의 캔버스 ----
    const size = values.size;
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.setAttribute("aria-label", "지도 열기");
    Object.assign(this.button.style, {
      position: "fixed",
      top: `calc(${EDGE}px + env(safe-area-inset-top))`,
      left: `calc(${EDGE}px + env(safe-area-inset-left))`,
      width: `${size}px`,
      height: `${size}px`,
      padding: "0",
      border: "2px solid #fff",
      borderRadius: "50%",
      background: "transparent",
      boxShadow: "0 1px 6px rgba(0,0,0,.25)",
      overflow: "hidden",
      cursor: "pointer",
      touchAction: "manipulation",
    });
    const inner = size - 4;
    const mini = canvasOf(inner, this.dpr);
    this.miniCtx = mini.getContext("2d")!;
    this.miniImg = this.miniCtx.createImageData(mini.width, mini.height);
    this.button.append(mini);
    this.button.addEventListener("click", () => this.toggle());
    // ---- 큰 지도: 화면을 덮는 판(바깥을 누르면 닫힌다) 가운데에 큰 지구본 ----
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(20,22,22,.22)",
      touchAction: "none",
      // 옷장 단추 등 화면의 다른 단추보다 위 — 바깥을 누르면 닫히기만 한다
      zIndex: "40",
    });
    const bigSize = this.bigSize();
    this.big = canvasOf(bigSize, this.dpr);
    Object.assign(this.big.style, {
      borderRadius: "50%",
      boxShadow: "0 0 0 2px #fff, 0 4px 18px rgba(0,0,0,.25)",
      touchAction: "none",
    });
    this.bigCtx = this.big.getContext("2d")!;
    const rasterSide = Math.min(BIG_RASTER_MAX, this.big.width);
    this.raster = document.createElement("canvas");
    this.raster.width = rasterSide;
    this.raster.height = rasterSide;
    this.overlay.append(this.big);
    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });
    this.big.addEventListener("pointerdown", (e) => this.onDown(e));
    this.big.addEventListener("pointermove", (e) => this.onMove(e));
    this.big.addEventListener("pointerup", () => this.onUp());
    this.big.addEventListener("pointercancel", () => this.onUp());
    // ---- 지역 이름: 지구본과 같은 높이의 가운데 ----
    const nameTop = EDGE + size / 2;
    this.nameEl = document.createElement("div");
    Object.assign(this.nameEl.style, {
      position: "fixed",
      left: "50%",
      top: `calc(${nameTop}px + env(safe-area-inset-top))`,
      transform: "translate(-50%, -50%)",
      fontFamily: HUD_FONT,
      fontSize: "26px",
      fontWeight: "800",
      letterSpacing: "-0.01em",
      color: "#fff",
      textShadow: "0 2px 10px rgba(0,0,0,.35), 0 0 2px rgba(0,0,0,.3)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity .25s",
    });
    parent.append(this.button, this.nameEl, this.overlay);
    s.hud.attach(this.button);
    s.hud.attach(this.nameEl);
  }

  /** 랜드마크(자리표 차례)의 게임을 했는지 묻는 창구 — 한 랜드마크는 깜빡이지 않는다(존 미니게임 기록) */
  setDone(isDone: (landmark: number) => boolean) {
    this.isDone = isDone;
  }

  /** 지역 이름을 화면 위 가운데에 띄운다(존 넘나들기가 부른다 — 정해진 초 동안) */
  showName(name: string) {
    this.nameEl.textContent = name;
    this.nameEl.style.opacity = "1";
    this.nameT = this.values.regionName.seconds;
  }

  /** 지구본을 내 자리·보는 쪽에 맞춰 다시 그리고, 띄운 이름은 시간이 되면 지운다(카메라 다음) */
  update(f: Frame) {
    this.time = f.time;
    const p = this.s.player.p;
    this.aimForward(p);
    aimView(this.miniView, p, this.forward);
    this.drawMini();
    if (this.nameT > 0) {
      this.nameT -= f.dt;
      if (this.nameT <= 0) this.nameEl.style.opacity = "0";
    }
    if (this.isOpen) this.drawBig();
  }

  /** 치운다 */
  dispose() {
    this.button.remove();
    this.nameEl.remove();
    this.overlay.remove();
  }

  // 작은 지구본을 누르면 큰 지도를 열고 닫는다(판 중에는 열지 않는다)
  private toggle() {
    if (this.isOpen) {
      this.close();
      return;
    }
    if (!this.canOpen()) return;
    const p = this.s.player.p;
    aimView(this.bigView, p, this.forward);
    this.isBigDirty = true;
    this.isOpen = true;
    this.overlay.style.display = "flex";
    this.drawBig();
  }

  private close() {
    this.isOpen = false;
    this.drag = null;
    this.overlay.style.display = "none";
  }

  private onDown(e: PointerEvent) {
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.big.setPointerCapture(e.pointerId);
  }

  // 끌면 공이 돈다(손가락 밑의 땅이 따라온다)
  private onMove(e: PointerEvent) {
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    const rad = this.big.clientWidth / 2;
    const dx = (e.clientX - drag.x) / rad,
      dy = (e.clientY - drag.y) / rad;
    drag.x = e.clientX;
    drag.y = e.clientY;
    dragView(this.bigView, dx, dy);
    this.isBigDirty = true;
  }

  private onUp() {
    this.drag = null;
  }

  // 보는 쪽: 카메라가 보는 방향을 땅에 눕힌 것(바로 내려다보면 내가 가는 쪽)
  private aimForward(p: THREE.Vector3) {
    const f = this.forward;
    this.camera.getWorldDirection(f);
    const along = f.dot(p);
    f.addScaledVector(p, -along);
    if (f.lengthSq() < 1e-6) f.copy(this.s.player.h);
    f.normalize();
  }

  private bigSize(): number {
    const side = Math.min(innerWidth, innerHeight);
    const size = side * this.values.bigMap.width;
    return Math.round(size);
  }

  // 작은 지구본: 지역(픽셀) → 큰 길 → 랜드마크 점(깜빡) → 가운데 나
  private drawMini() {
    const ctx = this.miniCtx,
      view = this.miniView,
      dpr = this.dpr;
    paintRegions(this.miniImg, view, this.data);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(this.miniImg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = this.miniImg.width / dpr,
      half = css / 2;
    drawRoads(ctx, view, this.data, half, half, half, MINI.road);
    const blink = this.blink();
    const dotR = MINI.landmark / 2;
    this.data.landmarks.forEach((m, i) => {
      project(view, m.v, this.pt);
      if (this.pt.z <= 0) return;
      const x = half + this.pt.x * half,
        y = half - this.pt.y * half;
      const alpha = this.isDone(i) ? 1 : blink;
      dot(ctx, x, y, dotR, alpha);
    });
    drawMe(ctx, half, half, MINI.me, 0);
  }

  // 큰 지도: 지역(돌렸을 때만 다시 칠한다) → 큰 길 → 이동 구멍 → 랜드마크 아이콘 → 지역 이름 → 나
  private drawBig() {
    const ctx = this.bigCtx,
      view = this.bigView,
      dpr = this.dpr,
      side = this.big.width;
    if (this.isBigDirty) {
      const rctx = this.raster.getContext("2d")!;
      const img = rctx.createImageData(this.raster.width, this.raster.height);
      paintRegions(img, view, this.data);
      rctx.putImageData(img, 0, 0);
      this.isBigDirty = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.raster, 0, 0, side, side);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const half = side / dpr / 2;
    drawRoads(ctx, view, this.data, half, half, half, BIG.road);
    const pt = this.pt;
    for (const h of this.data.holes) {
      project(view, h, pt);
      if (pt.z <= 0) continue;
      const x = half + pt.x * half,
        y = half - pt.y * half;
      hole(ctx, x, y, BIG.hole);
    }
    const blink = this.blink();
    this.data.landmarks.forEach((m, i) => {
      project(view, m.v, pt);
      if (pt.z <= FRONT_FOR_TEXT) return;
      const x = half + pt.x * half,
        y = half - pt.y * half;
      const alpha = this.isDone(i) ? 1 : blink;
      icon(ctx, m.name, x, y, BIG.icon, alpha);
    });
    this.data.hubs.forEach((hub, i) => {
      project(view, hub, pt);
      if (pt.z <= FRONT_FOR_TEXT) return;
      const x = half + pt.x * half,
        y = half - pt.y * half + BIG.icon * 2.2;
      label(ctx, this.data.names[i], x, y, BIG.name);
    });
    // 나: 그 자리에서 보는 쪽을 가리킨다
    const p = this.s.player.p;
    project(view, p, pt);
    if (pt.z <= 0) return;
    const mx = half + pt.x * half,
      my = half - pt.y * half;
    const fx = this.forward.dot(view.right),
      fy = this.forward.dot(view.up);
    const angle = Math.atan2(fx, fy);
    drawMe(ctx, mx, my, BIG.me, angle);
  }

  // 아직 안 한 게임의 랜드마크는 천천히 깜빡인다(했는지는 setDone 창구 — 존 미니게임 기록)
  private blink(): number {
    const phase = (this.time / BLINK.period) * Math.PI * 2;
    const wave = 0.5 + 0.5 * Math.sin(phase);
    return BLINK.low + (1 - BLINK.low) * wave;
  }
}

/** 아이콘 도형: 네모 [x, y, 너비, 높이] · 동그라미 [x, y, 반지름] · 다각형 [x0, y0, x1, y1, …] — 단위는 아이콘 크기 */
type IconShape =
  | { kind: "rect"; at: readonly [number, number, number, number] }
  | { kind: "circle"; at: readonly [number, number, number] }
  | { kind: "poly"; at: readonly number[] };

/** 랜드마크 이름 → 아이콘(기획이 아이콘을 주면 바꾼다) */
const ICONS: Readonly<Record<string, readonly IconShape[]>> = {
  "3단 디저트 스탠드": [
    { kind: "rect", at: [-1, 0.45, 2, 0.35] },
    { kind: "rect", at: [-0.7, -0.15, 1.4, 0.35] },
    { kind: "rect", at: [-0.4, -0.75, 0.8, 0.35] },
  ],
  "쿠키 성": [
    { kind: "rect", at: [-0.8, -0.3, 1.6, 1.1] },
    { kind: "rect", at: [-0.8, -0.75, 0.3, 0.45] },
    { kind: "rect", at: [-0.15, -0.75, 0.3, 0.45] },
    { kind: "rect", at: [0.5, -0.75, 0.3, 0.45] },
  ],
  "블록 성": [
    { kind: "rect", at: [-0.85, -0.05, 0.8, 0.85] },
    { kind: "rect", at: [0.05, -0.05, 0.8, 0.85] },
    { kind: "rect", at: [-0.4, -0.85, 0.8, 0.7] },
  ],
  "빛나는 큰 꽃": [
    { kind: "circle", at: [0, -0.55, 0.38] },
    { kind: "circle", at: [0.52, -0.17, 0.38] },
    { kind: "circle", at: [0.32, 0.45, 0.38] },
    { kind: "circle", at: [-0.32, 0.45, 0.38] },
    { kind: "circle", at: [-0.52, -0.17, 0.38] },
  ],
  "떠 있는 구름섬": [
    { kind: "circle", at: [-0.45, 0.1, 0.42] },
    { kind: "circle", at: [0.05, -0.2, 0.55] },
    { kind: "circle", at: [0.5, 0.12, 0.4] },
  ],
  등대: [
    { kind: "poly", at: [-0.45, 0.85, 0.45, 0.85, 0.25, -0.45, -0.25, -0.45] },
    { kind: "rect", at: [-0.32, -0.9, 0.64, 0.35] },
  ],
};
/** 모르는 랜드마크: 작은 점 */
const PLAIN: readonly IconShape[] = [{ kind: "circle", at: [0, 0, 0.5] }];

/* ─── 내부 ─────────────────────────── */

// 빈 보는 틀
function newView(): GlobeView {
  return {
    c: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
    right: new THREE.Vector3(1, 0, 0),
  };
}

// css 크기(px)의 정사각 캔버스(해상도 dpr 배)
function canvasOf(css: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const px = css * dpr;
  const side = Math.round(px);
  c.width = side;
  c.height = side;
  Object.assign(c.style, { width: `${css}px`, height: `${css}px`, display: "block" });
  return c;
}

// 랜드마크 점: 먹색 + 흰 테두리
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const full = Math.PI * 2;
  ctx.arc(x, y, r, 0, full);
  ctx.fillStyle = GLOBE_INK;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.restore();
}

// 이동 구멍: 흰 테두리 점
function hole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  const full = Math.PI * 2;
  ctx.arc(x, y, r, 0, full);
  ctx.fillStyle = GLOBE_INK;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

// 지역 이름: 먹색 글자에 흰 테두리
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number) {
  ctx.save();
  ctx.font = `800 ${px}px ${HUD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = GLOBE_INK;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 랜드마크 아이콘: 흰 동그라미 안에 그 랜드마크를 줄인 먹색 그림(모르는 이름은 점)
function icon(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  r: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.beginPath();
  const full = Math.PI * 2;
  ctx.arc(0, 0, r, 0, full);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = GLOBE_INK;
  ctx.stroke();
  ctx.fillStyle = GLOBE_INK;
  const shapes = ICONS[name] ?? PLAIN;
  const u = r * 0.62;
  for (const shape of shapes) drawShape(ctx, shape, u);
  ctx.restore();
}

// 도형 하나(단위 u 배)
function drawShape(ctx: CanvasRenderingContext2D, shape: IconShape, u: number) {
  if (shape.kind === "rect") {
    const [x, y, w, h] = shape.at;
    const px = x * u,
      py = y * u,
      pw = w * u,
      ph = h * u;
    ctx.fillRect(px, py, pw, ph);
    return;
  }
  ctx.beginPath();
  if (shape.kind === "circle") {
    const [x, y, r] = shape.at;
    const px = x * u,
      py = y * u,
      pr = r * u,
      full = Math.PI * 2;
    ctx.arc(px, py, pr, 0, full);
  } else {
    for (let k = 0; k + 1 < shape.at.length; k += 2) {
      const px = shape.at[k] * u,
        py = shape.at[k + 1] * u;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.fill();
}
