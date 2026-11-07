"use client";

import { useTranslations } from "next-intl";

import { buttonClasses } from "@/components/ui/Button";

/** 이름을 아는 택배사 코드(orders.carrier.*) — 모르는 코드는 그대로 보여 준다 */
const CARRIER_CODES: readonly string[] = ["cj", "epost", "hanjin", "lotte", "logen"];

interface TrackingLineProps {
  carrier: string;
  trackingNumber: string;
  /** 택배사 배송 조회 링크(서버가 만든다). 없으면 버튼 없이 택배사·송장번호만 */
  trackingUrl?: string;
}

/** 택배사·송장번호와 '배송 조회'(택배사 화면, 새 탭) — 주문 발송·교환 새 제품 발송이 같이 쓴다 */
export default function TrackingLine({ carrier, trackingNumber, trackingUrl }: TrackingLineProps) {
  const t = useTranslations("orders");
  return (
    <div className="flex flex-wrap items-center gap-[8px_16px]">
      <span className="num text-[13px] text-grey">
        {CARRIER_CODES.includes(carrier) ? t(`carrier.${carrier}`) : carrier} {trackingNumber}
      </span>
      {trackingUrl && (
        // 택배사 화면이라 새 탭으로 — 주문 화면은 그대로 둔다
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("secondary", "sm")}
        >
          {t("trackShipment")}
        </a>
      )}
    </div>
  );
}
