import type { Metadata } from "./common";

/** 손님 배송지 한 건(백엔드 배송지 DTO) */
export interface Address {
  addressId: string;
  label?: string;
  recipient: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2?: string;
  isDefault: boolean;
  metadata?: Metadata;
}
/** 배송지 추가 요청 — 주문서와 계정의 배송지 폼이 보낸다 */
export interface CreateAddressRequest {
  label?: string;
  recipient: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2?: string;
  isDefault?: boolean;
  metadata?: Metadata;
}
/** 배송지 고치기 요청 — 바꿀 칸만 보낸다 */
export type UpdateAddressRequest = Partial<CreateAddressRequest>;
