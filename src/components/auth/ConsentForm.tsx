"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";

/** 콜백이 sessionStorage 에 담아 둔 가입 표 */
export interface SignupStash {
  signupToken: string;
  provider: string;
  email?: string;
  name?: string;
  next: string;
}

interface ConsentFormProps {
  stash: SignupStash;
}

/**
 * 소셜 첫 가입 동의 — 필수 셋(약관·개인정보·만 14세) + 마케팅(선택, 기본 꺼짐).
 * 제출하면 가입 표(10분)를 계정으로 바꾼다. 만료면 다시 로그인 안내.
 */
export default function ConsentForm({ stash }: ConsentFormProps) {
  const t = useTranslations("pay.consent");
  const router = useRouter();
  const { adoptTokens } = useAuth();

  const [name, setName] = useState(stash.name ?? "");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<"required" | "expired" | "tangled" | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms || !privacy || !age) {
      setError("required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.socialComplete({
        signupToken: stash.signupToken,
        ...(name.trim() ? { name: name.trim() } : {}),
        consents: { terms, privacy, age, marketing },
      });
      await adoptTokens(tokens);
      try {
        localStorage.setItem("suaci.auth.lastProvider", stash.provider);
        sessionStorage.removeItem("suaci.auth.signup");
      } catch {}
      router.replace(stash.next.startsWith("/") ? stash.next : "/");
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.code === "SOCIAL_SIGNUP_EXPIRED"
          ? "expired"
          : "tangled",
      );
    } finally {
      setBusy(false);
    }
  };

  if (error === "expired" || error === "tangled") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm">{t(error)}</p>
        <Link href="/login" className="text-sm underline">
          {t("toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <InputField
        label={t("name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
      />
      <fieldset className="flex flex-col gap-3">
        <ConsentCheck label={t("terms")} checked={terms} onChange={setTerms} href="/legal/terms" />
        <ConsentCheck
          label={t("privacy")}
          checked={privacy}
          onChange={setPrivacy}
          href="/legal/privacy"
        />
        <ConsentCheck label={t("age")} checked={age} onChange={setAge} />
        <ConsentCheck label={t("marketing")} checked={marketing} onChange={setMarketing} />
      </fieldset>
      {error === "required" && (
        <p role="alert" className="text-sm text-red-600">
          {t("required")}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function ConsentCheck({
  label,
  checked,
  onChange,
  href,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-ink"
        />
        {label}
      </label>
      {href && (
        <Link href={href} target="_blank" className="shrink-0 text-xs text-grey underline">
          →
        </Link>
      )}
    </div>
  );
}
