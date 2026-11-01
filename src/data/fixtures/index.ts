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

export const products: Product[] = [
  {
    productId: "prod_daily_mist",
    brandId: "brand_suaci",
    slug: "daily-calming-mist",
    name: "lime & basil facial serum mist · take-01",
    nameKo: "라임바질 페이셜 세럼 미스트 · take-01",
    descriptor: "lime & basil facial serum mist",
    category: "mist",
    images: ["/image/v5/product-reference.webp"],
    status: "active",
    defaultVariantId: "var_daily_80",
    variants: [
      {
        variantId: "var_daily_80",
        sku: "SUACI-MIST-100",
        optionName: "100 ml",
        price: krw(CHECKOUT_PRICING.price),
        stock: 120,
        available: 120,
        status: "active",
      },
    ],
  },
];
