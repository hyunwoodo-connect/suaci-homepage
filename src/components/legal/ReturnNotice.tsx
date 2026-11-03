import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

interface ReturnNoticeProps {
  className?: string;
}

/**
 * 뜯거나 쓴 화장품은 단순 변심 반품이 안 된다는 고지 + 배송·교환·환불 안내 링크.
 * 전자상거래법 제17조제6항 — 소비자가 쉽게 알 수 있는 곳에 표시해야 반품 제한을 주장할 수 있어
 * 상품 화면·주문서·재구매 시트에 같은 문장으로 둔다.
 */
export default function ReturnNotice({ className = "" }: ReturnNoticeProps) {
  const t = useTranslations("legal");

  return (
    <p className={`m-0 text-[12px] leading-[1.6] text-grey ${className}`}>
      {t("returnNotice")} {t("seeMore")}{" "}
      <Link href="/legal/refund" className="underline underline-offset-[3px] hover:text-ink">
        {t("refund")}
      </Link>
    </p>
  );
}
