import { Geist } from "next/font/google";

/**
 * 라틴 글꼴(브랜드 기준 Geist) — next/font 가 빌드 때 받아 우리 주소에서 준다(구글 폰트 왕복 없음).
 * [locale] 레이아웃 전용. 이벤트 레이아웃은 자기 파일에서 따로 부른다 — 같은 호출을 레이아웃 파일 두 곳에 두면
 * 번들러가 두 레이아웃의 글꼴 CSS 를 한 묶음으로 합쳐 홈에서도 이벤트 글꼴 조각(50개)을 미리 받는다(빌드로 확인).
 */
export const GEIST = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
