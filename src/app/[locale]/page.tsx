import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import RulebarSection from "@/components/sections/RulebarSection";
import BandSection from "@/components/sections/BandSection";
import ProductRevealSection from "@/components/sections/ProductRevealSection";
import MomentHeroSection from "@/components/sections/MomentHeroSection";
import MomentStackSection from "@/components/sections/MomentStackSection";
import FourMomentsSection from "@/components/sections/FourMomentsSection";
import MarqueeSection from "@/components/sections/MarqueeSection";
import InsideSection from "@/components/sections/InsideSection";
import OrderSection from "@/components/sections/OrderSection";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <RulebarSection />
        <BandSection />
        <ProductRevealSection />
        <MomentHeroSection />
        <MomentStackSection />
        <FourMomentsSection />
        <MarqueeSection />
        <InsideSection />
        <OrderSection />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
