import type { AvatarRecord, AvatarStore } from "./record";
import { emptyAvatarRecord, isBlankRecord } from "./record";

// 이번에 쓰는 아바타 기록: 처음에 읽어 두고(읽기 전에는 빈 기록), 바꾼 뒤 commit 으로 둔다.
// 공용 기록이 비어 있으면 다른 자리에 남은 기록(adopt)을 한 번 물어 옮겨 온다 —
// 아바타 기록을 놀이 기록 안에 두던 기기에서 그 차림을 잃지 않게

/** 이번에 쓰는 아바타 기록 */
export class AvatarProfile {
  /** 지금 기록(읽기 전에는 빈 기록) */
  record: AvatarRecord = emptyAvatarRecord();
  /** 기록을 다 읽었다(읽지 못했어도 빈 기록으로 끝난다) */
  readonly ready: Promise<void>;

  /** adopt: 공용 기록이 비어 있을 때 대신 쓸, 다른 자리에 남은 기록(없으면 null) */
  constructor(
    private readonly store: AvatarStore,
    adopt?: () => AvatarRecord | null,
  ) {
    this.ready = store.load().then((loaded) => {
      const found = isBlankRecord(loaded) && adopt ? adopt() : null;
      this.record = found ?? loaded;
      if (found) this.commit();
    });
  }

  /** 바꾼 기록을 둔다 */
  commit() {
    void this.store.save(this.record);
  }
}
