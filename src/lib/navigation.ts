export interface NavItem {
  name: string
  href: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

// Single source of truth for all navigation across desktop header,
// mobile menu, and anywhere else. Edit this one file to update all menus.

export const shopLinks: NavItem[] = [
  { name: "Clothing", href: "/clothing" },
  { name: "Accessories", href: "/accessories" },
  // (2026-11-01) 미용실 세계 지도 — 헤어스타일 3D 입어 보기
  { name: "Salons", href: "/salons" },
]

export const accountLinks: NavItem[] = [
  { name: "My Account", href: "/account" },
  { name: "Wishlist", href: "/wishlist" },
  { name: "Orders", href: "/account/orders" },
]

export const infoLinks: NavItem[] = [
  { name: "All Brands", href: "/brands" },
  { name: "Blog", href: "/blog" },
  { name: "Pages", href: "/pages" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
  { name: "FAQ", href: "/faq" },
]

export const mobileMenuSections: NavSection[] = [
  { label: "Shop", items: shopLinks },
  { label: "Account", items: accountLinks },
  { label: "Info", items: infoLinks },
]
