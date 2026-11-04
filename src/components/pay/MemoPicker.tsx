"use client";

import { useTranslations } from "next-intl";

import { DELIVERY_MEMOS, DELIVERY_MEMO_KEYS } from "@/constants/checkout";

import { CHIP, CHIP_OFF, CHIP_ON } from "./chip";

interface MemoPickerProps {
  memo: string;
  isCustom: boolean;
  onPick: (memo: string) => void;
  onCustom: () => void;
  onType: (memo: string) => void;
}

/**
 * 배송 메모 고르기 — 칩 셋 + '직접 쓸게요'. 값은 택배 기사에게 가는 한국어 그대로, 칩 이름만 언어별.
 * 주문서와 재구매 시트가 같이 쓴다.
 */
export default function MemoPicker({ memo, isCustom, onPick, onCustom, onType }: MemoPickerProps) {
  const t = useTranslations("pay");
  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      {DELIVERY_MEMOS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={memo === m && !isCustom}
          onClick={() => {
            onPick(m);
          }}
          className={`${CHIP} ${memo === m && !isCustom ? CHIP_ON : CHIP_OFF}`}
        >
          {t(`memo.${DELIVERY_MEMO_KEYS[m]}`)}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={isCustom}
        onClick={onCustom}
        className={`${CHIP} ${isCustom ? CHIP_ON : CHIP_OFF}`}
      >
        {t("sheet.customMemo")}
      </button>
      {isCustom && (
        <input
          value={memo}
          onChange={(e) => {
            onType(e.target.value);
          }}
          aria-label={t("sheet.memo")}
          maxLength={40}
          className="w-full border border-line bg-paper px-[12px] py-[11px] text-[16px] outline-none focus:border-ink"
          autoFocus
        />
      )}
    </div>
  );
}

/** 배송 메모를 화면 이름으로 — 고른 칩이면 그 언어의 이름, 직접 쓴 메모는 쓴 그대로 */
export function memoLabel(memo: string, t: (key: string) => string): string {
  // 직접 쓴 메모가 'constructor' 같은 이름이어도 객체 기본 속성을 집지 않게
  if (!Object.hasOwn(DELIVERY_MEMO_KEYS, memo)) return memo;
  return t(`memo.${(DELIVERY_MEMO_KEYS as Record<string, string>)[memo]}`);
}
