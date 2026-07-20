"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HOME_V4_IMAGES } from "@/constants/homeImages";

/**
 * Home v4 섹션 03 — 웨이트리스트. 이미지 + 카피 + 이메일 폼.
 * 백엔드 없음: 제출 시 로컬 상태로 성공 노트만 표시.
 */
export default function WaitlistV4() {
  const t = useTranslations("v4.waitlist");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 백엔드 연결 시 실제 등록 API 호출
    setEmail("");
    setJoined(true);
  };

  return (
    <>
      <div className="sec">
        <div className="sec__no">03</div>
        <div className="sec__ti">
          The <em>waitlist</em>
        </div>
        <div className="sec__me">{t("secMeta")}</div>
      </div>

      <div className="cell or-img">
        <img src={HOME_V4_IMAGES.order} alt={t("imgAlt")} />
        <span className="stamp">2026 · Launching soon</span>
      </div>
      <div className="cell or-txt" id="order">
        <span className="cell__tag">C/01</span>
        <h2>
          Be first
          <br />
          to press
        </h2>
        <p>{t("body")}</p>
        <form className="wl-form" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder={t("placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">{t("submit")}</button>
        </form>
        <p className="wl-form__note">{joined ? `◇ ${t("success")}` : t("note")}</p>
      </div>
    </>
  );
}
