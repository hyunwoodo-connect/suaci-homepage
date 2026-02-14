/** 네비게이션 메뉴 아이템 */
export interface NavItem {
  label: string;
  href: string;
}

/** 푸터 링크 그룹 */
export interface FooterLinkGroup {
  title: string;
  links: NavItem[];
}
