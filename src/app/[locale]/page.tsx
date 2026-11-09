import BuyBar from "@/components/home/BuyBar";
import Hero from "@/components/home/Hero";
import Moments from "@/components/home/Moments";
import ProductSection from "@/components/home/ProductSection";
import SiteFooter from "@/components/home/SiteFooter";
import SiteHeader from "@/components/home/SiteHeader";
import Story from "@/components/home/Story";

/**
 * Home v5 — white studio. 단일 SKU(라임바질 페이셜 세럼 미스트 · take-01) 원페이지.
 * 히어로 영상 → 브랜드 스토리 → 제품 → 무드 갤러리 → 하단 원클릭 바 → 푸터.
 * 제품(가격·고시·전성분)은 갤러리 앞 — 사진 여섯 장·영상 뒤 페이지 72% 지점에 있으면 무엇을 파는지 늦게 읽힌다(UX 리뷰 A2).
 * 바는 푸터 앞에 둔다 — 스크롤 중엔 화면 아래에 붙고, 끝에선 제품 바로 밑에 내려앉아
 * 푸터(맨 아래 잘려 나가는 로고)가 페이지 끝이 된다. 푸터 뒤에 두면 로고 아래에 바 자리만큼 빈 띠가 생긴다.
 */
export default function Home() {
  return (
    <main className="relative w-full bg-paper">
      <SiteHeader overlay />
      <Hero />
      <Story />
      <ProductSection />
      <Moments />
      <BuyBar />
      <SiteFooter />
    </main>
  );
}
