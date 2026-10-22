import { createElement } from "react";

import type { ActivityModule } from "..";

import Entrance from "./Entrance";
import PreparingScreen from "./PreparingScreen";

const SUB_ROUTES = new Set(["booth", "album", "no-camera", "info"]);

/** take four. 부스. 하위 화면은 부스·앨범·카메라 없을 때·No.01 안내. */
export const TAKE_FOUR: ActivityModule = {
  id: "take-four",
  Entrance,
  route(rest, event) {
    if (rest.length !== 1 || !SUB_ROUTES.has(rest[0])) return null;
    return createElement(PreparingScreen, { slug: event.slug });
  },
};
