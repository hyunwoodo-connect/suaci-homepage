import { SOUND_EFFECTS } from "../../assets/settings";
import type { SoundTable } from "../../assets/settings";

// 티타임 행성의 소리 대응표(기획서 v3.1 15장). 지금 매니페스트(v10)에 있는 소리만 쓴다.
// 키득·바스락·열어 보기는 지금 게임의 규칙을 그대로 빌린다(좌우·거리 크기 셈이 같다).
// 바람 기둥의 snd_wind 는 배경음 묶음이라 효과음으로 받지 않아 snd_up 을 느리게 쓴다(기획이 효과음으로 넘기면 바꾼다).
// '없음'(꼭꼭 숨어라·들킴·찜·다 도망간다)은 기획이 만들어 넘기기 전까지 있는 소리를 빌린다

/** 이 씬의 효과음 표 */
export const TEA_SOUNDS: SoundTable = {
  landed: { key: "snd_box_thud_small", volume: 0.55, gap: 0.3 },
  mushroomJumped: { key: "snd_boing", volume: 0.5 },
  rose: { key: "snd_up", volume: 0.45, rate: 0.7, gap: 1 },
  grabbed: ({ by }) => (by === "cannon" ? { key: "snd_cannon", volume: 0.7 } : null),
  railed: { key: "snd_rail", volume: 0.45 },
  findGiggled: SOUND_EFFECTS.findGiggled,
  findRustled: SOUND_EFFECTS.findRustled,
  findTapped: SOUND_EFFECTS.findTapped,
  findMissed: SOUND_EFFECTS.findMissed,
  findFound: { key: "snd_box_found_a", volume: 0.8 },
  findHopped: SOUND_EFFECTS.findHopped,
  openKnocked: SOUND_EFFECTS.openKnocked,
  openRolled: SOUND_EFFECTS.openRolled,
  openPopped: SOUND_EFFECTS.openPopped,
  openFizzled: SOUND_EFFECTS.openFizzled,
  teaStepped: ({ pan, volume, running }) =>
    running
      ? { key: "snd_box_steps_b", volume: 0.55 * volume, rate: 1.35, pan, gap: 0.22 }
      : { key: "snd_box_steps_a", volume: 0.35 * volume, pan, gap: 0.35 },
  teaStartled: ({ pan }) => ({ key: "snd_find_hop", volume: 0.7, rate: 1.5, pan }),
  teaCaught: [
    { key: "snd_hide_tap_mist", volume: 0.55 },
    { key: "snd_box_found_a", volume: 0.85, delay: 0.15, gap: 0.01 },
  ],
  teaClaimed: { key: "snd_find_taunt", volume: 0.7 },
};
