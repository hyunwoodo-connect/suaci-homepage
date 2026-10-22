import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import {
  FONT_TIMEOUT_MS,
  captionText,
  composeStrip,
  kstDateLabel,
  stripCaption,
  stripFilename,
} from "./compose";
import { STRIP, stripLayout } from "./layout";

// 2026-10-22 23:30 UTC = 10-23 08:30 KST
const LATE_UTC = new Date("2026-10-22T23:30:00Z");

interface FakeCanvas {
  width: number;
  height: number;
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
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blobResult)),
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

describe("kstDateLabel", () => {
  it("UTC로 전날 밤이어도 → 한국 날짜", () => {
    expect(kstDateLabel(LATE_UTC)).toBe("10.23");
  });

  it("한 자리 달·날 → 0을 채운다", () => {
    expect(kstDateLabel(new Date("2027-01-05T03:00:00Z"))).toBe("01.05");
  });
});

describe("stripCaption · captionText", () => {
  it.each(["upcoming", "live"] as const)("%s → No.01 표시, 번호는 no.----", (phase) => {
    const caption = stripCaption(phase, LATE_UTC);
    expect(caption.eventLabel).toBe("No.01");
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "No.01 · 10.23" });
  });

  it("ended → 이벤트 표시 없이 날짜만", () => {
    const caption = stripCaption("ended", LATE_UTC);
    expect(caption.eventLabel).toBeNull();
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "10.23" });
  });

  it("파일 이름 → 한국 날짜", () => {
    expect(stripFilename(stripCaption("live", LATE_UTC))).toBe("take-four-1023.jpg");
  });
});

describe("composeStrip", () => {
  it("900×2970 캔버스에 네 장을 칸마다 그리고 JPEG 0.86으로", async () => {
    const blob = await composeStrip(
      [frame(), frame(), frame(), frame()],
      stripCaption("live", LATE_UTC),
    );
    expect(blob).toBe(blobResult);
    const [canvas] = canvases;
    expect([canvas.width, canvas.height]).toEqual([STRIP.width, STRIP.height]);
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
    await composeStrip([frame(), frame(), frame(), frame()], stripCaption("live", LATE_UTC));
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

  it("이벤트 끝남 → 도장 없이 날짜만", async () => {
    await composeStrip([frame(), frame(), frame(), frame()], stripCaption("ended", LATE_UTC));
    const ctx = canvases[0].ctx as unknown as { texts: { text: string }[]; calls: string[] };
    expect(ctx.texts.map((t) => t.text)).toEqual(["no.----", "10.23"]);
    expect(ctx.calls).not.toContain("arc");
  });

  it("글꼴이 끝내 안 옴 → 시간 한도 뒤 그대로 합성하고 경고", async () => {
    vi.useFakeTimers();
    fonts.load.mockReturnValue(new Promise(() => {}));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const done = composeStrip([frame(), frame(), frame(), frame()], stripCaption("live", LATE_UTC));
    await vi.advanceTimersByTimeAsync(FONT_TIMEOUT_MS);
    await expect(done).resolves.toBe(blobResult);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("toBlob이 null → 실패로 던진다", async () => {
    blobResult = null;
    await expect(
      composeStrip([frame(), frame(), frame(), frame()], stripCaption("live", LATE_UTC)),
    ).rejects.toThrow();
  });
});
