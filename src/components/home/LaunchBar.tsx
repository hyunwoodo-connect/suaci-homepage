import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { PRODUCT } from "@/constants/product";
import { formatKRW } from "@/lib/format";

/**
 * 판매를 열기 전 하단 바(`SALES_OPEN` false). 사기 바와 같은 자리·모양으로 가격을 보여 주고,
 * 구매 대신 출시 알림 받기로 보낸다 — 판매를 열기 전에는 손님이 주문할 수 있으면 안 된다(주문·결제 화면도 잠근다).
 */
export default function LaunchBar() {
  const t = useTranslations("pay.bar");

  return (
    // 바 높이(66+16px)만큼 끌어올려 푸터 아래에 빈 띠가 생기지 않게 한다(BuyBar 와 같다).
    <div className="pointer-events-none sticky bottom-0 z-20 -mt-[82px] flex flex-col items-center gap-[6px] px-[16px] pb-[16px]">
      <p className="m-0 text-[11px] text-grey">{t("soon")}</p>
      <div className="pointer-events-auto flex h-[52px] items-center gap-[12px] rounded-full bg-ink pl-[20px] pr-[8px] text-paper shadow-[0_6px_24px_rgba(17,17,17,0.18)]">
        <span className="num text-[14px]">{formatKRW(PRODUCT.price)}</span>
        <Link
          href="/notify"
          className="flex h-[36px] items-center rounded-full bg-lime px-[16px] text-[14px] font-medium text-ink"
        >
          {t("notify")}
        </Link>
      </div>
    </div>
  );
}
