"use client";

import { useTranslations } from "next-intl";

import type { PayMethodId } from "@/lib/payment/providers";

import { CHIP, CHIP_OFF, CHIP_ON } from "./chip";

interface MethodPickerProps {
  methods: PayMethodId[];
  value: PayMethodId;
  onChange: (m: PayMethodId) => void;
}

/** 결제수단 고르기 — 어댑터가 다루는 수단만 칩으로 */
export default function MethodPicker({ methods, value, onChange }: MethodPickerProps) {
  const t = useTranslations("pay.method");
  return (
    <div role="radiogroup" className="flex flex-wrap gap-[8px]">
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => {
            onChange(m);
          }}
          className={`${CHIP} ${value === m ? CHIP_ON : CHIP_OFF}`}
        >
          {t(m)}
        </button>
      ))}
    </div>
  );
}
