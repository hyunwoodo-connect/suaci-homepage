import type { ActivityModule } from "../types";

import TeumEntrance from "./TeumEntrance";

/** 틈 — 구 모양 세계를 끌어서 날아다니며 놀이기구·생물·조형물을 만나는 놀이. 하위 화면은 없다(route 는 늘 null) */
export const TEUM: ActivityModule = {
  id: "teum",
  usesAvatar: true,
  Entrance: TeumEntrance,
  route() {
    return null;
  },
};
