import Link from "next/link";
import type { Product } from "@/types";
import { formatPrice } from "@/utils/format";

interface ProductCardProps {
  product: Product;
}

/** 태그 배지 스타일 매핑 */
const TAG_STYLES: Record<string, string> = {
  NEW: "bg-foreground text-white",
  BEST: "bg-white text-foreground border border-border",
};

/**
 * 상품 카드 컴포넌트
 * - 이미지 플레이스홀더 (실제 이미지가 들어가면 교체)
 * - 호버 시 QUICK VIEW 슬라이드 업
 * - 태그, 할인율, 정가 표시
 */
export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href="#" className="group cursor-pointer">
      {/* 이미지 영역 */}
      <div className="relative aspect-[3/4] bg-[#f5f5f5] mb-4 overflow-hidden">
        {/* 플레이스홀더 — 실제 이미지로 교체 예정 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs tracking-[0.2em] text-[#ccc]">SUACI</span>
        </div>

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />

        {/* 태그 배지 */}
        {product.tag && (
          <span
            className={`absolute top-3 left-3 text-[10px] tracking-[0.15em] font-medium px-2.5 py-1 ${TAG_STYLES[product.tag]}`}
          >
            {product.tag}
          </span>
        )}

        {/* 퀵뷰 */}
        <div className="absolute bottom-0 left-0 right-0 bg-foreground text-white text-center py-3 text-xs tracking-[0.15em] translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          QUICK VIEW
        </div>
      </div>

      {/* 상품 정보 */}
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
  );
}
