"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LoginPage() {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 실제 인증 로직 연결
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      {/* 로고 */}
      <Link href="/" className="mb-14">
        <Image
          src="/logo.png"
          alt="SUACI"
          width={120}
          height={40}
          priority
          className="h-5 sm:h-6 w-auto object-contain brightness-0"
        />
      </Link>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col gap-4">
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

        {/* 로그인 버튼 */}
        <button
          type="submit"
          className="w-full bg-foreground text-white text-xs tracking-[0.15em] font-medium py-4 mt-4 hover:bg-foreground/85 transition-colors"
        >
          {t("loginButton")}
        </button>

        {/* OR 구분선 */}
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-foreground/10" />
          <span className="text-[10px] tracking-[0.2em] text-foreground/30">
            {t("or")}
          </span>
          <div className="flex-1 h-px bg-foreground/10" />
        </div>

        {/* Google 로그인 */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 border border-foreground/15 py-3.5 text-xs tracking-[0.05em] text-foreground/70 hover:border-foreground/40 hover:text-foreground transition-colors"
        >
          <GoogleIcon />
          {t("googleLogin")}
        </button>
      </form>

      {/* 하단 — 회원가입 */}
      <p className="mt-10 text-xs text-foreground/40">
        {t("noAccount")}{" "}
        <Link
          href="#"
          className="text-foreground underline underline-offset-4 hover:text-foreground/60 transition-colors"
        >
          {t("signUp")}
        </Link>
      </p>
    </div>
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
