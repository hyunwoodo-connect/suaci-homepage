import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

/**
 * 언어 레이아웃 밖에서 난 404(이벤트 주소 등). 언어 안의 404 는 `[locale]/not-found` 가 그린다.
 * 글꼴·셸이 없는 자리라 기본 언어(한국어) 문구와 홈 버튼 하나만 둔다.
 */
export default async function NotFound() {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "common" });
  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
          color: "#141414",
          background: "#ffffff",
          margin: 0,
          padding: "0 16px",
          wordBreak: "keep-all",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 400, margin: 0 }}>{t("notFoundTitle")}</h1>
          <p style={{ margin: "12px 0 28px", color: "#5f5f5c", fontSize: "15px" }}>
            {t("notFoundBody")}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "52px",
              padding: "0 24px",
              borderRadius: "999px",
              background: "#141414",
              color: "#ffffff",
              fontSize: "15px",
              textDecoration: "none",
            }}
          >
            {t("home")}
          </Link>
        </div>
      </body>
    </html>
  );
}
