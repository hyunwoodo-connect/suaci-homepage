import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import IntroSection from "@/components/sections/IntroSection";
import ProductFeatureSection from "@/components/sections/ProductFeatureSection";
import MomentsSection from "@/components/sections/MomentsSection";
import QualitiesSection from "@/components/sections/QualitiesSection";
import StorySection from "@/components/sections/StorySection";
import OrderSection from "@/components/sections/OrderSection";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ProductFeatureSection />
        <IntroSection />
        <MomentsSection />
        <QualitiesSection />
        <StorySection />
        <OrderSection />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
