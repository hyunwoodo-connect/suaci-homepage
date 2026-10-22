import { SITE_HOST } from "@/constants/site";

import { TAKE_FOUR_COLORS } from "../theme";
import { canvasFont, canvasToBlob, fontFamily, loadFonts } from "../canvas";
import { CARD } from "../strip/layout";

/** 9:16 스토리 이미지. 시안 Story(360×640)의 3배. */
export const STORY = { width: 1080, height: 1920 } as const;

const SCALE = STORY.width / 360;
const JPEG_QUALITY = 0.9;
export const STORY_HASHTAG = "#그라데이션웃음챌린지";

export interface StoryLayout {
  /** `take four.` 가운데 x·기준선 y */
  title: { x: number; baseline: number; size: number; letterSpacing: number };
  /** 합성 카드 자리. 시안 img(왼쪽 30·위 112·폭 300), 높이는 카드 비율대로 */
  card: { x: number; y: number; width: number; height: number };
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

/** 시안 Story의 자리(Chrome에서 잰 기준선)를 3배로. */
export function storyLayout(): StoryLayout {
  const s = (v: number) => v * SCALE;
  const width = s(300);
  return {
    title: { x: s(180), baseline: s(79), size: s(46), letterSpacing: -0.03 * s(46) },
    card: { x: s(30), y: s(112), width, height: (width * CARD.height) / CARD.width },
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
  return `${SITE_HOST}/events/${slug}`;
}

/** 스토리 파일 이름 — 카드 파일 이름에 `-story`. */
export function storyFilename(stripFilename: string): string {
  return stripFilename.replace(/\.jpg$/, "-story.jpg");
}

/**
 * 합성 카드를 얹은 시안 Story 1080×1920 JPEG. 카드(합성 JPEG)는 그대로 얹어 저장본과 같다.
 * 바탕이 카드 바탕과 같은 연두라 카드 테두리가 보이지 않는다. 글꼴은 카드와 같은 규칙 — 다 받기 전엔 그리지 않고, 못 받으면 던진다(기본 글꼴로 찍지 않는다).
 * link: 왼쪽 아래 주소(시안 `[suaci.com/four]` 자리).
 */
export async function composeStory(strip: Blob, link: string): Promise<Blob> {
  const layout = storyLayout();
  const latin = fontFamily("--font-fraunces", "Fraunces");
  const korean = fontFamily("--font-gowun-batang", "Gowun Batang");
  const fonts = {
    title: canvasFont(`italic 600 ${layout.title.size}px`, latin),
    wordmark: canvasFont(`700 ${layout.wordmark.size}px`, latin),
    hashtag: canvasFont(`400 ${layout.hashtag.size}px`, korean),
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

    ctx.fillStyle = TAKE_FOUR_COLORS.pale;
    ctx.fillRect(0, 0, STORY.width, STORY.height);

    // ---- take four. ----
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.textBaseline = "alphabetic";
    ctx.font = fonts.title.draw;
    ctx.textAlign = "center";
    setLetterSpacing(ctx, layout.title.letterSpacing);
    ctx.fillText("take four.", layout.title.x, layout.title.baseline);
    setLetterSpacing(ctx, 0);

    // ---- 카드 ----
    const { x, y, width, height } = layout.card;
    ctx.drawImage(image, x, y, width, height);

    // ---- 왼쪽 아래 ----
    const { wordmark, hashtag } = layout;
    ctx.textAlign = "left";
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.font = fonts.wordmark.draw;
    ctx.fillText("suaci", wordmark.x, wordmark.baseline);
    const dotX = wordmark.x + ctx.measureText("suaci").width + wordmark.dot.gap + wordmark.dot.r;
    ctx.beginPath();
    ctx.arc(dotX, wordmark.baseline - wordmark.dot.rise, wordmark.dot.r, 0, Math.PI * 2);
    ctx.fillStyle = TAKE_FOUR_COLORS.dot;
    ctx.fill();
    ctx.fillStyle = TAKE_FOUR_COLORS.ink;
    ctx.font = fonts.hashtag.draw;
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
