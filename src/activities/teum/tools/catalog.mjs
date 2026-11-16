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
  // suaci 프로모션 오브젝트(로고·제품 등)는 'brand' 분류로 넣는다. 예: ...group("brand", 5000, 1024, "logo_sign bottle"),
  // 소리(v3 부터): 원본은 raw/snd_<이름>.mp3(시제품 v78 assets16.js 에서 푼 것). 되풀이하는 것은 'audio/bgm', 한 번씩 나는 것은 'audio/sfx'
  ...sounds("audio/bgm", "snd_bgm snd_wind"),
  ...sounds(
    "audio/sfx",
    "snd_up snd_boing snd_quad snd_swim snd_wing snd_jelly snd_legend snd_rocket snd_cannon snd_rail snd_whale snd_splash snd_ring snd_stamp snd_pick snd_palin snd_open snd_blank snd_win",
  ),
  // 숨바꼭질 소리(v6 부터): 기획이 넘긴 mp3(teum-handoff/slice-01b/sounds)의 앞뒤 무음을 자르고 음량을 맞춘 것 — raw/snd_box_<이름>.mp3.
  // 두 벌(a·b) 가운데 원본이 사실상 무음인 것(재채기 b·발소리 b·떨어짐 a·휴 a)과 하나만 고르는 것의 나머지(전설 b·다 찾음 b)는 싣지 않았다
  ...sounds(
    "audio/sfx",
    "snd_box_sneeze_a snd_box_steps_a snd_box_found_a snd_box_found_b snd_box_fall_b snd_box_thud_small snd_box_thud_big snd_box_giggle_a snd_box_giggle_b snd_box_phew_b snd_box_legend snd_box_allfound",
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
