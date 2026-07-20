"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { Address } from "@/types";

/**
 * 배송지 — listAddresses / createAddress / updateAddress(isDefault) / deleteAddress 계약 호출.
 */
export default function AddressesPage() {
  const t = useTranslations("addresses");
  const { status } = useAuth();

  const [items, setItems] = useState<Address[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [label, setLabel] = useState("");

  const refresh = useCallback(async () => {
    setItems(await api.listAddresses());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void refresh();
  }, [status, refresh]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createAddress({
        recipient,
        phone,
        zipcode,
        addr1,
        addr2: addr2 || undefined,
        label: label || undefined,
        isDefault: items.length === 0,
      });
      setRecipient(""); setPhone(""); setZipcode(""); setAddr1(""); setAddr2(""); setLabel("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <PageShell no="AD" title={<>Ship <em>to</em></>} meta="">
        <Link href="/login" className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline underline-offset-[3px]">
          {t("needLogin")} →
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell no="AD" title={<>Ship <em>to</em></>} meta={t("meta")}>
      <div className="grid grid-cols-[1.2fr_1fr] gap-[40px] max-lg:grid-cols-1 max-w-[1040px]">
        {/* 목록 */}
        <div>
          {loaded && items.length === 0 && (
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-grey">{t("empty")}</p>
          )}
          <ul className="list-none m-0 p-0 flex flex-col gap-[14px]">
            {items.map((a) => (
              <li key={a.addressId} className="border-[1.5px] border-ink p-[16px]">
                <div className="flex items-center gap-[10px] mb-[8px]">
                  <b className="font-display text-[15px]">{a.recipient}</b>
                  {a.label && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-grey">
                      {a.label}
                    </span>
                  )}
                  {a.isDefault && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] bg-ink text-acid px-[7px] py-[2px]">
                      {t("defaultBadge")}
                    </span>
                  )}
                </div>
                <p className="text-[13.5px] text-ink-soft m-0 leading-[1.6]">
                  ({a.zipcode}) {a.addr1} {a.addr2 ?? ""}
                  <br />
                  {a.phone}
                </p>
                <div className="flex gap-[8px] mt-[12px]">
                  {!a.isDefault && (
                    <Button
                      variant="outline"
                      className="!px-[12px] !py-[8px] !text-[10px]"
                      onClick={async () => {
                        await api.updateAddress(a.addressId, { isDefault: true });
                        await refresh();
                      }}
                    >
                      {t("setDefault")}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="!px-[12px] !py-[8px] !text-[10px]"
                    onClick={async () => {
                      await api.deleteAddress(a.addressId);
                      await refresh();
                    }}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 추가 폼 */}
        <form onSubmit={handleAdd} className="flex flex-col gap-[14px]">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-grey m-0">
            {t("addTitle")}
          </h3>
          <InputField label={t("recipient")} required value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <InputField label={t("phone")} required inputMode="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="grid grid-cols-[120px_1fr] gap-[10px]">
            <InputField label={t("zipcode")} required inputMode="numeric" value={zipcode} onChange={(e) => setZipcode(e.target.value)} />
            <InputField label={t("addr1")} required value={addr1} onChange={(e) => setAddr1(e.target.value)} />
          </div>
          <InputField label={t("addr2")} value={addr2} onChange={(e) => setAddr2(e.target.value)} />
          <InputField label={t("label")} placeholder={t("labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" disabled={busy} className="mt-[4px]">
            {busy ? "..." : t("submitAdd")}
          </Button>
        </form>
      </div>

      <Link href="/account" className="inline-block mt-[36px] font-mono text-[11px] uppercase tracking-[0.06em] text-grey hover:text-ink">
        ← {t("backAccount")}
      </Link>
    </PageShell>
  );
}
