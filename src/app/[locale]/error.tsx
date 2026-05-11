"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold">오류</h1>
        <p className="mt-4 text-lg text-muted">문제가 발생했습니다</p>
        <button onClick={reset} className="mt-6 inline-block underline">
          다시 시도
        </button>
      </div>
    </div>
  );
}
