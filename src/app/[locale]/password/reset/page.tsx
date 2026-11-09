"use client";

import { Suspense, useState } from "react";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PasswordField from "@/components/ui/PasswordField";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import {
  isPasswordMismatch,
  passwordProblem,
  WEAK_PASSWORD_CODES,
  type PasswordProblem,
} from "@/lib/auth/password";

/**
 * 비밀번호 재설정(resetPassword).
 * 이메일·인증코드·새 비밀번호(+ 확인 칸, 8자 이상) → 성공 시 로그인으로 이동.
 * ?email= 쿼리로 이메일 프리필. useSearchParams는 Suspense로 감싼다.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <PageShell title={t("resetTitle")} meta={t("resetSub")}>
      <div className="max-w-[440px]">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function ResetForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  // 보내려다 막힌 비밀번호 문제 — 고치기 시작하면 지운다
  const [passwordIssue, setPasswordIssue] = useState<PasswordProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(newPassword, newPasswordConfirm);
    if (problem) {
      setPasswordIssue(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({ email, code, newPassword });
      router.push({ pathname: "/login", query: { reset: "1" } });
    } catch (err) {
      if (err instanceof ApiClientError && WEAK_PASSWORD_CODES.includes(err.code)) {
        setPasswordIssue("tooShort");
        return;
      }
      const errorMessage = t("error");
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
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
          label={t("codeLabel")}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <PasswordField
          label={t("newPassword")}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          hint={t("passwordRule")}
          error={passwordIssue === "tooShort" ? t("passwordTooShort") : null}
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setPasswordIssue(null);
          }}
        />
        <PasswordField
          label={t("newPasswordConfirm")}
          required
          autoComplete="new-password"
          placeholder="••••••••"
          error={
            isPasswordMismatch(newPassword, newPasswordConfirm) || passwordIssue === "mismatch"
              ? t("passwordMismatch")
              : null
          }
          value={newPasswordConfirm}
          onChange={(e) => {
            setNewPasswordConfirm(e.target.value);
            setPasswordIssue(null);
          }}
        />
        {error && (
          <p role="alert" className="m-0 text-[13px] text-alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-[4px]">
          {t("submitReset")}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-[16px] inline-flex min-h-[44px] items-center text-[14px] text-grey hover:text-ink"
      >
        {t("backToLogin")}
      </Link>
    </>
  );
}
