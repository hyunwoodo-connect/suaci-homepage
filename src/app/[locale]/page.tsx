import fs from "fs";
import path from "path";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import BrandStorySection from "@/components/sections/BrandStorySection";
import ProductSection from "@/components/sections/ProductSection";
import LifestyleSection from "@/components/sections/LifestyleSection";

function getProductImages(): string[] {
  const dir = path.join(process.cwd(), "public/detail-cut");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((f) => `/detail-cut/${f}`);
  } catch {
    return [];
  }
}

export default function Home() {
  const productImages = getProductImages();

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <BrandStorySection />
        <ProductSection images={productImages} />
        <LifestyleSection />
      </main>
      <Footer />
    </>
  );
}
