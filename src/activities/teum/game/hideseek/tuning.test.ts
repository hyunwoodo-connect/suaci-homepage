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
    expect(HIDE.spots).toHaveLength(18);
    expect(HIDE.copy.hide).toBe("꼭꼭 숨어라");
  });

  it("묶음에 없는 자리 id → 어느 묶음의 어느 id 인지 알리며 멈춘다", () => {
    const bad = edited((c) => {
      c.rounds = [["wishtree", "tree-e", "pad-n", "nowhere"]];
    });
    expect(() => readTuning(bad)).toThrow('rounds[0]: spots 에 없는 id "nowhere"');
  });

  it("묶음의 자리가 넷이 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      c.rounds = [["wishtree", "tree-e"]];
    });
    expect(() => readTuning(bad)).toThrow("rounds[0]: 자리 4개여야 한다");
  });

  it("같은 id 가 두 번 → 멈춘다", () => {
    const bad = edited((c) => {
      const spots = c.spots as unknown[];
      c.spots = [...spots, spots[0]];
    });
    expect(() => readTuning(bad)).toThrow('id "wishtree" 가 두 번');
  });

  it("수가 글로 들어가면 → 그 칸 이름을 알리며 멈춘다", () => {
    const bad = edited((c) => {
      (c.chik as Record<string, unknown>).reach = "40m";
    });
    expect(() => readTuning(bad)).toThrow("chik.reach: 수여야 한다");
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

  it("숨는 자리가 무대 반경 밖이면 → 어느 자리인지 알리며 멈춘다", () => {
    const bad = edited((c) => {
      (c.stage as Record<string, unknown>).radius = 50;
    });
    expect(() => readTuning(bad)).toThrow('"tree-e" 가 무대 반경(stage.radius 50m) 밖이다');
  });

  it("판 시작 장면의 시각이 차례대로가 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.start as Record<string, unknown>).openAt = 1;
    });
    expect(() => readTuning(bad)).toThrow("start.openAt: closeAt 보다 이르다");
  });

  it("해가 진 뒤 장면·노을·전설의 시각이 판 길이와 어긋나면 → 멈춘다", () => {
    const noRun = edited((c) => {
      (c.lost as Record<string, unknown>).climbAt = 1.3;
    });
    expect(() => readTuning(noRun)).toThrow("lost.climbAt");
    const lateRed = edited((c) => {
      (c.round as Record<string, unknown>).redFrom = 200;
    });
    expect(() => readTuning(lateRed)).toThrow("round.redFrom");
    const lateLegend = edited((c) => {
      (c.legend as Record<string, unknown>).to = 240;
    });
    expect(() => readTuning(lateLegend)).toThrow("legend.to");
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

  it("뒤에 숨기의 side 가 1·-1 이 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      const spots = c.spots as Record<string, unknown>[];
      spots[0] = { ...spots[0], side: 0 };
    });
    expect(() => readTuning(bad)).toThrow("spots[0].side");
  });

  it("뛰어가는 시간·고양이가 냄새 맡는 거리가 차례대로가 아니면 → 멈춘다", () => {
    const slow = edited((c) => {
      (c.find as Record<string, unknown>).leapMin = 2;
    });
    expect(() => readTuning(slow)).toThrow("find: leapMin 이 leapMax 보다 길다");
    const mixed = edited((c) => {
      (c.cat as Record<string, unknown>).near = 30;
    });
    expect(() => readTuning(mixed)).toThrow("cat: near ≤ mid ≤ far");
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

  it("도움을 주는 무리가 종류마다 하나가 아니면 → 멈춘다", () => {
    const twice = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[6] = { ...guests[6], help: "rabbit" };
    });
    expect(() => readTuning(twice)).toThrow('도움 "rabbit" 를 주는 무리가 하나여야 한다(지금 2)');
    const unknown = edited((c) => {
      const guests = c.guests as Record<string, unknown>[];
      guests[0] = { ...guests[0], help: "map" };
    });
    expect(() => readTuning(unknown)).toThrow("guests[0].help");
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

  it("묶음의 아닌 척 수가 틀리거나 첫 묶음에 내 줄에 끼기가 있으면 → 멈춘다", () => {
    const many = edited((c) => {
      c.rounds = [["wishtree", "glasses", "flowerpot", "pad-n"]];
    });
    expect(() => readTuning(many)).toThrow("rounds[0]: 아닌 척하기가 1개여야 한다");
    const line = edited((c) => {
      c.rounds = [["wishtree", "wishtree-fruit", "pad-n", "line"]];
    });
    expect(() => readTuning(line)).toThrow("rounds[0]: 첫 묶음에는 내 줄에 끼기를 쓰지 않는다");
  });

  it("가면이 섞여 들 무리가 땅 위 손님이 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      const list = c.disguises as Record<string, unknown>[];
      const at = list.findIndex((d) => d.as === "mask");
      list[at] = { ...list[at], group: "c_wletter" };
    });
    expect(() => readTuning(bad)).toThrow('"c_wletter" 는 guests 의 땅 위 무리가 아니다');
  });

  it("줄 선 상자의 배수가 1 을 넘거나 고양이 고개 폭이 0~90 도 밖이면 → 멈춘다", () => {
    const big = edited((c) => {
      (c.line as Record<string, unknown>).scale = 1.2;
    });
    expect(() => readTuning(big)).toThrow("line.scale: 1 이하여야 한다");
    const wide = edited((c) => {
      (c.cat as Record<string, unknown>).wobble = 120;
    });
    expect(() => readTuning(wide)).toThrow("cat.wobble: 0~90 도여야 한다");
  });

  it("이 조각의 값 → 톡 30m·넉넉한 자리, 상자는 화면에서 72px 밑으로 안 작아진다, 전설은 세 번", () => {
    expect(HIDE.find).toMatchObject({ tapReach: 30, tapPad: 24, tapMin: 96, tapMove: 10 });
    expect(HIDE.find).toMatchObject({ leapMin: 0.6, leapMax: 1 });
    expect(HIDE.box).toMatchObject({ height: 2.5, minScreen: 72, maxGrow: 3, earScale: 2 });
    expect(HIDE.legend).toMatchObject({ hits: 3, catchReach: 40 });
    expect(HIDE.rabbit).toMatchObject({ stop: 20, trailSeconds: 12, waitGap: 25 });
    expect(HIDE.mushroom).toMatchObject({ height: 18, hang: 3, tapReach: 60 });
    expect(HIDE.sneak).toMatchObject({ firstRound: 1, later: 2, resumeAfter: 0.5, sweatAfter: 2 });
  });
});
