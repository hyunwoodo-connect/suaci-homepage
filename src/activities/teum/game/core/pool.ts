// 미리 만들어 둔 것을 돌려 쓴다(프레임 중에 새로 만들지 않는다)

/** 차례로 돌려 쓰는 고정 묶음: 가장 오래전에 쓴 것을 다시 쓴다(안개·도장·구름 싹·바람 고리) */
export class Ring<T> {
  private i = 0;

  constructor(readonly items: readonly T[]) {}

  /** 다음 것 */
  next(): T {
    const item = this.items[this.i % this.items.length];
    this.i++;
    return item;
  }

  /** 아직 안 쓴(조건에 맞는) 것이 있으면 그것, 없으면 맨 앞 것 — 방울 길처럼 비어 있는 줄부터 쓸 때 */
  firstOr(isFree: (item: T) => boolean): T {
    return this.items.find(isFree) ?? this.items[0];
  }
}

/**
 * 살아 있는 것만 차례대로 도는 고정 크기 묶음. 꽉 차면 가장 오래된 것을 지우고 넣는다(빛 방울 60 개처럼).
 * 모양(T)은 처음에 한 번만 만들고, 넣을 때는 채우기만 한다
 */
export class Fifo<T> {
  private readonly slots: T[];
  private head = 0;
  private count = 0;

  constructor(capacity: number, make: () => T) {
    this.slots = Array.from({ length: capacity }, make);
  }

  /** 지금 살아 있는 수 */
  get size(): number {
    return this.count;
  }

  /** 새 칸 하나(가득이면 가장 오래된 칸을 다시 쓴다). 채우는 것은 부른 쪽 */
  push(): T {
    const cap = this.slots.length;
    if (this.count === cap) {
      this.head = (this.head + 1) % cap;
      this.count--;
    }
    const at = (this.head + this.count) % cap;
    this.count++;
    return this.slots[at];
  }

  /** 오래된 것부터 i 번째 */
  at(i: number): T {
    const at = (this.head + i) % this.slots.length;
    return this.slots[at];
  }

  /** 오래된 것부터 돌며, keep 이 false 인 것은 지운다(남은 순서는 그대로) */
  sweep(keep: (item: T) => boolean) {
    const cap = this.slots.length;
    let kept = 0;
    for (let i = 0; i < this.count; i++) {
      const from = (this.head + i) % cap;
      const item = this.slots[from];
      if (!keep(item)) continue;
      const to = (this.head + kept) % cap;
      // 지운 칸 자리로 당겨 넣는다. 지운 칸의 물건은 뒤로 보내 다시 쓴다
      this.slots[from] = this.slots[to];
      this.slots[to] = item;
      kept++;
    }
    this.count = kept;
  }
}
