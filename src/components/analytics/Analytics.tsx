import Script from "next/script";

import { analyticsIds } from "@/lib/analytics";

import PixelPageViews from "./PixelPageViews";

/**
 * GA4·메타 픽셀 스크립트. `NEXT_PUBLIC_GA4_ID`·`NEXT_PUBLIC_META_PIXEL_ID`가 있을 때만 싣는다(없으면 아무것도 안 그린다).
 * GA4는 화면 이동(history)을 스스로 세고, 픽셀은 이동마다 PageView를 따로 보낸다
 */
export default function Analytics() {
  const { ga4, pixel } = analyticsIds(
    process.env.NEXT_PUBLIC_GA4_ID,
    process.env.NEXT_PUBLIC_META_PIXEL_ID,
  );
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
