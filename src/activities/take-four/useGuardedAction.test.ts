import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useGuardedAction } from "./useGuardedAction";

describe("useGuardedAction", () => {
  it("도는 동안 다시 부르면 → 무시, 끝나면 다시 된다", async () => {
    let finish: () => void = () => {};
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useGuardedAction());
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run(action);
      void result.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isBusy).toBe(true);
    expect(result.current.isRunning()).toBe(true);
    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.isBusy).toBe(false);
    const next = vi.fn(async () => {});
    await act(async () => {
      await result.current.run(next);
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("행동이 던지면 → 잠금을 풀고 그대로 던진다", async () => {
    const { result } = renderHook(() => useGuardedAction());
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    });
    expect(result.current.isBusy).toBe(false);
    expect(result.current.isRunning()).toBe(false);
  });
});
