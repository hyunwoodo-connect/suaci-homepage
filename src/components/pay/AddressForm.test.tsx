import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

import AddressForm from "./AddressForm";

// Daum 우편번호 레이어 스텁 — embed 를 부르면 즉시 한 건을 고른 셈 친다
const embed = vi.fn();
let onComplete: ((d: { zonecode: string; roadAddress: string }) => void) | null = null;
vi.stubGlobal("daum", {
  Postcode: class {
    constructor(opts: { oncomplete: (d: { zonecode: string; roadAddress: string }) => void }) {
      onComplete = opts.oncomplete;
    }
    embed = embed;
  },
});

const submit = vi.fn().mockResolvedValue(undefined);

function renderForm() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <AddressForm onSubmit={submit} submitLabel="저장" />
    </NextIntlClientProvider>,
  );
}

async function pickAddress() {
  await act(async () => {
    onComplete?.({ zonecode: "04524", roadAddress: "서울 중구 세종대로 110" });
  });
}

describe("AddressForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onComplete = null;
  });

  it("주소 고른 뒤 상세주소 비우고 제출 → 동·호수 안내", async () => {
    renderForm();
    await pickAddress();
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
    fireEvent.change(screen.getByLabelText("전화"), { target: { value: "01012345678" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("동·호수까지 적어 주세요. 없으면 '없음'도 돼요.")).toBeTruthy();
  });

  it("전화가 틀리면 → 숫자만 안내", async () => {
    renderForm();
    await pickAddress();
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
    fireEvent.change(screen.getByLabelText("전화"), { target: { value: "021234" } });
    fireEvent.change(screen.getByLabelText("상세주소"), { target: { value: "10층" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("숫자만 넣어 주세요. 하이픈은 알아서 넣을게요.")).toBeTruthy();
  });

  it("정상 제출 → CreateAddressRequest 모양('다음에도 여기로' 기본 켬)", async () => {
    renderForm();
    await pickAddress();
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
    fireEvent.change(screen.getByLabelText("전화"), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText("상세주소"), { target: { value: "없음" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    });
    expect(submit).toHaveBeenCalledWith({
      recipient: "미나",
      phone: "010-1234-5678",
      zipcode: "04524",
      addr1: "서울 중구 세종대로 110",
      addr2: "없음",
      isDefault: true,
    });
  });
});
