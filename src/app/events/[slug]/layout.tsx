import type { Metadata } from "next";
import { Fraunces, Geist, Gowun_Batang } from "next/font/google";

import Analytics from "@/components/analytics/Analytics";
import { PRETENDARD_CSS } from "@/constants/fonts";

import "../../globals.css";

export const metadata: Metadata = {
  title: "suaci — 이벤트",
};

// 사이트 기본 글꼴(--font-sans 가 쓰는 --font-geist). [locale] 레이아웃(lib/fonts)과 같은 모듈을 쓰거나 같은 호출을 레이아웃에 두면
// 두 레이아웃의 글꼴 CSS 가 한 묶음이 돼 홈에서도 이벤트 글꼴(Gowun Batang 조각 수십 개)을 미리 받는다
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

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
    <html lang="ko" className={`${geist.variable} ${fraunces.variable} ${gowunBatang.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
        <Analytics locale="ko" />
      </body>
    </html>
  );
}
