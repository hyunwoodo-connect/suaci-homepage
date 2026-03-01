import { readdir } from "fs/promises";
import { join } from "path";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import BrandStorySection from "@/components/sections/BrandStorySection";
import ProductSection from "@/components/sections/ProductSection";
import LifestyleSection from "@/components/sections/LifestyleSection";

async function getProductImages(): Promise<string[]> {
  try {
    const files = await readdir(join(process.cwd(), "public/detail-cut"));
    return files
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((f) => `/detail-cut/${f}`);
  } catch {
    return [];
  }
}

export default async function Home() {
  const productImages = await getProductImages();

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
