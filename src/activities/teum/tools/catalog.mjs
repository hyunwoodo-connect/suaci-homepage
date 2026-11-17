// 에셋 분류표: 이름(게임 코드가 쓰는 키) → 폴더, 폴리곤 목표, 텍스처 크기(모델) 또는 소리 분류(소리).
// 새 에셋을 넣을 때는 여기에 한 줄을 더한다. 분류에 없는 이름은 빌드가 멈춘다.
const group = (cat, tris, tex, names) =>
  Object.fromEntries(names.split(" ").map((n) => [n, { cat, tris, tex }]));
const sounds = (cat, names) => Object.fromEntries(names.split(" ").map((n) => [n, { cat }]));
const images = (cat, names) =>
  Object.fromEntries(names.split(" ").map((n) => [n, { cat, image: true }]));

/** 소리 원본으로 받는 형식(확장자). 소리는 다시 누르지 않고 그대로 싣는다 — 형식·크기는 원본을 넣기 전에 정한다 */
export const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".ogg", ".webm"];

/** 분류(cat)가 소리인가 — 'audio/sfx' 효과음·'audio/bgm' 배경 음악 */
export const isAudioCategory = (cat) => cat.startsWith("audio/");

/** 그림 원본으로 받는 형식. 그림(옷 무늬·옷장 썸네일)도 다시 누르지 않고 그대로 싣는다 — 크기는 원본을 넣기 전에 정한다 */
export const IMAGE_EXTENSIONS = [".webp"];

