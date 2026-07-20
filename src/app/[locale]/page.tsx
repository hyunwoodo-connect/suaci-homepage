import TopBar from "@/components/home/TopBar";
import HeroV4 from "@/components/home/HeroV4";
import TickerV4 from "@/components/home/TickerV4";
import ProductV4 from "@/components/home/ProductV4";
import MomentsV4 from "@/components/home/MomentsV4";
import QuoteV4 from "@/components/home/QuoteV4";
import WaitlistV4 from "@/components/home/WaitlistV4";
import FooterV4 from "@/components/home/FooterV4";

/**
 * Home v4 — acid grid 에디토리얼.
 * 모든 셀은 하나의 12컬럼 마스터 그리드(.frame.v4-grid)의 직계 자식이어야 한다.
 */
export default function Home() {
  return (
    <main className="frame v4-grid">
      <TopBar />
      <HeroV4 />
      <TickerV4 />
      <ProductV4 />
      <MomentsV4 />
      <QuoteV4 />
      <WaitlistV4 />
      <FooterV4 />
    </main>
  );
}
