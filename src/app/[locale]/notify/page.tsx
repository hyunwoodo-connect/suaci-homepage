import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PageShell from "@/components/shell/PageShell";
import WaitlistForm from "@/components/waitlist/WaitlistForm";

interface NotifyPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ utm_source?: string; ref?: string }>;
}

export async function generateMetadata({ params }: NotifyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "waitlist" });
  return { title: `${t("title")} — suaci` };
}

/**
 * 출시 알림 받기(대기 명단). 출시 전 잠금 밖에 있는 유일한 화면이다(12월 티저 링크가 여기로 온다).
 * 유입은 ?utm_source= 또는 ?ref= 로 받아 그대로 넘긴다
 */
export default async function NotifyPage({ params, searchParams }: NotifyPageProps) {
  const { locale } = await params;
  const { utm_source, ref } = await searchParams;
  const t = await getTranslations({ locale, namespace: "waitlist" });
  return (
    <PageShell title={t("title")} meta={t("meta")}>
      <WaitlistForm locale={locale} source={utm_source || ref || undefined} />
    </PageShell>
  );
}
