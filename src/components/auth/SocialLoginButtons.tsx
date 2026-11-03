"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  SOCIAL_PROVIDER_CONFIG,
  authorizeUrl,
  createLoginState,
  envClientId,
  envSocialMode,
  socialRedirectUri,
  unlockedProviders,
  visibleProviders,
} from "@/lib/auth/social";
import type { SocialProvider } from "@/types";

interface SocialLoginButtonsProps {
  /** 로그인 뒤 돌아갈 경로 */
  next: string;
}

/**
 * 소셜 로그인 버튼 — `SOCIAL_PROVIDERS` 순서대로. live 는 프로바이더로, mock 은 목업 동의 화면으로.
 * off(운영 + 키 없음)인 프로바이더는 빼고, 출시 전 숨긴 프로바이더(`NEXT_PUBLIC_SOCIAL_HIDDEN`)는 `?with=` 로 연 탭에서만 보인다.
 * 전부 빠지면 버튼 대신 준비 중 안내 한 줄.
 */
export default function SocialLoginButtons({ next }: SocialLoginButtonsProps) {
  const t = useTranslations("pay.login");
  const router = useRouter();

  // 숨긴 프로바이더를 연 탭인지는 주소·sessionStorage 를 봐야 해서 붙은 뒤에 정한다(서버 그림과 어긋나지 않게 처음엔 숨김)
  const [unlocked, setUnlocked] = useState<SocialProvider[]>([]);
  useEffect(() => {
    // setState 는 .then() 안에서(동기 setState 를 react-hooks 린트가 막는다)
    void Promise.resolve().then(() => {
      setUnlocked(unlockedProviders(window.location.search));
    });
  }, []);

  const providers = visibleProviders(unlocked);
  if (providers.length === 0) {
    return <p className="text-center text-[13px] text-grey">{t("preparing")}</p>;
  }

  const start = (provider: SocialProvider) => {
    const state = createLoginState(next);
    const url = authorizeUrl({
      provider,
      mode: envSocialMode(provider),
      clientId: envClientId(provider),
      redirectUri: socialRedirectUri(window.location.origin, provider),
      state,
    });
    if (!url) return;
    // 실제 프로바이더(절대 주소)는 전체 이동, 목업(앱 안 경로)은 라우터로
    if (url.startsWith("http")) window.location.assign(url);
    else router.push(url);
  };

  return (
    <div className="flex flex-col gap-[10px]">
      {providers.map((provider) => {
        const { bg, fg } = SOCIAL_PROVIDER_CONFIG[provider].colors;
        return (
          <button
            key={provider}
            type="button"
            onClick={() => {
              start(provider);
            }}
            className="h-[48px] cursor-pointer text-[14px] font-medium"
            style={{ backgroundColor: bg, color: fg }}
          >
            {t(provider)}
          </button>
        );
      })}
    </div>
  );
}
