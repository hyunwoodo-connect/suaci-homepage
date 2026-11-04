"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** 화면이 깨졌을 때 — 다시 시도(같은 화면) 또는 홈으로 */
export default function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("common");
  return (
    <PageShell title={t("errorTitle")} meta={t("errorBody")}>
      <div className="flex max-w-[400px] flex-col gap-[16px]">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center self-start text-[14px] text-grey underline underline-offset-[3px]"
        >
          {t("home")}
        </Link>
      </div>
    </PageShell>
  );
}
