"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import ConsentChecks from "@/components/auth/ConsentChecks";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import {
  clearSignupStash,
  rememberLastProvider,
  safeNextPath,
  type SignupStash,
} from "@/lib/auth/social";
import type { Consents } from "@/types";

interface ConsentFormProps {
  stash: SignupStash;
}

const NONE: Consents = { terms: false, privacy: false, age: false, marketing: false };

/**
 * 소셜 첫 가입 동의 — 필수 셋(약관·개인정보·만 14세) + 마케팅(선택, 기본 꺼짐).
 * 제출하면 가입 표(10분)를 계정으로 바꾸고 원래 가던 곳(next)으로. 만료·끊김이면 그 자리에서 로그인 버튼을 다시 준다.
 */
export default function ConsentForm({ stash }: ConsentFormProps) {
  const t = useTranslations("auth.consent");
  const router = useRouter();
  const { adoptTokens } = useAuth();

  const [name, setName] = useState(stash.name ?? "");
  const [consents, setConsents] = useState<Consents>(NONE);
  const [error, setError] = useState<"required" | "expired" | "broken" | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNextPath(stash.next);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consents.terms || !consents.privacy || !consents.age) {
      setError("required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.socialComplete({
        signupToken: stash.signupToken,
        ...(name.trim() ? { name: name.trim() } : {}),
        consents,
      });
      await adoptTokens(tokens);
      rememberLastProvider(stash.provider);
      clearSignupStash();
      router.replace(next);
    } catch (err) {
      // 이 가입 표는 다시 못 쓴다 — 새로고침해도 죽은 폼이 남지 않게 지운다
      clearSignupStash();
      setError(
        err instanceof ApiClientError && err.code === "SOCIAL_SIGNUP_EXPIRED"
          ? "expired"
          : "broken",
      );
    } finally {
      setBusy(false);
    }
  };

  if (error === "expired" || error === "broken") {
    return (
      <div className="flex flex-col gap-[20px]">
        <p role="alert" className="m-0 text-[15px] text-ink">
          {t(error)}
        </p>
        <SocialLoginButtons next={next} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]" noValidate>
      <InputField
        label={t("name")}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        autoComplete="name"
      />
      <ConsentChecks
        value={consents}
        onChange={(v) => {
          setConsents(v);
          if (error === "required" && v.terms && v.privacy && v.age) setError(null);
        }}
      />
      {error === "required" && (
        <p role="alert" className="m-0 text-[13px] text-alert">
          {t("required")}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? t("working") : t("submit")}
      </Button>
      <p className="m-0 text-[13px] text-grey">
        {t("joinedElsewhere")}{" "}
        <Link
          href={{ pathname: "/login", query: { next } }}
          className="text-ink underline underline-offset-[3px]"
        >
          {t("toLogin")}
        </Link>
      </p>
    </form>
  );
}
