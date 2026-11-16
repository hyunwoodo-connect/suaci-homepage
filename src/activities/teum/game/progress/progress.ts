import type { TeumSave } from "./save";
import { emptySave } from "./save";
import type { SaveStore } from "./store";

// 이번 판이 쓰는 기록: 처음에 기록을 읽어 두고(읽기 전에는 빈 기록), 바꾼 뒤 commit 으로 둔다

/** 이번 판의 기록 */
export class Progress {
  /** 지금 기록(읽기 전에는 빈 기록) */
  save: TeumSave = emptySave();
  /** 기록을 다 읽었다(읽지 못했어도 빈 기록으로 끝난다) */
  readonly ready: Promise<void>;

  constructor(private readonly store: SaveStore) {
    this.ready = store.load().then((loaded) => {
      this.save = loaded;
    });
  }

  /** 바꾼 기록을 둔다 */
  commit() {
    void this.store.save(this.save);
  }
}
