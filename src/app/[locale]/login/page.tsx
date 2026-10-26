"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import { safeNextPath } from "@/lib/auth/social";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * 로그인 — mock ApiClient 계약(login → getMe) 호출.
 * ?next= 파라미터가 있으면 로그인 후 해당 경로로 복귀(PDP 담기 게이트 등).
 * 백엔드 연결 시 NEXT_PUBLIC_API_MODE 스위칭 외 수정 불필요.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function LoginForm() {
  const t = useTranslations("auth");
  const tp = useTranslations("pay.login");
  const [showEmail, setShowEmail] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = () => {
    const next = searchParams.get("next");
    const safe = safeNextPath(next);
    return safe === "/" && next !== "/" ? "/account" : safe;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push(nextPath());
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title={
        <>
          Sign <em>in</em>
        </>
      }
      meta={t("loginSub")}
    >
      <div className="max-w-[440px]">
        {/* 소셜 로그인 — 카카오·네이버만(오너 결정 #93). 이메일 폼은 접어 둔다(결정 2: 숨김, 삭제 아님) */}
        <div className="mb-[28px] flex flex-col gap-[12px]">
          <SocialLoginButtons next={nextPath()} />
          <p className="m-0 text-center text-[12px] text-grey">{tp("hint")}</p>
          {!showEmail && (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="mx-auto mt-[4px] cursor-pointer text-[12px] text-grey underline underline-offset-[3px] hover:text-ink"
            >
              {t("emailLogin")}
            </button>
          )}
        </div>
        {showEmail && (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
              <InputField
                label={t("email")}
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <InputField
                label={t("password")}
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="font-sans text-[11px] text-[#c0392b] m-0">✕ {error}</p>}
              <Button type="submit" disabled={busy} className="mt-[6px]">
                {busy ? "..." : t("submitLogin")}
              </Button>
            </form>

            <p className="mt-[16px] font-sans text-[11px]">
              <Link href="/password/forgot" className="text-grey hover:text-lime">
                {t("forgotPassword")} →
              </Link>
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
