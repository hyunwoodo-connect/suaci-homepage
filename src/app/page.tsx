import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import BestSellerSection from "@/components/sections/BestSellerSection";
import FilmSection from "@/components/sections/FilmSection";
import BrandSection from "@/components/sections/BrandSection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <BestSellerSection />
        <FilmSection />
        <BrandSection />
      </main>
      <Footer />
    </>
  );
}
