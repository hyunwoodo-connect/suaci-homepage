import type { AvatarRecord } from "@/lib/avatar/record";
import { isBlankRecord, readAvatarRecord } from "@/lib/avatar/record";

import { SAVE_KEY } from "./store";

// 이 기기의 틈 기록(suaci.teum.save) 안에 아바타 차림(look)과 꾸민 적(dressed)이 들어 있는 사람이 있다.
// 아바타 기록은 놀이마다 같이 쓰는 공용 기록(lib/avatar)에 두므로, 공용 기록이 비어 있을 때 그 값을 한 번 옮겨 오는 데 쓴다
// TODO(출시): 운영에는 틈 기록에 차림을 둔 기기가 없다 — 미리 보기로 놀던 기기의 차림을 옮긴 뒤에는 뺀다

/** 틈 기록 안에 남은 아바타 기록(없거나 깨졌거나 비었으면 null) */
export function legacyAvatar(): AvatarRecord | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== "object" || raw === null) return null;
    const { look, dressed } = raw as Record<string, unknown>;
    const record = readAvatarRecord({ v: 1, look, dressed });
    return isBlankRecord(record) ? null : record;
  } catch {
    return null;
  }
}
