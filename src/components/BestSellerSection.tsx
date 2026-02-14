import Link from "next/link";

interface Product {
  id: number;
  name: string;
  nameEn: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  tag?: string;
}

const products: Product[] = [
  {
    id: 1,
    name: "시그니처 에센스 토너",
    nameEn: "Signature Essence Toner",
    price: 32000,
    originalPrice: 42000,
    discount: 24,
    tag: "BEST",
  },
  {
    id: 2,
    name: "딥 클렌징 폼",
    nameEn: "Deep Cleansing Foam",
    price: 28000,
    originalPrice: 35000,
    discount: 20,
  },
  {
    id: 3,
    name: "하이드라 올인원 로션",
    nameEn: "Hydra All-in-One Lotion",
    price: 38000,
    tag: "NEW",
  },
  {
    id: 4,
    name: "리페어 세럼 앰플",
    nameEn: "Repair Serum Ampoule",
    price: 45000,
    originalPrice: 52000,
    discount: 13,
  },
  {
    id: 5,
    name: "데일리 선크림 SPF50+",
    nameEn: "Daily Sun Cream SPF50+",
    price: 26000,
  },
  {
    id: 6,
    name: "쿨링 애프터 밤",
    nameEn: "Cooling After Balm",
    price: 22000,
    originalPrice: 28000,
    discount: 21,
    tag: "BEST",
  },
  {
    id: 7,
    name: "모이스처 크림",
    nameEn: "Moisture Cream",
    price: 35000,
    tag: "NEW",
  },
  {
    id: 8,
    name: "포어 타이트닝 패드",
    nameEn: "Pore Tightening Pad",
    price: 19000,
    originalPrice: 25000,
    discount: 24,
  },
];

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR");
}

export default function BestSellerSection() {
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 md:mb-16">
          <div>
            <p className="text-xs tracking-[0.3em] text-muted mb-3">
              CURATED FOR YOU
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              BEST SELLER
            </h2>
          </div>
          <Link
            href="#"
            className="mt-4 md:mt-0 text-sm tracking-[0.1em] text-muted hover:text-foreground transition-colors border-b border-muted hover:border-foreground pb-0.5"
          >
            VIEW ALL →
          </Link>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10 md:gap-y-14">
          {products.map((product) => (
            <Link
              key={product.id}
              href="#"
              className="group cursor-pointer"
            >
              {/* Product Image Placeholder */}
              <div className="relative aspect-[3/4] bg-[#f5f5f5] mb-4 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs tracking-[0.2em] text-[#ccc]">
                    SUACI
                  </span>
                </div>
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />

                {/* Tag */}
                {product.tag && (
                  <span
                    className={`absolute top-3 left-3 text-[10px] tracking-[0.15em] font-medium px-2.5 py-1 ${
                      product.tag === "NEW"
                        ? "bg-foreground text-white"
                        : "bg-white text-foreground border border-border"
                    }`}
                  >
                    {product.tag}
                  </span>
                )}

                {/* Quick View */}
                <div className="absolute bottom-0 left-0 right-0 bg-foreground text-white text-center py-3 text-xs tracking-[0.15em] translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                  QUICK VIEW
                </div>
              </div>

              {/* Product Info */}
              <div>
                <p className="text-[11px] tracking-[0.05em] text-muted mb-1">
                  {product.nameEn}
                </p>
                <h3 className="text-sm font-medium mb-2 group-hover:text-muted transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  {product.discount && (
                    <span className="text-sm font-bold text-red-500">
                      {product.discount}%
                    </span>
                  )}
                  <span className="text-sm font-semibold">
                    {formatPrice(product.price)}원
                  </span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted line-through">
                      {formatPrice(product.originalPrice)}원
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
