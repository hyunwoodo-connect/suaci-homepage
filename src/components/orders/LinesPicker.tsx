"use client";

import { useTranslations } from "next-intl";

import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import type { Order } from "@/types";

import QtyStepper from "./QtyStepper";
import type { ClaimScope } from "./useLineSelection";

interface LinesPickerProps {
  order: Order;
  /** 줄마다 남은 수량 — 그만큼만 고른다(0이면 못 고른다) */
  left: Record<string, number>;
  scope: ClaimScope;
  onScope: (s: ClaimScope) => void;
  qty: Record<string, number>;
  onQty: (lineId: string, n: number) => void;
  /** 범위 칸 이름·두 칩 이름·아무것도 안 골랐을 때 한 줄 — 취소·반품·교환마다 다르다 */
  labels: { legend: string; full: string; partial: string; hint: string };
  partialEmpty: boolean;
}

/** 취소·반품·교환 폼의 범위(전체·일부) 칩과, 일부면 줄마다 수량 고르기 */
export default function LinesPicker({
  order,
  left,
  scope,
  onScope,
  qty,
  onQty,
  labels,
  partialEmpty,
}: LinesPickerProps) {
  const tc = useTranslations("claims");
  return (
    <>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] p-0 text-[13px] text-grey">{labels.legend}</legend>
        <div className="flex gap-[8px]">
          {(["full", "partial"] as const).map((s) => {
            const active = scope === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => onScope(s)}
                className={`${CHIP} flex-1 justify-center ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {s === "full" ? labels.full : labels.partial}
              </button>
            );
          })}
        </div>
      </fieldset>

      {scope === "partial" && (
        <ul className="m-0 list-none border border-line p-0">
          {order.items.map((item) => (
            <li
              key={item.lineId}
              className="flex flex-wrap items-center gap-[12px] border-b border-line px-[14px] py-[12px] last:border-b-0"
            >
              <div className="min-w-[140px] flex-1">
                <b className="block text-[15px] font-medium">{item.productName}</b>
                <span className="text-[13px] text-grey">
                  {item.optionName} · {tc("ownedQty", { n: left[item.lineId] ?? 0 })}
                </span>
              </div>
              <QtyStepper
                value={qty[item.lineId] ?? 0}
                max={left[item.lineId] ?? 0}
                onChange={(n) => onQty(item.lineId, n)}
              />
            </li>
          ))}
        </ul>
      )}
      {partialEmpty && <p className="m-0 text-[13px] text-grey">{labels.hint}</p>}
    </>
  );
}
