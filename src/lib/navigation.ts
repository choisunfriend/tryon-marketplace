export interface NavItem {
  name: string
  ko?: string // (2026-11-14) 한국어 화면 글자
  href: string
}

export interface NavSection {
  label: string
  ko?: string
  items: NavItem[]
}

// Single source of truth for all navigation across desktop header,
// mobile menu, and anywhere else. Edit this one file to update all menus.

export const shopLinks: NavItem[] = [
  { name: "Clothing", ko: "의류", href: "/clothing" },
  { name: "Accessories", ko: "액세서리", href: "/accessories" },
  // (2026-11-01) 미용실 세계 지도 — 헤어스타일 3D 입어 보기
  { name: "Salons", ko: "미용실", href: "/salons" },
]

export const accountLinks: NavItem[] = [
  { name: "My Account", ko: "내 계정", href: "/account" },
  { name: "Wishlist", ko: "찜 목록", href: "/wishlist" },
  { name: "Orders", ko: "주문 내역", href: "/account/orders" },
]

export const infoLinks: NavItem[] = [
  { name: "All Brands", ko: "전체 브랜드", href: "/brands" },
  { name: "Blog", ko: "블로그", href: "/blog" },
  { name: "Pages", ko: "페이지", href: "/pages" },
  { name: "About", ko: "소개", href: "/about" },
  { name: "Contact", ko: "문의", href: "/contact" },
  { name: "FAQ", ko: "자주 묻는 질문", href: "/faq" },
]

export const mobileMenuSections: NavSection[] = [
  { label: "Shop", ko: "쇼핑", items: shopLinks },
  { label: "Account", ko: "내 계정", items: accountLinks },
  { label: "Info", ko: "안내", items: infoLinks },
]
