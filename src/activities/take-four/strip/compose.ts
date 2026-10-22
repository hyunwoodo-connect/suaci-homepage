import type { EventPhase } from "@/types";

import { TAKE_FOUR_COLORS } from "../theme";
import { STRIP, stripLayout } from "./layout";
import type { Rect } from "./layout";

/** 띠 아래 글자. 1단계 serial은 서버 발급 전이라 null(→ `no.----`). */
export interface StripCaption {
  serial: string | null;
  /** 진행 중·시작 전이면 `No.01`. 이벤트가 끝났으면 null — 도장도 같이 빠진다 */
  eventLabel: string | null;
  date: Date;
}

/** 찍은 장(카메라 캡처·앨범 사진을 4:3으로 자른 것) */
export type StripFrame = HTMLCanvasElement | ImageBitmap;

const EVENT_LABEL = "No.01";
const JPEG_QUALITY = 0.86;
/**
 * 글꼴을 이만큼까지 기다린다. 현상 화면이 도는 동안이라 넉넉히 둔다.
 * 넘으면 기본 글꼴로 찍지 않고 실패로 던진다(현상 화면의 `다시 인화하기`).
 */
export const FONT_TIMEOUT_MS = 12_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 이벤트 상태로 캡션을 정한다. 놀이는 상설이라 마감 뒤엔 이벤트 표시만 뺀다. */
export function stripCaption(phase: EventPhase, date: Date): StripCaption {
  return { serial: null, eventLabel: phase === "ended" ? null : EVENT_LABEL, date };
}

/** 한국 날짜 `MM.DD`(폰 시간대와 상관없이). */
export function kstDateLabel(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

/** 캡션 왼쪽 번호와 오른쪽 회차·날짜. 화면 띠(Strip)와 합성 띠가 같은 글자를 쓴다. */
export function captionText(caption: StripCaption): { number: string; meta: string } {
  const date = kstDateLabel(caption.date);
  return {
    number: caption.serial ?? "no.----",
    meta: caption.eventLabel ? `${caption.eventLabel} · ${date}` : date,
  };
}

/** 저장 파일 이름 */
export function stripFilename(caption: StripCaption): string {
  return `take-four-${kstDateLabel(caption.date).replace(".", "")}.jpg`;
}

/**
 * 네 장을 시안 비율 띠(900×2659)로 합성해 JPEG(0.86)로. 글꼴(Fraunces)을 받은 뒤에만 글자를 그린다.
 * 사진은 찍힌 그대로(전면 카메라 거울 모양) 얹는다.
 */
export async function composeStrip(frames: StripFrame[], caption: StripCaption): Promise<Blob> {
  const layout = stripLayout();
  const family = latinFamily();
  const fonts = {
    number: `700 ${layout.font.number}px ${family}`,
    meta: `500 ${layout.font.meta}px ${family}`,
    stamp: `italic 600 ${layout.font.stamp}px ${family}`,
  };
  const isLoaded = await loadFonts(
    caption.eventLabel ? Object.values(fonts) : [fonts.number, fonts.meta],
  );
  if (!isLoaded) throw new Error("글꼴(Fraunces)을 못 받아 합성하지 않았어요");

  const canvas = document.createElement("canvas");
  canvas.width = STRIP.width;
  canvas.height = STRIP.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d를 못 열었어요");

  // ---- 종이 + 물결 테두리 ----
  ctx.fillStyle = TAKE_FOUR_COLORS.cream;
  ctx.fillRect(0, 0, STRIP.width, STRIP.height);
  ctx.beginPath();
  layout.border.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.lineWidth = layout.border.stroke;
  ctx.lineJoin = "round";
  ctx.strokeStyle = TAKE_FOUR_COLORS.red;
  ctx.stroke();

  // ---- 사진 ----
  frames.slice(0, 4).forEach((frame, i) => drawCover(ctx, frame, layout.frames[i]));

  // ---- 캡션 ----
  const { number, meta } = captionText(caption);
  const baseline = layout.caption.y + layout.caption.height;
  ctx.fillStyle = TAKE_FOUR_COLORS.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = fonts.number;
  ctx.textAlign = "left";
  ctx.fillText(number, layout.caption.x, baseline);
  ctx.font = fonts.meta;
  ctx.textAlign = "right";
  ctx.fillText(meta, layout.caption.x + layout.caption.width, baseline);

  // ---- 도장 ----
  if (caption.eventLabel) {
    const { x, y, r } = layout.stamp;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.beginPath();
    ctx.arc(0, 0, r - layout.font.stampRing / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 227, 207, 0.92)";
    ctx.fill();
    ctx.lineWidth = layout.font.stampRing;
    ctx.strokeStyle = TAKE_FOUR_COLORS.red;
    ctx.stroke();
    ctx.fillStyle = TAKE_FOUR_COLORS.red;
    ctx.font = fonts.stamp;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption.eventLabel, 0, 0);
    ctx.restore();
  }

  return canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
}

