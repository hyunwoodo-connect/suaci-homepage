import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
  androidLine:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Line/14.17.1",
  iosKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
} as const;

const stage = vi.hoisted(() => ({ shipped: { wall: false, entry: false } }));
vi.mock("./stage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stage")>();
  return {
    ...actual,
    isStageOn: (...[event, name]: Parameters<typeof actual.isStageOn>) =>
      actual.isStageOn(event, name, stage.shipped),
  };
});

const PAGE_URL = "https://takesuaci.com/events/take-four?preview=tok-1234567890abcd";

function event(
  phase: EventPhase = "live",
  switches: Record<string, boolean> = {},
  eventId = "no01",
): EventDetail {
  return {
    eventId,
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
  stage.shipped = { wall: false, entry: false };
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Entrance", () => {
  it("폰 브라우저·진행 중 → No.01 쪽지(안내로)와 커튼 열기(부스로)", () => {
    render(<Entrance event={event("live")} userAgent={UA.iosSafari} url={PAGE_URL} />);
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

  it("머리 라벨 → 이벤트 내용의 회차 이름(소문자)", () => {
    render(<Entrance event={event("live")} userAgent={UA.iosSafari} url={PAGE_URL} />);
    expect(screen.getByText("no.01")).toBeInTheDocument();
  });

  it("이벤트 내용이 없는 이벤트 → 회차 라벨·쪽지 없이 커튼 열기만", () => {
    render(
      <Entrance event={event("live", {}, "unknown")} userAgent={UA.iosSafari} url={PAGE_URL} />,
    );
    expect(screen.queryByText(/no\.01/i)).toBeNull();
    expect(screen.queryByText("인화해서 보내 드려요")).toBeNull();
    expect(screen.getByRole("link", { name: "커튼 열기" })).toBeInTheDocument();
  });

  it("열기 전 → 쪽지가 있다", () => {
    render(<Entrance event={event("upcoming")} userAgent={UA.iosSafari} url={PAGE_URL} />);
    expect(screen.getByText("인화해서 보내 드려요")).toBeInTheDocument();
  });

  it("마감 → 쪽지는 떼고 커튼 열기는 그대로", () => {
    render(<Entrance event={event("ended")} userAgent={UA.iosSafari} url={PAGE_URL} />);
    expect(screen.queryByText("인화해서 보내 드려요")).toBeNull();
    expect(screen.getByRole("link", { name: "커튼 열기" })).toBeInTheDocument();
  });

  it("switches.wall이 아니면 → 다른 사람들 네컷 보기 없음", () => {
    render(
      <Entrance event={event("live", { wall: false })} userAgent={UA.iosSafari} url={PAGE_URL} />,
    );
    expect(screen.queryByText("다른 사람들 네컷 보기")).toBeNull();
  });

  it("switches.wall이 true여도 2단계 전(STAGE.wall false) → 다른 사람들 네컷 보기 없음", () => {
    render(
      <Entrance event={event("live", { wall: true })} userAgent={UA.iosSafari} url={PAGE_URL} />,
    );
    expect(screen.queryByText("다른 사람들 네컷 보기")).toBeNull();
  });

  it("2단계가 나왔고 switches.wall이 true → 다른 사람들 네컷 보기 링크", () => {
    stage.shipped = { wall: true, entry: false };
    render(
      <Entrance event={event("live", { wall: true })} userAgent={UA.iosSafari} url={PAGE_URL} />,
    );
    expect(screen.getByRole("link", { name: "다른 사람들 네컷 보기" })).toHaveAttribute(
      "href",
      "/events/take-four/wall",
    );
  });

  it("안드로이드 인앱 → 안내 + 지금 주소를 크롬 intent로 여는 브라우저로 열기, 커튼 열기 없음", () => {
    render(<Entrance event={event()} userAgent={UA.androidInstagram} url={PAGE_URL} />);
    expect(screen.getByText(/여기선 카메라가 안 열려요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "브라우저로 열기" })).toHaveAttribute(
      "href",
      "intent://takesuaci.com/events/take-four?preview=tok-1234567890abcd#Intent;scheme=https;package=com.android.chrome;end",
    );
    expect(screen.queryByText("커튼 열기")).toBeNull();
  });

  it("라인 → 같은 주소(미리보기 토큰 그대로)에 openExternalBrowser=1", () => {
    render(<Entrance event={event()} userAgent={UA.androidLine} url={PAGE_URL} />);
    expect(screen.getByRole("link", { name: "브라우저로 열기" })).toHaveAttribute(
      "href",
      `${PAGE_URL}&openExternalBrowser=1`,
    );
  });

  it("인앱 → 브라우저를 못 바꿔도 앨범에서 넉 장 고르기로 지나간다", () => {
    render(<Entrance event={event()} userAgent={UA.iosInstagram} url={PAGE_URL} />);
    expect(screen.getByRole("link", { name: "앨범에서 넉 장 고르기" })).toHaveAttribute(
      "href",
      "/events/take-four/album",
    );
  });

  it("폰 브라우저 → 앨범 링크 없음(커튼 열기만)", () => {
    render(<Entrance event={event()} userAgent={UA.iosSafari} url={PAGE_URL} />);
    expect(screen.queryByText("앨범에서 넉 장 고르기")).toBeNull();
  });

  it("iOS 카카오톡 → 카카오톡 외부 열기 스킴", () => {
    render(<Entrance event={event()} userAgent={UA.iosKakao} url={PAGE_URL} />);
    expect(screen.getByRole("link", { name: "브라우저로 열기" })).toHaveAttribute(
      "href",
      `kakaotalk://web/openExternal?url=${encodeURIComponent(PAGE_URL)}`,
    );
  });

  it("iOS 인스타 → 안내 + 주소 복사하기, 누르면 복사하고 토스트", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Entrance event={event()} userAgent={UA.iosInstagram} url={PAGE_URL} />);
    expect(screen.getByText(/오른쪽 위 ··· → 다른 브라우저로 열기/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "주소 복사하기" }));
    });
    expect(writeText).toHaveBeenCalledWith(PAGE_URL);
    expect(screen.getByRole("status")).toHaveTextContent("주소를 복사했어요");
  });

  it("복사가 둘 다 실패 → 길게 눌러 복사하라는 토스트", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    // jsdom엔 execCommand가 없어 이 테스트에서만 단다
    const execCommand = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    try {
      render(<Entrance event={event()} userAgent={UA.iosInstagram} url={PAGE_URL} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "주소 복사하기" }));
      });
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(screen.getByRole("status")).toHaveTextContent("주소창을 길게 눌러 복사해 주세요");
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });

  it("서버 그림(하이드레이션 전) → 안드로이드 intent 링크는 이미 href가 있다", () => {
    const html = renderToStaticMarkup(
      <Entrance event={event()} userAgent={UA.androidInstagram} url={PAGE_URL} />,
    );
    expect(html).toContain(
      'href="intent://takesuaci.com/events/take-four?preview=tok-1234567890abcd#Intent;scheme=https;package=com.android.chrome;end"',
    );
  });

  it("서버 그림(하이드레이션 전) → 복사 버튼은 비활성", () => {
    const html = renderToStaticMarkup(
      <Entrance event={event()} userAgent={UA.iosInstagram} url={PAGE_URL} />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>주소 복사하기<\/button>/);
  });

  it("복사 토스트는 2초 뒤 사라진다", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn() } });
    render(<Entrance event={event()} userAgent={UA.iosInstagram} url={PAGE_URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "주소 복사하기" }));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("PC UA → 폰에서만 열려요 안내와 주소, 커튼 열기 없음", () => {
    render(<Entrance event={event()} userAgent={UA.macChrome} url={PAGE_URL} />);
    expect(screen.getByText("폰에서만 열려요.")).toBeInTheDocument();
    expect(screen.getByText("takesuaci.com/events/take-four")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR 코드/ })).toBeInTheDocument();
    expect(screen.queryByText("커튼 열기")).toBeNull();
  });
});
