import { useState } from "react";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCloseOnBack } from "./useCloseOnBack";

/** 시트 칸이 위에 있나 */
const onSheetEntry = () =>
  typeof window.history.state === "object" &&
  window.history.state !== null &&
  "suaciSheet" in window.history.state;

/** 닫으면 정말 닫히는 시트 하나. setIsOpen 은 시트 안 버튼처럼 hook 을 거치지 않고 닫는 길 */
function useSheet(onClosed: () => void) {
  const [isOpen, setIsOpen] = useState(true);
  const close = useCloseOnBack(isOpen, () => {
    onClosed();
    setIsOpen(false);
  });
  return { isOpen, close, setIsOpen };
}

describe("useCloseOnBack", () => {
  beforeEach(() => {
    // 앞 테스트가 남긴 시트 칸 위에서 시작하지 않게 새 칸에서
    window.history.pushState({ page: true }, "");
  });
  afterEach(async () => {
    // 닫힌 시트가 칸을 걷는 뒤로가기(한 틱 뒤)가 다음 테스트로 새지 않게 기다린다
    cleanup();
    await new Promise((r) => setTimeout(r, 30));
    vi.restoreAllMocks();
  });

  it("열면 같은 주소에 시트 칸을 하나 쌓는다", () => {
    const before = window.history.length;
    renderHook(() => useCloseOnBack(true, () => {}));
    expect(window.history.length).toBe(before + 1);
    expect(onSheetEntry()).toBe(true);
  });

  it("닫혀 있으면 → 쌓지 않는다", () => {
    const before = window.history.length;
    renderHook(() => useCloseOnBack(false, () => {}));
    expect(window.history.length).toBe(before);
  });

  it("뒤로가기(popstate) → 닫히고 시트 칸이 빠진다", async () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useSheet(onClosed));
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(result.current.isOpen).toBe(false));
    expect(onClosed).toHaveBeenCalledOnce();
    expect(onSheetEntry()).toBe(false);
  });

  it("close(X·바깥·Esc) → 바로 onClose, 쌓은 칸은 걷어 내고 그 뒤로가기로 두 번 닫지 않는다", async () => {
    const onClosed = vi.fn();
    const back = vi.spyOn(window.history, "back");
    const { result } = renderHook(() => useSheet(onClosed));
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    await waitFor(() => expect(onSheetEntry()).toBe(false));
    expect(back).toHaveBeenCalledOnce();
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("닫기를 거절해(보내는 중) 열린 채면 → 뒤로가기 뒤에 칸을 다시 쌓는다", async () => {
    const onClose = vi.fn();
    renderHook(() => useCloseOnBack(true, onClose));
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    await waitFor(() => expect(onSheetEntry()).toBe(true));
  });

  it("시트 안 버튼처럼 hook 을 거치지 않고 닫아도(열림 false) → 쌓은 칸을 걷어 낸다", async () => {
    const { result } = renderHook(() => useSheet(() => {}));
    expect(onSheetEntry()).toBe(true);
    act(() => {
      result.current.setIsOpen(false);
    });
    await waitFor(() => expect(onSheetEntry()).toBe(false));
  });

  it("열린 채 사라지면(언마운트) → 쌓은 칸을 걷어 낸다", async () => {
    const { unmount } = renderHook(() => useCloseOnBack(true, () => {}));
    expect(onSheetEntry()).toBe(true);
    unmount();
    await waitFor(() => expect(onSheetEntry()).toBe(false));
  });

  it("StrictMode 두 번 마운트 → 칸은 하나, 저절로 닫히지 않는다", async () => {
    const before = window.history.length;
    const onClosed = vi.fn();
    const { result } = renderHook(() => useSheet(onClosed), { reactStrictMode: true });
    expect(window.history.length).toBe(before + 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.isOpen).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
    expect(onSheetEntry()).toBe(true);
  });

  it("닫자마자 다시 열어도 → 걷어 낸 칸의 뒤로가기에 새 시트가 닫히지 않고, 칸을 다시 쌓는다", async () => {
    const first = renderHook(() => useCloseOnBack(true, () => {}));
    first.unmount();
    const onClosed = vi.fn();
    const { result } = renderHook(() => useSheet(onClosed));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(result.current.isOpen).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
    expect(onSheetEntry()).toBe(true);
  });
});
