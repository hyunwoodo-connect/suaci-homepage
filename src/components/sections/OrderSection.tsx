"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Order — 출시 알림 이메일 등록 폼 (UI 쉘, 동작은 비어있음)
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
      className="order py-[140px] pb-[160px] border-t border-line max-md:py-[80px]"
    >
      <div className={SHELL}>
        <div className="grid grid-cols-[160px_1fr_1fr] gap-[48px] items-end max-md:grid-cols-1 max-md:gap-[24px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
          <div className="reveal flex flex-col gap-[18px]">
            <h2 className="font-normal text-[clamp(36px,4.4vw,64px)] leading-[1.18] tracking-[-0.02em] max-md:text-[38px]">
              {t("headline")}
            </h2>
            <div className="text-ink-soft text-[16px] leading-[1.8] max-w-[24ch]">
              {t("sub1")}
              <br />
              {t("sub2")}
            </div>
          </div>
          <form
            onSubmit={handleSubmit}
            className="reveal flex flex-col gap-[14px] pb-[6px]"
          >
            <div className="flex border-b border-ink">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("placeholder")}
                className="flex-1 bg-transparent border-0 py-[14px] text-[15px] outline-none"
              />
              <button
                type="submit"
                className="px-[22px] py-[14px] bg-green text-white font-en text-[11px] tracking-[0.18em] uppercase hover:bg-green-2 transition-colors"
              >
                {t("submit")}
              </button>
            </div>
            <div className="font-en text-[11px] tracking-[0.06em] text-ink-mute flex justify-between gap-[12px] mt-[6px] max-md:flex-col max-md:gap-[6px]">
              <span className="font-sans tracking-normal">
                {submitted ? t("success") : t("capLeft")}
              </span>
              <span>{t("capRight")}</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
