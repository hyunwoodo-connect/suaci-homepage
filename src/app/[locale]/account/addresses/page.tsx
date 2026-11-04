"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import AddressForm from "@/components/pay/AddressForm";
import { addressName } from "@/lib/checkout/address";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { Address, CreateAddressRequest } from "@/types";
import ButtonLink from "@/components/ui/ButtonLink";

/**
 * 배송지 — 목록·기본 지정·삭제(한 번 더 묻는다)·추가. 추가는 주문서와 같은 Daum 주소 찾기 폼.
 * 없으면 안내 + '배송지 추가' 하나로 시작한다. 중간에 로그인이 풀리면(AUTH_REQUIRED) 세션을 다시 확인한다.
 */
export default function AddressesPage() {
  const t = useTranslations("addresses");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, user, sessionEnded, refresh: recheckSession } = useAuth();

  const [items, setItems] = useState<Address[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown, message: string) => {
      if (err instanceof ApiClientError && err.code === "AUTH_REQUIRED") {
        void recheckSession();
        return;
      }
      setNote(message);
    },
    [recheckSession],
  );

  const load = useCallback(async () => {
    try {
      setItems(await api.listAddresses());
      setLoadFailed(false);
    } catch (err) {
      setLoadFailed(true);
      handleError(err, t("loadError"));
    }
  }, [handleError, t]);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  const save = async (r: CreateAddressRequest) => {
    setNote(null);
    try {
      await api.createAddress(r);
      setAdding(false);
      await load();
      // 폼이 접히면 화면이 푸터에 걸려 있다 — 방금 넣은 배송지가 보이게 위로
      window.scrollTo({ top: 0 });
    } catch (err) {
      handleError(err, t("saveError"));
    }
  };

  const mutate = async (addressId: string, run: () => Promise<unknown>) => {
    setBusyId(addressId);
    setNote(null);
    try {
      await run();
      setConfirmingId(null);
      await load();
    } catch (err) {
      handleError(err, t("saveError"));
    } finally {
      setBusyId(null);
    }
  };

  if (status === "loading") {
    return (
      <PageShell title={t("title")}>
        <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
      </PageShell>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageShell title={t("title")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p className="m-0 text-[15px] text-ink">
            {sessionEnded ? ta("sessionEnded") : t("needLogin")}
          </p>
          <ButtonLink href={{ pathname: "/login", query: { next: "/account/addresses" } }}>
            {ta("goLogin")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  const isEmpty = items !== null && items.length === 0;

  return (
    <PageShell title={t("title")} meta={t("meta")}>
      <div className="flex max-w-[480px] flex-col gap-[24px]">
        {note && (
          <p role="alert" className="m-0 text-[13px] text-alert">
            {note}
          </p>
        )}

        {items === null && !loadFailed && (
          <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
        )}
        {loadFailed && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setNote(null);
              void load();
            }}
          >
            {tc("retry")}
          </Button>
        )}

        {isEmpty && !adding && (
          <div className="flex flex-col gap-[20px]">
            <p className="m-0 text-[15px] text-ink">{t("empty")}</p>
            <Button
              onClick={() => {
                setAdding(true);
              }}
            >
              {t("add")}
            </Button>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
            {items.map((a) => (
              <li key={a.addressId} className="border border-line p-[16px]">
                <div className="mb-[6px] flex flex-wrap items-center gap-[8px]">
                  <h2 className="m-0 text-[15px] font-medium">{addressName(a)}</h2>
                  {a.isDefault && (
                    <span className="rounded-full bg-lime px-[8px] py-[1px] text-[12px] text-ink">
                      {t("defaultBadge")}
                    </span>
                  )}
                </div>
                <p className="m-0 text-[14px] leading-[1.6] text-ink-soft">
                  <span className="num">({a.zipcode})</span> {a.addr1} {a.addr2 ?? ""}
                  <br />
                  {/* 배송지 이름이 제목이면 받는 분은 여기 — 이름이 없으면 제목이 곧 받는 분 */}
                  <span className="num">
                    {addressName(a) === a.recipient ? a.phone : `${a.recipient} · ${a.phone}`}
                  </span>
                </p>

                {confirmingId === a.addressId ? (
                  <div className="mt-[14px] flex flex-wrap items-center gap-[8px]">
                    <span className="mr-[4px] text-[13px] text-ink">{t("deleteConfirm")}</span>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === a.addressId}
                      onClick={() => {
                        void mutate(a.addressId, () => api.deleteAddress(a.addressId));
                      }}
                    >
                      {t("deleteYes")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfirmingId(null);
                      }}
                    >
                      {t("deleteNo")}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-[14px] flex gap-[8px]">
                    {!a.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === a.addressId}
                        onClick={() => {
                          void mutate(a.addressId, () =>
                            api.updateAddress(a.addressId, { isDefault: true }),
                          );
                        }}
                      >
                        {t("setDefault")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConfirmingId(a.addressId);
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {items !== null && items.length > 0 && !adding && (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              setAdding(true);
            }}
          >
            {t("add")}
          </Button>
        )}

        {adding && (
          <section className="flex flex-col gap-[14px]">
            <div className="flex items-baseline justify-between gap-[12px]">
              <h2 className="m-0 text-[16px] font-medium">{t("addTitle")}</h2>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                }}
                className="-my-[12px] inline-flex min-h-[44px] cursor-pointer items-center text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
              >
                {tc("close")}
              </button>
            </div>
            <AddressForm
              onSubmit={save}
              submitLabel={t("save")}
              initialRecipient={user?.name}
              withLabel
            />
          </section>
        )}

        <Link
          href="/account"
          className="inline-flex min-h-[44px] items-center self-start text-[14px] text-grey hover:text-ink"
        >
          ← {ta("title")}
        </Link>
      </div>
    </PageShell>
  );
}
