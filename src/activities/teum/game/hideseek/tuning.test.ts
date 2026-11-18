import { describe, expect, it } from "vitest";

import data from "./hideseek.data.json";
import { HIDE, readTuning } from "./tuning";

// 고친 값 하나만 바꿔 넣은 사본
function edited(change: (copy: Record<string, unknown>) => void): unknown {
  const copy = structuredClone(data) as Record<string, unknown>;
  change(copy);
  return copy;
}

describe("숨바꼭질 값 파일(hideseek.data.json)", () => {
  it("지금 파일 → 그대로 읽힌다", () => {
    expect(readTuning(data)).toEqual(HIDE);
    expect(HIDE.copy.hide).toBe("꼭꼭 숨어라");
  });

  it("수가 글로 들어가면 → 그 칸 이름을 알리며 멈춘다", () => {
    const bad = edited((c) => {
      (c.find as Record<string, unknown>).tapPad = "24px";
    });
    expect(() => readTuning(bad)).toThrow("find.tapPad: 수여야 한다");
  });

  it("모르는 내용물·꽝과 일어나는 일에 같이 있는 내용물 → 멈춘다", () => {
    const unknown = edited((c) => {
      (c.unbox as Record<string, unknown>).duds = ["nested", "confetti"];
    });
    expect(() => readTuning(unknown)).toThrow("unbox.duds[1]");
    const both = edited((c) => {
      (c.unbox as Record<string, unknown>).duds = ["nested", "giant"];
    });
    expect(() => readTuning(both)).toThrow('"giant" 가 꽝과 일어나는 일에 같이 있다');
  });

  it("꽝 수가 찾는 상자 수보다 많으면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.unbox as Record<string, unknown>).dudCount = 5;
    });
    expect(() => readTuning(bad)).toThrow("unbox.dudCount: 0~4");
  });

  it("판 시작 장면의 시각이 차례대로가 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.start as Record<string, unknown>).openAt = 1;
    });
    expect(() => readTuning(bad)).toThrow("start.openAt: closeAt 보다 이르다");
  });

  it("판에 부르는 생물이 설정표에 없는 종이거나, 하늘 무리에 도는 반지름이 없으면 → 멈춘다", () => {
    const unknown = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], species: "dragon" };
    });
    expect(() => readTuning(unknown)).toThrow('guests[0].species: "dragon"');
    const flat = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { species: "c_wletter", count: 3, x: 0, y: 10 };
    });
    expect(() => readTuning(flat)).toThrow("guests[0].orbit");
  });

  it("무리가 사는 자리(home)가 [x, y] 두 수가 아니거나 무대 밖이면 → 멈춘다", () => {
    const flat = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], home: [3] };
    });
    expect(() => readTuning(flat)).toThrow("guests[0].home: [x, y] 두 수여야 한다");
    const far = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], home: [69, 69] };
    });
    expect(() => readTuning(far)).toThrow("guests[0].home: 무대 반경");
  });

  it("사는 자리를 적지 않은 무리 → home 은 null(판마다 아무 빈자리)", () => {
    const loose = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], home: undefined };
    });
    expect(readTuning(loose).guests[0].home).toBeNull();
    expect(HIDE.guests.find((g) => g.species === "teapot")?.home).toEqual({ x: 0, y: 20 });
  });

  it("한 줄로 서는 무리(row)가 참·거짓이 아니거나 하늘 무리면 → 멈춘다", () => {
    const bad = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], row: "yes" };
    });
    expect(() => readTuning(bad)).toThrow("guests[0].row");
    const sky = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { species: "c_wletter", count: 2, orbit: 6, alt: 3, row: true };
    });
    expect(() => readTuning(sky)).toThrow("guests[0].row: 하늘 무리는 줄 서지 않는다");
  });

  it("앉을 자리가 무리보다 적거나 무대 밖이면 → 멈춘다", () => {
    const few = edited((c) => {
      c.seats = (c.seats as unknown[]).slice(0, 3);
    });
    expect(() => readTuning(few)).toThrow("seats: 생물 무리(guests) 수보다 적다");
    const far = edited((c) => {
      const seats = c.seats as Record<string, unknown>[];
      seats[0] = { x: 90, y: 0 };
    });
    expect(() => readTuning(far)).toThrow("seats[0]: 무대 반경");
  });

  it("줄 선 상자의 배수가 1 을 넘으면 → 멈춘다", () => {
    const big = edited((c) => {
      (c.line as Record<string, unknown>).scale = 1.2;
    });
    expect(() => readTuning(big)).toThrow("line.scale: 1 이하여야 한다");
  });

  it("값 → 누르기·상자·버섯 높이 뛰기가 명세대로", () => {
    expect(HIDE.find).toEqual({ tapPad: 24, tapMin: 96, tapMove: 10 });
    expect(HIDE.box).toMatchObject({ height: 3, earScale: 2, outlinePx: 2 });
    expect(HIDE.mushroom).toMatchObject({ height: 25, hang: 4, drift: 10 });
  });

  it("화면 글 → 큰 글자와 단추 말고는 없다(칙이라는 낱말은 어디에도 없다)", () => {
    expect(Object.keys(HIDE.copy).sort()).toEqual(["again", "found", "hide", "it", "open"]);
    const texts = JSON.stringify(HIDE.copy);
    expect(texts).not.toContain("칙");
  });
});
