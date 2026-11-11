import type * as Api from "./api.gen";

/** 클레임 종류 — 발송 전 취소 / 받은 뒤 반품 / 받은 뒤 교환 / 회사가 금액만 돌려준 보상 환불 */
export type ClaimType = Api.ClaimType;
/** 손님이 신청할 수 있는 종류(보상 환불은 회사가 연다) */
export type ClaimFormType = Exclude<ClaimType, "compensation">;
/** 반품 사유 — 단순 변심과 회사 탓 셋 */
export type ReturnReason = Api.ReturnReason;
/** 교환 사유 — 회사 탓만(단순 변심은 반품 후 새 주문) */
export type ExchangeReason = Api.CustomerExchangeReason;
/** 클레임에 걸린 주문 줄 */
export type ClaimLine = Api.ClaimLine;
/** 취소·반품·교환 한 건 */
export type Claim = Api.ClaimView;
/** 발송 전 취소 요청 */
export type CreateClaimRequest = Api.CreateClaimInput;
/** 반품 신청 */
export type CreateReturnRequest = Api.RequestReturnInput;
/** 교환 신청 */
export type CreateExchangeRequest = Api.RequestExchangeInput;
/** 환불 금액 미리 보기 요청 — 취소·반품 폼이 보내기 전에 이대로 신청하면 얼마가 돌아오는지 묻는다 */
export type RefundPreviewRequest = Api.RefundPreviewInput;
/** 환불 금액 미리 보기 — 서버가 신청을 만들 때와 같은 계산으로 낸 금액 */
export type RefundPreview = Api.RefundPreviewView;
