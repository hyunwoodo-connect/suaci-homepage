/**
 * 언어별 사이트의 <html> — 메타데이터(제목·OG·hreflang)와 번역·로그인·카트 컨텍스트.
 * 이벤트 페이지(/events)는 [locale] 밖이라 자기 레이아웃을 쓴다.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import Analytics from "@/components/analytics/Analytics";
import { routing } from "@/i18n/routing";
import { SITE } from "@/constants/site";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CartProvider } from "@/lib/cart/cart-context";
import { PRETENDARD_CSS, PRETENDARD_JP_CSS } from "@/constants/fonts";
import { GEIST } from "@/lib/fonts";

import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const canonicalPath = locale === routing.defaultLocale ? "" : `/${locale}`;

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: SITE.name,
      locale,
      type: "website",
      // 여기서 openGraph를 새로 정의하면 루트 `app/opengraph-image.png`가 이어지지 않아 직접 건다
      images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: SITE.wordmark }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    alternates: {
      canonical: canonicalPath || "/",
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, l === routing.defaultLocale ? "/" : `/${l}`]),
      ),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={GEIST.variable}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
        {locale === "ja" && (
          <link rel="stylesheet" href={PRETENDARD_JP_CSS} crossOrigin="anonymous" />
        )}
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
