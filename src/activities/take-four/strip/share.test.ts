import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { downloadBlob, shareOrDownload } from "./share";

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
