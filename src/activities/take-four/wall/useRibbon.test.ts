import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { hasRibbon, rememberRibbon } from "./local";
import { useRibbon } from "./useRibbon";

const api = vi.hoisted(() => ({ wallApi: { ribbon: vi.fn() } }));
vi.mock("./api", () => api);

const STRIP = { id: "01J", ribbons: 4 };

beforeEach(() => {
  api.wallApi.ribbon.mockReset();
});

describe("useRibbon", () => {
  it("누르면 바로 +1, 서버 수로 맞추고 이 폰에 기억", async () => {
    api.wallApi.ribbon.mockResolvedValue(9);
    const { result } = renderHook(() => useRibbon(STRIP));
    expect(result.current).toMatchObject({ count: 4, isOn: false });
    await act(async () => {
      await result.current.give();
    });
    expect(result.current).toMatchObject({ count: 9, isOn: true });
    expect(hasRibbon("01J")).toBe(true);
  });

  it("연타해도 한 번만 보낸다", async () => {
    let resolve: (n: number) => void = () => {};
    api.wallApi.ribbon.mockReturnValue(new Promise<number>((r) => (resolve = r)));
    const { result } = renderHook(() => useRibbon(STRIP));
    await act(async () => {
      void result.current.give();
      void result.current.give();
    });
    expect(result.current.count).toBe(5);
    await act(async () => resolve(5));
    expect(api.wallApi.ribbon).toHaveBeenCalledTimes(1);
  });

  it("실패 → 되돌리고 다시 누를 수 있다", async () => {
    api.wallApi.ribbon.mockRejectedValueOnce(new Error("net"));
    const { result } = renderHook(() => useRibbon(STRIP));
    await act(async () => {
      await result.current.give();
    });
    expect(result.current).toMatchObject({ count: 4, isOn: false });
    expect(hasRibbon("01J")).toBe(false);
    api.wallApi.ribbon.mockResolvedValueOnce(5);
    await act(async () => {
      await result.current.give();
    });
    expect(result.current).toMatchObject({ count: 5, isOn: true });
  });

  it("이미 단 네컷 → 켜진 채로, 눌러도 보내지 않는다", async () => {
    rememberRibbon("01J");
    const { result } = renderHook(() => useRibbon(STRIP));
    expect(result.current.isOn).toBe(true);
    await act(async () => {
      await result.current.give();
    });
    expect(api.wallApi.ribbon).not.toHaveBeenCalled();
    expect(result.current.count).toBe(4);
  });
});
