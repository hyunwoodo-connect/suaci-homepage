// 게임에서 일어나는 일을 알리는 작은 알림판. 놀이기구·생물·만남이 알리기만 하고, 소리(sound/)가 듣는다.
// 알리는 쪽은 듣는 쪽을 모른다 — 새로 들을 것(소리·기록)이 생겨도 알리는 코드는 그대로다.
// 프레임마다가 아니라 그 일이 일어난 순간에만 알린다(듣는 이가 없으면 그냥 지나간다)

/** 나를 붙잡는 놀이기구의 이름 */
export type RideName =
  | "cannon"
  | "sling"
  | "rocket"
  | "swing"
  | "funnel"
  | "whirl"
  | "hole"
  | "whale"
  | "comet"
  | "slide";

/** 알리는 일과 그때 함께 오는 값 */
export interface GameEventMap {
  /** 놀이기구가 나를 붙잡았다(이미 붙잡은 것이 또 붙잡으면 알리지 않는다) */
  grabbed: { by: RideName };
  /** 놀이기구가 나를 놓았다 */
  released: { by: RideName };
  /** 놀이기구가 놓으며 나를 날려 보냈다(위로 vy, 빠르기 boost) */
  launched: { by: RideName; vy: number; boost: number };
  /** 밟거나 닿아 통 튀었다(통통 구름·나무 갓·꽃송이·조형물·버섯…) — vy 는 튀는 세기 */
  bounced: { vy: number };
  /** 생물을 만났다(first: 이 판에서 이 종을 처음 만났다, legend: 전설의 손님) */
  creatureMet: { kind: string; first: boolean; legend: boolean };
  /** 전설의 손님을 만났다 */
  legendMet: { kind: string };
  /** 비눗방울이 터졌다(combo: 잇달아 터뜨린 수, 1 부터) */
  bubblePopped: { combo: number };
  /** 방울 길의 방울을 터뜨렸다(step: 그 줄에서 몇 번째 — 0부터, last: 줄의 마지막 방울) */
  trailBubblePopped: { step: number; last: boolean };
  /** 고리를 지나며 울렸다(i: 그 줄에서 몇째 고리) */
  ringPassed: { i: number };
  /** 풍경 종이 울렸다 */
  chimeRung: Record<string, never>;
  /** 로고 풍선 줄을 잡아 올라간다 */
  logoBalloonCaught: Record<string, never>;
  /** 높은 풍선에 닿아 터졌다 */
  highBalloonBurst: Record<string, never>;
  /** 랜드마크·쉬는 곳에 다가가 인사를 받았다(kind: 자리표의 k) */
  landmarkGreeted: { kind: string };
  /** 장소가 반응했다(소원 나무·분수·뽑기 기계·등대) */
  placeReacted: { name: string };
  /** 꼬마 라임이 따라오기 시작했다(count: 따라오는 수) */
  babyJoined: { count: number };
  /** 뭉게구름을 뚫고 지나가 흩었다 */
  cloudBurst: Record<string, never>;
  /** 빛 방울이 튀었다(n: 방울 수, dist: 나와의 거리 m) */
  sparkled: { n: number; dist: number };
  /** 물이 튀었다(dist: 나와의 거리 m) */
  splashed: { dist: number };
  /** 위로 솟구치기 시작했다(위 속도가 빠르게 넘어선 순간) */
  rose: { vy: number };
  /** 높이 떠 있다가 땅에 내려앉았다 */
  landed: Record<string, never>;
  /** 풍선 줄을 잡았다 */
  hung: Record<string, never>;
  /** 레일에 붙었다 */
  railed: Record<string, never>;
  /** 고래가 가까이(240m 안으로) 왔다 */
  whaleNear: Record<string, never>;
  /** 새 지역에 들어섰다(region: 지역 차례) */
  regionEntered: { region: number };
  /** 랜드마크가 말을 걸었다(region: 그 마을의 지역 차례) */
  landmarkTalked: { region: number };
  /** 한국 시간으로 날이 바뀌었다(festival: 새 축제 지역) */
  dayChanged: { day: number; festival: number };
  /** 옷장에서 하나 골랐다(random: 아무거나 단추) */
  outfitPicked: { random: boolean };
  /** 물풍선을 먹었다(count: 이번 판에 먹은 수, total: 이 지도의 물풍선 수) */
  waterBalloonPopped: { count: number; total: number };
  /** 물풍선을 다 먹었다(seconds: 처음 움직인 때부터 걸린 시간) */
  waterBalloonsCleared: { seconds: number };
  /** 나가기를 눌렀다(화면 왼쪽 위의 단추 · 성공 판) — 놀이를 연 쪽(입구)이 듣고 데리고 나간다(놀이는 어디로 가는지 모른다) */
  leavePressed: Record<string, never>;
}

/** 알리는 일의 이름 */
export type GameEventName = keyof GameEventMap;

/** 듣는 쪽 */
type GameListener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

/** 알림판: 알리기(emit)와 듣기(on) */
export class GameEvents {
  private readonly listeners = new Map<GameEventName, GameListener<never>[]>();

  /** name 을 듣는다. 그만 듣는 함수를 돌려준다 */
  on<K extends GameEventName>(name: K, fn: GameListener<K>): () => void {
    const list = this.listeners.get(name) ?? [];
    list.push(fn as GameListener<never>);
    this.listeners.set(name, list);
    return () => {
      const at = list.indexOf(fn as GameListener<never>);
      if (at >= 0) list.splice(at, 1);
    };
  }

  /** name 을 알린다(듣는 차례대로) */
  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]) {
    const list = this.listeners.get(name);
    if (!list) return;
    for (const fn of [...list]) (fn as GameListener<K>)(payload);
  }
}
