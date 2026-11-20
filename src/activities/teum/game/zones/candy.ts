import type { ZoneConfig } from "./zone";

// 간식 존 — 세 시의 다과상(기획 MAP-03 "거인의 다과상", 지역-컨셉-6 1번). 출발점(북극) 마을 0.
// 꾸밈(decor 837)·숨는 자리·기구·쉼터는 자리표(world-v3)가 놓는다 — 여기는 키컬러·모델 색·몸놀림·소리·랜드마크·미니게임만

/** 간식 존 */
export const CANDY_ZONE: ZoneConfig = {
  id: "candy",
  name: "간식 존",
  hub: 0,
  // 키컬러: 딸기우유 분홍·흰 체크(12m), 큰 길은 테이블 러너, 하늘·안개 라벤더, 오후 세 시의 낮고 따뜻한 빛
  colors: {
    ground: [0xffd6e6, 0xfffafc],
    checker: 12,
    road: 0xffecd6,
    sky: 0xc9b8ff,
    fog: 0xc9b8ff,
    light: { color: 0xffeedd },
  },
  // 꽃은 줄기·잎·꽃술을 흰색으로 바꾼 변형(에셋 빌드의 존별 색 바꾸기 — 맵에 초록·노랑 없음)
  objects: {
    models: {
      flower_pink: { variant: "flower_pink@candy" },
      flower_blue: { variant: "flower_blue@candy" },
    },
  },
  // 몸놀림: 통통 튀기 + 찾기 — 값은 오너 판정 뒤(지금은 기본값)
  motion: {},
  // 소리: 기획이 넘기면 키를 맞춘다(파일이 없으면 조용히)
  sound: { ambient: "snd_zone_candy", landmark: "snd_cake_musicbox" },
  // 거인의 케이크: 70m, 꼭대기에 촛불 다섯, 분홍 빛 기둥, 흰·분홍·코발트 반짝이
  landmark: {
    model: "cake",
    height: 70,
    footR: 30,
    top: "candles",
    beacon: 0xffaad2,
    sparkles: [0xffffff, 0xff8fbe, 0x2a4fd0],
  },
  minigame: "hideseek",
};
