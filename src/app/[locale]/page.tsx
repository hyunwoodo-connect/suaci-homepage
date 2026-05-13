import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import ProductFeatureSection from "@/components/sections/ProductFeatureSection";
import LifestyleSection from "@/components/sections/LifestyleSection";
import OrderSection from "@/components/sections/OrderSection";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ProductFeatureSection />
        <LifestyleSection />
        <OrderSection />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
