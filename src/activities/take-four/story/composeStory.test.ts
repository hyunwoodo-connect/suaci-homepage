import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { CARD } from "../strip/layout";
import {
  STORY,
  STORY_HASHTAG,
  composeStory,
  storyFilename,
  storyLayout,
  storyLink,
} from "./composeStory";

describe("storyLayout", () => {
  const layout = storyLayout();

  it("1080×1920(9:16), 시안 360×640의 3배", () => {
    expect(STORY).toEqual({ width: 1080, height: 1920 });
    expect(STORY.width / STORY.height).toBeCloseTo(9 / 16);
  });

  it("take four. — 가운데, 기준선 237(시안 79), 138px, 자간 −0.03em", () => {
    expect(layout.title).toEqual({ x: 540, baseline: 237, size: 138, letterSpacing: -4.14 });
  });

  it("카드 — 시안 img(왼쪽 30·위 112·폭 300)의 3배, 합성 카드 비율 그대로", () => {
    const { card } = layout;
    expect([card.x, card.y, card.width]).toEqual([90, 336, 900]);
    expect(card.width / card.height).toBeCloseTo(CARD.width / CARD.height, 6);
  });

  it("카드가 제목 아래·왼쪽 아래 글자 위, 화면 가운데에 든다", () => {
    const { card, title, wordmark } = layout;
    expect(card.x * 2 + card.width).toBe(STORY.width);
    expect(card.y).toBeGreaterThan(title.baseline);
    expect(card.y + card.height).toBeLessThan(wordmark.baseline - wordmark.size);
  });

  it("왼쪽 아래 세 줄 — x 66, 기준선 1716·1776·1833, 45·36·36px", () => {
    const { wordmark, hashtag, link } = layout;
    expect([wordmark.x, wordmark.baseline, wordmark.size]).toEqual([66, 1716, 45]);
    expect([hashtag.x, hashtag.baseline, hashtag.size]).toEqual([66, 1776, 36]);
    expect([link.x, link.baseline, link.size]).toEqual([66, 1833, 36]);
    expect(wordmark.dot).toEqual({ gap: 9, r: 9, rise: expect.closeTo(10.74, 2) });
  });

  it("파일 이름·주소", () => {
    expect(storyFilename("take-four-1022.jpg")).toBe("take-four-1022-story.jpg");
    expect(storyLink("take-four")).toBe("takesuaci.com/events/take-four");
  });
});

describe("composeStory", () => {
  const fonts = { load: vi.fn(), check: vi.fn() };
  const bitmap = { width: 900, height: 2659, close: vi.fn() };
  let ctx: Record<string, unknown> & { texts: { text: string; font: string }[] };
  let canvas: { width: number; height: number; sizeAtBlob?: number[] } & Record<string, unknown>;
  let order: string[];

  beforeEach(() => {
    order = [];
    const texts: { text: string; font: string }[] = [];
    ctx = { texts, font: "", letterSpacing: "0px" };
    for (const name of [
      "fillRect",
      "save",
      "restore",
      "translate",
      "rotate",
      "beginPath",
      "arc",
      "fill",
    ]) {
      ctx[name] = vi.fn();
    }
    ctx.drawImage = vi.fn(() => order.push("drawImage"));
    ctx.measureText = vi.fn(() => ({ width: 117 }));
    ctx.fillText = vi.fn((text: string) => {
      order.push("fillText");
      texts.push({ text, font: ctx.font as string });
    });
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") return create(tag);
      canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: vi.fn((cb: (b: Blob | null) => void, type: string, quality: number) => {
          canvas.sizeAtBlob = [canvas.width, canvas.height];
          order.push(`toBlob ${type} ${quality}`);
          cb(new Blob(["story"], { type }));
        }),
      };
      return canvas as never;
    });
    fonts.load.mockReset().mockImplementation(async () => {
      order.push("fonts.load");
      return [];
    });
    fonts.check.mockReset().mockReturnValue(true);
    Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
    bitmap.close.mockReset();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => bitmap),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const STRIP_BLOB = new Blob(["card"], { type: "image/jpeg" });

  it("1080×1920 JPEG 0.9, 카드 비트맵을 레이아웃 자리에 그리고 놓는다", async () => {
    const blob = await composeStory(STRIP_BLOB, "takesuaci.com/events/take-four");
    expect(blob.type).toBe("image/jpeg");
    expect(canvas.sizeAtBlob).toEqual([1080, 1920]);
    expect(createImageBitmap).toHaveBeenCalledWith(STRIP_BLOB);
    const { card } = storyLayout();
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, card.x, card.y, card.width, card.height);
    expect(order.at(-1)).toBe("toBlob image/jpeg 0.9");
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("글꼴을 다 받은 뒤에 글자 — 제목·워드마크는 Fraunces, 해시태그·주소는 Gowun Batang", async () => {
    await composeStory(STRIP_BLOB, "takesuaci.com/events/take-four");
    expect(order.indexOf("fillText")).toBeGreaterThan(order.lastIndexOf("fonts.load"));
    expect(ctx.texts).toEqual([
      { text: "take four.", font: expect.stringMatching(/^italic 600 138px .*Fraunces/) },
      { text: "suaci", font: expect.stringMatching(/^700 45px .*Fraunces/) },
      { text: STORY_HASHTAG, font: expect.stringMatching(/^400 36px .*Gowun Batang/) },
      {
        text: "takesuaci.com/events/take-four",
        font: expect.stringMatching(/^400 36px .*Gowun Batang/),
      },
    ]);
    // 한글은 unicode-range 조각이라 그릴 글자로 받는다
    expect(fonts.load).toHaveBeenCalledWith(
      expect.stringContaining("Gowun Batang"),
      expect.stringContaining(STORY_HASHTAG),
    );
  });

  it("대체 글꼴이 없는 폰(안드로이드) → 받기·확인엔 웹 글꼴만, 그리기엔 전체 목록", async () => {
    const root = document.documentElement.style;
    root.setProperty("--font-fraunces", "'Fraunces', 'Fraunces Fallback'");
    root.setProperty("--font-gowun-batang", "'Gowun Batang', 'Gowun Batang Fallback'");
    fonts.load.mockImplementation(async (font: string) => {
      if (font.includes("Fallback")) throw new Error("NetworkError");
      return [];
    });
    fonts.check.mockImplementation((font: string) => !font.includes("Fallback"));
    try {
      await composeStory(STRIP_BLOB, "x");
      const loaded = fonts.load.mock.calls.map(([font]) => font as string);
      expect(loaded.every((font) => /'(Fraunces|Gowun Batang)'$/.test(font))).toBe(true);
      expect(ctx.texts.map((t) => t.font)).toEqual([
        expect.stringContaining("'Fraunces', 'Fraunces Fallback', serif"),
        expect.stringContaining("'Fraunces', 'Fraunces Fallback', serif"),
        expect.stringContaining("'Gowun Batang', 'Gowun Batang Fallback', serif"),
        expect.stringContaining("'Gowun Batang', 'Gowun Batang Fallback', serif"),
      ]);
    } finally {
      root.removeProperty("--font-fraunces");
      root.removeProperty("--font-gowun-batang");
    }
  });

  it("글꼴을 못 받음 → 기본 글꼴로 그리지 않고 던진다", async () => {
    fonts.check.mockImplementation((font: string) => !font.includes("Gowun"));
    await expect(composeStory(STRIP_BLOB, "x")).rejects.toThrow(/글꼴/);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});
