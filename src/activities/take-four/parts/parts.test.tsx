import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import BottomSheet from "./BottomSheet";
import Countdown from "./Countdown";
import DashedPill from "./DashedPill";
import NoteSticker from "./NoteSticker";
import PillButton from "./PillButton";
import ScallopFrame from "./ScallopFrame";
import Shutter from "./Shutter";
import StepBar from "./StepBar";
import Strip from "./Strip";
import TitleMark from "./TitleMark";
import TopBar from "./TopBar";
import Wordmark from "./Wordmark";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TopBar", () => {
  it("href 있는 뒤로 → 이름 붙은 링크 + 오른쪽 라벨", () => {
    render(
      <TopBar nav={{ icon: "back", label: "밖으로", href: "/events/take-four" }} label="1 / 4" />,
    );
    expect(screen.getByRole("link", { name: "밖으로" })).toHaveAttribute(
      "href",
      "/events/take-four",
    );
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("href 없는 닫기 → 버튼, 누르면 onClick", () => {
    const onClick = vi.fn();
    render(<TopBar nav={{ icon: "close", label: "멈추기", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("nav 없으면 start(워드마크)를 왼쪽에", () => {
    render(<TopBar start={<Wordmark />} label="no.01" />);
    expect(screen.getByText("suaci")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("TitleMark", () => {
  it("제목 `take four.`", () => {
    render(<TitleMark />);
    expect(screen.getByRole("heading", { level: 1, name: "take four." })).toBeInTheDocument();
  });
});

describe("StepBar", () => {
  function segments(container: HTMLElement) {
    return Array.from(container.querySelectorAll("span"));
  }

  it("filled 1 · active 0 → 첫 칸만 차고 첫 칸에 링", () => {
    const { container } = render(<StepBar filled={1} active={0} size="sm" />);
    const s = segments(container);
    expect(s.map((e) => e.dataset.filled)).toEqual(["true", "false", "false", "false"]);
    expect(s.map((e) => e.dataset.active)).toEqual(["true", "false", "false", "false"]);
  });

  it("active 없으면(대기·완료) 링 없음", () => {
    const { container } = render(<StepBar filled={4} />);
    expect(segments(container).every((e) => e.dataset.active === "false")).toBe(true);
  });

  it("보조기기엔 숨긴다", () => {
    const { container } = render(<StepBar filled={2} active={1} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("NoteSticker", () => {
  it("쪽지 전체가 링크, 이름에 머리와 본문", () => {
    render(
      <NoteSticker href="/events/take-four/event" title="No.01">
        인화해서 보내 드려요
      </NoteSticker>,
    );
    expect(screen.getByRole("link", { name: /No\.01\s*인화해서 보내 드려요/ })).toHaveAttribute(
      "href",
      "/events/take-four/event",
    );
  });
});

describe("ScallopFrame", () => {
  it("이름 붙은 그림 + 창 안에 자식", () => {
    render(
      <ScallopFrame label="카메라 화면">
        <Countdown value={3} />
      </ScallopFrame>,
    );
    expect(screen.getByRole("img", { name: "카메라 화면" })).toBeInTheDocument();
    expect(screen.getByText("3")).toHaveAttribute("aria-live", "polite");
  });
});

describe("Countdown", () => {
  it("value null → 읽기 영역은 남고 비어 있다", () => {
    const { container } = render(<Countdown value={null} />);
    const live = container.querySelector("[aria-live]");
    expect(live).not.toBeNull();
    expect(live).toBeEmptyDOMElement();
  });
});

describe("Shutter", () => {
  it("ready → `찍기 시작` 버튼, 누르면 onPress", () => {
    const onPress = vi.fn();
    render(<Shutter state="ready" onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "찍기 시작" }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("starting → `카메라 켜는 중` 비활성, 눌러도 안 불린다", () => {
    const onPress = vi.fn();
    render(<Shutter state="starting" onPress={onPress} />);
    const btn = screen.getByRole("button", { name: "카메라 켜는 중" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("running → 자동으로 넘어가는 중 비활성", () => {
    render(<Shutter state="running" />);
    expect(screen.getByRole("button", { name: "다음 장 (자동으로 넘어가요)" })).toBeDisabled();
  });
});

describe("PillButton", () => {
  it("href 있으면 링크", () => {
    render(<PillButton href="/events/take-four/booth">커튼 열기</PillButton>);
    expect(screen.getByRole("link", { name: "커튼 열기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });

  it("href 없으면 버튼, 누르면 onClick", () => {
    const onClick = vi.fn();
    render(
      <PillButton variant="outline" size="md" onClick={onClick}>
        저장
      </PillButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("DashedPill", () => {
  it("누를 수 없는 자리(aria-disabled)", () => {
    render(<DashedPill>2장 더</DashedPill>);
    expect(screen.getByText("2장 더")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Strip", () => {
  const props = {
    src: "/events/take-four/strip-main-duo.jpg",
    alt: "네컷: 무표정, 살짝 미소, 방긋, 박장대소",
    number: "no.0347",
    meta: "No.01 · 12.04",
  };

  it("사진 + 캡션(번호·회차 날짜)", () => {
    render(<Strip {...props} />);
    expect(screen.getByRole("img", { name: props.alt })).toHaveAttribute("src", props.src);
    expect(screen.getByRole("figure")).toHaveTextContent("no.0347");
    expect(screen.getByRole("figure")).toHaveTextContent("No.01 · 12.04");
  });

  it("hasStamp 없으면 도장 없음", () => {
    const { container } = render(<Strip {...props} />);
    expect(container.querySelector("[data-stamp]")).toBeNull();
  });

  it("hasStamp → `No.01` 도장", () => {
    const { container } = render(<Strip {...props} hasStamp />);
    expect(container.querySelector("[data-stamp]")).toHaveTextContent("No.01");
  });
});

describe("BottomSheet", () => {
  it("닫힘 → 대화상자 없음", () => {
    render(
      <BottomSheet isOpen={false} onClose={() => {}} label="응모하기">
        내용
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("열림 → 이름 붙은 대화상자, 포커스가 안으로", () => {
    render(
      <BottomSheet isOpen onClose={() => {}} label="응모하기">
        내용
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "응모하기" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("Esc → onClose", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} label="응모 취소">
        내용
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("바깥(어두운 뒤) 탭 → onClose, 시트 안 탭은 아님", () => {
    const onClose = vi.fn();
    const { container } = render(
      <BottomSheet isOpen onClose={onClose} label="신고">
        내용
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector("[data-backdrop]")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("열려 있는 동안 배경 스크롤을 막고 닫으면 되돌린다", () => {
    const { rerender } = render(
      <BottomSheet isOpen onClose={() => {}} label="신고">
        내용
      </BottomSheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <BottomSheet isOpen={false} onClose={() => {}} label="신고">
        내용
      </BottomSheet>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
