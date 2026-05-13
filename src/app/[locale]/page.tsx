import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import ProductFeatureSection from "@/components/sections/ProductFeatureSection";
import BrandNoteSection from "@/components/sections/BrandNoteSection";
import ProductNotesSection from "@/components/sections/ProductNotesSection";
import OrderSection from "@/components/sections/OrderSection";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ProductFeatureSection />
        <BrandNoteSection />
        <ProductNotesSection />
        <OrderSection />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
