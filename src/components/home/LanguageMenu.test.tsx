import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/orders",
  Link: ({
    href,
    locale,
    children,
    ...rest
  }: { href: string; locale: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a
      href={`/${locale}${href}`}
      {...rest}
      onClick={(e) => {
        (rest.onClick as ((e: React.MouseEvent) => void) | undefined)?.(e);
        e.preventDefault(); // jsdom 은 페이지 이동을 못 한다
      }}
    >
      {children}
    </a>
  ),
}));

import LanguageMenu from "./LanguageMenu";

function renderMenu(locale = "ko") {
  return render(
    <NextIntlClientProvider locale={locale} messages={ko}>
      <LanguageMenu />
      <p>바깥</p>
    </NextIntlClientProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /언어/ });

describe("LanguageMenu", () => {
  it("닫힌 처음 → 단추에 지금 언어(kr·한국어)가 보이고 목록은 닫혀 있다", () => {
    renderMenu();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().textContent).toContain("kr");
    expect(trigger().textContent).toContain("한국어");
  });

  it("누르면 → 펼쳐지고, 다시 누르면 → 닫힌다", () => {
    renderMenu();
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("목록 → 세 언어가 지금 경로 그대로, 지금 언어엔 aria-current", () => {
    renderMenu("ja");
    fireEvent.click(trigger());

    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["한국어", "english", "日本語"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/ko/orders",
      "/en/orders",
      "/ja/orders",
    ]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, null, "true"]);
    expect(links.map((a) => a.getAttribute("lang"))).toEqual(["ko", "en", "ja"]);
  });

  it("Esc → 닫히고 초점은 단추로 돌아온다", () => {
    renderMenu();
    fireEvent.click(trigger());
    screen.getAllByRole("link")[1].focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("바깥을 누르면 → 닫힌다", () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("바깥"));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("단추에서 ↓ → 펼치고 첫 언어에 초점", () => {
    renderMenu();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getAllByRole("link")[0]);
  });

  it("목록 안 ↑↓ → 끝에서 처음으로 돌아간다", () => {
    renderMenu();
    fireEvent.click(trigger());
    const links = screen.getAllByRole("link");

    fireEvent.keyDown(links[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[2]);
    fireEvent.keyDown(links[2], { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[0]);
  });

  it("초점이 밖으로 나가면(Tab) → 닫힌다", () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.blur(screen.getAllByRole("link")[2], { relatedTarget: screen.getByText("바깥") });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("다음 초점 없이 흐려지면(Safari 가 누른 링크에 초점을 안 줄 때) → 열어 둔다", () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.blur(trigger(), { relatedTarget: null });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("언어를 고르면 → 목록을 닫는다", () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.click(screen.getAllByRole("link")[1]);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
