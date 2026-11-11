import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

const { searchState } = vi.hoisted(() => ({ searchState: { value: "" } }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchState.value),
}));

import WithdrawnNotice from "./WithdrawnNotice";

function renderNotice(search: string) {
  searchState.value = search;
  render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <WithdrawnNotice />
    </NextIntlClientProvider>,
  );
}

describe("탈퇴 완료 안내", () => {
  it("?withdrawn=1 로 오면 → '탈퇴가 끝났어요.'", () => {
    renderNotice("withdrawn=1");
    expect(screen.getByRole("status").textContent).toBe("탈퇴가 끝났어요.");
  });

  it("그 밖의 주소면 → 아무것도 없다", () => {
    renderNotice("buy=1&qty=2");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
