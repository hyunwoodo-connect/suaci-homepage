import type { Product, User } from "@/types";

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
    name: "brume no.1",
    nameKo: "brume no.1",
    descriptor: "lime & basil face mist",
    category: "mist",
    images: ["/image/v5/product-reference.webp"],
    status: "active",
    defaultVariantId: "var_daily_80",
    variants: [
      {
        variantId: "var_daily_80",
        sku: "SUACI-MIST-100",
        optionName: "100 ml",
        price: krw(38000),
        stock: 120,
        available: 120,
        status: "active",
      },
    ],
  },
];
