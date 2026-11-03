import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";

/** 없는 주소(모르는 소셜 콜백 포함) — 다른 화면과 같은 셸, 다음 행동은 홈으로 하나 */
export default function NotFound() {
  const t = useTranslations("common");
  return (
    <PageShell title={t("notFoundTitle")} meta={t("notFoundBody")}>
      <Link
        href="/"
        className="inline-flex h-[52px] items-center justify-center rounded-full bg-ink px-[24px] text-[15px] font-medium text-paper transition-colors hover:bg-ink-soft"
      >
        {t("home")}
      </Link>
    </PageShell>
  );
}
