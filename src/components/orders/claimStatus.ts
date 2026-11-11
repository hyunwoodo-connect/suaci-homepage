import type { BadgeTone } from "@/components/ui/Badge";
import type { Claim, ClaimStatus, ClaimStatusByType, ClaimType, RefundStatus } from "@/types";

/** 환불 단계의 색 — 환불 진행(서버 재시도 포함)은 진행 중, 환불 끝은 닫힌 회색 */
const REFUND_TONE = {
  refunding: "neutral",
  refund_failed: "neutral",
  refunded: "muted",
} as const satisfies Record<RefundStatus, BadgeTone>;

/**
 * 클레임 뱃지 색 — 종류마다 가질 수 있는 상태가 달라(메시지 `claims.status.{type}.{status}`) 색도 종류별로 둔다.
 * 신청·진행은 진행 중, 철회·기한 지남은 닫힌 회색, 거절만 빨강. 교환 완료는 새 제품을 받은 것이라 배송완료와 같은 '잘 끝남'
 */
const CLAIM_STATUS_TONE = {
  cancel: REFUND_TONE,
  compensation: REFUND_TONE,
  return: {
    requested: "neutral",
    ...REFUND_TONE,
    withdrawn: "muted",
    expired: "muted",
    rejected: "problem",
  },
  exchange: {
    requested: "neutral",
    received: "neutral",
    shipped: "neutral",
    completed: "done",
    withdrawn: "muted",
    rejected: "problem",
  },
} as const satisfies { [T in ClaimType]: Record<ClaimStatusByType[T], BadgeTone> };

/** 메시지 `claims` 아래 상태 이름 키 — 그 종류에 있는 상태만(없는 짝의 문구는 두지 않는다) */
export type ClaimStatusKey = {
  [T in ClaimType]: `status.${T}.${ClaimStatusByType[T]}`;
}[ClaimType];

/** 클레임 뱃지 색. 종류에 없는 상태(서버가 새 상태를 먼저 내보낸 때)면 진행 중 색 */
export function claimStatusTone(c: Pick<Claim, "type" | "status">): BadgeTone {
  const tones: Partial<Record<ClaimStatus, BadgeTone>> = CLAIM_STATUS_TONE[c.type];
  return tones[c.status] ?? "neutral";
}

/** 클레임 상태 이름의 메시지 키(`claims.status.{type}.{status}`) — 백엔드가 종류에 맞는 상태만 준다 */
export function claimStatusKey(c: Pick<Claim, "type" | "status">): ClaimStatusKey {
  return `status.${c.type}.${c.status}` as ClaimStatusKey;
}
