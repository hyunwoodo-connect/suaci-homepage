import type { Content } from "./hideseek/tuning";
import type { BoxSource, Prize, QuestType } from "./progress/save";

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
  // ---- 숨바꼭질 ----
  /** 꼭꼭 숨어라: 상자들이 숨을 곳으로 흩어져 달려간다 */
  hideStarted: Record<string, never>;
  /** 넷을 다 찾았다(칸 넷이 번쩍인다) */
  hideAllFound: Record<string, never>;
  /** 금색 상자가 하늘에서 떨어지기 시작했다(휘파람) */
  hideBonusFalling: Record<string, never>;
  /** 보너스 상자가 하늘에서 떨어져 내려앉았다 */
  hideBonusLanded: Record<string, never>;
  /** 언박싱: 상자가 들썩했다 */
  hideBoxShaken: Record<string, never>;
  /** 언박싱: 상자가 열렸다(content: 내용물) */
  hideBoxOpened: { content: Content };
  /** 언박싱: 상자 속 상자가 열렸다(empty: 셋째 — 비었다) */
  hideNestedPopped: { empty: boolean };
  // ---- 숨바꼭질 조각 02 '찾는 손맛' ----
  /** 뜨거워 차가워의 키득(which: 세 가지 가운데 몇째, pan: 화면에서 본 좌우 -1..1, volume: 거리로 정한 크기 0..1, rate: 음높이 배수) */
  findGiggled: { which: number; pan: number; volume: number; rate: number };
  /** 숨은 물건이 바스락거린다(내가 warm.near 안에 있다) */
  findRustled: { pan: number; volume: number };
  /** 후보 물건을 눌렀다: 미스트가 날아간다(far: 너무 멀어 아무 일도 없다) */
  findTapped: { far: boolean };
  /** 꽝: 물건이 말랑하게 찌그러졌다 */
  findMissed: Record<string, never>;
  /** 근처 상자가 빼꼼 나와 메롱 · 다른 물건으로 폴짝 이사 */
  findTaunted: { pan: number };
  findHopped: { pan: number };
  /** 상자를 찾았다 — 물건에서 튀어나온다(count: 찾은 수) */
  findFound: { count: number };
  // ---- 숨바꼭질 조각 03 '열어 보기' ----
  /** 두근: 물건이 덜컹했다(step: 몇째 덜컹 0..) · 덜컹이 시작됐다(북 굴림) */
  openKnocked: { step: number; pan: number };
  openRolled: { pan: number };
  /** 결과가 갈렸다: 팡(찾음) · 푸슉(꽝) */
  openPopped: { pan: number };
  openFizzled: { pan: number };
  /** 버섯이 나를 쏘아 올렸다 */
  mushroomJumped: Record<string, never>;
  // ---- 수집·상자·부탁·도장·이동(구조만 — 아직 알리는 곳이 없다. 기획이 정하면 그 흐름이 알린다) ----
  /** 처음 친해진 종이 보관함에 남았다 */
  collected: { kind: string };
  /** 상자를 얻었다(why: 주운 곳·까닭, boxes: 안 연 상자 수) */
  boxPicked: { why: BoxSource; boxes: number };
  /** 상자를 열었다(판정 결과) */
  boxOpened: { prize: Prize };
  /** 오늘의 부탁을 받았다 · 끝냈다 */
  questStarted: { type: QuestType };
  questDone: { type: QuestType };
  /** 오늘 도장을 찍었다(count: 이번 주 도장 수) */
  stamped: { count: number };
  /** 가 본 지역으로 옮겨 갔다 */
  travelled: { region: number };
}

/** 알리는 일의 이름 */
export type GameEventName = keyof GameEventMap;

/** 듣는 쪽 */
export type GameListener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

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
