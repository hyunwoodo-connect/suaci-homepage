"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { socialRedirectUri, takeLoginState } from "@/lib/auth/social";
import type { SocialProvider } from "@/types";

/**
 * 소셜 로그인 콜백 — 프로바이더(또는 목업 동의 화면)가 code·state 를 들고 돌아오는 곳.
 * state 가 저장된 nonce 와 다르면 교환 없이 안내만(위조 방지). 처음 온 사람은 /auth/consent 로.
 */
export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

type Phase = "working" | "declined" | "tangled";

function CallbackBody() {
  const t = useTranslations("pay");
  const router = useRouter();
  const params = useParams<{ provider: string }>();
  const search = useSearchParams();
  const { adoptTokens } = useAuth();
  const [phase, setPhase] = useState<Phase>("working");
  const ran = useRef(false);

  const provider = (params.provider === "naver" ? "naver" : "kakao") as SocialProvider;

  useEffect(() => {
    // StrictMode 이중 실행 방지 — state 는 한 번 읽으면 사라진다.
    // setState 는 전부 .then() 안에서(동기 setState 를 react-hooks 린트가 막는다).
    if (ran.current) return;
    ran.current = true;

    Promise.resolve()
      .then(async () => {
        if (search.get("error") === "access_denied") {
          setPhase("declined");
          return;
        }
        const code = search.get("code");
        const saved = takeLoginState(search.get("state"));
        if (!code || !saved) {
          setPhase("tangled");
          return;
        }
        const next = saved.next.startsWith("/") ? saved.next : "/";
        const result = await api.socialSignIn(provider, {
          code,
          redirectUri: socialRedirectUri(window.location.origin, provider),
        });
        if (result.status === "signed_in") {
          await adoptTokens(result.tokens);
          try {
            localStorage.setItem("suaci.auth.lastProvider", provider);
          } catch {}
          router.replace(next);
          return;
        }
        try {
          sessionStorage.setItem(
            "suaci.auth.signup",
            JSON.stringify({
              signupToken: result.signupToken,
              provider,
              email: result.email,
              name: result.name,
              next,
            }),
          );
        } catch {}
        router.replace("/auth/consent");
      })
      .catch(() => {
        setPhase("tangled");
      });
  }, [adoptTokens, provider, router, search]);

  return (
    <main>
      <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-4 px-4 text-center">
        {phase === "working" && <p className="text-sm text-grey">{t("result.confirming")}</p>}
        {phase === "declined" && (
          <>
            <p className="text-sm">{t(provider === "kakao" ? "login.declined" : "login.title")}</p>
            <Link href="/login" className="text-sm underline">
              {t("consent.toLogin")}
            </Link>
          </>
        )}
        {phase === "tangled" && (
          <>
            <p className="text-sm">{t("consent.tangled")}</p>
            <Link href="/login" className="text-sm underline">
              {t("consent.toLogin")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
