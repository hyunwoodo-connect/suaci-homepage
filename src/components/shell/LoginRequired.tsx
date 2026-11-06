"use client";

import { useTranslations } from "next-intl";

import PageShell from "@/components/shell/PageShell";
import ButtonLink from "@/components/ui/ButtonLink";
import { useAuth } from "@/lib/auth/auth-context";

interface LoginRequiredProps {
  title: string;
  /** 로그인한 적 없는 사람에게 보일 한 줄. 로그인이 풀린 사람에게는 '로그인이 풀렸어요'가 대신 나온다 */
  needLogin: string;
  /** 로그인 버튼 글 */
  cta: string;
  /** 로그인 뒤 돌아올 경로 */
  next: string;
}

/** 로그인해야 보이는 화면(계정·배송지·주문)에 로그인하지 않고 왔을 때 — 한 줄 + 로그인 버튼 */
export default function LoginRequired({ title, needLogin, cta, next }: LoginRequiredProps) {
  const t = useTranslations("account");
  const { sessionEnded } = useAuth();
  return (
    <PageShell title={title}>
      <div className="flex max-w-[400px] flex-col gap-[20px]">
        <p className="m-0 text-[15px] text-ink">{sessionEnded ? t("sessionEnded") : needLogin}</p>
        <ButtonLink href={{ pathname: "/login", query: { next } }}>{cta}</ButtonLink>
      </div>
    </PageShell>
  );
}
