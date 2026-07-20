"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * 로그인 — mock ApiClient 계약(login → getMe) 호출.
 * 백엔드 연결 시 NEXT_PUBLIC_API_MODE 스위칭 외 수정 불필요.
 */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/account");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell no="AC" title={<>Sign <em>in</em></>} meta={t("loginSub")}>
      <div className="max-w-[440px]">
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
          {error && (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] m-0">
              ✕ {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-[6px]">
            {busy ? "..." : t("submitLogin")}
          </Button>
        </form>

        <p className="mt-[24px] font-mono text-[11px] uppercase tracking-[0.08em] text-grey">
          {t("noAccount")}{" "}
          <Link href="/signup" className="text-ink underline underline-offset-[3px] hover:text-acid-deep">
            {t("goSignup")} →
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
