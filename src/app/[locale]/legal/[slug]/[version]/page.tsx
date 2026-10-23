import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import LegalMarkdown from "@/components/legal/LegalMarkdown";
import PageShell from "@/components/shell/PageShell";
import { Link } from "@/i18n/navigation";
import { legalApi } from "@/lib/api";
import { LEGAL_SLUGS, type LegalSlug } from "@/types";

interface LegalVersionPageProps {
  params: Promise<{ locale: string; slug: string; version: string }>;
}

export const revalidate = 300;

/** 개정 이력의 예전(또는 시행 예정) 판. 지금 판으로 돌아가는 링크를 위에 둔다. */
export default async function LegalVersionPage({ params }: LegalVersionPageProps) {
  const { locale, slug, version: raw } = await params;
  if (!(LEGAL_SLUGS as readonly string[]).includes(slug) || !/^[1-9]\d{0,3}$/.test(raw)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "legal" });
  const found = await legalApi.getVersion(slug as LegalSlug, Number(raw)).catch(() => null);
  if (!found) notFound();

  return (
    <PageShell
      title={`${t(found.slug)} · ${t("version", { n: found.version })}`}
      meta={t("effective", { date: found.effectiveDtm.slice(0, 10) })}
    >
      <div className="flex flex-col gap-[40px]">
        <p className="m-0 max-w-[72ch] text-[13px] text-grey">
          {t("pastVersion")}{" "}
          <Link href={`/legal/${found.slug}`} className="underline hover:text-ink">
            {t("current")}
          </Link>
        </p>
        <LegalMarkdown source={found.body} />
      </div>
    </PageShell>
  );
}
