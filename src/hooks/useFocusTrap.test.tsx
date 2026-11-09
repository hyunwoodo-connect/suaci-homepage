import { useRef, useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

function Sheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} role="dialog" aria-label="시트" tabIndex={-1}>
      <button type="button">첫째</button>
      <button type="button" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

function Page() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        열기
      </button>
      <a href="#x">바깥 링크</a>
      {isOpen && <Sheet onClose={() => setIsOpen(false)} />}
    </>
  );
}

describe("useFocusTrap", () => {
  it("열리면 시트로 초점, Tab 은 끝에서 처음으로·Shift+Tab 은 처음에서 끝으로, 닫히면 연 버튼으로", () => {
    render(<Page />);
    const opener = screen.getByRole("button", { name: "열기" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    const first = screen.getByRole("button", { name: "첫째" });
    const last = screen.getByRole("button", { name: "닫기" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // 초점이 시트 밖에 있어도 Tab 은 시트로 돌아온다
    screen.getByRole("link", { name: "바깥 링크" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.click(last);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
