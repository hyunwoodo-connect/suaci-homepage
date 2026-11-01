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
      {/* 키컬러는 밝아 글자색으로 안 읽힌다. 점으로 두고 글자는 ink */}
      <p className="m-0 flex items-center gap-[8px] text-[18px] text-ink">
        <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
        {formatKstMonthDay(startAt)}에 열려요
      </p>
      {message ? <p className="m-0 text-[14px] text-grey">{message}</p> : null}
    </section>
  );
}
