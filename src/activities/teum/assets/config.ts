import { AVATAR_BUNDLE } from "@/lib/avatar/bundle";

/**
 * 틈이 받는 에셋 묶음. 아바타의 것(몸·부품·무늬)이 같은 묶음에 들어 있어 주소와 버전은 아바타 쪽에 하나만 둔다 —
 * 둘이 어긋나면 옷장에 있는 부품이 틈이 받는 묶음에 없을 수 있다. 묶음을 나누게 되면 여기에 틈의 주소를 따로 둔다
 */
export const TEUM_BUNDLE = AVATAR_BUNDLE;
