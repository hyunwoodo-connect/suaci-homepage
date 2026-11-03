"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import ConsentForm from "@/components/auth/ConsentForm";
import { readSignupStash, type SignupStash } from "@/lib/auth/social";

/**
 * 소셜 첫 가입 동의 페이지 — 콜백이 담아 둔 가입 표(sessionStorage)를 꺼내 ConsentForm 에 준다.
 * 표가 없으면(직접 들어옴·새로고침 뒤 소비됨) 로그인으로 돌려보낸다.
 */
export default function ConsentPage() {
  const t = useTranslations("auth.consent");
  const router = useRouter();
  const [stash, setStash] = useState<SignupStash | null>(null);

  useEffect(() => {
    // setState 는 .then() 안에서(동기 setState 를 react-hooks 린트가 막는다)
    Promise.resolve().then(() => {
      const saved = readSignupStash();
      if (saved) setStash(saved);
      else router.replace("/login");
    });
  }, [router]);

  return (
    <PageShell title={t("title")} meta={t("sub")}>
      <div className="max-w-[440px]">{stash && <ConsentForm stash={stash} />}</div>
    </PageShell>
  );
}
