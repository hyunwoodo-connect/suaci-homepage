import type { ActivityModule } from "../types";

import BoothFlow from "./booth/BoothFlow";
import LastResultScreen from "./booth/LastResultScreen";
import EntranceScreen from "./EntranceScreen";
import InfoScreen from "./InfoScreen";
import NoCameraScreen from "./NoCameraScreen";
import { isStageOn } from "./stage";
import DetailScreen from "./wall/DetailScreen";
import WallScreen from "./wall/WallScreen";

/**
 * take four. 부스. 하위 화면은 부스·마지막 카드·앨범·카메라 없을 때·회차 안내,
 * 벽·크게 보기(`wall`, `wall/{stripId}` — 코드에 나왔고 레코드 스위치가 켜졌을 때만).
 */
export const TAKE_FOUR: ActivityModule = {
  id: "take-four",
  Entrance: EntranceScreen,
  route(rest, event, ctx) {
    if (rest[0] === "wall") {
      if (!isStageOn(event, "wall") || rest.length > 2) return null;
      return rest.length === 1 ? (
        <WallScreen event={event} now={Date.now()} />
      ) : (
        <DetailScreen event={event} stripId={rest[1]} />
      );
    }
    if (rest.length !== 1) return null;
    switch (rest[0]) {
      case "booth":
        return <BoothFlow event={event} />;
      case "album":
        return <BoothFlow event={event} source="album" />;
      case "result":
        return <LastResultScreen event={event} />;
      case "no-camera":
        return <NoCameraScreen event={event} {...ctx} />;
      case "info":
        return <InfoScreen event={event} now={Date.now()} />;
      default:
        return null;
    }
  },
};
