/**
 * Commerce 도메인 모델
 *
 * 단일 SKU 단계지만 다중 SKU·PDP·카트·결제 확장을 받쳐주도록 설계.
 * 텍스트성 카피는 i18n 메시지에 두고, 여기는 SKU 자체에 귀속되는 사실(가격·이미지·재고·등급 등)만 보관한다.
 */

export type Currency = "KRW";

/**
 * 정가/할인가/통화. 표시는 `formatKRW`, 할인율은 `getDiscountPercent` 유틸을 통해 파생한다.
 */
export interface Price {
  /** 정가 */
  list: number;
  /** 할인가. 없으면 정가만 표시. */
  sale?: number;
  currency: Currency;
}

export interface ProductImage {
  src: string;
  /** 의미 있는 alt 텍스트. 장식용일 경우 빈 문자열 + aria-hidden 별도 처리. */
  alt: string;
}

export type ProductStatus = "available" | "preorder" | "soldout";

export interface ProductRating {
  /** 0~5 사이 평점 */
  score: number;
  /** 사전 예약 또는 리뷰 수 */
  count: number;
}

export interface ProductShipping {
  free: boolean;
  /** 무료배송 기준 최소 주문 금액. */
  minimumOrder: number;
  todayDispatch: boolean;
}

export interface Product {
  /** SKU 코드 (재고/주문 식별). */
  sku: string;
  /** URL slug. `/product/[slug]` 라우트에 쓰일 예정. */
  slug: string;
  /** 매거진 호수. UI에서 No.01 같이 표기. */
  issueNumber: string;
  /** 영문 제품명. */
  name: string;
  /** 한국어 제품명. (다국어 확장 시 messages/{locale}.json 으로 이관) */
  nameKo: string;
  /** 카테고리 식별자 (filter, related products용). */
  category: string;
  /** 표기용 용량 문자열 ("100ml"). */
  volume: string;
  /** 표기용 상세 용량 ("100 ml / 3.4 fl.oz"). */
  volumeDetail: string;
  /** 짧은 영문 디스크립터 ("Portable calming mist"). */
  shortDescriptor: string;
  price: Price;
  images: {
    bottle: ProductImage;
    hero?: ProductImage[];
  };
  rating?: ProductRating;
  shipping?: ProductShipping;
  status: ProductStatus;
}

export interface CartItem {
  sku: string;
  quantity: number;
}
