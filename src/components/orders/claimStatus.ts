import type { BadgeTone } from "@/components/ui/Badge";
import type { ClaimStatus, ClaimType } from "@/types";

/** 환불이 있는 클레임(취소·반품)의 색 — 신청·환불 진행(서버 재시도 포함)은 진행 중, 환불 끝·철회는 닫힌 회색, 거절만 빨강 */
const REFUND_TONE = {
  requested: "neutral",
  approved: "neutral",
  failed: "neutral",
  received: "neutral",
  shipped: "neutral",
  completed: "muted",
  withdrawn: "muted",
  expired: "muted",
  rejected: "problem",
} as const satisfies Record<ClaimStatus, BadgeTone>;

/**
 * 클레임 뱃지 색 — 종류마다 상태 이름이 달라(메시지 `claims.status.{type}.{status}`) 색도 종류별로 둔다.
 * 교환 완료는 새 제품을 받은 것이라 배송완료와 같은 '잘 끝남'. 종류에 없는 상태(취소의 requested 등)도 빈칸 없이 채운다
 */
export const CLAIM_STATUS_TONE = {
  cancel: REFUND_TONE,
  return: REFUND_TONE,
  compensation: REFUND_TONE,
  exchange: {
    requested: "neutral",
    received: "neutral",
    shipped: "neutral",
    approved: "neutral",
    failed: "neutral",
    completed: "done",
    withdrawn: "muted",
    expired: "muted",
    rejected: "problem",
  },
} as const satisfies Record<ClaimType, Record<ClaimStatus, BadgeTone>>;
