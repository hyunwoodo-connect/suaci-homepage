import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "suaci — 이벤트",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

// 루트 레이아웃은 <html>을 그리지 않고 [locale] 레이아웃이 그린다.
// 이 경로는 [locale] 밖이라 한국어 단독 <html>을 여기서 직접 그린다.
export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
