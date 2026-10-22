import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { FONT_TIMEOUT_MS } from "../canvas";
import { composeStrip, drawCard } from "./compose";
import { CARD, cardLayout } from "./layout";

// 2026-10-22 23:30 UTC = 10-23 08:30 KST
const LATE_UTC = new Date("2026-10-22T23:30:00Z");

interface FakeCanvas {
  width: number;
  height: number;
  /** toBlob 순간의 크기(그 뒤엔 메모리를 돌려주려 0으로 줄인다) */
  sizeAtBlob?: [number, number];
  ctx: Record<string, unknown> & { calls: string[] };
  toBlob: ReturnType<typeof vi.fn>;
}

let canvases: FakeCanvas[] = [];
let blobResult: Blob | null = new Blob(["jpg"], { type: "image/jpeg" });
const fonts = { load: vi.fn(), check: vi.fn() };
/** 글꼴 받기가 끝났는지(글자를 그리는 순간 값을 남긴다) */
let areFontsReady = false;

/** 그리기 호출을 이름으로 쌓는 2d 문맥. 마지막 font 값도 같이 남긴다 */
function fakeContext() {
  const calls: string[] = [];
  const texts: { text: string; font: string; areFontsReady: boolean }[] = [];
  const ctx: Record<string, unknown> & { calls: string[]; texts: typeof texts } = {
    calls,
    texts,
    font: "",
  };
  for (const name of [
    "fillRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "closePath",
    "stroke",
    "fill",
    "drawImage",
    "save",
    "restore",
    "translate",
    "rotate",
  ]) {
    ctx[name] = vi.fn(() => calls.push(name));
  }
  ctx.getImageData = vi.fn((x: number, y: number, w: number, h: number) => {
    calls.push("getImageData");
    return { data: new Uint8ClampedArray([128, 128, 128, 255]), x, y, w, h };
  });
  ctx.putImageData = vi.fn(() => calls.push("putImageData"));
  ctx.fillText = vi.fn((text: string) => {
    calls.push("fillText");
    texts.push({ text, font: ctx.font as string, areFontsReady });
  });
  return ctx;
}

function frame() {
  return { width: 960, height: 960 } as HTMLCanvasElement;
}

beforeEach(() => {
  canvases = [];
  blobResult = new Blob(["jpg"], { type: "image/jpeg" });
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag !== "canvas") return create(tag);
    const ctx = fakeContext();
    const canvas: FakeCanvas & { getContext: () => unknown } = {
      width: 0,
      height: 0,
      ctx,
      getContext: () => ctx,
      toBlob: vi.fn((cb: (b: Blob | null) => void) => {
        canvas.sizeAtBlob = [canvas.width, canvas.height];
        cb(blobResult);
      }),
    };
    canvases.push(canvas);
    return canvas as never;
  });
  fonts.load.mockReset().mockResolvedValue([]);
  fonts.check.mockReset().mockReturnValue(true);
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
  document.documentElement.style.setProperty("--font-fraunces", "'Fraunces', 'Fraunces Fallback'");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("--font-fraunces");
});

const FRAMES = () => [frame(), frame(), frame(), frame()];

function textsOf(canvas: FakeCanvas) {
  return (
    canvas.ctx as unknown as { texts: { text: string; font: string; areFontsReady: boolean }[] }
  ).texts;
}

