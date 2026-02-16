"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function SignupPage() {
  const t = useTranslations("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");

  // 약관 동의
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);

  const requiredChecked = agreeTerms && agreePrivacy && agreeAge;

  const handleAgreeAll = () => {
    const next = !agreeAll;
    setAgreeAll(next);
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeMarketing(next);
    setAgreeAge(next);
  };

  const handleIndividual = (
    setter: (v: boolean) => void,
    value: boolean
  ) => {
    setter(value);
    // agreeAll 상태는 개별 체크 후 동기화
    if (!value) setAgreeAll(false);
  };

  // 개별 체크박스 변경 시 전체동의 동기화
  const syncAgreeAll = (
    terms: boolean,
    privacy: boolean,
    marketing: boolean,
    age: boolean
  ) => {
    if (terms && privacy && marketing && age) setAgreeAll(true);
    else setAgreeAll(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 실제 회원가입 로직
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-16 relative">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-foreground/40 hover:text-foreground transition-colors"
        aria-label="Back to home"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* 로고 */}
      <Link href="/" className="mb-12">
        <Image
          src="/logo.png"
          alt="SUACI"
          width={120}
          height={40}
          priority
          className="h-5 sm:h-6 w-auto object-contain brightness-0"
        />
      </Link>

      {/* 타이틀 */}
      <h1 className="text-lg sm:text-xl font-bold tracking-[-0.02em] mb-10">
        {t("title")}
      </h1>

      <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col gap-4">
        {/* 이름 */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("name")}
          required
          className="w-full border-b border-foreground/20 bg-transparent py-3 text-sm tracking-[-0.01em] placeholder:text-foreground/30 focus:border-foreground focus:outline-none transition-colors"
        />

        {/* 이메일 */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("email")}
          required
          className="w-full border-b border-foreground/20 bg-transparent py-3 text-sm tracking-[-0.01em] placeholder:text-foreground/30 focus:border-foreground focus:outline-none transition-colors"
        />

        {/* 비밀번호 */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          required
          className="w-full border-b border-foreground/20 bg-transparent py-3 text-sm tracking-[-0.01em] placeholder:text-foreground/30 focus:border-foreground focus:outline-none transition-colors"
        />

        {/* 비밀번호 확인 */}
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder={t("passwordConfirm")}
          required
          className="w-full border-b border-foreground/20 bg-transparent py-3 text-sm tracking-[-0.01em] placeholder:text-foreground/30 focus:border-foreground focus:outline-none transition-colors"
        />

        {/* 구분선 */}
        <div className="h-px bg-foreground/10 my-4" />

        {/* 약관 동의 */}
        <div className="flex flex-col gap-3">
          {/* 전체 동의 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={agreeAll}
              onChange={handleAgreeAll}
            />
            <span className="text-sm font-semibold">{t("agreeAll")}</span>
          </label>

          <div className="h-px bg-foreground/10 my-1" />

          {/* 이용약관 (필수) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={agreeTerms}
              onChange={(v) => {
                handleIndividual(setAgreeTerms, v);
                syncAgreeAll(v, agreePrivacy, agreeMarketing, agreeAge);
              }}
            />
            <span className="text-xs text-foreground/70">
              {t("agreeTerms")}
              <Required />
            </span>
          </label>

          {/* 개인정보 (필수) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={agreePrivacy}
              onChange={(v) => {
                handleIndividual(setAgreePrivacy, v);
                syncAgreeAll(agreeTerms, v, agreeMarketing, agreeAge);
              }}
            />
            <span className="text-xs text-foreground/70">
              {t("agreePrivacy")}
              <Required />
            </span>
          </label>

          {/* 만 14세 이상 (필수) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={agreeAge}
              onChange={(v) => {
                handleIndividual(setAgreeAge, v);
                syncAgreeAll(agreeTerms, agreePrivacy, agreeMarketing, v);
              }}
            />
            <span className="text-xs text-foreground/70">
              {t("agreeAge")}
              <Required />
            </span>
          </label>

          {/* 마케팅 수신 (선택) */}
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={agreeMarketing}
              onChange={(v) => {
                handleIndividual(setAgreeMarketing, v);
                syncAgreeAll(agreeTerms, agreePrivacy, v, agreeAge);
              }}
            />
            <span className="text-xs text-foreground/70">
              {t("agreeMarketing")}
              <Optional />
            </span>
          </label>
        </div>

        {/* 회원가입 버튼 */}
        <button
          type="submit"
          disabled={!requiredChecked}
          className={`w-full text-xs tracking-[0.15em] font-medium py-4 mt-6 transition-colors ${
            requiredChecked
              ? "bg-foreground text-white hover:bg-foreground/85"
              : "bg-foreground/20 text-foreground/40 cursor-not-allowed"
          }`}
        >
          {t("signUpButton")}
        </button>

        {/* OR 구분선 */}
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-foreground/10" />
          <span className="text-[10px] tracking-[0.2em] text-foreground/30">
            {t("or")}
          </span>
          <div className="flex-1 h-px bg-foreground/10" />
        </div>

        {/* Google 회원가입 */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 border border-foreground/15 py-3.5 text-xs tracking-[0.05em] text-foreground/70 hover:border-foreground/40 hover:text-foreground transition-colors"
        >
          <GoogleIcon />
          {t("googleSignUp")}
        </button>
      </form>

      {/* 하단 — 이미 계정이 있는 경우 */}
      <p className="mt-10 text-xs text-foreground/40">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4 hover:text-foreground/60 transition-colors"
        >
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}

/* ─── 체크박스 ──────────────────────────────────── */

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-[18px] h-[18px] shrink-0 border flex items-center justify-center transition-colors ${
        checked
          ? "bg-foreground border-foreground"
          : "bg-transparent border-foreground/25 hover:border-foreground/50"
      }`}
    >
      {checked && (
        <svg
          width="10"
          height="8"
          viewBox="0 0 10 8"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
    </button>
  );
}

/* ─── 필수/선택 뱃지 ────────────────────────────── */

function Required() {
  return (
    <span className="ml-1.5 text-[10px] tracking-[0.05em] text-foreground/40">
      *
    </span>
  );
}

function Optional() {
  return (
    <span className="ml-1.5 text-[10px] tracking-[0.05em] text-foreground/25">
      (optional)
    </span>
  );
}

/* ─── Google 아이콘 ──────────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.42l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}
