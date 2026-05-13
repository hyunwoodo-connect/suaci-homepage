import type { ButtonHTMLAttributes } from "react";

/**
 * 사이트 공통 버튼.
 *
 * variant:
 *  - "primary"   장바구니/구매 등 주 CTA. 짙은 초록 채움.
 *  - "secondary" 보조 CTA. 짙은 초록 보더, hover 시 채움.
 *  - "uppercase" 폼 제출용. EN 대문자, 작고 짙은 톤. (Order/Login 제출)
 *
 * 디자인 톤상 버튼은 거의 항상 사각형(보더 라운드 없음).
 * 사이즈가 다양해지면 size prop을 별도로 추가한다.
 */
type ButtonVariant = "primary" | "secondary" | "uppercase";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "px-[18px] py-[15px] text-[14px] font-medium tracking-[0.02em] text-center border border-green bg-green text-white hover:bg-foreground hover:border-foreground transition-colors",
  secondary:
    "px-[18px] py-[15px] text-[14px] font-medium tracking-[0.02em] text-center border border-green text-green hover:bg-green hover:text-white transition-colors",
  uppercase:
    "px-[22px] py-[14px] bg-green text-white font-en text-[11px] tracking-[0.18em] uppercase hover:bg-green-2 transition-colors",
};

export default function Button({
  variant,
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
