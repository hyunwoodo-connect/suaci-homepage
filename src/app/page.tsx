import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import BestSellerSection from "@/components/BestSellerSection";
import FilmSection from "@/components/FilmSection";
import BrandSection from "@/components/BrandSection";

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
