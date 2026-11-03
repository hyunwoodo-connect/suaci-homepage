"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { Consents } from "@/types";

interface ConsentChecksProps {
  value: Consents;
  onChange: (next: Consents) => void;
}

/** 가입 동의 줄 — 약관·개인정보는 새 탭으로 본문을 열 수 있다(적던 칸이 날아가지 않게) */
const ROWS: ReadonlyArray<{ key: keyof Consents; href?: "/legal/terms" | "/legal/privacy" }> = [
  { key: "terms", href: "/legal/terms" },
  { key: "privacy", href: "/legal/privacy" },
  { key: "age" },
  { key: "marketing" },
] as const;

/**
 * 가입 동의 체크 — 맨 위 '모두 동의' 한 번이면 네 줄이 다 켜진다(선택인 소식 받기 포함, 줄마다 필수·선택 표시).
 * 소셜 첫 가입(ConsentForm)과 이메일 가입이 같이 쓴다.
 */
export default function ConsentChecks({ value, onChange }: ConsentChecksProps) {
  const t = useTranslations("auth.consent");
  const isAll = ROWS.every((row) => value[row.key]);

  const setAll = (checked: boolean) => {
    onChange({ terms: checked, privacy: checked, age: checked, marketing: checked });
  };

  return (
    <fieldset className="m-0 min-w-0 border border-line p-0">
      <legend className="sr-only">{t("all")}</legend>
      <label className="flex min-h-[52px] cursor-pointer items-center gap-[12px] border-b border-line px-[16px] text-[15px] font-medium">
        <input
          type="checkbox"
          checked={isAll}
          onChange={(e) => {
            setAll(e.target.checked);
          }}
          className="size-[18px] shrink-0 accent-ink"
        />
        {t("all")}
      </label>
      <ul className="m-0 flex list-none flex-col px-[16px] py-[8px]">
        {ROWS.map((row) => (
          <li key={row.key} className="flex min-h-[40px] items-center justify-between gap-[12px]">
            <label className="flex cursor-pointer items-center gap-[12px] text-[14px]">
              <input
                type="checkbox"
                checked={value[row.key]}
                onChange={(e) => {
                  onChange({ ...value, [row.key]: e.target.checked });
                }}
                className="size-[18px] shrink-0 accent-ink"
              />
              {t(row.key)}
            </label>
            {row.href && (
              <Link
                href={row.href}
                target="_blank"
                aria-label={`${t(row.key)} ${t("view")}`}
                className="shrink-0 text-[13px] text-grey underline underline-offset-[3px] hover:text-ink"
              >
                {t("view")}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
