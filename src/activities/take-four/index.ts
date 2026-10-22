import { createElement } from "react";

import type { ActivityModule } from "..";

import BoothFlow from "./booth/BoothFlow";
import LastResult from "./booth/LastResult";
import Entrance from "./Entrance";
import InfoScreen from "./InfoScreen";
import NoCameraScreen from "./NoCameraScreen";
import { isStageOn } from "./stage";
import DetailScreen from "./wall/DetailScreen";
import WallScreen from "./wall/WallScreen";

/**
 * take four. 부스. 하위 화면은 부스·마지막 띠·앨범·카메라 없을 때·No.01 안내,
 * 2단계 벽·크게 보기(`wall`, `wall/{id}` — 단계·레코드 스위치가 켜졌을 때만).
 */
export const TAKE_FOUR: ActivityModule = {
  id: "take-four",
  Entrance,
  route(rest, event, ctx) {
    if (rest[0] === "wall") {
      if (!isStageOn(event, "wall") || rest.length > 2) return null;
      return rest.length === 1
        ? createElement(WallScreen, { event, now: Date.now() })
        : createElement(DetailScreen, { slug: event.slug, stripId: rest[1] });
    }
    if (rest.length !== 1) return null;
    switch (rest[0]) {
      case "booth":
        return createElement(BoothFlow, { event });
      case "album":
        return createElement(BoothFlow, { event, source: "album" });
      case "result":
        return createElement(LastResult, { event });
      case "no-camera":
        return createElement(NoCameraScreen, { slug: event.slug, ...ctx });
      case "info":
        return createElement(InfoScreen, { event, now: Date.now() });
      default:
        return null;
    }
  },
};
