import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import BottomSheet from "./BottomSheet";
import Card from "./Card";
import Countdown from "./Countdown";
import DashedPill from "./DashedPill";
import GirlsIllustration from "./GirlsIllustration";
import NoteSticker from "./NoteSticker";
import PillButton from "./PillButton";
import Pin from "./Pin";
import SaveIcon from "./SaveIcon";
import ScallopFrame from "./ScallopFrame";
import ShareIcon from "./ShareIcon";
import Shutter from "./Shutter";
import StepBar from "./StepBar";
import TitleMark from "./TitleMark";
import TopBar from "./TopBar";
import TextLink from "./TextLink";
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

  it("filled 2 → 앞 두 칸만 색", () => {
    const { container } = render(<StepBar filled={2} size="sm" />);
    expect(segments(container).map((e) => e.hasAttribute("data-filled"))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("보조기기엔 숨긴다", () => {
    const { container } = render(<StepBar filled={4} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Pin", () => {
  it("장식이라 숨긴다", () => {
    const { container } = render(<Pin />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Wordmark", () => {
  it("글자는 suaci, 점은 숨긴다", () => {
    const { container } = render(<Wordmark />);
    expect(container.firstElementChild).toHaveTextContent(/^suaci$/);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("GirlsIllustration", () => {
  it("설명 붙은 소녀 그림(girls-peek.png)", () => {
    render(<GirlsIllustration />);
    const img = screen.getByRole("img", { name: /두 소녀/ });
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain(
      "/events/take-four/girls-peek.png",
    );
  });
});

describe("ShareIcon · SaveIcon", () => {
  it("버튼 이름은 글자만(아이콘은 숨김)", () => {
    render(
      <>
        <PillButton variant="outline" size="md">
          <ShareIcon />
          공유하기
        </PillButton>
        <PillButton variant="outline" size="md">
          <SaveIcon />
          저장
        </PillButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "공유하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(document.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
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
      <ScallopFrame>
        <span>안</span>
      </ScallopFrame>,
    );
    expect(screen.getByRole("img", { name: "카메라 화면" })).toBeInTheDocument();
    expect(screen.getByText("안")).toBeInTheDocument();
  });
});

describe("Countdown", () => {
  it("2 → 지금 숫자 하나만 읽고, 2가 크게", () => {
    const { container } = render(<Countdown count={2} />);
    expect(container.querySelector("[aria-live=assertive] .sr-only")).toHaveTextContent("2");
    expect(container.querySelector("[data-current]")).toHaveTextContent("2");
  });

  it("null(찰칵 순간) → 숫자 대신 찰칵", () => {
    const { container } = render(<Countdown count={null} />);
    expect(container.querySelector("[data-current]")).toBeNull();
    expect(container.querySelector(".sr-only")).toHaveTextContent("찰칵");
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

describe("PillButton 상태", () => {
  it("disabled → 비활성 버튼, 눌러도 안 불린다", () => {
    const onClick = vi.fn();
    render(
      <PillButton disabled onClick={onClick}>
        보내는 중…
      </PillButton>,
    );
    const btn = screen.getByRole("button", { name: "보내는 중…" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("href + disabled → 링크가 아니라 비활성 버튼", () => {
    render(
      <PillButton href="/events/take-four/booth" disabled>
        커튼 열기
      </PillButton>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "커튼 열기" })).toBeDisabled();
  });
});

describe("TextLink", () => {
  it("href 있으면 링크", () => {
    render(<TextLink href="/events/take-four">다시 찍기</TextLink>);
    expect(screen.getByRole("link", { name: "다시 찍기" })).toHaveAttribute(
      "href",
      "/events/take-four",
    );
  });

  it("버튼 → 폼 안에서도 제출하지 않는다", () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TextLink>아니요</TextLink>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "아니요" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disabled → 비활성 버튼, 눌러도 안 불린다", () => {
    const onClick = vi.fn();
    render(
      <TextLink href="/x" disabled onClick={onClick}>
        그냥 둘게요
      </TextLink>,
    );
    const btn = screen.getByRole("button", { name: "그냥 둘게요" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("DashedPill", () => {
  it("아직 못 누르는 버튼", () => {
    render(<DashedPill>2장 더</DashedPill>);
    expect(screen.getByRole("button", { name: "2장 더" })).toBeDisabled();
  });
});

describe("Card", () => {
  it("src → 그 카드 이미지", () => {
    render(<Card src="data:image/jpeg;base64,AA" alt="네컷" size="result" />);
    expect(screen.getByRole("img", { name: "네컷" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,AA",
    );
  });

  it("src 없음 → 카드 비율 뼈대에 합성과 같은 칸 넷(숨김)", () => {
    const { container } = render(<Card alt="" size="detail" />);
    const skeleton = container.querySelector("[data-card-skeleton]") as HTMLElement;
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton.style.aspectRatio).toBe("1080 / 1350");
    const cells = Array.from(skeleton.children) as HTMLElement[];
    expect(cells).toHaveLength(4);
    expect(cells[0].style.left).toBe(`${(63 / 1080) * 100}%`);
  });
});

describe("BottomSheet", () => {
  it("닫힘 → 대화상자 없음", () => {
    render(
      <BottomSheet isOpen={false} onClose={() => {}} label="벽에 붙이기">
        내용
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("열림 → 이름 붙은 대화상자, 포커스가 안으로", () => {
    render(
      <BottomSheet isOpen onClose={() => {}} label="벽에 붙이기">
        내용
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "벽에 붙이기" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("Esc → onClose", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen onClose={onClose} label="그냥 둘게요">
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

  it("Tab은 시트 안에서 돈다(끝 → 처음, 처음 ← 끝)", () => {
    render(
      <BottomSheet isOpen onClose={() => {}} label="벽에 붙이기">
        <button type="button">벽에 붙이기</button>
        <button type="button">아니요</button>
      </BottomSheet>,
    );
    const first = screen.getByRole("button", { name: "벽에 붙이기" });
    const last = screen.getByRole("button", { name: "아니요" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("열 때 시트 자체에서 Shift+Tab → 마지막으로", () => {
    render(
      <BottomSheet isOpen onClose={() => {}} label="벽에 붙이기">
        <button type="button">벽에 붙이기</button>
        <button type="button">아니요</button>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "아니요" })).toHaveFocus();
  });

  it("닫히면 연 버튼으로 포커스가 돌아간다", () => {
    function Harness({ isOpen }: { isOpen: boolean }) {
      return (
        <>
          <button type="button">열기</button>
          <BottomSheet isOpen={isOpen} onClose={() => {}} label="신고">
            <button type="button">신고하기</button>
          </BottomSheet>
        </>
      );
    }
    const { rerender } = render(<Harness isOpen={false} />);
    const opener = screen.getByRole("button", { name: "열기" });
    opener.focus();
    rerender(<Harness isOpen />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    rerender(<Harness isOpen={false} />);
    expect(opener).toHaveFocus();
  });

  it("열린 동안 onClose가 바뀌어도 포커스를 다시 뺏지 않는다", () => {
    const { rerender } = render(
      <BottomSheet isOpen onClose={() => {}} label="신고">
        <button type="button">신고하기</button>
      </BottomSheet>,
    );
    const inner = screen.getByRole("button", { name: "신고하기" });
    inner.focus();
    rerender(
      <BottomSheet isOpen onClose={() => {}} label="신고">
        <button type="button">신고하기</button>
      </BottomSheet>,
    );
    expect(inner).toHaveFocus();
  });
});
