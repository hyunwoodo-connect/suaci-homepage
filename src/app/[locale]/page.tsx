import BuyBar from "@/components/home/BuyBar";
import Hero from "@/components/home/Hero";
import Moments from "@/components/home/Moments";
import ProductSection from "@/components/home/ProductSection";
import SiteFooter from "@/components/home/SiteFooter";
import SiteHeader from "@/components/home/SiteHeader";
import Story from "@/components/home/Story";

/**
 * Home v5 — white studio. 단일 SKU(brume no.1) 원페이지.
 * 히어로 영상 → 브랜드 스토리 → 무드 갤러리 → 제품 → 푸터, 하단 원클릭 바.
 */
export default function Home() {
  return (
    <main className="relative w-full bg-paper">
      <SiteHeader overlay />
      <Hero />
      <Story />
      <Moments />
      <ProductSection />
      <SiteFooter />
      <BuyBar />
    </main>
  );
}
