import type { ReasonCode, ClaimStatus } from './common'

export interface ClaimLine { lineId: string; productId: string; variantId: string; quantity: number }
export interface Claim {
  claimId: string; orderId: string; type: 'cancel'; status: ClaimStatus
  reasonCode: ReasonCode; reasonDetail?: string; lines: ClaimLine[]
  refundAmount: number; refundedShipping: number; returnShippingFee: number
  refundDueAt: number; refundDueDtm: string
  createdAt: number; createdDtm: string; resolvedAt?: number; resolvedDtm?: string
}
export interface CreateClaimRequest {
  idempotencyKey: string; reasonCode: ReasonCode; reasonDetail?: string
  lines?: { lineId: string; quantity: number }[]
}
