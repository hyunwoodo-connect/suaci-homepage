import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import type { GameEventMap } from "../events";
import { GameEvents } from "../events";
import { Hud } from "../hud";
import type { GameMap, WaterBalloonSpot } from "../maps/map";
import type { Holder } from "../player/player";
import { Player } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { Terrain } from "../world/terrain";
import type { WaterBalloons } from "./waterBalloons";
import { createWaterBalloons } from "./waterBalloons";

// 그리지 않는 작은 세계(평평한 땅 · 진짜 몸과 알림판 · 가짜 빛 방울) 위에 물풍선 놀이를 얹는다.
// 장면에 올린 것과 화면(DOM)에 붙인 것을 그대로 본다 — WebGL 은 쓰지 않는다

const DT = 1 / 60;
const STILL = { fx: 0, fy: 0, m: 0, dragFx: 0 },
  FORWARD = { fx: 0, fy: 1, m: 1, dragFx: 0 };
/** 서로 멀리 떨어진 세 자리(땅 가까이 · 하늘 높이 · 땅 가까이) */
const SPOTS: readonly WaterBalloonSpot[] = [
  { dist: 20, bear: 0, alt: 2 },
  { dist: 40, bear: 90, alt: 60 },
  { dist: 60, bear: 200, alt: 3 },
];

function world(spots: readonly WaterBalloonSpot[] | undefined) {
  const terrain = new Terrain(7, { flowers: 0, mounds: 0, clouds: 0 }, []);
  const events = new GameEvents();
  const player = new Player(terrain, events);
  player.goHome();
  const parent = document.createElement("div");
  const hud = new Hud(parent);
  const scene = new THREE.Scene();
  const sceneBefore = scene.children.length,
    domBefore = parent.childElementCount;
  const s = {
    scene,
    map: { waterBalloons: spots } as GameMap,
    events,
    terrain,
    player,
    camera: { camera: new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 900) },
    fx: { burst: () => {} },
    hud,
    rng: new Random(7),
  } as unknown as Services;
  const popped: GameEventMap["waterBalloonPopped"][] = [],
    cleared: GameEventMap["waterBalloonsCleared"][] = [];
  events.on("waterBalloonPopped", (e) => popped.push(e));
  events.on("waterBalloonsCleared", (e) => cleared.push(e));
  const game = createWaterBalloons(s, parent);
  let time = 0;
  /** 한 프레임: 입력 → 몸 → 물풍선 */
  const frame = (intent = STILL) => {
    time += DT;
    player.begin(DT, intent);
    player.move();
    player.updateAlt();
    player.place(time);
    game?.update({ dt: DT, time });
  };
  /** 몸을 i 번째 물풍선 가운데로 옮긴다(순간 이동) */
  const jumpTo = (wb: WaterBalloons, i: number) => {
    const b = wb.list[i];
    player.teleport(b.v, null, b.alt - S.hover);
  };
  const panel = () => parent.querySelector<HTMLElement>('[role="dialog"]');
  const counter = () => parent.querySelector('[role="status"]')?.textContent;
  return {
    s,
    scene,
    parent,
    hud,
    player,
    game,
    popped,
    cleared,
    frame,
    jumpTo,
    panel,
    counter,
    sceneBefore,
    domBefore,
  };
}

/** 물풍선이 있는 세계(놀이가 꼭 만들어진다) */
function playing() {
  const w = world(SPOTS);
  return { ...w, game: w.game! };
}

describe("물풍선이 없는 지도", () => {
  it("waterBalloons 가 없다 → 놀이를 만들지 않고 장면·화면에 아무것도 얹지 않는다", () => {
    const w = world(undefined);
    w.frame(FORWARD);
    expect([w.game, w.scene.children.length, w.parent.childElementCount]).toEqual([
      null,
      w.sceneBefore,
      w.domBefore,
    ]);
  });

  it("빈 목록 → 없는 것과 같다", () => {
    const w = world([]);
    expect([w.game, w.scene.children.length, w.parent.childElementCount]).toEqual([
      null,
      w.sceneBefore,
      w.domBefore,
    ]);
  });
});

