import type { Address } from "./address";

/** GET /checkout/defaults — 두 번 클릭 구매가 미리 채울 값. 없으면 null. */
export interface CheckoutDefaults {
  address: Address | null;
  /** 백엔드가 남긴 수단 이름("브랜드페이" · "간편결제(네이버페이)" · "카드" …) */
  lastPaymentMethod: string | null;
}
