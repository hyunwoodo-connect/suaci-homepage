import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/** 루트 경로 → 기본 locale로 리다이렉트 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
