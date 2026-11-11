import { afterEach, describe, expect, it, vi } from "vitest";

import { clearSavedMemo, readSavedMemo, saveMemo } from "./memo";

describe("배송 메모 저장", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("저장한 적 없으면 → null", () => {
    expect(readSavedMemo()).toBeNull();
  });

  it("칩 메모를 저장 → 그대로 읽히고 직접 쓴 메모가 아니다", () => {
    saveMemo("경비실에 맡겨 주세요");
    expect(readSavedMemo()).toEqual({ memo: "경비실에 맡겨 주세요", isCustom: false });
  });

  it("예전 칩 값('문 앞') → 지금 문장으로, 칩으로 다시 골라진다", () => {
    localStorage.setItem("suaci.checkout.memo", "문 앞");
    expect(readSavedMemo()).toEqual({ memo: "문 앞에 놓아 주세요", isCustom: false });
  });

  it("직접 쓴 메모 → 쓴 그대로, 직접 입력 칸으로", () => {
    saveMemo("벨 누르지 말아 주세요");
    expect(readSavedMemo()).toEqual({ memo: "벨 누르지 말아 주세요", isCustom: true });
  });

  it("지우면(회원 탈퇴) → 다시 null", () => {
    saveMemo("벨 누르지 말아 주세요");
    clearSavedMemo();
    expect(readSavedMemo()).toBeNull();
  });

  it("저장소가 막혔으면(시크릿 모드 등) → 읽기는 null, 저장은 조용히 넘어간다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readSavedMemo()).toBeNull();
    expect(() => saveMemo("문 앞에 놓아 주세요")).not.toThrow();
  });
});
