"use client";

import { useId, useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { trackLead } from "@/lib/analytics";
import { ApiClientError, waitlistApi } from "@/lib/api";

interface WaitlistFormProps {
  locale: string;
  /** 유입 표시(?utm_source=…·?ref=…). 페이지가 주소에서 읽어 넘긴다 */
  source?: string;
}

type Status = "idle" | "sending" | "done";
const KNOWN_ERRORS = ["INVALID_EMAIL", "RATE_LIMITED"] as const;

/**
 * 출시 알림 받기 폼. 이메일 + 동의 둘(개인정보 수집·이용, 광고성 정보 수신 — 둘 다 필수).
 * 보내는 동안 버튼 글자가 바뀌고 다시 못 누른다. 알 수 없는 실패는 [다시 시도]로 같은 값을 다시 보낸다.
 */
export default function WaitlistForm({ locale, source }: WaitlistFormProps) {
  const t = useTranslations("waitlist");
  const detailId = useId();
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<{ message: string; canRetry: boolean } | null>(null);

  async function send() {
    if (status === "sending") return;
    if (!privacy || !marketing) {
      const consentMessage = t("needConsent");
      setError({ message: consentMessage, canRetry: false });
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      // source 는 임의 쿼리 유입 — 64자 상한(저장·CSV 위생)
      const src = source?.slice(0, 64);
      const trimmedEmail = email.trim();
      const sourceField = src ? { source: src } : {};
      await waitlistApi.join({ email: trimmedEmail, locale, ...sourceField });
      trackLead(src);
      setStatus("done");
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "";
      const known = (KNOWN_ERRORS as readonly string[]).includes(code);
      setError({
        message: known ? t(`error.${code as (typeof KNOWN_ERRORS)[number]}`) : t("error.default"),
        canRetry: !known,
      });
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex max-w-[440px] flex-col items-start gap-[16px]" aria-live="polite">
        <p className="m-0 text-[15px] text-ink">{t("done")}</p>
        <button
          type="button"
          onClick={() => {
            // 다른 사람 이메일일 수 있다 — 동의는 승계하지 않는다
            setEmail("");
            setPrivacy(false);
            setMarketing(false);
            setStatus("idle");
          }}
          className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
        >
          {t("again")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex max-w-[440px] flex-col gap-[12px]"
    >
      <p className="m-0 text-[14px] text-ink">{t("lead")}</p>
      <InputField
        label={t("email")}
        id={`${detailId}-email`}
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "sending"}
      />
      <label className="flex min-h-[44px] cursor-pointer items-start gap-[10px] py-[10px] text-[14px] leading-[1.5] text-ink">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          aria-describedby={detailId}
          className="mt-[1px] size-[20px] shrink-0 accent-ink"
        />
        <span>{t("privacyConsent")}</span>
      </label>
      <p id={detailId} className="m-0 -mt-[18px] pl-[30px] text-[13px] leading-[1.5] text-grey">
        {t("privacyDetail")}
      </p>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-[10px] py-[10px] text-[14px] leading-[1.5] text-ink">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-[1px] size-[20px] shrink-0 accent-ink"
        />
        <span>{t("marketingConsent")}</span>
      </label>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-[12px] text-[14px] text-alert"
        >
          <span>{error.message}</span>
          {error.canRetry && (
            <button
              type="button"
              onClick={() => void send()}
              className="inline-flex min-h-[44px] cursor-pointer items-center text-ink underline underline-offset-[3px]"
            >
              {t("retry")}
            </button>
          )}
        </div>
      )}
      <Button type="submit" disabled={status === "sending"} className="mt-[6px]">
        {status === "sending" ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
