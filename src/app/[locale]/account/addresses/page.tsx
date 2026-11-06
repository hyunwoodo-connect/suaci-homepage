"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import AddressForm from "@/components/pay/AddressForm";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Skeleton from "@/components/ui/Skeleton";
import { addressName } from "@/lib/checkout/address";
import { api, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { Address, CreateAddressRequest } from "@/types";

/** 배송지 카드의 틀 — 실제 카드와 뼈대 카드가 같은 크기 */
const CARD = "border border-line p-[16px]";

/**
 * 배송지 — 목록·기본 지정·삭제(한 번 더 묻는다)·추가. 추가는 주문서와 같은 Daum 주소 찾기 폼.
 * 없으면 안내 + '배송지 추가' 하나로 시작한다. 중간에 로그인이 풀리면(AUTH_REQUIRED) 세션을 다시 확인한다.
 * 로그인 토큰이 브라우저에만 있어 서버에서 미리 못 받는다 — 받는 동안은 같은 틀의 뼈대, '아직 배송지가 없어요'는 받은 뒤에만.
 */
export default function AddressesPage() {
  const t = useTranslations("addresses");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, user, sessionEnded, recheckSession } = useAuth();

  const [items, setItems] = useState<Address[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown, message: string) => {
      if (isAuthRequired(err)) {
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

  if (status === "anonymous") {
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

        {(status === "loading" || (items === null && !loadFailed)) && (
          <AddressesSkeleton label={tc("loading")} />
        )}
        {loadFailed && (
          <Button
            variant="secondary"
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
              <li key={a.addressId} className={CARD}>
                <div className="mb-[6px] flex flex-wrap items-center gap-[8px]">
                  <h2 className="m-0 text-[15px] font-medium leading-[24px]">{addressName(a)}</h2>
                  {a.isDefault && <Badge>{t("defaultBadge")}</Badge>}
                </div>
                <p className="m-0 text-[14px] leading-[22px] text-ink-soft">
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
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConfirmingId(null);
                      }}
                    >
                      {t("deleteNo")}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-[14px] flex gap-[8px_20px]">
                    {!a.isDefault && (
                      <Button
                        variant="secondary"
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
                    {/* 카드마다 나오는 줄이라 빨간 버튼으로 두지 않는다 — 빨강(danger)은 한 번 더 묻는 단계의 '지우기'에만 */}
                    <Button
                      variant="text"
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
            variant="secondary"
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
              <Button
                variant="text"
                size="sm"
                className="-my-[12px]"
                onClick={() => {
                  setAdding(false);
                }}
              >
                {tc("close")}
              </Button>
            </div>
            <AddressForm
              onSubmit={save}
              submitLabel={t("save")}
              initialRecipient={user?.name}
              withLabel
            />
          </section>
        )}

        <ButtonLink href="/account" variant="text" size="sm" className="self-start">
          ← {ta("title")}
        </ButtonLink>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 배송지 카드 하나 + '배송지 추가' 알약 크기의 뼈대 — 제목 / 주소 두 줄 / 버튼 두 개가 실제 카드와 같은 자리 */
function AddressesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="flex flex-col gap-[24px]">
      <div className={CARD}>
        <div className="mb-[6px] flex h-[24px] items-center gap-[8px]">
          <Skeleton className="h-[14px] w-[56px]" />
          <Skeleton shape="badge" className="h-[22px] w-[40px]" />
        </div>
        <div className="flex h-[22px] items-center">
          <Skeleton className="h-[12px] w-[260px] max-w-full" />
        </div>
        <div className="flex h-[22px] items-center">
          <Skeleton className="h-[12px] w-[112px]" />
        </div>
        <div className="mt-[14px] flex gap-[8px_20px]">
          <Skeleton shape="pill" className="h-[44px] w-[112px]" />
          <Skeleton className="my-[16px] h-[12px] w-[28px]" />
        </div>
      </div>
      <Skeleton shape="pill" className="h-[52px] w-[128px]" />
    </div>
  );
}
