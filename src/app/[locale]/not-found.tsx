import { useTranslations } from "next-intl";

import PageShell from "@/components/shell/PageShell";
import ButtonLink from "@/components/ui/ButtonLink";

/** 없는 주소(모르는 소셜 콜백 포함) — 다른 화면과 같은 셸, 다음 행동은 홈으로 하나 */
export default function NotFound() {
  const t = useTranslations("common");
  return (
    <PageShell title={t("notFoundTitle")} meta={t("notFoundBody")}>
      <ButtonLink href="/">{t("home")}</ButtonLink>
    </PageShell>
  );
}
