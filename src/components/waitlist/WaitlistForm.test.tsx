import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api/errors";

import WaitlistForm from "./WaitlistForm";

const { join } = vi.hoisted(() => ({ join: vi.fn() }));
vi.mock("@/lib/api/waitlist", () => ({ waitlistApi: { join } }));

function renderForm(source?: string) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <WaitlistForm locale="ko" source={source} />
    </NextIntlClientProvider>,
  );
}

async function fill(email = "a@b.co", consents = true) {
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: email } });
  if (consents) {
    fireEvent.click(screen.getByLabelText(/개인정보 수집·이용에 동의합니다/));
    fireEvent.click(screen.getByLabelText(/광고성 정보를 이메일로 받는 데 동의합니다/));
  }
}

beforeEach(() => join.mockReset());

describe("WaitlistForm", () => {
  it("동의 둘 중 하나라도 없으면 → 보내지 않고 안내", async () => {
    renderForm();
    await fill("a@b.co", false);
    fireEvent.click(screen.getByLabelText(/개인정보 수집·이용에 동의합니다/));
    fireEvent.click(screen.getByRole("button", { name: "알림 받기" }));
    expect(join).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("두 가지 모두 동의해 주세요.");
  });

  it("보내는 동안 버튼이 '보내는 중…'으로 바뀌고 비활성, 끝나면 완료 문구", async () => {
    let resolve: () => void = () => {};
    join.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderForm("teaser");
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "알림 받기" }));
    expect(screen.getByRole("button", { name: "보내는 중…" })).toBeDisabled();
    expect(join).toHaveBeenCalledWith({ email: "a@b.co", locale: "ko", source: "teaser" });
    resolve();
    expect(await screen.findByText(/등록했어요/)).toBeInTheDocument();
  });

  it("서버 오류 코드 → 맞는 문구, 모르는 오류 → 다시 시도 버튼으로 같은 값을 다시 보낸다", async () => {
    join.mockRejectedValueOnce(new ApiClientError("INVALID_EMAIL", "x", 400, "email"));
    renderForm();
    await fill("a@b.co");
    fireEvent.click(screen.getByRole("button", { name: "알림 받기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이메일 주소를 다시 확인해 주세요.");

    join.mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "알림 받기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("지금은 등록하지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText(/등록했어요/)).toBeInTheDocument();
    expect(join).toHaveBeenCalledTimes(3);
  });
});