/** 이름 → 모델 { cat 폴더, tris 폴리곤 목표, tex 텍스처 한 변 } · 소리 { cat 'audio/…' 폴더 } · 그림 { cat, image } */
export const CATALOG = {
  ...group("avatar/body", 0, 1024, "SUACI_AV"), // 뼈대가 있는 몸은 폴리곤을 줄이지 않는다(스키닝이 깨진다)
  // 꾸미기 부품(v4 부터 — 시제품 v82 assets18.js 에서 푼 것). 소품은 시제품 쪽에서 이미 줄여 와서 목표를 그 폴리곤 수에 둔다
  ...group("avatar/hair", 5000, 512, "hair_bob"),
  ...group("avatar/hair", 6000, 512, "scarf"),
  ...group("avatar/face", 3500, 512, "glass_heart"),
  ...group("avatar/face", 5000, 512, "sunglass"),
  ...group("avatar/ear", 3500, 512, "earring"),
  ...group("avatar/hand", 6000, 512, "bouquet bag"),
  ...group("avatar/board", 5500, 512, "board"),
  // 옷 무늬(512px, 시제품 v82 assets17.js)와 옷장 칸 그림(부품마다 하나) — raw/<이름>.webp
  ...images(
    "avatar/prints",
    "print_daisy print_ditsy print_stripe print_patch print_rose print_gingham",
  ),
  ...images(
    "avatar/thumbs",
    "thumb_hair_bob thumb_scarf thumb_glass_heart thumb_sunglass thumb_earring thumb_bouquet thumb_bag thumb_board",
  ),
  ...group("avatar/companion", 3500, 512, "cat_lime"),
  ...group(
    "creatures/common",
    3500,
    512,
    "teapot card mushroom brabbit bfish key umbrella c_watch c_hat c_dice c_rose c_cupcake c_wheart c_wletter c_wcup c_wbell c_narwhal c_seal",
  ),
  ...group("creatures/legend", 4500, 512, "c_deer c_wcrown"),
  ...group(
    "sculptures/large",
    6000,
    1024,
    "s_rook s_icecream s_lollipop s_donut s_heart s_bow s_cherry s_pudding s_arch s_crown s_gift s_top",
  ),
  // 열기구 장식(d_hotairballoon)은 작은 조형물과 같이 하늘을 꾸민다. rides 에 두면 큰 열기구(hotairballoon)와 파일 이름이 겹친다
  ...group(
    "sculptures/small",
    1600,
    512,
    "d_cake d_macaron d_teacup d_fruitpile d_smileflower d_flowerpile d_hotairballoon",
  ),
  ...group("scenery/trees", 5000, 512, "tree_pink tree_white tree_yellow knittree wishtree"),
  ...group("scenery/flowers", 3500, 512, "flower_pink flower_blue smileflower flowerpile"),
  ...group(
    "scenery/landmarks",
    6000,
    512,
    "palace castle ferris ferris_wheel ferris_stand carousel gacha island slide campfire busstop fountain fountaintower parasol cake bathtub sofa hammock lighthouse pod mailbox stairs startower dome candycart observatory flamingo",
  ),
  ...group(
    "scenery/props",
    3500,
    512,
    "fruitcrate ducktube boat door tent picnic moonswing gumdrops macaron moon lifering teacup petalbench fruitpile",
  ),
  ...group(
    "rides",
    4500,
    512,
    "cannon bell bumper balloon hotairballoon star whale lime lime_half r_funnel r_bud w_butterfly",
  ),
  // 숨바꼭질의 숨는 애(라임 상자, 원본 약 2만 폴리곤). 언박싱에서 가까이 보므로 1024 텍스처
  ...group("hideseek", 8000, 1024, "limebox"),
  // 아닌 척하는 상자가 입는 소품(v7 — 기획 세션이 만들어 teum-handoff/assets/props 에 넣은 것): 안경·화분·토끼 가면, 선물 더미는 1024 텍스처
  ...group("hideseek", 6000, 512, "disguise_glasses flowerpot rabbit_mask"),
  ...group("hideseek", 9000, 1024, "gift_pile"),
  // 상자가 속에 숨는 후보 물건(v9 — 기획 세션이 teum-handoff/slice-02/props 에 넣은 것, 이미 줄여 온 폴리곤 그대로): 찻잔·바구니·쿠키 단지.
  // 풍경의 teacup·d_teacup 과 이름이 겹치지 않게 hide_ 를 붙인다
  ...group("hideseek", 7000, 512, "hide_teacup hide_basket hide_jar"),
  // 화면 단추 그림(v9 — 옷장 단추. 256px webp)
  ...images("ui", "ui_wardrobe"),
  // suaci 프로모션 오브젝트(로고·제품 등)는 'brand' 분류로 넣는다. 예: ...group("brand", 5000, 1024, "logo_sign bottle"),
  // 소리(v3 부터): 원본은 raw/snd_<이름>.mp3(시제품 v78 assets16.js 에서 푼 것). 되풀이하는 것은 'audio/bgm', 한 번씩 나는 것은 'audio/sfx'
  ...sounds("audio/bgm", "snd_bgm snd_wind"),
  ...sounds(
    "audio/sfx",
    "snd_up snd_boing snd_quad snd_swim snd_wing snd_jelly snd_legend snd_rocket snd_cannon snd_rail snd_whale snd_splash snd_ring snd_stamp snd_pick snd_palin snd_open snd_blank snd_win",
  ),
  // 숨바꼭질 소리(v6 부터): 기획이 넘긴 mp3(teum-handoff/slice-01b/sounds)의 앞뒤 무음을 자르고 음량을 맞춘 것 — raw/snd_box_<이름>.mp3.
  // 하나만 고르는 것의 나머지(전설 b·다 찾음 b)는 싣지 않았다. 01b 에서 무음이던 넷(재채기 b·발소리 b·떨어짐·휴 a)은 v8 에서 새 벌로 채웠다
  // (떨어짐은 의심스럽던 b 대신 새 a 를 쓴다)
  ...sounds(
    "audio/sfx",
    "snd_box_sneeze_a snd_box_sneeze_b snd_box_steps_a snd_box_steps_b snd_box_found_a snd_box_found_b snd_box_fall_a snd_box_thud_small snd_box_thud_big snd_box_giggle_a snd_box_giggle_b snd_box_phew_a snd_box_phew_b snd_box_legend snd_box_allfound",
  ),
  // 생물·누르기 소리(v8 — teum-handoff/assets/sounds-01e, 기획이 앞뒤 무음을 자르고 가장 큰 소리를 −1dB 에 맞춰 넘긴 것):
  // 누르기(미스트)·뛰어가기·고리 켜짐·전설이 울며 내려옴, 여섯 생물이 도움을 시작하는 몸짓
  ...sounds(
    "audio/sfx",
    "snd_hide_tap_mist snd_hide_leap snd_hide_ring_on snd_hide_legend snd_help_rabbit snd_help_mushroom snd_help_key snd_help_soldier snd_help_cupcake snd_help_watch",
  ),
  // 찾는 손맛 소리(v9 — teum-handoff/slice-02/sounds, 기획이 앞뒤 무음을 자르고 −1dB 에 맞춰 넘긴 것. ffmpeg 로 재 보니 여덟 다 들린다):
  // 키득 셋(뜨거워 차가워)·바스락·꽝·메롱·이사 폴짝·찾았다 팡파레
  ...sounds(
    "audio/sfx",
    "snd_find_giggle_1 snd_find_giggle_2 snd_find_giggle_3 snd_find_rustle snd_find_wrong snd_find_taunt snd_find_hop snd_find_found",
  ),
};

/**
 * 원본(raw/)에는 남아 있지만 게임이 쓰지 않아 빌드하지 않는 옛 톤 에셋. 원본 보관(S3 source/)에만 남는다.
 * 옛 아바타(avatar_base)는 뼈대 있는 몸(SUACI_AV)이 들어오기 전 자리 채움이었다.
 */
export const RETIRED = new Set(["avatar_base", "sheep", "fish", "bird", "turtle", "jellyfish"]);

/** 에셋 키 → 배포 파일 이름(확장자 없이). 빌드가 두 키가 같은 파일로 가는지 따로 막는다 */
export const fileName = (k) =>
  k
    .replace(/^SUACI_AV$/, "base")
    .replace(/^(c|s|d|r|w|snd|print|thumb)_/, "")
    .replace(/_/g, "-")
    .toLowerCase();
