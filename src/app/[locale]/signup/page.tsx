"use client";

import { Suspense, useState } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import ConsentChecks from "@/components/auth/ConsentChecks";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { afterLoginPath } from "@/lib/auth/social";
import type { Consents } from "@/types";

type Step = "form" | "confirm";

/**
 * 이메일 회원가입 — 2단계. 로그인 화면의 이메일 칸에서 들어온다(소셜이 기본).
 * signup(이메일·비밀번호·이름·동의) → confirm(인증코드) → login → ?next= 로.
 */
export default function SignupPage() {
  return (
    <Suspense>
      <SignupBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function SignupBody() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const next = afterLoginPath(searchParams.get("next"));

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consents, setConsents] = useState<Consents>({
    terms: false,
    privacy: false,
    age: false,
    marketing: false,
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consents.terms || !consents.privacy || !consents.age) {
      setError(t("consent.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.signup({ email, password, name, consents });
      setStep("confirm");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.confirm({ email, code });
      await login(email, password);
      router.push(next);
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={t("signupTitle")} meta={step === "form" ? t("signupSub") : t("confirmSub")}>
      <div className="max-w-[440px]">
        {step === "form" ? (
          <form onSubmit={handleSignup} className="flex flex-col gap-[16px]">
            <InputField
              label={t("name")}
              required
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
            <InputField
              label={t("email")}
              type="email"
              required
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
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
            <div className="mt-[8px]">
              <ConsentChecks value={consents} onChange={setConsents} />
            </div>
            {error && <ErrorNote text={error} />}
            <Button type="submit" disabled={busy} className="mt-[4px]">
              {t("submitSignup")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-col gap-[16px]">
            <p className="m-0 text-[15px] text-ink">{t("confirmBody", { email })}</p>
            <InputField
              label={t("codeLabel")}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
              }}
            />
            {error && <ErrorNote text={error} />}
            <Button type="submit" disabled={busy} className="mt-[4px]">
              {t("submitConfirm")}
            </Button>
          </form>
        )}

        <p className="m-0 mt-[24px] text-[13px] text-grey">
          {t("hasAccount")}{" "}
          <Link
            href={{ pathname: "/login", query: { next } }}
            className="text-ink underline underline-offset-[3px]"
          >
            {t("goLogin")}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="m-0 text-[13px] text-alert">
      {text}
    </p>
  );
}
