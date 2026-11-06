import type { ReasonCode, ClaimStatus } from "./common";

/** 클레임 종류 — 발송 전 취소(바로 환불) / 받은 뒤 반품(신청 → 회수 확인 뒤 환불 또는 거절) */
export type ClaimType = "cancel" | "return";

/** 반품 사유 — 단순 변심(손님 부담·7일·미개봉)과 회사 탓 셋(3개월·배송비 회사 부담) */
export type ReturnReason = Extract<ReasonCode, "단순변심" | "상품하자" | "오배송" | "표시광고상이">;

export interface ClaimLine {
  lineId: string;
  productId: string;
  variantId: string;
  quantity: number;
}
export interface Claim {
  claimId: string;
  orderId: string;
  type: ClaimType;
  status: ClaimStatus;
  reasonCode: ReasonCode;
  reasonDetail?: string;
  lines: ClaimLine[];
  refundAmount: number;
  /** 돌려주는 처음 배송비 */
  refundedShipping: number;
  /** 손님 부담 반품 배송비(단순 변심 반품만) — refundAmount 에서 이미 뺐다 */
  returnShippingFee: number;
  /** 환급기한 — 취소는 신청 때, 반품은 회수 확인 때 정해진다 */
  refundDueAt?: number;
  refundDueDtm?: string;
  /** 반품: 회수 확인·거절 시각, 거절 이유 */
  receivedAt?: number;
  rejectedAt?: number;
  rejectReason?: string;
  createdAt: number;
  createdDtm: string;
  resolvedAt?: number;
  resolvedDtm?: string;
}
export interface CreateClaimRequest {
  idempotencyKey: string;
  reasonCode: ReasonCode;
  reasonDetail?: string;
  lines?: { lineId: string; quantity: number }[];
}
/** 반품 신청. 단순 변심은 unopenedConfirmed 가 true 여야 한다 */
export interface CreateReturnRequest {
  idempotencyKey: string;
  reasonCode: ReturnReason;
  reasonDetail?: string;
  lines?: { lineId: string; quantity: number }[];
  unopenedConfirmed: boolean;
}
