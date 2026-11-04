import type { ButtonHTMLAttributes } from "react";

/**
 * 공용 버튼 — v5 white studio. 주문서·구매 시트와 같은 알약 모양(52px, 엄지 자리).
 *
 * variant:
 *  - "primary" 잉크 채움 + 흰 글자
 *  - "outline" 가는 선, 누르기 전에는 조용하게
 *  - "danger"  가는 선 + 에러 글자 (삭제류)
 * size: "md" 화면의 주 행동, "sm" 카드 안의 작은 행동(누르는 자리는 그래도 44px)
 */
export type ButtonVariant = "primary" | "outline" | "danger";
export type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-[8px] rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-[52px] px-[24px] text-[15px]",
  sm: "h-[44px] px-[16px] text-[14px]",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  outline: "border border-line text-ink hover:border-ink",
  danger: "border border-line text-alert hover:border-alert",
};

/** 버튼 모양 클래스 — 링크를 버튼처럼 보여야 할 때(ButtonLink)도 같은 모양을 쓴다 */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]}`;
}

export default function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${buttonClasses(variant, size)} ${className}`} {...rest} />
  );
}
