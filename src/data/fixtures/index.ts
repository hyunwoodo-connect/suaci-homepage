import type { Product, User } from "@/types";
import { CHECKOUT_PRICING } from "@/constants/checkout";

/** 로그인 목데모 유저. mock 클라이언트의 getMe/인증 판단에 사용. */
export const demoUser: User = {
  userId: "user_demo",
  email: "demo@suaci.com",
  name: "수아치",
  status: "active",
  createdAt: 1784041200000,
  createdDtm: "2026-07-20T00:00:00+09:00",
};

function krw(list: number) {
  return { list, currency: "KRW" as const };
}

/** 목업 API 가 파는 상품 목록 */
export const products: Product[] = [
  {
    productId: "01M6Q9CRE26QQ23008GC0M9C0N",
    brandId: "01M6Q9CPJ8C2CT144C8X7F8XHY",
    slug: "take-01",
    name: "lime & basil facial serum mist · take-01",
    nameKo: "라임바질 페이셜 세럼 미스트 · take-01",
    descriptor: "lime & basil facial serum mist",
    category: "mist",
    images: [],
    status: "active",
    defaultVariantId: "01M6Q9CSF159ZC0FD4GMR8WDQB",
    variants: [
      {
        variantId: "01M6Q9CSF159ZC0FD4GMR8WDQB",
        sku: "TAKE01-100",
        optionName: "100 ml",
        price: krw(CHECKOUT_PRICING.price),
        stock: 120,
        available: 120,
        status: "active",
      },
    ],
  },
];
