"use client";

import { useState } from "react";

import type { Order } from "@/types";

/** 신청 범위 — 남은 수량 전부 / 줄마다 고른 수량 */
export type ClaimScope = "full" | "partial";

/**
 * 취소·반품·교환 폼의 범위·줄 수량 고르기. 줄 수량은 남은 수량(`left`)까지만.
 * `lines` 는 API 에 그대로 보낸다 — 전부면 undefined(서버가 남은 수량 전부로 읽는다)
 */
export function useLineSelection(
  order: Order,
  left: Record<string, number>,
): {
  scope: ClaimScope;
  setScope: (s: ClaimScope) => void;
  qty: Record<string, number>;
  setLineQty: (lineId: string, n: number) => void;
  lines: { lineId: string; quantity: number }[] | undefined;
  /** 일부를 골랐는데 아무 줄도 안 고름 — 보내지 않는다 */
  partialEmpty: boolean;
} {
  const [scope, setScope] = useState<ClaimScope>("full");
  // lineId → 고른 수량 (0 = 안 고름)
  const [qty, setQty] = useState<Record<string, number>>({});

  const setLineQty = (lineId: string, n: number) => {
    setQty((prev) => ({ ...prev, [lineId]: Math.max(0, Math.min(left[lineId] ?? 0, n)) }));
  };

  const picked = order.items
    .map((it) => ({ lineId: it.lineId, quantity: qty[it.lineId] ?? 0 }))
    .filter((l) => l.quantity > 0);

  return {
    scope,
    setScope,
    qty,
    setLineQty,
    lines: scope === "partial" ? picked : undefined,
    partialEmpty: scope === "partial" && picked.length === 0,
  };
}
