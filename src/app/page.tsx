import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import ProductSection from "@/components/sections/ProductSection";
import FilmSection from "@/components/sections/FilmSection";
import BrandSection from "@/components/sections/BrandSection";
import BrandStorySection from "@/components/sections/BrandStorySection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <BrandStorySection />
        <ProductSection />
        <FilmSection />
        <BrandSection />
      </main>
      <Footer />
    </>
  );
}
