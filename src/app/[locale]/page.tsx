import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import FilmSection from "@/components/sections/FilmSection";
import BrandStorySection from "@/components/sections/BrandStorySection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <BrandStorySection />
        <FilmSection />
      </main>
      <Footer />
    </>
  );
}
