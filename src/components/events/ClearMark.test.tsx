import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ko from "@/messages/ko.json";
import { recordClear } from "@/lib/play-record";

import ClearMark from "./ClearMark";

async function renderMark(eventId: string) {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ClearMark eventId={eventId} />
      </NextIntlClientProvider>,
    );
  });
}

describe("ClearMark", () => {
  it("이 기기에서 그 이벤트를 깬 적이 있으면 → 성공했다고 표시한다", async () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: 1 });
    await renderMark("teum01");
    expect(screen.getByText("성공했어요")).toBeTruthy();
  });

  it("깬 적이 없으면 → 아무것도 그리지 않는다", async () => {
    await renderMark("teum01");
    expect(screen.queryByText("성공했어요")).toBeNull();
  });

  it("다른 이벤트를 깬 기록 → 이 카드에는 표시하지 않는다", async () => {
    recordClear({ eventId: "teum02", activityId: "teum", at: 1 });
    await renderMark("teum01");
    expect(screen.queryByText("성공했어요")).toBeNull();
  });

  it("놀이에 다녀와 뒤로가기로 되살아난 화면 → 그사이 깬 것을 표시한다", async () => {
    await renderMark("teum01");
    recordClear({ eventId: "teum01", activityId: "teum", at: 1 });
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(screen.getByText("성공했어요")).toBeTruthy();
  });
});
