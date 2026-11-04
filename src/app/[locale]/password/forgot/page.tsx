"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import ButtonLink from "@/components/ui/ButtonLink";

/**
 * 비밀번호 찾기(forgotPassword).
 * 이메일 입력 → 인증코드 발송 → 성공 안내에서 재설정 페이지로 유도.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={t("forgotTitle")} meta={t("forgotSub")}>
      <div className="max-w-[440px]">
        {sent ? (
          <div className="flex flex-col gap-[16px]">
            <p role="status" className="m-0 text-[15px] text-ink">
              {t("forgotSent", { email })}
            </p>
            <ButtonLink href={{ pathname: "/password/reset", query: { email } }}>
              {t("goReset")}
            </ButtonLink>
            <Link href="/login" className="self-start text-[13px] text-grey hover:text-ink">
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
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
              {error && (
                <p role="alert" className="m-0 text-[13px] text-alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="mt-[4px]">
                {t("submitForgot")}
              </Button>
            </form>

            <Link
              href="/login"
              className="mt-[24px] inline-block text-[13px] text-grey hover:text-ink"
            >
              {t("backToLogin")}
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
}
