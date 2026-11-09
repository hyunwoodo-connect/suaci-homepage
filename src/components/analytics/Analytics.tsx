import { getTranslations } from "next-intl/server";

import { analyticsIds } from "@/lib/analytics";

import ConsentedAnalytics from "./ConsentedAnalytics";

interface AnalyticsProps {
  /** 배너 문구 언어. 이벤트 화면(언어 접두사 없음)은 ko */
  locale: string;
}

/**
 * GA4·메타 픽셀. `NEXT_PUBLIC_GA4_ID`·`NEXT_PUBLIC_META_PIXEL_ID`가 있을 때만, 그리고 방문자가 허용한 뒤에만 싣는다.
 * ID 가 하나도 없으면 아무것도 안 그린다(동의 배너도 없다 — 물어볼 도구가 없다).
 * GA4는 화면 이동(history)을 스스로 세고, 픽셀은 이동마다 PageView를 따로 보낸다
 */
export default async function Analytics({ locale }: AnalyticsProps) {
  const ids = analyticsIds(process.env.NEXT_PUBLIC_GA4_ID, process.env.NEXT_PUBLIC_META_PIXEL_ID);
  if (!ids.ga4 && !ids.pixel) return null;
  const t = await getTranslations({ locale, namespace: "consent" });
  const disclosures = t.raw("disclosures") as string[];
  const copy = {
    title: t("title"),
    body: t("body"),
    disclosures,
    more: t("more"),
    allow: t("allow"),
    decline: t("decline"),
    details: t("details"),
  };
  const privacyHref = locale === "ko" ? "/legal/privacy" : `/${locale}/legal/privacy`;
  return <ConsentedAnalytics ids={ids} copy={copy} privacyHref={privacyHref} />;
}
