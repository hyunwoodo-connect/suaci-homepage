import { formatKstMonthDay } from "@/lib/event-date";

interface EventWaitingProps {
  title: string;
  /** 여는 시각(Unix ms) */
  startAt: number;
  message?: string;
}

/** 이벤트 페이지는 한국어 단독이라 고정 문구를 컴포넌트에 둔다. */
export default function EventWaiting({ title, startAt, message }: EventWaitingProps) {
  return (
    <section className="flex flex-col items-center gap-[12px] text-center">
      <h1 className="m-0 text-[24px] text-ink">{title}</h1>
      <p className="m-0 text-[18px] text-lime">{formatKstMonthDay(startAt)}에 열려요</p>
      {message ? <p className="m-0 text-[14px] text-grey">{message}</p> : null}
    </section>
  );
}
