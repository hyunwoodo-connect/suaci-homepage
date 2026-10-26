"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { ApiClientError } from "@/lib/api/errors";
import { trackLead } from "@/lib/analytics";
import { waitlistApi } from "@/lib/api/waitlist";

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
      setError({ message: t("needConsent"), canRetry: false });
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await waitlistApi.join({ email: email.trim(), locale, ...(source ? { source } : {}) });
      trackLead(source);
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
            setEmail("");
            setStatus("idle");
          }}
          className="cursor-pointer text-[12px] text-grey underline underline-offset-[3px] hover:text-ink"
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
      className="flex max-w-[440px] flex-col gap-[18px]"
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
      <label className="flex cursor-pointer items-start gap-[10px] text-[12px] text-ink">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          aria-describedby={detailId}
          className="mt-[2px] size-[16px] shrink-0"
        />
        <span>{t("privacyConsent")}</span>
      </label>
      <p id={detailId} className="m-0 -mt-[10px] pl-[26px] text-[11px] text-grey">
        {t("privacyDetail")}
      </p>
      <label className="flex cursor-pointer items-start gap-[10px] text-[12px] text-ink">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-[2px] size-[16px] shrink-0"
        />
        <span>{t("marketingConsent")}</span>
      </label>
      {error && (
        <div role="alert" className="flex items-center gap-[12px] text-[12px] text-[#c0392b]">
          <span>{error.message}</span>
          {error.canRetry && (
            <button
              type="button"
              onClick={() => void send()}
              className="cursor-pointer text-ink underline underline-offset-[3px]"
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
