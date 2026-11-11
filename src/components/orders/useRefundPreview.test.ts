import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RefundPreview, RefundPreviewRequest } from "@/types";

const { previewRefund } = vi.hoisted(() => ({ previewRefund: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { previewRefund } }));

import { useRefundPreview } from "./useRefundPreview";

const previewOf = (refundAmount: number): RefundPreview => ({
  itemsAmount: refundAmount,
  refundedShipping: 0,
  returnShippingFee: 0,
  priorCompensation: 0,
  refundAmount,
});

/** 취소 미리 보기 입력 — 수량을 주면 그 줄만, 안 주면 남은 수량 전부 */
const cancelOf = (quantity?: number): RefundPreviewRequest => ({
  type: "cancel",
  reasonCode: "기타",
  lines: quantity === undefined ? undefined : [{ lineId: "l1", quantity }],
});

function renderPreview(input: RefundPreviewRequest | null) {
  return renderHook(
    (props: { input: RefundPreviewRequest | null }) => useRefundPreview("o1", props.input),
    { initialProps: { input } },
  );
}

/** 시간을 흘려 기다리던 요청을 보내고, 온 답을 상태에 반영한다 */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useRefundPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("물을 것이 없으면(null) → idle, 요청하지 않는다", async () => {
    const { result } = renderPreview(null);
    await tick(1000);
    expect(result.current.state).toEqual({ status: "idle" });
    expect(previewRefund).not.toHaveBeenCalled();
  });

  it("입력이 생기면 → 기다리지 않고 묻고(loading), 답이 오면 그 금액(loaded)", async () => {
    previewRefund.mockResolvedValue(previewOf(31000));
    const { result } = renderPreview(cancelOf());
    expect(result.current.state).toEqual({ status: "loading", last: null });
    await tick();
    expect(previewRefund).toHaveBeenCalledWith("o1", { type: "cancel", reasonCode: "기타" });
    expect(result.current.state).toEqual({ status: "loaded", preview: previewOf(31000) });
  });

  it("연달아 바뀌면 → 잦아든 뒤 마지막 입력만 묻고, 그동안은 앞 금액을 last 로 든 loading", async () => {
    previewRefund.mockResolvedValue(previewOf(31000));
    const { result, rerender } = renderPreview(cancelOf());
    await tick(1000);
    rerender({ input: cancelOf(1) });
    rerender({ input: cancelOf(2) });
    rerender({ input: cancelOf(3) });
    expect(result.current.state).toEqual({ status: "loading", last: previewOf(31000) });
    await tick(249);
    expect(previewRefund).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(previewRefund).toHaveBeenCalledTimes(2);
    expect(previewRefund).toHaveBeenLastCalledWith("o1", cancelOf(3));
  });

  it("앞 요청의 답이 늦게 와도 → 버리고 지금 입력의 금액만 보인다", async () => {
    let answerFirst: (preview: RefundPreview) => void = () => undefined;
    previewRefund
      .mockImplementationOnce(() => new Promise<RefundPreview>((r) => (answerFirst = r)))
      .mockResolvedValueOnce(previewOf(28000));
    const { result, rerender } = renderPreview(cancelOf());
    await tick(1000);
    rerender({ input: cancelOf(1) });
    await tick();
    expect(result.current.state).toEqual({ status: "loaded", preview: previewOf(28000) });
    await act(async () => answerFirst(previewOf(59000)));
    expect(result.current.state).toEqual({ status: "loaded", preview: previewOf(28000) });
  });

  it("못 받으면 → failed(던져진 오류 그대로), retry 하면 같은 입력으로 다시 묻는다", async () => {
    const boom = new TypeError("Failed to fetch");
    previewRefund.mockRejectedValueOnce(boom).mockResolvedValueOnce(previewOf(31000));
    const { result } = renderPreview(cancelOf(1));
    await tick();
    expect(result.current.state).toEqual({ status: "failed", error: boom });
    act(() => result.current.retry());
    expect(result.current.state.status).toBe("loading");
    await tick(1000);
    expect(previewRefund).toHaveBeenCalledTimes(2);
    expect(previewRefund).toHaveBeenLastCalledWith("o1", cancelOf(1));
    expect(result.current.state).toEqual({ status: "loaded", preview: previewOf(31000) });
  });

  it("고른 것이 없어지면(null) → idle 로 돌아가고, 기다리던 요청은 보내지 않는다", async () => {
    previewRefund.mockResolvedValue(previewOf(31000));
    const { result, rerender } = renderPreview(cancelOf());
    await tick(1000);
    rerender({ input: cancelOf(1) });
    rerender({ input: null });
    await tick(1000);
    expect(result.current.state).toEqual({ status: "idle" });
    expect(previewRefund).toHaveBeenCalledTimes(1);
  });
});
