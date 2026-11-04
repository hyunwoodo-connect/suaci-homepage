import { Geist } from "next/font/google";

/** 라틴 글꼴(브랜드 기준 Geist) — next/font 가 빌드 때 받아 우리 주소에서 준다. 구글 폰트 왕복이 없다 */
export const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
