"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";

type Step = "form" | "confirm";

/**
 * 회원가입 — mock ApiClient 계약 2단계 플로우.
 * signup(이메일·비밀번호·이름·동의) → confirm(인증코드) → login.
 */
export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = terms && privacy && age;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.signup({
        email,
        password,
        name,
        consents: { terms, privacy, age, marketing },
      });
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
      router.push("/account");
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      no="AC"
      title={<>Join <em>suaci</em></>}
      meta={step === "form" ? t("signupSub") : t("confirmSub")}
    >
      <div className="max-w-[440px]">
        {step === "form" ? (
          <form onSubmit={handleSignup} className="flex flex-col gap-[18px]">
            <InputField
              label={t("name")}
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <fieldset className="border-[1.5px] border-ink p-[16px] m-0 flex flex-col gap-[10px]">
              <legend className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey px-[6px]">
                {t("consents")}
              </legend>
              <Consent checked={terms} onChange={setTerms} label={t("consentTerms")} />
              <Consent checked={privacy} onChange={setPrivacy} label={t("consentPrivacy")} />
              <Consent checked={age} onChange={setAge} label={t("consentAge")} />
              <Consent checked={marketing} onChange={setMarketing} label={t("consentMarketing")} optional />
            </fieldset>

            {error && <ErrorNote text={error} />}
            <Button type="submit" disabled={busy || !canSubmit} className="mt-[6px]">
              {busy ? "..." : t("submitSignup")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-col gap-[18px]">
            <p className="text-[14px] text-ink m-0">
              {t("confirmBody", { email })}
            </p>
            <InputField
              label={t("codeLabel")}
              required
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <ErrorNote text={error} />}
            <Button type="submit" disabled={busy} className="mt-[6px]">
              {busy ? "..." : t("submitConfirm")}
            </Button>
          </form>
        )}

        <p className="mt-[24px] font-mono text-[11px] uppercase tracking-[0.06em] text-grey">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-ink underline underline-offset-[3px] hover:text-acid-deep">
            {t("goLogin")} →
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Consent({
  checked,
  onChange,
  label,
  optional = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  optional?: boolean;
}) {
  return (
    <label className={`flex items-center gap-[10px] text-[13px] cursor-pointer ${optional ? "text-grey" : "text-ink"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-[15px] h-[15px] accent-[#121210]"
      />
      {label}
    </label>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#c0392b] m-0">
      ✕ {text}
    </p>
  );
}
