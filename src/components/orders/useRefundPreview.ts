"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { RefundPreview, RefundPreviewRequest } from "@/types";

/** 입력이 이 시간 안에 또 바뀌면(수량 단추 연타) 잦아들 때까지 기다렸다가 마지막 것만 묻는다 */
const DEBOUNCE_MS = 250;

/**
 * 환불 금액 미리 보기의 상태.
 *  - idle: 물을 것이 없다(고른 수량이 없거나 반품 사유를 아직 안 골랐다)
 *  - loading: 묻는 중. `last` 는 바로 앞에 받은 금액 — 숫자는 보이지 않고, 같은 줄 수로 자리만 잡는다(칸이 튀지 않게)
 *  - loaded: 지금 고른 대로 신청하면 서버가 돌려주는 금액
 *  - failed: 못 받았다. `error` 는 던져진 그대로(서버 거절이면 `ApiClientError`) — 화면이 보고 문구를 고른다
 */
export type RefundPreviewState =
  | { status: "idle" }
  | { status: "loading"; last: RefundPreview | null }
  | { status: "loaded"; preview: RefundPreview }
  | { status: "failed"; error: unknown };

/** 마지막으로 끝난 요청. `key` 가 지금 요청과 다르면 지난 답이다. 실패여도 앞에 받은 금액(`preview`)은 남긴다(줄 자리) */
type Settled =
  | { key: string; ok: true; preview: RefundPreview }
  | { key: string; ok: false; error: unknown; preview: RefundPreview | null };

/**
 * 취소·반품 폼의 환불 금액 — 화면이 셈하지 않고 서버에 묻는다(`api.previewRefund`, 신청을 만들 때와 같은 계산).
 * `input` 이 바뀔 때마다 다시 묻고, 늦게 온 지난 답은 버린다. `input` 이 null 이면 묻지 않는다.
 * `retry` 는 같은 입력으로 다시 묻는다(실패한 뒤, 또는 주문이 바뀌었을 수 있을 때).
 */
export function useRefundPreview(
  orderId: string,
  input: RefundPreviewRequest | null,
): { state: RefundPreviewState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  // 입력 객체는 렌더마다 새로 만들어진다 — 내용이 같으면 같은 요청으로 본다
  const body = input === null ? null : JSON.stringify(input);
  const requestKey = body === null ? null : `${orderId}#${attempt}#${body}`;
  const lastChange = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (body === null || requestKey === null) return;
    let isStale = false;
    // 띄엄띄엄 바뀌면(폼을 엶·사유 고름·다시 시도) 바로 묻고, 연달아 바뀔 때만 기다린다.
    // 같은 요청으로 effect 가 다시 도는 것(개발 모드 StrictMode)은 바뀐 것이 아니다
    const now = Date.now();
    const prev = lastChange.current;
    const isRapid = prev !== null && prev.key !== requestKey && now - prev.at < DEBOUNCE_MS;
    lastChange.current = { key: requestKey, at: now };
    const wait = isRapid ? DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      const request = JSON.parse(body) as RefundPreviewRequest;
      api.previewRefund(orderId, request).then(
        (preview) => {
          if (!isStale) setSettled({ key: requestKey, ok: true, preview });
        },
        (error: unknown) => {
          if (isStale) return;
          setSettled((prev) => ({
            key: requestKey,
            ok: false,
            error,
            preview: prev?.preview ?? null,
          }));
        },
      );
    }, wait);
    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [orderId, body, requestKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state: stateOf(requestKey, settled), retry };
}

/* ─── 내부 ─────────────────────────── */

function stateOf(requestKey: string | null, settled: Settled | null): RefundPreviewState {
  if (requestKey === null) return { status: "idle" };
  if (settled?.key !== requestKey) return { status: "loading", last: settled?.preview ?? null };
  if (!settled.ok) return { status: "failed", error: settled.error };
  return { status: "loaded", preview: settled.preview };
}
