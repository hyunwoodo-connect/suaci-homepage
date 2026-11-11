"use client";

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useSubmitLock } from "@/components/orders/useSubmitLock";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import CloseButton from "@/components/ui/CloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ApiClientError, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { clearSavedMemo } from "@/lib/checkout/memo";

interface WithdrawSheetProps {
  onClose: () => void;
  /** 탈퇴가 끝나 홈으로 넘어가기 시작했다 — 계정 화면이 그동안 로그인 안내를 비추지 않게 */
  onWithdrawn: () => void;
}

/** 탈퇴하지 못한 까닭 — 끝나지 않은 주문·신청(서버 409) / 그 밖(다시 누르면 서버가 남은 일을 이어서 끝낸다) */
type WithdrawProblem = "blocked" | "failed";

const CHECK_ROW = "flex min-h-[44px] cursor-pointer items-center gap-[10px] text-[15px] text-ink";

/**
 * 회원 탈퇴 확인 시트 — 되돌릴 수 없어서 지우는 것·법에 따라 보관하는 것을 보이고 '안내를 확인했어요'를 받아야 버튼이 열린다.
 * 출시 알림은 탈퇴와 따로 동의한 것이라 그만 받을지 따로 묻는다.
 * 닫기: X · 바깥 누르기 · Esc · 뒤로가기 — 보내는 중이거나 탈퇴가 끝난 뒤에는 닫지 않는다
 */
export default function WithdrawSheet({ onClose, onWithdrawn }: WithdrawSheetProps) {
  const t = useTranslations("account.withdraw");
  const tc = useTranslations("common");
  const router = useRouter();
  const { withdraw, recheckSession } = useAuth();
  const { busy, run } = useSubmitLock();
  const [leaveWaitlist, setLeaveWaitlist] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [problem, setProblem] = useState<WithdrawProblem | null>(null);
  // 탈퇴가 끝나 홈으로 넘어가는 중 — 지워진 계정으로 다시 보내지 않는다
  const [isDone, setIsDone] = useState(false);
  const isLocked = busy || isDone;

  useBodyScrollLock(true);
  const close = useCloseOnBack(true, () => {
    if (!isLocked) onClose();
  });
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasConfirmed || isLocked) return;
    await run(async () => {
      setProblem(null);
      try {
        await withdraw(leaveWaitlist);
      } catch (err) {
        if (isAuthRequired(err)) {
          // 로그인이 풀렸다 — 시트를 닫으면 계정 화면이 '로그인이 풀렸어요'로 넘어간다
          onClose();
          void recheckSession();
          return;
        }
        const nextProblem = isBlocked(err) ? "blocked" : "failed";
        setProblem(nextProblem);
        return;
      }
      setIsDone(true);
      onWithdrawn();
      clearSavedMemo();
      // replace — 시트가 쌓은 기록 칸을 홈이 차지한다. 홈은 ?withdrawn=1 을 보고 '탈퇴가 끝났어요'를 띄운다
      router.replace({ pathname: "/", query: { withdrawn: "1" } });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 바깥 누르기 — 읽는 길은 X 버튼이 맡는다 */}
      <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-ink/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-sheet-title"
        tabIndex={-1}
        // 작은 폰에서 안내가 길어도 화면 안에서 스크롤
        className="relative flex max-h-[92dvh] w-full max-w-[480px] flex-col gap-[16px] overflow-y-auto overscroll-contain rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[20px] outline-none"
      >
        <div className="-mr-[12px] -mt-[8px] flex items-center justify-between gap-[12px]">
          <h2 id="withdraw-sheet-title" className="m-0 text-[17px] font-medium">
            {t("title")}
          </h2>
          <CloseButton label={tc("close")} onClick={close} />
        </div>

        {problem === "blocked" ? (
          <>
            <p role="alert" className="m-0 text-[15px] leading-[1.6] text-ink">
              {t("blocked")}
            </p>
            {/* replace — 시트가 쌓은 기록 칸을 주문 내역이 차지해 돌아올 때 헛돌지 않는다 */}
            <ButtonLink href="/orders" replace variant="secondary" className="w-full">
              {t("viewOrders")}
            </ButtonLink>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
            <p className="m-0 text-[15px] leading-[1.6] text-ink">{t("lead")}</p>

            <div className="flex flex-col gap-[14px] border-y border-line py-[16px]">
              <InfoList
                title={t("deletedTitle")}
                items={[t("deletedAccount"), t("deletedAddresses"), t("deletedSocial")]}
              />
              <InfoList title={t("keptTitle")} items={[t("keptOrders"), t("keptClaims")]} />
            </div>

            <div className="flex flex-col">
              <label className={CHECK_ROW}>
                <input
                  type="checkbox"
                  checked={leaveWaitlist}
                  onChange={(e) => setLeaveWaitlist(e.target.checked)}
                  disabled={isLocked}
                  className="size-[20px] shrink-0 accent-ink"
                />
                {t("leaveWaitlist")}
              </label>
              <label className={CHECK_ROW}>
                <input
                  type="checkbox"
                  checked={hasConfirmed}
                  onChange={(e) => setHasConfirmed(e.target.checked)}
                  disabled={isLocked}
                  className="size-[20px] shrink-0 accent-ink"
                />
                {t("confirm")}
              </label>
            </div>

            {problem === "failed" && (
              <p role="alert" className="m-0 text-[14px] text-alert">
                {t("error")}
              </p>
            )}

            <Button
              type="submit"
              variant="danger"
              className="w-full"
              disabled={!hasConfirmed || isLocked}
            >
              {isLocked ? "…" : t("submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="m-0 mb-[4px] text-[13px] font-medium leading-[20px] text-grey">{title}</h3>
      <ul className="m-0 list-none p-0 text-[15px] leading-[1.7] text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/* ─── 내부 ─────────────────────────── */

/** 서버가 막았다(409) — 결제 대기·배송 전·환불 중·반품·교환 중인 주문이 있다 */
function isBlocked(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === "ACCOUNT_WITHDRAWAL_BLOCKED";
}
