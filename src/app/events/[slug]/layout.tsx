import type { Metadata } from "next";
import { Fraunces, Gowun_Batang } from "next/font/google";
import "../../globals.css";
import Analytics from "@/components/analytics/Analytics";

export const metadata: Metadata = {
  title: "suaci — 이벤트",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

// 이벤트 놀이(take four.) 글꼴. 변수로만 달고, 쓰는 쪽(놀이 모듈)이 골라 쓴다
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

// Gowun Batang은 한글 글리프가 unicode-range 조각으로 온다(next/font 서브셋 목록엔 latin만 있다)
const gowunBatang = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-gowun-batang",
  display: "swap",
});

// 루트 레이아웃은 <html>을 그리지 않고 [locale] 레이아웃이 그린다.
// 이 경로는 [locale] 밖이라 한국어 단독 <html>을 여기서 직접 그린다.
export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${fraunces.variable} ${gowunBatang.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
