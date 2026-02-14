import { BEST_SELLER_PRODUCTS } from "@/data/products";
import { SECTION_PADDING_X } from "@/constants/site";
import SectionHeader from "@/components/ui/SectionHeader";
import ProductCard from "@/components/ui/ProductCard";

/**
 * 제품 섹션
 *
 * - 상품 4열(데스크톱) / 2열(모바일) 그리드
 * - 데이터는 src/data/products.ts 에서 관리
 */
export default function BestSellerSection() {
  return (
    <section id="product" className="py-20 md:py-32">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <SectionHeader
          subtitle="OUTDOOR RECOVERY"
          title="OUR PRODUCT"
          viewAllHref="#"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10 md:gap-y-14">
          {BEST_SELLER_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
