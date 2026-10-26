"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatPhoneInput, isValidPhone } from "@/lib/checkout/phone";
import type { CreateAddressRequest } from "@/types";

interface AddressFormProps {
  onSubmit: (r: CreateAddressRequest) => Promise<void>;
  submitLabel: string;
  /** 수령인 프리필(소셜 이름) */
  initialRecipient?: string;
}

/** Daum 우편번호 임베드가 주는 값 중 쓰는 것 */
interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: { oncomplete: (d: DaumPostcodeData) => void }) => {
        embed: (el: HTMLElement) => void;
      };
    };
  }
}

const DAUM_SCRIPT = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/**
 * 배송지 입력 — Daum 우편번호 레이어를 페이지 안에 임베드(결정 11: 팝업 금지).
 * 고르면 우편번호·주소가 채워지고 상세주소로 포커스가 간다. 전화는 자동 하이픈.
 */
export default function AddressForm({ onSubmit, submitLabel, initialRecipient }: AddressFormProps) {
  const t = useTranslations("pay.checkout");
  const [recipient, setRecipient] = useState(initialRecipient ?? "");
  const [phone, setPhone] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState<"detail" | "phone" | null>(null);
  const [busy, setBusy] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);

  // Daum 스크립트 동적 로드 → 레이어 임베드. 고르면 레이어를 접고 상세주소로 포커스
  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled || !layerRef.current || !window.daum) return;
      new window.daum.Postcode({
        oncomplete: (d) => {
          setZipcode(d.zonecode);
          setAddr1(d.roadAddress);
          detailRef.current?.focus();
        },
      }).embed(layerRef.current);
    };
    if (window.daum) {
      mount();
    } else {
      const script = document.createElement("script");
      script.src = DAUM_SCRIPT;
      script.async = true;
      script.onload = mount;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const picked = zipcode !== "" && addr1 !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || busy) return;
    if (!addr2.trim()) {
      setError("detail");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("phone");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        recipient: recipient.trim(),
        phone,
        zipcode,
        addr1,
        addr2: addr2.trim(),
        isDefault,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
      <Field label={t("recipient")}>
        {(id) => (
          <input
            id={id}
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
            }}
            required
            autoComplete="name"
            className="w-full border border-line px-[12px] py-[11px] text-[16px]"
          />
        )}
      </Field>
      <Field label={t("phone")}>
        {(id) => (
          <input
            id={id}
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
            }}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-"
            className="w-full border border-line px-[12px] py-[11px] text-[16px]"
          />
        )}
      </Field>

      {/* 주소 찾기 — 레이어가 항상 보인다(고르면 값이 채워진다) */}
      {!picked && (
        <div>
          <p className="m-0 mb-[6px] text-[12px] text-grey">{t("searchHint")}</p>
          <div ref={layerRef} className="h-[380px] w-full border border-line" />
        </div>
      )}
      {picked && (
        <p className="num m-0 text-[14px]">
          ({zipcode}) {addr1}
        </p>
      )}
      <Field label={t("detail")}>
        {(id) => (
          <input
            id={id}
            ref={detailRef}
            value={addr2}
            onChange={(e) => {
              setAddr2(e.target.value);
            }}
            placeholder={t("detailPlaceholder")}
            autoComplete="address-line2"
            className="w-full border border-line px-[12px] py-[11px] text-[16px]"
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => {
            setIsDefault(e.target.checked);
          }}
          className="size-4 accent-ink"
        />
        {t("saveDefault")}
      </label>

      {error && (
        <p role="alert" className="m-0 text-[13px] text-red-600">
          {error === "detail" ? t("detailRequired") : t("phoneInvalid")}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !picked}
        className="h-[52px] cursor-pointer rounded-full bg-ink text-[15px] font-medium text-paper disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

let fieldSeq = 0;

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const [id] = useState(() => `af-${String(++fieldSeq)}`);
  return (
    <div>
      <label htmlFor={id} className="mb-[6px] block text-[12px] text-grey">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
