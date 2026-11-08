"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { BUSINESS } from "@/constants/site";
import { api } from "@/lib/api";
import { canChangeShippingAddress } from "@/lib/claims/rules";
import type { Address, Order, ShippingAddressSnapshot } from "@/types";

import { claimErrorKey } from "./claimError";
import { useSubmitLock } from "./useSubmitLock";

interface ShippingAddressBoxProps {
  order: Order;
  /** 바꾼 주문(서버 응답) — 화면이 주문을 그것으로 바꾼다 */
  onChanged: (order: Order) => void;
  /** 바꾸지 못했다 — 주문을 다시 읽는다(관리자가 포장을 시작했을 수 있다) */
  onFailed: () => Promise<void>;
}

/**
 * 주문 상세의 배송지 상자. 결제 뒤 상품 준비 전이면 손님 배송지 목록에서 골라 바꾼다(PUT /orders/{id}/shipping-address).
 * 상품준비중(포장 시작)부터는 화면에서 못 바꾸고 고객센터 메일로 안내한다 — 관리자는 발송 전까지 바꿀 수 있다.
 */
export default function ShippingAddressBox({
  order,
  onChanged,
  onFailed,
}: ShippingAddressBoxProps) {
  const t = useTranslations("orders");
  const a = order.shippingAddress;
  const canChange = canChangeShippingAddress(order);
  const isPreparing =
    order.fulfillmentStatus === "preparing" &&
    (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded");

  const [picking, setPicking] = useState(false);
  const [changed, setChanged] = useState(false);

  return (
    <div className="border border-line p-[16px]">
      <h2 className="m-0 mb-[12px] text-[14px] font-medium leading-[24px] text-ink">
        {t("shippingTo")}
      </h2>
      <p className="m-0 text-[14px] leading-[24px] text-ink">
        <b>{a.recipient}</b>
        <br />({a.zipcode}) {a.addr1} {a.addr2 ?? ""}
        <br />
        {a.phone}
      </p>
      {changed && (
        <p role="status" className="m-0 mt-[8px] text-[13px] text-grey">
          {t("addressChanged")}
        </p>
      )}

      {canChange &&
        (picking ? (
          <AddressPicker
            order={order}
            onFailed={onFailed}
            onClose={() => setPicking(false)}
            onChanged={(next) => {
              setPicking(false);
              setChanged(true);
              onChanged(next);
            }}
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-[12px]"
            onClick={() => {
              setChanged(false);
              setPicking(true);
            }}
          >
            {t("changeAddress")}
          </Button>
        ))}

      {isPreparing && (
        <p className="m-0 mt-[12px] text-[13px] leading-[1.6] text-grey">
          {t.rich("addressPreparing", {
            email: BUSINESS.email,
            mail: (chunks) => (
              <a
                href={`mailto:${BUSINESS.email}`}
                className="text-ink underline underline-offset-[3px]"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      )}
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface AddressPickerProps {
  order: Order;
  onClose: () => void;
  onChanged: (order: Order) => void;
  onFailed: () => Promise<void>;
}

/** 손님 배송지 목록에서 하나 고르기 — 새 주소는 배송지 관리 화면에서 넣고 돌아온다 */
function AddressPicker({ order, onClose, onChanged, onFailed }: AddressPickerProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("claims");
  const tCommon = useTranslations("common");
  const [list, setList] = useState<Address[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useSubmitLock();

  // 펼칠 때 받는다 — 지금 주문 배송지와 같은 주소를 미리 골라 둔다
  useEffect(() => {
    let cancelled = false;
    api
      .listAddresses()
      .then((addresses) => {
        if (cancelled) return;
        setList(addresses);
        setSelected(
          addresses.find((x) => sameAddress(x, order.shippingAddress))?.addressId ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [order.shippingAddress]);

  const apply = () =>
    run(async () => {
      if (!selected) return;
      setError(null);
      try {
        const changedOrder = await api.changeShippingAddress(order.orderId, {
          addressId: selected,
        });
        onChanged(changedOrder);
      } catch (err) {
        const errorKey = claimErrorKey(err);
        const errorMessage = tc(errorKey);
        setError(errorMessage);
        await onFailed();
      }
    });

  const current = list?.find((x) => sameAddress(x, order.shippingAddress))?.addressId;

  return (
    <div className="mt-[16px] flex flex-col gap-[12px] border-t border-line pt-[16px]">
      {error && (
        <p role="alert" className="m-0 text-[14px] text-alert">
          {error}
        </p>
      )}
      {loadFailed ? (
        <p role="alert" className="m-0 text-[14px] text-ink">
          {t("addressLoadError")}
        </p>
      ) : list === null ? (
        <p role="status" className="m-0 text-[13px] text-grey">
          {tCommon("loading")}
        </p>
      ) : list.length === 0 ? (
        <p className="m-0 text-[14px] text-ink">{t("addressEmpty")}</p>
      ) : (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-[10px] p-0 text-[13px] text-grey">{t("addressPick")}</legend>
          <div className="flex flex-col gap-[8px]">
            {list.map((x) => (
              <label
                key={x.addressId}
                className={`flex min-h-[44px] cursor-pointer items-start gap-[10px] border px-[12px] py-[10px] text-[14px] leading-[1.5] ${selected === x.addressId ? "border-ink" : "border-line"}`}
              >
                <input
                  type="radio"
                  name="order-address"
                  value={x.addressId}
                  checked={selected === x.addressId}
                  onChange={() => setSelected(x.addressId)}
                  className="mt-[3px] size-[18px] shrink-0 accent-ink"
                />
                <span className="min-w-0">
                  <b className="font-medium">{x.label ?? x.recipient}</b>
                  <span className="block text-grey">
                    ({x.zipcode}) {x.addr1} {x.addr2 ?? ""} · {x.recipient}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        {list !== null && list.length > 0 && (
          <Button
            size="sm"
            disabled={busy || !selected || selected === current}
            onClick={() => {
              void apply();
            }}
          >
            {busy ? "…" : t("addressApply")}
          </Button>
        )}
        <ButtonLink href="/account/addresses" variant="secondary" size="sm">
          {t("addressAdd")}
        </ButtonLink>
        <Button variant="text" size="sm" disabled={busy} onClick={onClose}>
          {t("addressClose")}
        </Button>
      </div>
    </div>
  );
}

/* ─── 내부 ─────────────────────────── */

/** 주문에 찍힌 배송지와 같은 주소인가(주문엔 배송지 id 가 없어 값으로 비교) */
function sameAddress(x: Address, snap: ShippingAddressSnapshot): boolean {
  return (
    x.zipcode === snap.zipcode &&
    x.addr1 === snap.addr1 &&
    (x.addr2 ?? "") === (snap.addr2 ?? "") &&
    x.recipient === snap.recipient &&
    x.phone === snap.phone
  );
}