/** 네 장을 사진 기둥(칸 넷 + 사이) 크기 캔버스에 그린다. 현상 화면 미리보기. */
export function drawPhotos(canvas: HTMLCanvasElement, frames: StripFrame[]): void {
  const { photo, frames: cells } = stripLayout();
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = TAKE_FOUR_COLORS.cream;
  ctx.fillRect(0, 0, photo.width, photo.height);
  frames
    .slice(0, 4)
    .forEach((frame, i) =>
      drawCover(ctx, frame, { ...cells[i], x: cells[i].x - photo.x, y: cells[i].y - photo.y }),
    );
}

/**
 * 사진 기둥만(칸 넷 + 사이, 테두리·글자 없이) JPEG로. 완성 화면 띠(시안 Strip)와 입구 카드가 쓴다.
 * 합성 띠와 같은 칸 배치라 저장되는 사진과 같다. 합성 띠를 잘라 쓰면 도장이 사진 위에 같이 잘려 온다.
 */
export async function composePhotos(frames: StripFrame[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawPhotos(canvas, frames);
  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

/**
 * 사진 기둥을 <img>에 쓸 data: URL로. blob: URL은 개발 모드(StrictMode)의 effect 두 번 실행에서
 * 지운 URL을 다시 쓰게 되기 쉬워, 지울 필요 없는 data: URL을 쓴다(사진 기둥은 수백 KB).
 */
export function photosDataUrl(photos: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(photos);
  });
}

/* ─── 내부 ─────────────────────────── */

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // 큰 캔버스(900×2659) 메모리를 바로 돌려준다 — 폰 사파리는 캔버스 총량 한도가 빠듯하다
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("이미지를 만들지 못했어요"));
      },
      type,
      quality,
    );
  });
}

/** 칸을 꽉 채우게(가운데 자르기). 찍은 장은 이미 4:3이라 보통 그대로 들어간다. */
function drawCover(ctx: CanvasRenderingContext2D, source: StripFrame, cell: Rect) {
  const { width, height } = source;
  if (!width || !height) return;
  const scale = Math.max(cell.width / width, cell.height / height);
  const sw = cell.width / scale;
  const sh = cell.height / scale;
  ctx.drawImage(
    source,
    (width - sw) / 2,
    (height - sh) / 2,
    sw,
    sh,
    cell.x,
    cell.y,
    cell.width,
    cell.height,
  );
}

/**
 * next/font가 단 Fraunces 이름(`'Fraunces', 'Fraunces Fallback'` 꼴). canvas는 CSS 변수를 못 읽어 직접 꺼낸다.
 * 레이아웃이 <html>에 변수를 단다.
 */
function latinFamily(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-fraunces")
    .trim();
  return value ? `${value}, serif` : "Fraunces, serif";
}

/** 쓰는 글꼴을 다 받았으면 true. 시간 안에 못 받으면 false. */
async function loadFonts(fonts: string[]): Promise<boolean> {
  if (!("fonts" in document)) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), FONT_TIMEOUT_MS);
  });
  const loaded = Promise.all(fonts.map((font) => document.fonts.load(font)))
    .then(() => fonts.every((font) => document.fonts.check(font)))
    .catch(() => false);
  try {
    return await Promise.race([loaded, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
