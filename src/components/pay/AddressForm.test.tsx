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

function renderForm(withLabel = false) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <AddressForm onSubmit={submit} submitLabel="저장" withLabel={withLabel} />
    </NextIntlClientProvider>,
  );
}

async function fillAndSubmit() {
  await pickAddress();
  fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
  fireEvent.change(screen.getByLabelText("휴대폰 번호"), { target: { value: "01012345678" } });
  fireEvent.change(screen.getByLabelText("상세 주소"), { target: { value: "없음" } });
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
  });
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
    fireEvent.change(screen.getByLabelText("휴대폰 번호"), { target: { value: "01012345678" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("상세 주소를 입력해 주세요.")).toBeTruthy();
  });

  it("전화가 틀리면 → 숫자만 안내", async () => {
    renderForm();
    await pickAddress();
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
    fireEvent.change(screen.getByLabelText("휴대폰 번호"), { target: { value: "021234" } });
    fireEvent.change(screen.getByLabelText("상세 주소"), { target: { value: "10층" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("휴대폰 번호를 확인해 주세요.")).toBeTruthy();
  });

  it("정상 제출 → CreateAddressRequest 모양('기본 배송지로 저장' 기본 켬)", async () => {
    renderForm();
    await pickAddress();
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "미나" } });
    fireEvent.change(screen.getByLabelText("휴대폰 번호"), { target: { value: "01012345678" } });
    fireEvent.change(screen.getByLabelText("상세 주소"), { target: { value: "없음" } });
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

  it("주문서(배송지 이름 칸 없음) → 배송지 이름을 묻지 않는다", () => {
    renderForm();
    expect(screen.queryByLabelText("배송지 이름 (선택)")).toBeNull();
  });

  it("배송지 이름은 선택 — 비우고 저장하면 label 을 보내지 않는다", async () => {
    renderForm(true);
    expect(screen.getByPlaceholderText("집, 회사")).toBeTruthy();
    await fillAndSubmit();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0]?.[0]).not.toHaveProperty("label");
  });

  it("배송지 이름을 적으면 → 앞뒤 공백을 떼고 label 로 보낸다", async () => {
    renderForm(true);
    fireEvent.change(screen.getByLabelText("배송지 이름 (선택)"), { target: { value: " 회사 " } });
    await fillAndSubmit();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ label: "회사", recipient: "미나" }),
    );
  });
});
