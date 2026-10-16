import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 text-lg text-grey">페이지를 찾을 수 없습니다</p>
        <Link href="/" className="mt-6 inline-block underline">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
