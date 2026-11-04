import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

/** 다음 화면으로 가는 주 행동 — 생김새는 Button 과 같고 동작은 링크 */
interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonLinkProps) {
  return <Link className={`${buttonClasses(variant, size)} ${className}`} {...rest} />;
}
