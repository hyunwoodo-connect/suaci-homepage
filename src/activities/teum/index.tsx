import type { ActivityModule } from "../types";

import TeumEntrance from "./TeumEntrance";

/** 틈 — 구 모양 세계를 끌어서 날아다니며 놀이기구·생물·조형물을 만나는 놀이. 아래 화면은 아직 없다 */
export const TEUM: ActivityModule = {
  id: "teum",
  Entrance: TeumEntrance,
  route() {
    return null;
  },
};
