import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { downloadBlob, pickShareFiles, shareOrDownload, shareStoryOrDownload } from "./share";

const BLOB = new Blob(["x"], { type: "image/jpeg" });

let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
  URL.createObjectURL = vi.fn(() => "blob:strip");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubShare(canShare: boolean, share: () => Promise<void>) {
  vi.stubGlobal("navigator", {
    ...navigator,
    canShare: vi.fn(() => canShare),
    share: vi.fn(share),
  });
}

describe("shareOrDownload", () => {
  it("파일 공유 됨 → 공유 시트에 파일 하나, shared", async () => {
    stubShare(true, async () => {});
    await expect(shareOrDownload(BLOB, "take-four-1022.jpg")).resolves.toBe("shared");
    const [data] = vi.mocked(navigator.share).mock.calls[0] as [ShareData];
    expect(data.files?.[0].name).toBe("take-four-1022.jpg");
    expect(data.files?.[0].type).toBe("image/jpeg");
    expect(clicked).toHaveLength(0);
  });

  it("공유 시트를 닫음(AbortError) → cancelled, 내려받지 않는다", async () => {
    stubShare(true, () => Promise.reject(new DOMException("닫음", "AbortError")));
    await expect(shareOrDownload(BLOB, "a.jpg")).resolves.toBe("cancelled");
    expect(clicked).toHaveLength(0);
  });

  it("앞선 공유가 아직 열려 있음(InvalidStateError) → cancelled, 내려받지 않는다", async () => {
    stubShare(true, () => Promise.reject(new DOMException("열려 있음", "InvalidStateError")));
    await expect(shareOrDownload(BLOB, "a.jpg")).resolves.toBe("cancelled");
    expect(clicked).toHaveLength(0);
  });

  it("공유가 다른 이유로 실패 → 내려받기", async () => {
    stubShare(true, () => Promise.reject(new DOMException("막힘", "NotAllowedError")));
    await expect(shareOrDownload(BLOB, "a.jpg")).resolves.toBe("downloaded");
    expect(clicked).toHaveLength(1);
  });

  it("파일 공유 안 됨(PC 크롬) → <a download>로 내려받기", async () => {
    stubShare(false, async () => {});
    await expect(shareOrDownload(BLOB, "take-four-1022.jpg")).resolves.toBe("downloaded");
    expect(navigator.share).not.toHaveBeenCalled();
    expect(clicked[0].download).toBe("take-four-1022.jpg");
    expect(clicked[0].href).toBe("blob:strip");
  });

  it("canShare가 아예 없음 → 내려받기", async () => {
    vi.stubGlobal("navigator", { ...navigator, canShare: undefined, share: undefined });
    await expect(shareOrDownload(BLOB, "a.jpg")).resolves.toBe("downloaded");
    expect(clicked).toHaveLength(1);
  });
});

describe("downloadBlob", () => {
  it("내려받은 뒤 링크를 문서에서 뗀다", () => {
    downloadBlob(BLOB, "a.jpg");
    expect(clicked).toHaveLength(1);
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("shareStoryOrDownload", () => {
  const STORY = {
    blob: new Blob(["s"], { type: "image/jpeg" }),
    filename: "take-four-1022-story.jpg",
  };
  const STRIP = { blob: BLOB, filename: "take-four-1022.jpg" };

  function stubCanShare(canShare: (files: File[]) => boolean) {
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: vi.fn((data: ShareData) => canShare(data.files ?? [])),
      share: vi.fn(async () => {}),
    });
  }

  function sharedNames() {
    const [data] = vi.mocked(navigator.share).mock.calls[0] as [ShareData];
    return data.files?.map((f) => f.name);
  }

  it("두 파일 공유 됨 → 스토리·띠 둘 다", async () => {
    stubCanShare(() => true);
    await expect(shareStoryOrDownload(STORY, STRIP)).resolves.toBe("shared");
    expect(sharedNames()).toEqual(["take-four-1022-story.jpg", "take-four-1022.jpg"]);
  });

  it("한 파일만 공유 됨 → 스토리만", async () => {
    stubCanShare((files) => files.length === 1);
    await expect(shareStoryOrDownload(STORY, STRIP)).resolves.toBe("shared");
    expect(sharedNames()).toEqual(["take-four-1022-story.jpg"]);
  });

  it("파일 공유 안 됨 → 스토리를 내려받는다", async () => {
    stubCanShare(() => false);
    await expect(shareStoryOrDownload(STORY, STRIP)).resolves.toBe("downloaded");
    expect(navigator.share).not.toHaveBeenCalled();
    expect(clicked.map((a) => a.download)).toEqual(["take-four-1022-story.jpg"]);
  });

  it("canShare 없음 → pickShareFiles null", () => {
    vi.stubGlobal("navigator", { ...navigator, canShare: undefined });
    expect(pickShareFiles([[new File(["x"], "a.jpg")]])).toBeNull();
  });
});