describe("물풍선 먹기", () => {
  it("만들면 → 자리마다 하나씩, 땅 위 높이는 지도 값 그대로, 개수는 0 / 3", () => {
    const w = playing();
    expect([w.game.list.map((b) => b.alt), w.counter()]).toEqual([[2, 60, 3], "0 / 3"]);
  });

  it("멀리 있으면 → 먹지 않는다", () => {
    const w = playing();
    for (let i = 0; i < 30; i++) w.frame(FORWARD);
    expect([w.game.round.count, w.popped]).toEqual([0, []]);
  });

  it("몸이 닿으면 → 먹은 수가 오르고 몇 개째인지 알린다", () => {
    const w = playing();
    w.jumpTo(w.game, 0);
    w.frame();
    expect([w.game.round.eaten, w.popped, w.counter()]).toEqual([
      [true, false, false],
      [{ count: 1, total: 3 }],
      "1 / 3",
    ]);
  });

  it("하늘 높이 뜬 물풍선 → 그 높이로 가면 먹는다", () => {
    const w = playing();
    w.jumpTo(w.game, 1);
    w.frame();
    expect(w.game.round.eaten).toEqual([false, true, false]);
  });

  it("하늘 높이 뜬 물풍선 바로 아래 땅 → 먹지 않는다", () => {
    const w = playing();
    w.player.teleport(w.game.list[1].v, null, 0);
    w.frame();
    expect(w.game.round.count).toBe(0);
  });

  it("놀이기구에 붙잡혀 있어도 → 먹는다", () => {
    const w = playing();
    const cannon: Holder = { rideName: "cannon" };
    w.player.grab(cannon);
    w.jumpTo(w.game, 0);
    w.frame();
    expect([w.player.isHeld, w.game.round.count]).toEqual([true, 1]);
  });

  it("순간 이동으로 건너뛴 길 위의 물풍선 → 먹지 않는다(지나온 길로 치지 않는다)", () => {
    const w = playing();
    const b = w.game.list[0];
    // 물풍선을 사이에 둔 양쪽 20m 밖: 이쪽에 섰다가 저쪽으로 순간 이동
    const here = b.v.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), 20 / S.R),
      there = b.v.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -20 / S.R);
    w.player.teleport(here, null, b.alt - S.hover);
    w.frame();
    w.player.teleport(there, null, b.alt - S.hover);
    w.frame();
    expect(w.game.round.count).toBe(0);
  });
});

describe("물풍선 시계", () => {
  it("움직이기 전 → 시계가 가지 않는다", () => {
    const w = playing();
    for (let i = 0; i < 60; i++) w.frame();
    expect([w.game.round.stage, w.game.round.seconds]).toEqual(["waiting", 0]);
  });

  it("처음 움직인 프레임부터 → 프레임 시계로 간다", () => {
    const w = playing();
    for (let i = 0; i < 30; i++) w.frame();
    for (let i = 0; i < 60; i++) w.frame(FORWARD);
    expect(w.game.round.seconds).toBeCloseTo(1, 5);
  });

  it("다 먹으면 → 걸린 시간과 함께 알리고 시계가 멈춘다", () => {
    const w = playing();
    for (let i = 0; i < 60; i++) w.frame(FORWARD);
    for (const i of [0, 1, 2]) {
      w.jumpTo(w.game, i);
      w.frame();
    }
    const seconds = w.game.round.seconds;
    for (let i = 0; i < 30; i++) w.frame(FORWARD);
    expect(w.cleared).toEqual([{ seconds }]);
    expect([w.game.round.stage, w.game.round.seconds]).toEqual(["cleared", seconds]);
    expect(seconds).toBeCloseTo(63 / 60, 5);
  });
});

