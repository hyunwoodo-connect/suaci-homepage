import { createElement } from "react";

import type { ActivityModule } from "..";

import BoothFlow from "./booth/BoothFlow";
import LastResult from "./booth/LastResult";
import Entrance from "./Entrance";
import InfoScreen from "./InfoScreen";
import NoCameraScreen from "./NoCameraScreen";

/** take four. 부스. 하위 화면은 부스·마지막 띠·앨범·카메라 없을 때·No.01 안내. */
export const TAKE_FOUR: ActivityModule = {
  id: "take-four",
  Entrance,
  route(rest, event) {
    if (rest.length !== 1) return null;
    switch (rest[0]) {
      case "booth":
        return createElement(BoothFlow, { event });
      case "album":
        return createElement(BoothFlow, { event, source: "album" });
      case "result":
        return createElement(LastResult, { event });
      case "no-camera":
        return createElement(NoCameraScreen, { slug: event.slug });
      case "info":
        return createElement(InfoScreen, { event, now: Date.now() });
      default:
        return null;
    }
  },
};
