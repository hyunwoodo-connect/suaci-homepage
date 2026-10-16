"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";

/**
 * 비밀번호 재설정 — mock ApiClient 계약(resetPassword) 호출.
 * 이메일·인증코드·새 비밀번호 → 성공 시 로그인으로 이동.
 * ?email= 쿼리로 이메일 프리필. useSearchParams는 Suspense로 감싼다.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <PageShell title={<>Reset <em>password</em></>} meta={t("resetSub")}>
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

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({ email, code, newPassword });
      router.push("/login");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
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
          label={t("codeLabel")}
          required
          inputMode="numeric"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <InputField
          label={t("newPassword")}
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && (
          <p className="font-sans text-[11px] text-[#c0392b] m-0">
            ✕ {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-[6px]">
          {busy ? "..." : t("submitReset")}
        </Button>
      </form>

      <p className="mt-[24px] font-sans text-[11px] text-grey">
        <Link href="/login" className="text-ink underline underline-offset-[3px] hover:text-lime">
          {t("backToLogin")} →
        </Link>
      </p>
    </>
  );
}
