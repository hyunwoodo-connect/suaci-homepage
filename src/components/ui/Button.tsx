import type { ButtonHTMLAttributes } from "react";

/**
 * 공용 버튼 — v4 acid grid.
 * 사각형 + Space Mono 대문자. pill/라운드 금지 (v4 형태 언어).
 *
 * variant:
 *  - "primary" 잉크 채움 + 페이퍼 텍스트, hover 시 페이퍼 채움 (.bar__cta와 동일 문법)
 *  - "outline" 1.5px 잉크 보더, hover 시 잉크 채움 + 애시드 텍스트
 *  - "danger"  잉크 보더 + 붉은 텍스트 (삭제류)
 */
type ButtonVariant = "primary" | "outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE =
  "inline-flex items-center justify-center gap-[8px] px-[22px] py-[13px] font-sans text-[12px] transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-paper hover:text-ink border border-line",
  outline: "border border-line text-ink hover:bg-ink hover:text-lime",
  danger:
    "border border-line text-[#c0392b] hover:bg-[#c0392b] hover:text-paper hover:border-[#c0392b]",
};

export default function Button({
  variant = "primary",
  type = "button",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...rest} />
  );
}
