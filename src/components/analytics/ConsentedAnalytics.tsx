"use client";

import Script from "next/script";

import { useAnalyticsConsent } from "@/lib/analytics-consent";
import type { AnalyticsIds } from "@/lib/analytics";

import ConsentBanner, { type ConsentCopy } from "./ConsentBanner";
import PixelPageViews from "./PixelPageViews";

interface ConsentedAnalyticsProps {
  ids: AnalyticsIds;
  copy: ConsentCopy;
  privacyHref: string;
}

/**
 * 동의에 따라 GA4·메타 픽셀을 싣는다 — 허용이면 싣고, 거부면 아무것도, 아직 고르지 않았으면 배너만.
 * 서버 그림에서는 동의를 모르므로 아무것도 그리지 않는다(첫 그림 뒤에 정해진다).
 */
export default function ConsentedAnalytics({ ids, copy, privacyHref }: ConsentedAnalyticsProps) {
  const consent = useAnalyticsConsent();
  if (consent === undefined || consent === "denied") return null;
  if (consent === null) return <ConsentBanner copy={copy} privacyHref={privacyHref} />;
  const { ga4, pixel } = ids;
  return (
    <>
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      )}
      {pixel && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');`}
          </Script>
          <PixelPageViews />
        </>
      )}
    </>
  );
}
