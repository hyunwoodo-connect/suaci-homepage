"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { DELIVERY_MEMOS, displayTotal } from "@/constants/checkout";
import ReturnNotice from "@/components/legal/ReturnNotice";
import MemoPicker, { memoLabel } from "@/components/pay/MemoPicker";
import MethodPicker from "@/components/pay/MethodPicker";
import OrderTotals from "@/components/pay/OrderTotals";
import { CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import { orderErrorKey } from "@/components/pay/orderError";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { api, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { readLastProvider } from "@/lib/auth/social";
import { addressName } from "@/lib/checkout/address";
import { readSavedMemo } from "@/lib/checkout/memo";
import { formatKRW } from "@/lib/format";
import {
  adapterFor,
  availableMethods,
  browserPaymentAdapters,
  defaultMethod,
  paymentEnv,
  type PayMethodId,
} from "@/lib/payment/providers";
import { useSalesLock } from "@/lib/sales/sales-lock";
import { startPayment } from "@/lib/payment/start-payment";
import { isTestClientKey } from "@/lib/payment/toss";
import type { Address, CheckoutDefaults } from "@/types";
import Button from "@/components/ui/Button";
import CloseButton from "@/components/ui/CloseButton";

interface ReBuySheetProps {
  qty: number;
  defaults: CheckoutDefaults;
  onClose: () => void;
}

/**
 * 재구매 시트 — "지난번처럼 보낼게요." 주소·수단·메모 세 줄을 미리 채워 결제 한 번으로 끝낸다(스펙 §2 A).
 * 30분 안에 돌아온 보류 주문은 같은 멱등키로 잇는다(결정 12).
 */
export default function ReBuySheet({ qty, defaults, onClose }: ReBuySheetProps) {
  const t = useTranslations("pay.sheet");
  const tCommon = useTranslations("common");
  const tPay = useTranslations("pay");
  const tCheckout = useTranslations("checkout");
  const router = useRouter();
  const { user, recheckSession } = useAuth();

  const [method, setMethod] = useState<PayMethodId>("CARD");
  const [memo, setMemo] = useState<string>(DELIVERY_MEMOS[0]);
  const [customMemo, setCustomMemo] = useState(false);
  const [pickMethod, setPickMethod] = useState(false);
  const [pickMemo, setPickMemo] = useState(false);
  // 배송지 바꾸기 — 시트 안에서 저장된 배송지 중 고른다(주문서로 넘어가면 흐름이 끊긴다, UX 리뷰 D3). 새 주소는 주문서에서
  const [pickAddress, setPickAddress] = useState(false);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressLoadFailed, setAddressLoadFailed] = useState(false);
  const [pickedAddress, setPickedAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // 결제를 시작하지 못한 이유 — 주문서와 같은 문구
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  // 어댑터 목록 — 토스 클라이언트 키가 있으면 토스 결제창, 개발·목업이면 목업
  const adapters = useMemo(() => browserPaymentAdapters(), []);
  const methods = useMemo(() => availableMethods(adapters), [adapters]);
  // 출시 전 구매 차단(#286) — 판매 전이면 결제 버튼을 판매 시작 날짜로 막는다(서버도 막는다)
  const salesLock = useSalesLock();
  const ready = adapters.length > 0 && !salesLock.locked;
  const lockedLabel = salesLock.opensOn
    ? tPay("bar.salesStartsOn", { date: salesLock.opensOn })
    : tPay("bar.soon");
  const { tossClientKey } = paymentEnv();
  // 카드 심사 동안 운영도 토스 테스트 키로 연다 — 손님이 실제로 산 줄 알지 않게 알린다
  const isTestPayment = isTestClientKey(tossClientKey);

  // 저장된 메모·기본 수단은 마운트 뒤에 읽는다(렌더 중 storage 접근 금지, setState 는 .then 안 — 린트)
  useEffect(() => {
    Promise.resolve().then(() => {
      const saved = readSavedMemo();
      if (saved) {
        setMemo(saved.memo);
        if (saved.isCustom) setCustomMemo(true);
      }
      const loginProvider = readLastProvider();
      const initialMethod = defaultMethod({
        lastPaymentMethod: defaults.lastPaymentMethod,
        loginProvider,
        available: methods,
      });
      setMethod(initialMethod);
    });
  }, [defaults.lastPaymentMethod, methods]);

  const close = useCloseOnBack(true, onClose);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const total = displayTotal(qty);
  const totalLabel = formatKRW(total);
  const address = pickedAddress ?? defaults.address;

  const toggleAddressPicker = () => {
    const opening = !pickAddress;
    setPickAddress(opening);
    if (!opening || addresses) return;
    setAddressLoadFailed(false);
    void api
      .listAddresses()
      .then(setAddresses)
      .catch((err: unknown) => {
        if (isAuthRequired(err)) {
          // 로그인이 풀렸다 — 주문서가 로그인으로 보낸다
          router.replace(`/checkout?qty=${String(qty)}`);
          return;
        }
        setAddressLoadFailed(true);
        setPickAddress(false);
      });
  };

  const pay = async () => {
    if (busy || !ready || !address) return;
    const adapter = adapterFor(adapters, method);
    if (!adapter) {
      const preparingNote = t("preparing");
      setNote(preparingNote);
      return;
    }
    setBusy(true);
    const payingNote = t("paying");
    setNote(payingNote);
    setError(null);
    try {
      const { alreadyPaidOrderId } = await startPayment({
        adapter,
        method,
        qty,
        addressId: address.addressId,
        memo,
        screen: "rebuy-sheet",
        customerKey: user?.userId ?? "anonymous",
      });
      if (alreadyPaidOrderId) {
        router.replace(`/orders/${alreadyPaidOrderId}`);
        return;
      }
      // 여기까지 오면 손님이 결제창을 닫은 것(결제되면 토스가 다른 주소로 보낸다) — 다시 누를 수 있게
      setNote(null);
      setBusy(false);
    } catch (e) {
      setNote(null);
      const errorKey = orderErrorKey(e);
      const errorMessage = tCheckout(errorKey);
      setError(errorMessage);
      // 화면 상태만 로그인으로 남지 않게 — 다음 '구매하기'가 로그인 시트를 연다
      if (isAuthRequired(e)) void recheckSession();
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 바깥 누르기 — 읽는 길은 X 버튼이 맡는다 */}
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-ink/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebuy-title"
        tabIndex={-1}
        // 합계·배송지 목록·고르기가 다 펼쳐져도 폰 화면 안에서 스크롤(시트가 화면 밖으로 넘치지 않게)
        className="relative flex max-h-[92dvh] w-full max-w-[480px] flex-col gap-[16px] overflow-y-auto overscroll-contain rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[16px] outline-none"
      >
        <span aria-hidden="true" className="mx-auto h-[4px] w-[36px] rounded-full bg-line" />
        <div className="-mr-[12px] -my-[8px] flex items-center justify-between gap-[12px]">
          <h2 id="rebuy-title" className="m-0 text-[17px] font-medium">
            {t("title")}
          </h2>
          <CloseButton label={tCommon("close")} onClick={close} />
        </div>

        <SheetRow label={t("address")} onChange={toggleAddressPicker} changeLabel={t("change")}>
          {address ? `${address.addr1} ${address.addr2 ?? ""} · ${address.recipient}` : ""}
        </SheetRow>
        {addressLoadFailed && (
          <p role="alert" className="-mt-[8px] m-0 text-[13px] text-alert">
            {t("addressLoadFailed")}
          </p>
        )}
        {pickAddress && (
          <AddressPicker
            addresses={addresses}
            selectedId={address?.addressId ?? null}
            loadingLabel={t("addressLoading")}
            addLabel={t("addressAdd")}
            onPick={(a) => {
              setPickedAddress(a);
              setPickAddress(false);
            }}
            onAdd={() => {
              // 새 주소는 우편번호 찾기가 있는 주문서에서. replace — 뒤로가기 한 번에 홈으로 돌아온다
              router.replace(`/checkout?qty=${String(qty)}`);
            }}
          />
        )}

        {/* 결제창이 없으면 고를 수단도 없다 — '변경'을 두지 않는다 */}
        <SheetRow
          label={t("method")}
          onChange={
            ready
              ? () => {
                  setPickMethod((v) => !v);
                }
              : undefined
          }
          changeLabel={t("change")}
        >
          {tPay(`method.${method}`)}
        </SheetRow>
        {pickMethod && <MethodPicker methods={methods} value={method} onChange={setMethod} />}

        <SheetRow
          label={t("memo")}
          onChange={() => {
            setPickMemo((v) => !v);
          }}
          changeLabel={t("change")}
        >
          {memoLabel(memo, tPay)}
        </SheetRow>
        {pickMemo && (
          <MemoPicker
            memo={memo}
            isCustom={customMemo}
            onPick={(m) => {
              setMemo(m);
              setCustomMemo(false);
            }}
            onCustom={() => {
              setCustomMemo(true);
              setMemo("");
            }}
            onType={setMemo}
          />
        )}

        {method === "BRANDPAY" && (
          <p className="m-0 text-[13px] text-grey">{tPay("checkout.brandpayHint")}</p>
        )}

        <OrderTotals qty={qty} />

        <ReturnNotice />

        <Button
          type="button"
          onClick={() => {
            void pay();
          }}
          disabled={busy || !ready}
        >
          {ready
            ? t("payCta", { total: totalLabel })
            : salesLock.locked
              ? lockedLabel
              : t("preparingCta")}
        </Button>
        <p
          role="status"
          className={`m-0 min-h-[20px] text-center text-[13px] ${error ? "text-alert" : "text-grey"}`}
        >
          {error ?? note ?? (!ready ? t("preparing") : isTestPayment ? t("testNotice") : "")}
        </p>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface AddressPickerProps {
  /** 아직 못 받았으면 null */
  addresses: Address[] | null;
  selectedId: string | null;
  loadingLabel: string;
  addLabel: string;
  onPick: (a: Address) => void;
  onAdd: () => void;
}

/** 저장된 배송지 고르기 — 지금 배송지에 체크, 맨 아래 '새 배송지 추가'(주문서로) */
function AddressPicker({
  addresses,
  selectedId,
  loadingLabel,
  addLabel,
  onPick,
  onAdd,
}: AddressPickerProps) {
  if (!addresses) {
    return (
      <p role="status" className="m-0 text-[13px] text-grey">
        {loadingLabel}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-[8px]">
      {addresses.map((a) => {
        const isOn = a.addressId === selectedId;
        return (
          <button
            key={a.addressId}
            type="button"
            aria-pressed={isOn}
            onClick={() => onPick(a)}
            className={`flex min-h-[44px] w-full cursor-pointer flex-col items-start gap-[2px] rounded-[12px] border px-[14px] py-[10px] text-left transition-colors ${isOn ? CHIP_ON : CHIP_OFF}`}
          >
            <span className="text-[14px] font-medium">{addressName(a)}</span>
            <span className="text-[13px] opacity-80">
              {a.addr1} {a.addr2 ?? ""} · {a.recipient}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-[44px] cursor-pointer items-center self-start text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
      >
        {addLabel}
      </button>
    </div>
  );
}

function SheetRow({
  label,
  children,
  onChange,
  changeLabel,
}: {
  label: string;
  children: React.ReactNode;
  /** 없으면 '변경' 버튼을 그리지 않는다 */
  onChange?: () => void;
  changeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-[12px] border-b border-line pb-[10px]">
      <div className="min-w-0">
        <p className="m-0 text-[13px] text-grey">{label}</p>
        <p className="m-0 truncate text-[15px]">{children}</p>
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="-mr-[8px] flex h-[44px] shrink-0 cursor-pointer items-center px-[8px] text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
        >
          {changeLabel}
        </button>
      )}
    </div>
  );
}