describe("composeStrip", () => {
  it("1080×1350 캔버스에 네 장을 칸마다 그리고 JPEG 0.9로, 다 쓰면 캔버스를 비운다", async () => {
    const blob = await composeStrip(FRAMES(), LATE_UTC);
    expect(blob).toBe(blobResult);
    const [canvas] = canvases;
    expect(canvas.sizeAtBlob).toEqual([CARD.width, CARD.height]);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    const draws = vi.mocked(canvas.ctx.drawImage as () => void).mock.calls as unknown[][];
    expect(draws).toHaveLength(4);
    const { cells } = cardLayout();
    draws.forEach((args, i) => {
      expect(args.slice(5)).toEqual([cells[i].x, cells[i].y, cells[i].width, cells[i].height]);
    });
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
  });

  it("사진 → 칸마다 시안 톤을 픽셀에 건다(칸 자리 그대로)", async () => {
    await composeStrip(FRAMES(), LATE_UTC);
    const { ctx } = canvases[0];
    const reads = vi.mocked(ctx.getImageData as () => { data: Uint8ClampedArray }).mock.results;
    expect(reads).toHaveLength(4);
    // 가운데 회색 128 → 133(톤 계산은 tone.test)
    expect(Array.from(reads[0].value.data)).toEqual([133, 133, 133, 255]);
    const { cells } = cardLayout();
    const puts = vi.mocked(ctx.putImageData as () => void).mock.calls as unknown[][];
    puts.forEach((args, i) => expect(args.slice(1)).toEqual([cells[i].x, cells[i].y]));
  });

  it("글꼴 → Fraunces(이탤릭·바로 선)를 받은 뒤에 가장자리 글자를 그린다", async () => {
    areFontsReady = false;
    fonts.load.mockImplementation(async () => {
      await Promise.resolve();
      areFontsReady = true;
      return [];
    });
    await composeStrip(FRAMES(), LATE_UTC);
    const loaded = fonts.load.mock.calls.map(([font]) => font as string);
    expect(loaded).toEqual([
      expect.stringMatching(/^italic 400 20px 'Fraunces'$/),
      expect.stringMatching(/^400 20px 'Fraunces'$/),
    ]);
    const texts = textsOf(canvases[0]);
    expect(texts.every((t) => t.areFontsReady)).toBe(true);
    for (const { font } of texts) expect(font).toContain("'Fraunces'");
  });

  it("가장자리 글자 → 칸마다 take four. · 번호 · suaci · ▲ 번호(▲는 도형)", async () => {
    await composeStrip(FRAMES(), LATE_UTC);
    const texts = textsOf(canvases[0]).map((t) => t.text);
    expect(texts).toHaveLength(16);
    const first = texts.slice(0, 4);
    expect(first[0]).toBe("take four.");
    expect(first[2]).toBe("suaci");
    expect(Number(first[1])).toBe(Number(first[3]) + 17);
    expect(canvases[0].ctx.calls.filter((c) => c === "fill")).toHaveLength(4);
  });

  it("대체 글꼴이 없는 폰(안드로이드) → 받기·확인엔 웹 글꼴만, 그리기엔 전체 목록", async () => {
    // 'Fraunces Fallback'은 local(Times New Roman)이라 그 글꼴이 없으면 목록째 load()가 거절된다
    fonts.load.mockImplementation(async (font: string) => {
      if (font.includes("Fallback")) throw new Error("NetworkError");
      return [];
    });
    fonts.check.mockImplementation((font: string) => !font.includes("Fallback"));
    await composeStrip(FRAMES(), LATE_UTC);
    for (const [font] of fonts.load.mock.calls) expect(font).toMatch(/'Fraunces'$/);
    for (const { font } of textsOf(canvases[0]))
      expect(font).toContain("'Fraunces', 'Fraunces Fallback', serif");
  });

  it("글꼴이 끝내 안 옴 → 12초 뒤 실패, 기본 글꼴로 그리지 않는다", async () => {
    vi.useFakeTimers();
    fonts.load.mockReturnValue(new Promise(() => {}));
    const done = composeStrip(FRAMES(), LATE_UTC);
    const outcome = expect(done).rejects.toThrow(/글꼴/);
    expect(FONT_TIMEOUT_MS).toBe(12_000);
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS);
    await outcome;
    expect(canvases).toHaveLength(0);
  });

  it("글꼴 받기는 끝났지만 check가 false → 실패", async () => {
    fonts.check.mockReturnValue(false);
    await expect(composeStrip(FRAMES(), LATE_UTC)).rejects.toThrow(/글꼴/);
    expect(canvases).toHaveLength(0);
  });

  it("toBlob이 null → 실패로 던진다", async () => {
    blobResult = null;
    await expect(composeStrip(FRAMES(), LATE_UTC)).rejects.toThrow();
  });
});

describe("drawCard", () => {
  it("글자 없이(현상 미리보기, 글꼴 전) → 사진만, 글자는 안 그린다", () => {
    const canvas = document.createElement("canvas") as unknown as FakeCanvas;
    drawCard(canvas as unknown as HTMLCanvasElement, FRAMES(), LATE_UTC, false);
    expect([canvas.width, canvas.height]).toEqual([CARD.width, CARD.height]);
    expect(canvas.ctx.calls.filter((c) => c === "drawImage")).toHaveLength(4);
    expect(canvas.ctx.calls).not.toContain("fillText");
  });

  it("글자까지 → 저장 카드와 같은 그리기", async () => {
    const preview = document.createElement("canvas") as unknown as FakeCanvas;
    drawCard(preview as unknown as HTMLCanvasElement, FRAMES(), LATE_UTC, true);
    await composeStrip(FRAMES(), LATE_UTC);
    expect(canvases[1].ctx.calls).toEqual(preview.ctx.calls);
    expect(textsOf(canvases[1]).map((t) => t.text)).toEqual(textsOf(preview).map((t) => t.text));
  });
});
