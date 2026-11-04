"use client";

import { Suspense, useEffect, useState } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import {
  afterLoginPath,
  readLastProvider,
  unlockedProviders,
  visibleProviders,
} from "@/lib/auth/social";
import { useAuth } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";
import type { SocialProvider } from "@/types";

/**
 * 로그인·가입 한 화면 — 처음 온 사람도 같은 소셜 버튼으로 가입한다. 이메일·비밀번호는 접어 둔다.
 * ?next= 가 있으면 로그인 뒤 그 경로로(같은 사이트 경로만, 없으면 내 계정). 이미 로그인했으면 바로 보낸다.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function LoginBody() {
  const t = useTranslations("auth");
  const tp = useTranslations("pay.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status, refresh } = useAuth();

  const justReset = searchParams.get("reset") === "1";
  const next = afterLoginPath(searchParams.get("next"));

  const [showEmail, setShowEmail] = useState(justReset);
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    // 다른 탭에서 로그아웃했거나 토큰이 만료돼 지워졌는데 화면 상태만 남은 경우 — 바로 보내면 주문서와 여기를 왔다 갔다 한다.
    // 토큰이 없으면 상태를 다시 확인해(로그인 풀림) 폼을 보여 준다
    if (!tokenStore.getAccessToken()) {
      void refresh();
      return;
    }
    router.replace(next);
  }, [status, router, next, refresh]);

  // 다른 버튼으로 들어오면 계정이 하나 더 생긴다 — 지난번 버튼을 알려 준다(지금 보이는 버튼일 때만)
  useEffect(() => {
    Promise.resolve().then(() => {
      const last = readLastProvider();
      const visible = visibleProviders(unlockedProviders(window.location.search));
      setLastProvider(last && visible.includes(last) ? last : null);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setHasError(false);
    try {
      // 성공하면 status 가 authenticated 로 바뀌고 위 효과가 next 로 보낸다
      await login(email, password);
    } catch {
      setHasError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={tp("title")} meta={t("loginSub")}>
      <div className="flex max-w-[400px] flex-col">
        {justReset && (
          <p role="status" className="m-0 mb-[24px] text-[15px] text-ink">
            {t("resetDone")}
          </p>
        )}

        {/* 소셜 로그인 — 카카오·네이버만(오너 결정 #93). 공식 버튼은 손대지 않는다 */}
        <SocialLoginButtons next={next} />
        {lastProvider && (
          <p className="m-0 mt-[14px] flex items-center gap-[8px] text-[13px] text-grey">
            <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-lime" />
            {t("lastUsed", { provider: t(`provider.${lastProvider}`) })}
          </p>
        )}

        {/* 이메일은 접어 둔다(결정 2: 숨김, 삭제 아님) */}
        <div className="mt-[36px] border-t border-line pt-[20px]">
          {!showEmail ? (
            <button
              type="button"
              onClick={() => {
                setShowEmail(true);
              }}
              className="-my-[10px] inline-flex min-h-[44px] cursor-pointer items-center text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
            >
              {t("emailLogin")}
            </button>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
                <InputField
                  label={t("email")}
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                />
                <InputField
                  label={t("password")}
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                />
                {hasError && (
                  <p role="alert" className="m-0 text-[13px] text-alert">
                    {t("loginError")}
                  </p>
                )}
                <Button type="submit" disabled={busy} className="mt-[4px]">
                  {t("submitLogin")}
                </Button>
              </form>
              <div className="mt-[20px] flex flex-col gap-[10px] text-[13px] text-grey">
                <Link
                  href="/password/forgot"
                  className="-mb-[8px] inline-flex min-h-[44px] items-center self-start hover:text-ink"
                >
                  {t("forgotPassword")}
                </Link>
                <p className="m-0">
                  {t("noAccount")}{" "}
                  <Link
                    href={{ pathname: "/signup", query: { next } }}
                    className="text-ink underline underline-offset-[3px]"
                  >
                    {t("goSignup")}
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
