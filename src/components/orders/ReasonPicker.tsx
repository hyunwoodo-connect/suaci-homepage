"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import type { ReasonCode } from "@/types";

interface ReasonPickerProps<R extends ReasonCode> {
  legend: string;
  reasons: readonly R[];
  value: R;
  onChange: (r: R) => void;
  /** 고를 수 없는 사유(기한 지난 단순 변심) */
  isDisabled?: (r: R) => boolean;
  /** 칩 아래 한 줄(왜 못 고르는지·다른 길) */
  children?: ReactNode;
}

/** 취소·반품·교환 사유 칩 — 값은 API 값(한국어 코드) 그대로, 화면 이름만 `claims.reasonCode.*` */
export default function ReasonPicker<R extends ReasonCode>({
  legend,
  reasons,
  value,
  onChange,
  isDisabled,
  children,
}: ReasonPickerProps<R>) {
  const tc = useTranslations("claims");
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-[12px] p-0 text-[16px] font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-[8px]">
        {reasons.map((code) => {
          const active = value === code;
          // 좁은 사유 타입(R)은 메시지 키 타입을 못 푼다 — 넓은 ReasonCode 로 읽는다
          const name: ReasonCode = code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              disabled={isDisabled?.(code) ?? false}
              onClick={() => onChange(code)}
              className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
            >
              {tc(`reasonCode.${name}`)}
            </button>
          );
        })}
      </div>
      {children}
    </fieldset>
  );
}
