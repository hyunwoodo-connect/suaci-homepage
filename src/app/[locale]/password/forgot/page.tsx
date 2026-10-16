"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";

/**
 * 비밀번호 찾기 — mock ApiClient 계약(forgotPassword) 호출.
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
    <PageShell title={<>Reset <em>password</em></>} meta={t("forgotSub")}>
      <div className="max-w-[440px]">
        {sent ? (
          <div className="flex flex-col gap-[18px]">
            <p className="text-[14px] leading-[1.7] text-ink m-0">
              {t("forgotSent", { email })}
            </p>
            <Link
              href={{ pathname: "/password/reset", query: { email } }}
              className="inline-flex items-center justify-center gap-[8px] px-[22px] py-[13px] font-sans text-[12px] bg-ink text-paper border border-line transition-colors hover:bg-paper hover:text-ink"
            >
              {t("goReset")} →
            </Link>
            <p className="mt-[6px] font-sans text-[11px] text-grey">
              <Link href="/login" className="text-grey hover:text-lime">
                {t("backToLogin")} →
              </Link>
            </p>
          </div>
        ) : (
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
              {error && (
                <p className="font-sans text-[11px] text-[#c0392b] m-0">
                  ✕ {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="mt-[6px]">
                {busy ? "..." : t("submitForgot")}
              </Button>
            </form>

            <p className="mt-[24px] font-sans text-[11px] text-grey">
              <Link href="/login" className="text-ink underline underline-offset-[3px] hover:text-lime">
                {t("backToLogin")} →
              </Link>
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
