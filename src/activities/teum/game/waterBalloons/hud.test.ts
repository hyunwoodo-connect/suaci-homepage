import { describe, expect, it } from "vitest";

import { WaterBalloonHud } from "./hud";

// 화면 하나와, 눌린 단추를 적는 칸
function mount() {
  const parent = document.createElement("div");
  const pressed: string[] = [];
  const hud = new WaterBalloonHud(parent, {
    onAgain: () => pressed.push("again"),
    onKeepPlaying: () => pressed.push("keep"),
  });
  const root = parent.firstElementChild as HTMLElement;
  const buttonNamed = (name: string) =>
    [...parent.querySelectorAll("button")].find((b) => b.textContent === name)!;
  /** 성공 판이 보이나 */
  const isPanelShown = () =>
    parent.querySelector<HTMLElement>('[role="dialog"]')!.style.visibility === "visible";
  return { parent, hud, root, pressed, buttonNamed, isPanelShown };
}

describe("WaterBalloonHud 개수 알약", () => {
  it("setCount → '3 / 10' 과 읽는 이름", () => {
    const { parent, hud } = mount();
    hud.setCount(3, 10);
    const pill = parent.querySelector('[role="status"]')!;
    expect([pill.textContent, pill.getAttribute("aria-label")]).toEqual([
      "3 / 10",
      "물풍선 10개 가운데 3개",
    ]);
  });

  it("수가 오르면 → 잠깐 커졌다가 프레임 시계로 제 크기로 돌아온다", () => {
    const { parent, hud } = mount();
    const pill = parent.querySelector<HTMLElement>('[role="status"]')!;
    hud.setCount(1, 10);
    const bumped = pill.style.transform;
    hud.update({ dt: 0.2, time: 0.2 });
    expect([bumped, pill.style.transform]).toEqual([
      "translateX(-50%) scale(1.24)",
      "translateX(-50%) scale(1)",
    ]);
  });

  it("수가 0 으로 돌아가면(한 번 더) → 커지지 않는다", () => {
    const { parent, hud } = mount();
    const pill = parent.querySelector<HTMLElement>('[role="status"]')!;
    hud.setCount(10, 10);
    hud.update({ dt: 1, time: 1 });
    hud.setCount(0, 10);
    expect(pill.style.transform).toBe("translateX(-50%) scale(1)");
  });
});

describe("WaterBalloonHud 화살표", () => {
  it("자리를 주면 → 그 자리에 보이고, 뾰족한 끝이 그 각을 가리키게 돈다", () => {
    const { parent, hud } = mount();
    const arrow = parent.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    hud.pointTo({ x: 370, y: 400, angle: 0 }, "#ff4f9a");
    expect([arrow.style.display, arrow.style.transform]).toEqual([
      "block",
      `translate(370px, 400px) rotate(${Math.PI / 4}rad)`,
    ]);
  });

  it("null(물풍선이 화면에 보인다) → 숨는다", () => {
    const { parent, hud } = mount();
    const arrow = parent.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    hud.pointTo({ x: 370, y: 400, angle: 0 });
    hud.pointTo(null);
    expect(arrow.style.display).toBe("none");
  });
});

describe("WaterBalloonHud 성공 판", () => {
  it("처음엔 → 보이지 않는다", () => {
    const { isPanelShown } = mount();
    expect(isPanelShown()).toBe(false);
  });

  it("showSuccess → 성공!·다 먹었다는 말·걸린 시간이 보인다", () => {
    const { parent, hud, isPanelShown } = mount();
    hud.showSuccess(10, 151.9);
    const panel = parent.querySelector('[role="dialog"]')!;
    const text = panel.textContent ?? "";
    expect(isPanelShown()).toBe(true);
    expect(["성공!", "물풍선 10개를 다 먹었어요", "2분 31초"].every((s) => text.includes(s))).toBe(
      true,
    );
  });

  it("'한 번 더'·'계속 놀기' → 누른 것을 알린다", () => {
    const { hud, pressed, buttonNamed } = mount();
    hud.showSuccess(10, 20);
    buttonNamed("한 번 더").click();
    buttonNamed("계속 놀기").click();
    expect(pressed).toEqual(["again", "keep"]);
  });

  it("단추 → 누르는 칸이 44px 이상", () => {
    const { buttonNamed } = mount();
    const heights = ["한 번 더", "계속 놀기"].map((name) =>
      parseInt(buttonNamed(name).style.minHeight),
    );
    expect(heights.every((h) => h >= 44)).toBe(true);
  });

  it("hideSuccess → 다시 보이지 않는다", () => {
    const { hud, isPanelShown } = mount();
    hud.showSuccess(10, 20);
    hud.hideSuccess();
    expect(isPanelShown()).toBe(false);
  });
});

describe("WaterBalloonHud 숨기기·치우기", () => {
  it("꾸미기 씬(setHidden) → 통째로 숨고, 닫으면 돌아온다", () => {
    const { hud, root } = mount();
    hud.setHidden(true);
    const hidden = root.style.display;
    hud.setHidden(false);
    expect([hidden, root.style.display]).toEqual(["none", ""]);
  });

  it("알약·화살표 → 손가락을 받지 않는다(끌기를 막지 않는다), 성공 판만 받는다", () => {
    const { parent, root } = mount();
    const panel = parent.querySelector<HTMLElement>('[role="dialog"]')!;
    expect([root.style.pointerEvents, panel.style.pointerEvents]).toEqual(["none", "auto"]);
  });

  it("close(계속 놀기)·dispose → 화면에서 사라진다", () => {
    const a = mount(),
      b = mount();
    a.hud.close();
    b.hud.dispose();
    expect([a.parent.childElementCount, b.parent.childElementCount]).toEqual([0, 0]);
  });
});
