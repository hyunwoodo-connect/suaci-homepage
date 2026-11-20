import { describe, expect, it, vi } from "vitest";

import { PlayedGames } from "./played";

describe("PlayedGames(존 미니게임 기록)", () => {
  it("처음 → 아무 존도 안 했다", () => {
    const played = new PlayedGames();
    expect(played.has("candy")).toBe(false);
  });

  it("mark → 했다고 기억하고(다시 만들어도), 알린다", () => {
    const played = new PlayedGames();
    const heard = vi.fn();
    played.onMark(heard);
    played.mark("candy");
    expect(played.has("candy")).toBe(true);
    expect(heard).toHaveBeenCalledWith("candy");
    expect(new PlayedGames().has("candy")).toBe(true);
  });

  it("같은 존을 또 mark → 다시 알리지 않는다", () => {
    const played = new PlayedGames();
    played.mark("toy");
    const heard = vi.fn();
    played.onMark(heard);
    played.mark("toy");
    expect(heard).not.toHaveBeenCalled();
  });
});
