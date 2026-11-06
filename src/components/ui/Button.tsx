import type { ButtonHTMLAttributes } from "react";

/**
 * 공용 버튼 — v5 white studio. 누르는 것은 알약 모양(상태를 알리는 Badge 는 각진 작은 사각형 — 모양으로 역할을 가른다).
 *
 * 한 화면에 primary 는 하나만 둔다. 나머지는 한 단계씩 조용하게.
 *  - "primary"   그 화면의 목적(구매하기·결제하기·저장). 잉크 채움 + 흰 글자
 *  - "secondary" 곁가지 행동(주문 상세 보기·배송지 변경·다시 시도). 흰 바탕 + 회색 선
 *  - "text"      글자 링크 모양(뒤로·더 보기·닫기). 테두리 없이, 누르는 자리는 그래도 44px
 *  - "danger"    되돌리기 어려운 행동(주문 취소·환불 요청·탈퇴). 빨간 글자 + 옅은 빨간 선.
 *                누르면 바로 실행하지 않고 반드시 한 번 더 묻는 단계(확인 버튼·사유 폼)를 거친다
 * size: "md" 화면의 주 행동(52px, 엄지 자리), "sm" 카드 안의 작은 행동(44px)
 *
 * 라임(#A9FF39)을 primary 채움으로 쓰지 않는 이유:
 *  - 라임 위 잉크 글자는 15:1 로 읽기엔 충분하다(WCAG AA 4.5:1 통과). 막는 건 대비가 아니라 브랜드 규칙이다.
 *  - BRAND.md — 라임은 "작게, 곳곳에 반복"하는 점·띠·블록이고 "넓고 강하게 채우면 suaci 가 아니다".
 *    primary 는 모든 화면에 하나씩 나오므로 라임으로 칠하면 화면마다 라임이 가장 큰 면이 된다.
 *  - 그 화면의 라임 자리는 이미 따로 있다(주문 완료 띠, 언어 메뉴 체크 점). 버튼까지 라임이면 둘이 다툰다.
 *  - 흰 바탕과 라임의 대비는 1.2:1 이라 버튼 가장자리가 흐리고, 비활성(40%)이 되면 거의 사라진다.
 *  그래서 primary 는 잉크 채움(흰 바탕 대비 18:1)으로 두고, 위계는 나머지를 낮추는 쪽으로 만든다.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "text"
  | "danger"
  /** @deprecated secondary 와 같다. 결제 완료 화면(pay/complete)이 secondary 로 바뀌면 지운다 */
  | "outline";
export type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-[8px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-[52px] rounded-full px-[24px] text-[15px]",
  sm: "h-[44px] rounded-full px-[16px] text-[14px]",
};

// 글자 버튼은 알약이 아니라 글줄에 맞춘다 — 좌우 여백 없이 본문 왼쪽 선에 서고, 높이만 44px
const TEXT_SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-[44px] rounded-[2px] text-[15px]",
  sm: "min-h-[44px] rounded-[2px] text-[14px]",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  secondary: "border border-ink/25 bg-paper text-ink hover:border-ink",
  text: "text-grey underline-offset-[4px] hover:text-ink hover:underline",
  danger: "border border-alert/35 bg-paper text-alert hover:border-alert hover:bg-alert/[0.04]",
  outline: "border border-ink/25 bg-paper text-ink hover:border-ink",
};

/** 버튼 모양 클래스 — 링크를 버튼처럼 보여야 할 때(ButtonLink)도 같은 모양을 쓴다 */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  const sizeClasses = variant === "text" ? TEXT_SIZE_CLASSES[size] : SIZE_CLASSES[size];
  return `${BASE} ${sizeClasses} ${VARIANT_CLASSES[variant]}`;
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
