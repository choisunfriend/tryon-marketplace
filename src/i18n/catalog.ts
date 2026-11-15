import type { LFn } from "./l"

// ============================================================================
// (2026-11-14) 사이트 구조 글자(카테고리) 한국어 — slug 기준
// 상품 이름·설명·브랜드·블로그 글처럼 판매자/운영자가 적은 콘텐츠는 번역하지 않음(적은 그대로)
// ============================================================================

const CATEGORY_KO: Record<string, { name: string; description: string }> = {
  clothing: { name: "의류", description: "가상 착용과 코디 추천을 위해 고른 옷." },
  outer: { name: "아우터", description: "재킷·코트·블레이저 같은 겉옷." },
  jacket: { name: "재킷", description: "재킷." },
  coat: { name: "코트", description: "코트." },
  blazer: { name: "블레이저", description: "블레이저." },
  shirt: { name: "셔츠", description: "셔츠." },
  tshirt: { name: "티셔츠", description: "티셔츠." },
  hoodie: { name: "후디", description: "후디." },
  sweater: { name: "스웨터", description: "스웨터와 니트." },
  pants: { name: "바지", description: "바지와 슬랙스." },
  jeans: { name: "청바지", description: "청바지." },
  shorts: { name: "반바지", description: "반바지." },
  skirt: { name: "치마", description: "치마." },
  dress: { name: "원피스", description: "원피스." },
  accessories: { name: "액세서리", description: "룩을 완성하는 액세서리." },
  bag: { name: "가방", description: "가방." },
  hat: { name: "모자", description: "모자." },
  cap: { name: "캡", description: "캡 모자." },
  glasses: { name: "안경", description: "안경과 선글라스." },
  watch: { name: "시계", description: "시계." },
  necklace: { name: "목걸이", description: "목걸이." },
  earring: { name: "귀걸이", description: "귀걸이." },
  belt: { name: "벨트", description: "벨트." },
}

// slug 가 없으면 영어 이름으로도 찾음 ("T-Shirt" → tshirt)
const BY_NAME: Record<string, string> = Object.fromEntries(
  Object.keys(CATEGORY_KO).map((slug) => [slug, slug])
)
BY_NAME["t-shirt"] = "tshirt"

function keyOf(c: { slug?: string | null; name?: string | null; href?: string | null }): string | null {
  const fromSlug = c.slug?.toLowerCase()
  if (fromSlug && CATEGORY_KO[fromSlug]) return fromSlug
  const fromHref = c.href?.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase()
  if (fromHref && CATEGORY_KO[fromHref]) return fromHref
  const fromName = c.name?.toLowerCase()
  if (fromName && BY_NAME[fromName]) return BY_NAME[fromName]
  return null
}

export function catName(L: LFn, c: { slug?: string | null; name?: string | null; href?: string | null }): string {
  const k = keyOf(c)
  return k ? L(CATEGORY_KO[k].name, c.name ?? "") : (c.name ?? "")
}

export function catDescription(
  L: LFn,
  c: { slug?: string | null; name?: string | null; description?: string | null }
): string {
  const k = keyOf(c)
  return k ? L(CATEGORY_KO[k].description, c.description ?? "") : (c.description ?? "")
}
