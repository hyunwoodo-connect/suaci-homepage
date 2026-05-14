"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Order — 50/50 사진 + 이메일 폼 섹션.
 *
 * 구조:
 * - 왼쪽: 풀블리드 사진 + stamp 오버레이
 * - 오른쪽: eyebrow + headline + body + 이메일 입력 + caps
 */
export default function OrderSection() {
  const t = useTranslations("order");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmail("");
    setSubmitted(true);
  };

  return (
    <section
      id="order"
      className="relative bg-background grid grid-cols-2 min-h-[640px] max-lg:grid-cols-1"
    >
      {/* Photo */}
      <div className="relative overflow-hidden bg-beige max-lg:h-[420px]">
        <Image
          src="/image/daily/daily-01.jpg"
          alt="도시의 거리, 일상의 한 컷"
          fill
          sizes="(max-width: 1100px) 100vw, 50vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(120deg,rgba(15,61,46,.18) 0%,rgba(15,61,46,0) 60%)",
          }}
        />
        <span className="absolute left-[32px] bottom-[32px] font-en text-[10px] tracking-[0.36em] uppercase text-white bg-[rgba(15,61,46,0.78)] px-[16px] py-[10px] leading-none">
          {t("stamp")}
        </span>
      </div>

      {/* Form */}
      <div className="py-[120px] px-[80px] flex flex-col justify-center gap-[32px] max-w-[680px] max-lg:px-[18px] max-lg:md:px-[32px] max-lg:py-[80px]">
        <span className="micro text-green font-medium">{t("eyebrow")}</span>
        <h2 className="m-0 font-serif font-light text-[clamp(40px,4.4vw,64px)] leading-[1.05] tracking-[-0.025em]">
          {t("headline1")}{" "}
          <span className="font-fraunces italic text-green">
            {t("headlineAccent")}
          </span>
        </h2>
        <p className="m-0 text-ink-soft text-[16px] leading-[1.85] max-w-[28ch]">
          {t("body")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex items-center border-b border-ink pb-[6px] mt-[8px]"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 border-0 bg-transparent py-[14px] text-[16px] outline-none text-ink"
          />
          <button
            type="submit"
            className="font-en text-[11px] tracking-[0.32em] uppercase text-ink py-[10px] px-[4px] inline-flex items-center gap-[14px] bg-transparent border-0 cursor-pointer"
          >
            {t("submit")} →
          </button>
        </form>

        <div className="flex justify-between font-en text-[11px] tracking-[0.18em] uppercase text-ink-mute">
          <span>{submitted ? t("success") : t("capLeft")}</span>
          <span>{t("capRight")}</span>
        </div>
      </div>
    </section>
  );
}
