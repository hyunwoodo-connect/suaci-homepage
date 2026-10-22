import { TAKE_FOUR_COLORS } from "../theme";
import { canvasToBlob, fontFamily, loadFonts } from "../strip/compose";
import { STRIP } from "../strip/layout";

/** 9:16 스토리 이미지. 시안 Story(360×640)의 3배. */
export const STORY = { width: 1080, height: 1920 } as const;

const SCALE = STORY.width / 360;
const JPEG_QUALITY = 0.9;
export const STORY_HASHTAG = "#그라데이션웃음챌린지";

export interface StoryLayout {
  /** `take four.` 가운데 x·기준선 y */
  title: { x: number; baseline: number; size: number; letterSpacing: number };
  /** 합성 띠 자리(회전 전). 시안 figure 160×460의 가운데에 띠 비율 그대로(폭 480) 놓는다 */
  strip: { cx: number; cy: number; width: number; height: number; rotate: number };
  shadow: { offsetY: number; blur: number; color: string };
  /** 왼쪽 아래 세 줄: 워드마크·해시태그·주소 */
  wordmark: {
    x: number;
    baseline: number;
    size: number;
    dot: { gap: number; r: number; rise: number };
  };
  hashtag: { x: number; baseline: number; size: number };
  link: { x: number; baseline: number; size: number };
}

/**
 * 시안 Story의 자리(Chrome에서 잰 기준선)를 3배로. 띠는 시안 figure(left 92, top 108, 160×460, −3°)의
 * 가운데를 지키고, 폭 160(→480)에 합성 띠 비율(900×2659)을 지켜 높이를 정한다.
 * 시안은 SVG를 preserveAspectRatio=none으로 눌러 띠가 3% 낮지만, 사진을 찌그러뜨리지 않는다.
 */
export function storyLayout(): StoryLayout {
  const s = (v: number) => v * SCALE;
  const width = s(160);
  return {
    title: { x: s(180), baseline: s(79), size: s(46), letterSpacing: -0.03 * s(46) },
    strip: {
      cx: s(92 + 80),
      cy: s(108 + 230),
      width,
      height: (width * STRIP.height) / STRIP.width,
      rotate: -3,
    },
    shadow: { offsetY: s(10), blur: s(14), color: "rgba(43, 36, 32, 0.25)" },
    wordmark: {
      x: s(22),
      baseline: s(572),
      size: s(15),
      dot: { gap: s(3), r: s(3), rise: s(3.58) },
    },
    hashtag: { x: s(22), baseline: s(592), size: s(12) },
    link: { x: s(22), baseline: s(611), size: s(12) },
  };
}

/** 스토리 왼쪽 아래 주소(시안 `[suaci.com/four]` 자리) — 이 이벤트 페이지. */
export function storyLink(slug: string): string {
  return `takesuaci.com/events/${slug}`;
}

/** 스토리 파일 이름 — 띠 파일 이름에 `-story`. */
export function storyFilename(stripFilename: string): string {
  return stripFilename.replace(/\.jpg$/, "-story.jpg");
}

/**
 * 합성 띠 위에 시안 Story를 그린 1080×1920 JPEG. 띠(합성 JPEG)는 그대로 얹어 저장본과 같다.
 * 글꼴은 띠와 같은 규칙 — 다 받기 전엔 그리지 않고, 못 받으면 던진다(기본 글꼴로 찍지 않는다).
 * link: 왼쪽 아래 주소(시안 `[suaci.com/four]` 자리).
 */
export async function composeStory(strip: Blob, link: string): Promise<Blob> {
  const layout = storyLayout();
  const latin = fontFamily("--font-fraunces", "Fraunces");
  const korean = fontFamily("--font-gowun-batang", "Gowun Batang");
  const fonts = {
    title: `italic 600 ${layout.title.size}px ${latin}`,
    wordmark: `700 ${layout.wordmark.size}px ${latin}`,
    hashtag: `400 ${layout.hashtag.size}px ${korean}`,
  };
  const [isLatinLoaded, isKoreanLoaded] = await Promise.all([
    loadFonts([fonts.title, fonts.wordmark]),
    loadFonts([fonts.hashtag], `${STORY_HASHTAG}${link}`),
  ]);
  if (!isLatinLoaded || !isKoreanLoaded) throw new Error("글꼴을 못 받아 스토리를 만들지 않았어요");

  const image = await createImageBitmap(strip);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STORY.width;
    canvas.height = STORY.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d를 못 열었어요");

    ctx.fillStyle = TAKE_FOUR_COLORS.lime;
    ctx.fillRect(0, 0, STORY.width, STORY.height);

    // ---- take four. ----
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.textBaseline = "alphabetic";
    ctx.font = fonts.title;
    ctx.textAlign = "center";
    setLetterSpacing(ctx, layout.title.letterSpacing);
    ctx.fillText("take four.", layout.title.x, layout.title.baseline);
    setLetterSpacing(ctx, 0);

    // ---- 띠(−3°, 그림자) ----
    const { cx, cy, width, height, rotate } = layout.strip;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.shadowColor = layout.shadow.color;
    ctx.shadowOffsetY = layout.shadow.offsetY;
    ctx.shadowBlur = layout.shadow.blur;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();

    // ---- 왼쪽 아래 ----
    const { wordmark, hashtag } = layout;
    ctx.textAlign = "left";
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.font = fonts.wordmark;
    ctx.fillText("suaci", wordmark.x, wordmark.baseline);
    const dotX = wordmark.x + ctx.measureText("suaci").width + wordmark.dot.gap + wordmark.dot.r;
    ctx.beginPath();
    ctx.arc(dotX, wordmark.baseline - wordmark.dot.rise, wordmark.dot.r, 0, Math.PI * 2);
    ctx.fillStyle = TAKE_FOUR_COLORS.dot;
    ctx.fill();
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.font = fonts.hashtag;
    ctx.fillText(STORY_HASHTAG, hashtag.x, hashtag.baseline);
    ctx.fillText(link, layout.link.x, layout.link.baseline);

    return await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  } finally {
    image.close();
  }
}

/* ─── 내부 ─────────────────────────── */

// letterSpacing은 사파리 17 이전엔 없다 — 없으면 시안보다 살짝 넓게 찍힌다(글꼴은 같다)
function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}
