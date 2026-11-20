import { CANDY_ZONE } from "./candy";
import { FOREST_ZONE } from "./forest";
import { NAP_ZONE } from "./nap";
import { NIGHT_ZONE } from "./night";
import { TOY_ZONE } from "./toy";
import { VACATION_ZONE } from "./vacation";
import type { ZoneConfig } from "./zone";

// 지도 v79 의 존 여섯(마을 차례대로). 새 존은 zones/<id>.ts 하나를 쓰고 여기 한 줄 — 마을 번호(hub)가 자리표의 마을과 맞아야 한다

/** 지도 v79 의 존(마을 0~5) */
export const V79_ZONES: readonly ZoneConfig[] = [
  CANDY_ZONE,
  NIGHT_ZONE,
  TOY_ZONE,
  FOREST_ZONE,
  NAP_ZONE,
  VACATION_ZONE,
];
