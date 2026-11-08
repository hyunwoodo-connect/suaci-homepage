import type { Metadata, OrderStatus, PaymentStatus, FulfillmentStatus } from "./common";

/** 주문 금액 합계(백엔드 주문 DTO의 `totals`) */
export interface OrderTotals {
  itemsSubtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
}
/** 주문에 담긴 상품 한 줄(백엔드 주문 DTO) */
export interface OrderItem {
  lineId: string;
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  /** 한국어 상품명 스냅샷(상품 nameKo). 옛 주문엔 없다 — 화면은 `itemName` 으로 고른다 */
  productNameKo?: string;
  optionName: string;
  thumbnail?: string;
  unitPrice: number;
  compareAtPrice: number;
  quantity: number;
  lineSubtotal: number;
}
/** 주문을 만들 때 복사해 둔 배송지(백엔드 주문 DTO) */
export interface ShippingAddressSnapshot {
  recipient: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2?: string;
}
/** 주문 한 건(백엔드 주문 DTO) — 주문 만들기·결제 승인·주문 상세가 같은 모양을 돌려준다 */
export interface Order {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totals: OrderTotals;
  shippingAddress: ShippingAddressSnapshot;
  items: OrderItem[];
  /** 결제 수단 이름(백엔드가 남긴 그대로: "브랜드페이"·"간편결제(네이버페이)"…). 결제 전엔 없음 */
  paymentMethod?: string;
  /** 발송되면 택배사 코드(cj·epost·hanjin·lotte·logen)·송장번호·택배사 배송 조회 링크, 발송·도착 시각 */
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: number;
  deliveredAt?: number;
  /** 발송기한(Unix ms, 결제한 날부터 3영업일째 끝) — 보낼 주문(결제됨·발송 전)만, 테스트 결제는 없음 */
  shipBy?: number;
  createdAt: number;
  createdDtm: string;
}
/** 주문 목록의 한 줄(`GET /orders`) */
export interface OrderSummary {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  grandTotal: number;
  createdAt: number;
  createdDtm: string;
}
/** 바로 구매 라인 — 가격은 서버가 정한다 */
export interface OrderLineRequest {
  productId: string;
  variantId: string;
  quantity: number;
}
/** 주문 만들기 요청. `idempotencyKey` 가 같으면 서버는 새로 만들지 않고 옛 주문을 돌려준다 */
export interface CreateOrderRequest {
  addressId: string;
  idempotencyKey: string;
  /** 주문할 상품 줄. 지금은 상품이 하나라 구매 바·주문서가 한 줄만 싣는다(서버는 여러 줄을 받는다) */
  items: OrderLineRequest[];
  metadata?: Metadata;
}
/** 결제 뒤 상품 준비 전까지 손님이 배송지를 바꾼다 — 배송지 목록의 하나 */
export interface ChangeShippingAddressRequest {
  addressId: string;
}
/** 결제 승인 요청 — 결제창이 돌려준 `paymentKey` 와 금액 */
export interface ConfirmPaymentRequest {
  paymentKey: string;
  amount: number;
}
