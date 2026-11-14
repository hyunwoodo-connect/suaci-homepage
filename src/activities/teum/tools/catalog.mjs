// 에셋 분류표: 이름(게임 코드가 쓰는 키) → 폴더, 폴리곤 목표, 텍스처 크기.
// 새 에셋을 넣을 때는 여기에 한 줄을 더한다. 분류에 없는 이름은 빌드가 멈춘다.
const group = (cat, tris, tex, names) =>
  Object.fromEntries(names.split(" ").map((n) => [n, { cat, tris, tex }]));

/** 이름 → { cat 폴더, tris 폴리곤 목표, tex 텍스처 한 변 } */
export const CATALOG = {
  ...group("avatar/body", 0, 1024, "SUACI_AV"), // 뼈대가 있는 몸은 폴리곤을 줄이지 않는다(스키닝이 깨진다)
  ...group("avatar/hair", 5000, 512, "hair_bob"),
  ...group("avatar/face", 3500, 512, "glass_heart"),
  ...group("avatar/companion", 3500, 512, "cat_lime"),
  ...group(
    "creatures/common",
    3500,
    512,
    "teapot card mushroom brabbit bfish key umbrella c_watch c_hat c_dice c_rose c_cupcake c_wheart",
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
    "cannon bell bumper balloon hotairballoon star whale lime lime_half",
  ),
  // suaci 프로모션 오브젝트(로고·제품 등)는 'brand' 분류로 넣는다. 예: ...group("brand", 5000, 1024, "logo_sign bottle"),
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
    .replace(/^(c|s|d)_/, "")
    .replace(/_/g, "-")
    .toLowerCase();
