import type { ReactNode } from "react";

import { TAKE_FOUR_VARS } from "../theme";

interface ScreenProps {
  /** lime: 입구·이벤트·벽 / cream: 촬영·앨범 / pale: 현상·완성·크게 보기(카드 바탕과 같은 색) */
  tone: keyof typeof TONE_CLASS;
  /** 촬영 화면처럼 가운데 정렬 열 */
  isCentered?: boolean;
  children: ReactNode;
}

const TONE_CLASS = {
  lime: "bg-(--tf-lime)",
  cream: "bg-(--tf-cream)",
  pale: "bg-(--tf-pale)",
} as const;

/**
 * 화면 뿌리. take four. 색·글꼴 변수를 여기서만 깐다(홈페이지 테마와 분리).
 * 전역 body의 회색조 스무딩(antialiased)은 Gowun Batang 획을 시안보다 가늘게 만들어 여기서 되돌린다.
 */
export default function Screen({ tone, isCentered = false, children }: ScreenProps) {
  return (
    <div
      style={TAKE_FOUR_VARS}
      className={`relative flex min-h-dvh w-full flex-col overflow-hidden subpixel-antialiased px-[24px] pt-[20px] pb-[28px] font-(family-name:--tf-korean) text-(color:--tf-ink) ${
        TONE_CLASS[tone]
      } ${isCentered ? "items-center" : ""}`}
    >
      {children}
    </div>
  );
}
