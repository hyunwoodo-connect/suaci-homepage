// 판의 시계: 장면의 정한 때에 할 일을 걸어 두고, 시계가 그때에 닿으면 건 차례대로 한다.
// 시계는 판이 도는 동안만 간다 — 꾸미기 씬이 열려 있거나 찾는 순간 시간을 잠깐 멈추면(pause) 같이 멈춘다. 판을 처음으로 되돌리면 걸어 둔 일을 모두 버린다

/** 판의 시계와 걸어 둔 일 */
export class Timeline {
  private clock = 0;
  private readonly todo: { at: number; run: () => void }[] = [];

  /** seconds 초 뒤에 run 을 한다 */
  after(seconds: number, run: () => void) {
    const due = this.clock + seconds;
    this.todo.push({ at: due, run });
  }

  /** 시계를 dt 초 돌리고 때가 된 일을 건 차례대로 한다(하는 도중에 새로 건 일도 때가 되었으면 이번에 한다) */
  tick(dt: number) {
    this.clock += dt;
    for (let i = 0; i < this.todo.length;) {
      if (this.todo[i].at > this.clock) {
        i++;
        continue;
      }
      const [job] = this.todo.splice(i, 1);
      job.run();
    }
  }

  /** 걸어 둔 일을 모두 버린다 */
  clear() {
    this.todo.length = 0;
  }
}
