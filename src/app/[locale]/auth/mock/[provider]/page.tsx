"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { envSocialMode, safeRedirectTarget } from "@/lib/auth/social";
import type { SocialProvider } from "@/types";

/**
 * 목업 동의 화면 — 실키 전 개발 대역. 실제 프로바이더 동의 화면 자리에서
 * `code=mock:{provider}:{이름}` 을 콜백으로 돌려보낸다. live/off 환경에서는 404.
 */
export default function MockConsentPage() {
  return (
    <Suspense>
      <MockConsentBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

const PROVIDER_STYLE: Record<SocialProvider, { bg: string; fg: string; label: string }> = {
  kakao: { bg: "#FEE500", fg: "#191919", label: "kakao" },
  naver: { bg: "#03C75A", fg: "#ffffff", label: "naver" },
};

function MockConsentBody() {
  const t = useTranslations("pay.mock");
  const params = useParams<{ provider: string }>();
  const search = useSearchParams();
  const [name, setName] = useState("mina");

  if (params.provider !== "kakao" && params.provider !== "naver") notFound();
  const provider = params.provider as SocialProvider;
  if (envSocialMode(provider) !== "mock") notFound();

  const redirectUri = search.get("redirect_uri") ?? "";
  const state = search.get("state") ?? "";
  const style = PROVIDER_STYLE[provider];

  const go = (query: string) => {
    // 같은 오리진만 — 이 화면은 운영 데모(mock 모드)에서도 열리므로 외부로 보내면 피싱 통로가 된다
    const target = safeRedirectTarget(redirectUri, window.location.origin);
    if (!target) return;
    window.location.assign(`${target}?${query}&state=${encodeURIComponent(state)}`);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-studio px-4">
      <div className="w-full max-w-[360px] border border-line bg-paper p-6">
        <div
          className="mb-5 flex h-12 items-center justify-center text-sm font-bold"
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {style.label}
        </div>
        <h1 className="mb-4 text-base font-medium">{t("title", { provider: style.label })}</h1>
        <label className="mb-5 block text-sm">
          {t("name")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 text-base"
            autoFocus
          />
        </label>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              go(`code=${encodeURIComponent(`mock:${provider}:${name.trim() || "mina"}`)}`);
            }}
            className="w-full py-3 text-sm font-medium"
            style={{ backgroundColor: style.bg, color: style.fg }}
          >
            {t("agree")}
          </button>
          <button
            type="button"
            onClick={() => {
              go("error=access_denied");
            }}
            className="w-full border border-line py-3 text-sm"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </main>
  );
}
