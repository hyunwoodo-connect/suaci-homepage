"use client";

import { useState, type ComponentProps } from "react";

import { useTranslations } from "next-intl";

import InputField from "./InputField";

type PasswordFieldProps = Omit<ComponentProps<typeof InputField>, "type" | "trailing">;

/**
 * 비밀번호 칸 — 오른쪽 끝 눈 단추로 글자를 보이고 숨긴다(잘못 친 것을 알 수 있게). 누르는 자리 44px,
 * 읽는 이름은 지금 할 동작('비밀번호 보기'·'비밀번호 숨기기')이다.
 */
export default function PasswordField(props: PasswordFieldProps) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? t("hidePassword") : t("showPassword");
  const inputType = visible ? "text" : "password";

  const toggle = (
    <button
      type="button"
      aria-label={toggleLabel}
      aria-pressed={visible}
      onClick={() => {
        setVisible((v) => !v);
      }}
      className="flex size-[44px] cursor-pointer items-center justify-center text-grey transition-colors hover:text-ink"
    >
      <EyeIcon crossed={visible} />
    </button>
  );

  return <InputField {...props} type={inputType} trailing={toggle} />;
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 눈 모양 — 글자가 보이는 중이면 빗금(누르면 숨긴다) */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      {crossed && (
        <path d="M3 17 17 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}
