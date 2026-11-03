"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";
import { notFound, useParams, useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isSocialProvider,
  rememberLastProvider,
  safeNextPath,
  socialRedirectUri,
  stashSignup,
  takeLoginState,
} from "@/lib/auth/social";
import type { SocialProvider } from "@/types";

/**
 * 소셜 로그인 콜백 — 프로바이더(또는 목업 동의 화면)가 code·state 를 들고 돌아오는 곳.
 * state 가 저장된 nonce 와 다르면 교환 없이 안내만(위조 방지). 처음 온 사람은 /auth/consent 로.
 * 모르는 프로바이더 경로는 404.
 */
export default function CallbackPage() {
  const { provider } = useParams<{ provider: string }>();
  if (!isSocialProvider(provider)) notFound();

  return (
    <Suspense>
      <CallbackBody provider={provider} />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/**
 * 안 된 경우 셋 — 손님이 동의 화면에서 취소(declined) / 프로바이더가 다른 이유로 돌려보냄(refused,
 * 예: 검수 전 네이버 앱에 멤버가 아닌 사람) / 우리 쪽 왕복이 끊김(broken: state 불일치·코드 없음·교환 실패).
 */
type Phase =
  | { kind: "working" }
  | { kind: "declined" | "refused" | "broken"; next: string };

/** 어디서 왔는지 모를 때 다시 로그인하면 갈 곳 — 로그인 화면의 기본값과 같다 */
const FALLBACK_NEXT = "/account";

interface CallbackBodyProps {
  provider: SocialProvider;
}

function CallbackBody({ provider }: CallbackBodyProps) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const search = useSearchParams();
  const { adoptTokens } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const ran = useRef(false);

  useEffect(() => {
    // StrictMode 이중 실행 방지 — state 는 한 번 읽으면 사라진다.
    // setState 는 전부 .then() 안에서(동기 setState 를 react-hooks 린트가 막는다).
    if (ran.current) return;
    ran.current = true;

    let next = FALLBACK_NEXT;
    Promise.resolve()
      .then(async () => {
        const saved = takeLoginState(search.get("state"));
        if (saved) next = safeNextPath(saved.next);
        const error = search.get("error");
        if (error) {
          setPhase({ kind: error === "access_denied" ? "declined" : "refused", next });
          return;
        }
        const code = search.get("code");
        if (!code || !saved) {
          setPhase({ kind: "broken", next });
          return;
        }
        const result = await api.socialSignIn(provider, {
          code,
          redirectUri: socialRedirectUri(window.location.origin, provider),
          state: search.get("state") ?? undefined,
        });
        if (result.status === "signed_in") {
          await adoptTokens(result.tokens);
          rememberLastProvider(provider);
          router.replace(next);
          return;
        }
        stashSignup({
          signupToken: result.signupToken,
          provider,
          ...(result.email ? { email: result.email } : {}),
          ...(result.name ? { name: result.name } : {}),
          next,
        });
        router.replace("/auth/consent");
      })
      .catch(() => {
        setPhase({ kind: "broken", next });
      });
  }, [adoptTokens, provider, router, search]);

  if (phase.kind === "working") {
    return (
      <PageShell title={t("callback.working")}>
        <span className="sr-only" role="status">
          {t("callback.working")}
        </span>
      </PageShell>
    );
  }

  const providerName = t(`provider.${provider}`);
  const copy = {
    declined: { title: t("callback.declinedTitle"), body: t("callback.declinedBody") },
    refused: {
      title: t("callback.refusedTitle", { provider: providerName }),
      body: t("callback.refusedBody"),
    },
    broken: { title: t("callback.brokenTitle"), body: t("callback.brokenBody") },
  }[phase.kind];

  return (
    <PageShell title={copy.title} meta={copy.body}>
      <div className="flex max-w-[400px] flex-col gap-[28px]">
        {/* 다시 하기 = 공식 버튼 그대로(같은 프로바이더로 다시, 또는 다른 쪽으로). 돌아갈 곳(next)은 이어 간다 */}
        <SocialLoginButtons next={phase.next} />
        <Link href="/" className="self-start text-[14px] text-grey underline underline-offset-[3px]">
          {tc("home")}
        </Link>
      </div>
    </PageShell>
  );
}
