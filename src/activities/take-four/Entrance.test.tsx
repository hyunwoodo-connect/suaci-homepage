import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { EventDetail, EventPhase } from "@/types";

import Entrance from "./Entrance";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidInstagram:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.42.86 Android",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.31.94",
  iosKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
} as const;

function event(phase: EventPhase = "live", switches: Record<string, boolean> = {}): EventDetail {
  return {
    eventId: "no01",
    slug: "take-four",
    activityId: "take-four",
    phase,
    startAt: 0,
    startDtm: "",
    endAt: 0,
    endDtm: "",
    card: { title: "take four", summary: "", order: 1 },
    copy: {},
    switches,
    locales: ["ko"],
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Entrance", () => {
  it("폰 브라우저·진행 중 → No.01 쪽지(안내로)와 커튼 열기(부스로)", () => {
    render(<Entrance event={event("live")} userAgent={UA.iosSafari} />);
    expect(screen.getByRole("link", { name: /No\.01\s*인화해서 보내 드려요/ })).toHaveAttribute(
      "href",
      "/events/take-four/info",
    );
    expect(screen.getByRole("link", { name: "커튼 열기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
    expect(screen.queryByText(/카메라가 안 열려요/)).toBeNull();
  });

  it("열기 전 → 쪽지가 있다", () => {
    render(<Entrance event={event("upcoming")} userAgent={UA.iosSafari} />);
    expect(screen.getByText("인화해서 보내 드려요")).toBeInTheDocument();
  });

  it("마감 → 쪽지는 떼고 커튼 열기는 그대로", () => {
    render(<Entrance event={event("ended")} userAgent={UA.iosSafari} />);
    expect(screen.queryByText("인화해서 보내 드려요")).toBeNull();
    expect(screen.getByRole("link", { name: "커튼 열기" })).toBeInTheDocument();
  });

  it("switches.wall이 아니면 → 다른 사람들 네컷 보기 없음", () => {
    render(<Entrance event={event("live", { wall: false })} userAgent={UA.iosSafari} />);
    expect(screen.queryByText("다른 사람들 네컷 보기")).toBeNull();
  });

  it("switches.wall이 true → 다른 사람들 네컷 보기 링크", () => {
    render(<Entrance event={event("live", { wall: true })} userAgent={UA.iosSafari} />);
    expect(screen.getByRole("link", { name: "다른 사람들 네컷 보기" })).toHaveAttribute(
      "href",
      "/events/take-four/wall",
    );
  });

  it("안드로이드 인앱 → 안내 + 지금 주소를 크롬 intent로 여는 브라우저로 열기, 커튼 열기 없음", () => {
    render(<Entrance event={event()} userAgent={UA.androidInstagram} />);
    expect(screen.getByText(/여기선 카메라가 안 열려요/)).toBeInTheDocument();
    const { host, pathname } = window.location;
    expect(screen.getByRole("link", { name: "브라우저로 열기" })).toHaveAttribute(
      "href",
      `intent://${host}${pathname}#Intent;scheme=https;package=com.android.chrome;end`,
    );
    expect(screen.queryByText("커튼 열기")).toBeNull();
  });

  it("iOS 카카오톡 → 카카오톡 외부 열기 스킴", () => {
    render(<Entrance event={event()} userAgent={UA.iosKakao} />);
    expect(screen.getByRole("link", { name: "브라우저로 열기" })).toHaveAttribute(
      "href",
      `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`,
    );
  });

  it("iOS 인스타 → 안내 + 주소 복사하기, 누르면 복사하고 토스트", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Entrance event={event()} userAgent={UA.iosInstagram} />);
    expect(screen.getByText(/오른쪽 위 ··· → 다른 브라우저로 열기/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "주소 복사하기" }));
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status")).toHaveTextContent("주소를 복사했어요");
  });

  it("복사 토스트는 2초 뒤 사라진다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn() } });
    render(<Entrance event={event()} userAgent={UA.iosInstagram} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "주소 복사하기" }));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("PC UA → 폰에서만 열려요 안내와 주소, 커튼 열기 없음", () => {
    render(<Entrance event={event()} userAgent={UA.macChrome} />);
    expect(screen.getByText("폰에서만 열려요.")).toBeInTheDocument();
    expect(screen.getByText("takesuaci.com/events/take-four")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "QR 코드 자리" })).toBeInTheDocument();
    expect(screen.queryByText("커튼 열기")).toBeNull();
  });
});
