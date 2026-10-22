/** 캔버스·이미지 도구. 카드·스토리·벽 썸네일 합성이 같이 쓴다. */

/**
 * 글꼴을 이만큼까지 기다린다. 현상 화면이 도는 동안이라 넉넉히 둔다.
 * 넘으면 기본 글꼴로 찍지 않고 실패로 던진다(현상 화면의 `다시 인화하기`).
 */
export const FONT_TIMEOUT_MS = 12_000;

/** 캔버스를 이미지로 굽고 캔버스 메모리를 바로 돌려준다. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // 큰 캔버스(카드 1080×1350·스토리 1080×1920) 메모리를 바로 돌려준다 — 폰 사파리는 캔버스 총량 한도가 빠듯하다
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

/** canvas가 쓸 글꼴 이름 둘. */
export interface FontFamily {
  /** `ctx.font`용 전체 목록(`'Fraunces', 'Fraunces Fallback', serif`) */
  stack: string;
  /** `document.fonts.load`·`check`용 진짜 웹 글꼴 하나(`'Fraunces'`) */
  face: string;
}

/** 굵기·크기 + 글꼴. draw는 `ctx.font`에, load는 `loadFonts`에 넘긴다. */
export interface CanvasFont {
  draw: string;
  load: string;
}

/**
 * next/font가 단 글꼴 이름(`'Fraunces', 'Fraunces Fallback'` 꼴). canvas는 CSS 변수를 못 읽어 직접 꺼낸다.
 * 레이아웃이 <html>에 변수를 단다.
 * 받기·확인은 첫 이름(웹 글꼴)만 — 대체 글꼴은 `src: local(Times New Roman)`이라 그 글꼴이 없는
 * 안드로이드에선 목록째 넘긴 `load()`가 거절되고 합성이 통째로 실패한다.
 */
export function fontFamily(cssVar: string, fallback: string): FontFamily {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  const face = value ? value.split(",")[0].trim() : `'${fallback}'`;
  return { stack: `${value || face}, serif`, face };
}

/** 굵기·크기(`italic 600 46px`)와 글꼴로 CanvasFont를 만든다. */
export function canvasFont(style: string, family: FontFamily): CanvasFont {
  return { draw: `${style} ${family.stack}`, load: `${style} ${family.face}` };
}

/**
 * 쓰는 글꼴을 다 받았으면 true. 시간 안에 못 받으면 false.
 * text는 unicode-range 조각으로 오는 글꼴(Gowun Batang 한글)에서 그 글자가 든 조각을 받게 한다.
 */
export async function loadFonts(fonts: CanvasFont[], text?: string): Promise<boolean> {
  if (!("fonts" in document)) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), FONT_TIMEOUT_MS);
  });
  const args = ({ load }: CanvasFont): [string, string?] =>
    text === undefined ? [load] : [load, text];
  const loaded = Promise.all(fonts.map((font) => document.fonts.load(...args(font))))
    .then(() => fonts.every((font) => document.fonts.check(...args(font))))
    .catch(() => false);
  try {
    return await Promise.race([loaded, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 이미지를 <img>에 쓸 data: URL로. blob: URL은 개발 모드(StrictMode)의 effect 두 번 실행에서
 * 지운 URL을 다시 쓰게 되기 쉬워, 지울 필요 없는 data: URL을 쓴다(카드는 수백 KB).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
