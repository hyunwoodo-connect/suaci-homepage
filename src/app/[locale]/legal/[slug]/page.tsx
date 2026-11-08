import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import LegalMarkdown from "@/components/legal/LegalMarkdown";
import PageShell from "@/components/shell/PageShell";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { legalApi } from "@/lib/api";
import { LEGAL_SLUGS, type LegalSlug } from "@/types";

interface LegalPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

// 백엔드가 5분 캐시를 주므로 같은 주기로 다시 만든다. 네 문서 밖의 slug는 라우팅에서 404
export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t(slug as LegalSlug)} — suaci` };
}

/** 시행 중인 판 + (있으면) 시행 예고 + 개정 이력. 문서는 한국어로만 있어 다른 언어에서는 안내 한 줄을 붙인다. */
export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  // 빌드 때 미리 그리므로 백엔드가 잠깐 죽어도 빌드가 깨지지 않게 404로 둔다(5분 뒤 다시 만든다)
  const doc = await legalApi.get(slug as LegalSlug).catch(() => null);
  if (!doc) notFound();
  const others = LEGAL_SLUGS.filter((s) => s !== slug);
  const effectiveDate = doc.current.effectiveDtm.slice(0, 10);
  let upcomingNotice: string | undefined;
  if (doc.upcoming) {
    const upcomingDate = doc.upcoming.effectiveDtm.slice(0, 10);
    upcomingNotice = t("upcoming", { date: upcomingDate });
  }

  return (
    <PageShell title={t(doc.slug)} meta={t("effective", { date: effectiveDate })}>
      <div className="flex flex-col gap-[40px]">
        {locale !== "ko" && <p className="m-0 max-w-[72ch] text-[13px] text-grey">{t("koOnly")}</p>}
        {doc.upcoming && (
          <p className="m-0 max-w-[72ch] text-[13px] text-grey">
            {upcomingNotice}{" "}
            <Link
              href={`/legal/${doc.slug}/${doc.upcoming.version}`}
              className="underline hover:text-ink"
            >
              {t("version", { n: doc.upcoming.version })}
            </Link>
          </p>
        )}
        <LegalMarkdown source={doc.current.body} />
        {doc.history.length > 1 && (
          <section className="flex flex-col gap-[4px] text-[14px] text-grey">
            <h2 className="m-0 text-[14px] font-medium text-ink">{t("history")}</h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {doc.history.map((h) => (
                <li key={h.version}>
                  {h.version === doc.current.version ? (
                    <span className="inline-flex min-h-[44px] items-center">
                      {t("version", { n: h.version })} · {h.effectiveDtm.slice(0, 10)} ·{" "}
                      {t("current")}
                    </span>
                  ) : (
                    <Link
                      href={`/legal/${doc.slug}/${h.version}`}
                      className="inline-flex min-h-[44px] items-center underline underline-offset-[3px] hover:text-ink"
                    >
                      {t("version", { n: h.version })} · {h.effectiveDtm.slice(0, 10)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <nav
          aria-label={t("more")}
          className="flex flex-wrap gap-x-[20px] border-t border-line pt-[8px] text-[14px]"
        >
          {others.map((s) => (
            <Link
              key={s}
              href={`/legal/${s}`}
              className="inline-flex min-h-[44px] items-center text-grey hover:text-ink"
            >
              {t(s)}
            </Link>
          ))}
        </nav>
      </div>
    </PageShell>
  );
}
