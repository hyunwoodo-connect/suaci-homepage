"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  authorizeUrl,
  createLoginState,
  envClientId,
  envSocialMode,
  socialRedirectUri,
} from "@/lib/auth/social";
import type { SocialProvider } from "@/types";

interface SocialLoginButtonsProps {
  /** 로그인 뒤 돌아갈 경로 */
  next: string;
}

/**
 * 카카오·네이버 로그인 버튼(결정: 이 둘만). live 는 프로바이더로, mock 은 목업 동의 화면으로.
 * 둘 다 off(운영 + 키 없음)면 버튼 대신 준비 중 안내 한 줄.
 */
export default function SocialLoginButtons({ next }: SocialLoginButtonsProps) {
  const t = useTranslations("pay.login");
  const router = useRouter();

  const providers = (["kakao", "naver"] as const).filter((p) => envSocialMode(p) !== "off");
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
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => {
            start(provider);
          }}
          className="h-[48px] cursor-pointer text-[14px] font-medium"
          style={
            provider === "kakao"
              ? { backgroundColor: "#FEE500", color: "#191919" }
              : { backgroundColor: "#03C75A", color: "#ffffff" }
          }
        >
          {t(provider)}
        </button>
      ))}
    </div>
  );
}