describe("물풍선 성공 뒤", () => {
  /** 셋을 다 먹고 성공 판이 뜰 때까지 */
  function cleared() {
    const w = playing();
    for (const i of [0, 1, 2]) {
      w.jumpTo(w.game, i);
      w.frame();
    }
    for (let i = 0; i < 90; i++) w.frame();
    return w;
  }
  const press = (w: ReturnType<typeof cleared>, name: string) =>
    [...w.parent.querySelectorAll("button")].find((b) => b.textContent === name)!.click();

  it("마지막을 먹은 바로 그 프레임 → 성공 판은 아직(터지는 것을 보고 나서 뜬다)", () => {
    const w = playing();
    for (const i of [0, 1, 2]) {
      w.jumpTo(w.game, i);
      w.frame();
    }
    expect(w.panel()?.style.visibility).toBe("hidden");
  });

  it("조금 뒤 → 성공 판에 다 먹었다는 말이 뜬다", () => {
    const w = cleared();
    expect([w.panel()?.style.visibility, w.panel()?.textContent?.includes("물풍선 3개를")]).toEqual(
      ["visible", true],
    );
  });

  it("한 번 더 → 판이 내려가고 수·시계가 0 으로, 몸은 그 자리 그대로", () => {
    const w = cleared();
    const stood = w.player.p.clone();
    press(w, "한 번 더");
    w.frame();
    expect([w.panel()?.style.visibility, w.counter(), w.game.round.seconds]).toEqual([
      "hidden",
      "0 / 3",
      0,
    ]);
    expect(w.player.p.distanceTo(stood)).toBe(0);
  });

  it("한 번 더 → 내가 서 있는 자리의 물풍선은 나오자마자 먹히지 않는다", () => {
    const w = cleared();
    press(w, "한 번 더");
    for (let i = 0; i < 120; i++) w.frame();
    expect([w.game.round.count, w.game.round.stage]).toEqual([0, "waiting"]);
  });

  it("한 번 더 → 그 자리를 벗어났다 돌아오면 다시 먹힌다", () => {
    const w = cleared();
    press(w, "한 번 더");
    w.jumpTo(w.game, 0);
    for (let i = 0; i < 120; i++) w.frame();
    w.jumpTo(w.game, 2);
    w.frame();
    expect([w.game.round.eaten, w.popped.at(-1)]).toEqual([
      [false, false, true],
      { count: 1, total: 3 },
    ]);
  });

  it("한 번 더 → 다른 물풍선은 모두 돌아와 다시 먹을 수 있다", () => {
    const w = cleared();
    press(w, "한 번 더");
    for (let i = 0; i < 120; i++) w.frame();
    for (const i of [0, 1]) {
      w.jumpTo(w.game, i);
      w.frame();
    }
    expect(w.game.round.eaten).toEqual([true, true, false]);
  });

  it("계속 놀기 → 놀이 화면이 사라지고 물풍선은 더 먹히지 않는다", () => {
    const w = cleared();
    press(w, "계속 놀기");
    w.jumpTo(w.game, 0);
    w.frame();
    expect([w.parent.childElementCount, w.game.round.stage, w.popped.length]).toEqual([
      w.domBefore,
      "over",
      3,
    ]);
  });
});

describe("물풍선 화면 숨기기·치우기", () => {
  it("꾸미기 씬이 열리면 → 놀이 화면이 숨고, 닫히면 돌아온다", () => {
    const w = playing();
    const root = w.parent.lastElementChild as HTMLElement;
    w.hud.setStudio(true);
    w.frame();
    const hidden = root.style.display;
    w.hud.setStudio(false);
    w.frame();
    expect([hidden, root.style.display]).toEqual(["none", ""]);
  });

  it("세상이 보이고 조금 뒤 → 놀이를 알리는 한 줄(꾸미기 씬 동안은 미룬다)", () => {
    const w = playing();
    w.hud.setStudio(true);
    for (let i = 0; i < 120; i++) w.frame();
    const during = w.hud.hint.textContent;
    w.hud.setStudio(false);
    for (let i = 0; i < 60; i++) w.frame();
    expect([during, w.hud.hint.textContent]).toEqual([
      "정처 없이 떠다니세요",
      "물풍선 3개를 다 먹으면 성공이에요",
    ]);
  });

  it("dispose → 장면과 화면에서 사라진다", () => {
    const w = playing();
    w.frame();
    w.game.dispose();
    expect([w.scene.children.length, w.parent.childElementCount]).toEqual([
      w.sceneBefore,
      w.domBefore,
    ]);
  });
});
