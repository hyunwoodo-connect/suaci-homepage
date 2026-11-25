import type * as THREE from "three";

import type { Services } from "../services";
import type { PartSlot } from "@/lib/avatar/parts";
import { AVATAR_BODY } from "@/lib/avatar/parts";
import type { RigSlots } from "./rigBody";
import { measureRig } from "./rigBody";
import type { PoseFn } from "./rigPose";
import { poseFrame } from "./rigPose";
import { stripSlot, wearPart } from "./rigWear";

// 뼈대가 있는 아바타. 몸이 오면 한 번 재고(rigBody), 그 상태(Rig) 하나를 몸짓(rigPose)·손에 든 것(rigHand)·꾸미기(rigWear)가 같이 쓴다

/** 뼈대 있는 몸이 오면 넘기는 것 */
export interface RigHandle {
  pose: PoseFn;
  /** 부품을 끼운다(같은 칸의 것은 빠진다). 모델을 아직 안 받았으면 받아서 끼운다 — 그사이 같은 칸에 다른 것을 고르면 늦게 온 것은 버린다 */
  wear(key: string): void;
  /** 그 칸을 비운다 */
  strip(slot: PartSlot): void;
  /** 몸과 끼운 부품을 담은 틀(꾸미기 씬이 이 틀만 보이게 한다) */
  hold: THREE.Group;
}

/**
 * 뼈대 있는 몸이 오면 도형 몸을 숨기고 끼운 뒤, 몸짓 함수와 부품 끼우기를 onReady 로 넘긴다(무엇을 입을지는 옷장이 정한다).
 * 재질은 모델을 받을 때 키마다 한 번 칠해 두었다(아바타 몸·부품에는 색조가 없어 그 칠 그대로 쓴다)
 */
export function setupRig(s: Services, slots: RigSlots, onReady: (rig: RigHandle) => void) {
  const models = s.models;
  if (!models.has(AVATAR_BODY)) return;
  models.when(AVATAR_BODY, (av) => {
    const rig = measureRig(av, slots);
    const pose: PoseFn = (i) => poseFrame(rig, i);
    const wear = (key: string) => wearPart(rig, models, key);
    const strip = (slot: PartSlot) => stripSlot(rig, slot);
    onReady({ pose, wear, strip, hold: rig.hold });
  });
}
