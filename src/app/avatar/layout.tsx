import type { Metadata } from "next";

import Analytics from "@/components/analytics/Analytics";
import { PRETENDARD_CSS } from "@/constants/fonts";

import "../globals.css";

export const metadata: Metadata = {
  title: "suaci — 아바타",
  // 꾸미는 화면뿐이라 검색 결과에 낼 내용이 없다
  robots: { index: false },
};

// 루트 레이아웃은 <html>을 그리지 않고 [locale] 레이아웃이 그린다.
// 이 경로는 이벤트처럼 [locale] 밖이라 한국어 단독 <html>을 여기서 직접 그린다.
// 이 화면의 글자는 한글뿐이라 라틴 글꼴(Geist)은 받지 않고 한글 글꼴만 쓴다
export default function AvatarLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="antialiased" style={{ fontFamily: "var(--font-cjk), sans-serif" }}>
        {/* 동의 배너가 화면 맨 위에 뜨므로 읽는 순서도 맨 앞 */}
        <Analytics locale="ko" />
        {children}
      </body>
    </html>
  );
}
