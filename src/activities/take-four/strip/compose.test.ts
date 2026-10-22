import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { FONT_TIMEOUT_MS, captionText, composeStrip, stripCaption, stripFilename } from "./compose";
import { STRIP, stripLayout } from "./layout";

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
    "arc",
  ]) {
    ctx[name] = vi.fn(() => calls.push(name));
  }
  ctx.fillText = vi.fn((text: string) => {
    calls.push("fillText");
    texts.push({ text, font: ctx.font as string, areFontsReady });
  });
  return ctx;
}

function frame() {
  return { width: 1280, height: 960 } as HTMLCanvasElement;
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

describe("stripCaption · captionText", () => {
  it.each(["upcoming", "live"] as const)("%s → No.01 표시, 번호는 no.----", (phase) => {
    const caption = stripCaption(phase, LATE_UTC, "No.01");
    expect(caption.eventLabel).toBe("No.01");
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "No.01 · 10.23" });
  });

  it("ended → 이벤트 표시 없이 날짜만", () => {
    const caption = stripCaption("ended", LATE_UTC, "No.01");
    expect(caption.eventLabel).toBeNull();
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "10.23" });
  });

  it("이벤트 내용이 없음(label null) → 진행 중이어도 이벤트 표시 없음", () => {
    const caption = stripCaption("live", LATE_UTC, null);
    expect(caption.eventLabel).toBeNull();
    expect(captionText(caption).meta).toBe("10.23");
  });

  it("파일 이름 → 한국 날짜", () => {
    expect(stripFilename(stripCaption("live", LATE_UTC, "No.01"))).toBe("take-four-1023.jpg");
  });
});

describe("composeStrip", () => {
  it("900×2659 캔버스에 네 장을 칸마다 그리고 JPEG 0.86으로, 다 쓰면 캔버스를 비운다", async () => {
    const blob = await composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("live", LATE_UTC, "No.01"),
    );
    expect(blob).toBe(blobResult);
    const [canvas] = canvases;
    expect(canvas.sizeAtBlob).toEqual([STRIP.width, STRIP.height]);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    const draws = vi.mocked(canvas.ctx.drawImage as () => void).mock.calls as unknown[][];
    expect(draws).toHaveLength(4);
    const cells = stripLayout().frames;
    draws.forEach((args, i) => {
      expect(args.slice(5)).toEqual([cells[i].x, cells[i].y, cells[i].width, cells[i].height]);
    });
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.86);
  });

  it("글꼴 → 쓰는 굵기마다 Fraunces를 받은 뒤에 글자를 그린다", async () => {
    areFontsReady = false;
    fonts.load.mockImplementation(async () => {
      await Promise.resolve();
      areFontsReady = true;
      return [];
    });
    await composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("live", LATE_UTC, "No.01"),
    );
    const ctx = canvases[0].ctx as unknown as {
      texts: { text: string; font: string; areFontsReady: boolean }[];
    };
    const loaded = fonts.load.mock.calls.map(([font]) => font as string);
    expect(loaded).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^700 .*'Fraunces'/),
        expect.stringMatching(/^500 .*'Fraunces'/),
        expect.stringMatching(/^italic 600 .*'Fraunces'/),
      ]),
    );
    expect(ctx.texts.every((t) => t.areFontsReady)).toBe(true);
    expect(ctx.texts.map((t) => t.text)).toEqual(["no.----", "No.01 · 10.23", "No.01"]);
    for (const { font } of ctx.texts) expect(font).toContain("'Fraunces'");
  });

  it("대체 글꼴이 없는 폰(안드로이드) → 받기·확인엔 웹 글꼴만, 그리기엔 전체 목록", async () => {
    // 'Fraunces Fallback'은 local(Times New Roman)이라 그 글꼴이 없으면 목록째 load()가 거절된다
    fonts.load.mockImplementation(async (font: string) => {
      if (font.includes("Fallback")) throw new Error("NetworkError");
      return [];
    });
    fonts.check.mockImplementation((font: string) => !font.includes("Fallback"));
    await composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("live", LATE_UTC, "No.01"),
    );
    for (const [font] of fonts.load.mock.calls) expect(font).toMatch(/'Fraunces'$/);
    const ctx = canvases[0].ctx as unknown as { texts: { font: string }[] };
    for (const { font } of ctx.texts)
      expect(font).toContain("'Fraunces', 'Fraunces Fallback', serif");
  });

  it("이벤트 끝남 → 도장 없이 날짜만", async () => {
    await composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("ended", LATE_UTC, "No.01"),
    );
    const ctx = canvases[0].ctx as unknown as { texts: { text: string }[]; calls: string[] };
    expect(ctx.texts.map((t) => t.text)).toEqual(["no.----", "10.23"]);
    expect(ctx.calls).not.toContain("arc");
  });

  it("글꼴이 끝내 안 옴 → 12초 뒤 실패, 기본 글꼴로 그리지 않는다", async () => {
    vi.useFakeTimers();
    fonts.load.mockReturnValue(new Promise(() => {}));
    const done = composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("live", LATE_UTC, "No.01"),
    );
    const outcome = expect(done).rejects.toThrow(/글꼴/);
    expect(FONT_TIMEOUT_MS).toBe(12_000);
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS);
    await outcome;
    expect(canvases).toHaveLength(0);
  });

  it("글꼴 받기는 끝났지만 check가 false → 실패", async () => {
    fonts.check.mockReturnValue(false);
    await expect(
      composeStrip([frame(), frame(), frame(), frame()], stripCaption("live", LATE_UTC, "No.01")),
    ).rejects.toThrow(/글꼴/);
    expect(canvases).toHaveLength(0);
  });

  it("toBlob이 null → 실패로 던진다", async () => {
    blobResult = null;
    await expect(
      composeStrip([frame(), frame(), frame(), frame()], stripCaption("live", LATE_UTC, "No.01")),
    ).rejects.toThrow();
  });
});
