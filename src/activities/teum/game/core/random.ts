// 게임이 쓰는 난수. three 는 물체를 만들 때마다 uuid 로 Math.random 을 쓰므로 게임 난수를 거기에 섞지 않는다.
// 갈래(stream)마다 따로 흘러서, 한쪽(예: 멀리 있어 쉬는 생물)이 덜 뽑아도 다른 쪽의 흐름은 그대로다.
// 운영은 한 판마다 다른 씨앗, 개발의 ?seed 는 같은 씨앗(같은 입력이면 같은 판)

/** 0 이상 1 미만 난수를 차례로 낸다 */
export class Random {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** 다음 난수(mulberry32) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    const mixA = t ^ (t >>> 15),
      oddA = t | 1;
    t = Math.imul(mixA, oddA);
    const mixB = t ^ (t >>> 7),
      oddB = t | 61;
    t ^= t + Math.imul(mixB, oddB);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** a 이상 b 미만 */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** 이름으로 갈라진 새 갈래(같은 씨앗·같은 이름이면 같은 흐름) */
  fork(name: string): Random {
    let h = this.s ^ 0x9e3779b9;
    for (let i = 0; i < name.length; i++) {
      const mixed = h ^ name.charCodeAt(i);
      h = Math.imul(mixed, 0x01000193);
    }
    return new Random(h);
  }
}
