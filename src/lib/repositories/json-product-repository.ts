import type {
  Product,
  ProductFilters,
  ProductRepository,
  SortOption,
  PaginationParams,
  PaginatedResult,
  ProductVariant,
  ProductImage,
  ProductCategory,
  ProductGender,
  ProductBodyPart,
} from "@/types"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

const PRODUCTS_API_URL = `${API_BASE_URL}/api/products`

// ============================================================================
// API Product
// ============================================================================
// 현재 Worker가 반환하는 기존 상품 데이터.
// Worker는 이번 단계에서 수정하지 않는다.
// ============================================================================

interface ApiProduct {
  id: string
  name: string
  brand?: string | null
  category?: string | null
  gender?: string | null
  price?: number | null
  currency?: string | null
  description?: string | null
  model_path?: string | null
  created_at?: string | null
  updated_at?: string | null
  // 확장 컬럼 — Worker가 이미 돌려준다(값이 없으면 null).
  // D1 JSON 컬럼은 문자열로 올 수도, 객체로 올 수도 있어 둘 다 받는다.
  product_code?: string | null
  status?: string | null
  subcategory?: string | null
  image_url?: string | null
  details?: unknown
  media?: unknown
  avatar?: unknown
}

interface ApiProductsResponse {
  success: boolean
  products: ApiProduct[]
}

// ============================================================================
// Helpers
// ============================================================================

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function normalizeGender(
  gender?: string | null
): ProductGender {
  const value = (gender ?? "").toLowerCase()

  if (
    value === "female" ||
    value === "woman" ||
    value === "women"
  ) {
    return "female"
  }

  if (
    value === "unisex"
  ) {
    return "unisex"
  }

  return "male"
}

function normalizeCategory(
  category?: string | null
): ProductCategory {
  const value = (category ?? "").toLowerCase()

  if (
    value === "accessories" ||
    value === "accessory"
  ) {
    return "accessories"
  }

  return "clothing"
}

function normalizeBodyPart(
  category?: string | null
): ProductBodyPart {
  const value = (category ?? "").toLowerCase()

  if (
    value.includes("pants") ||
    value.includes("jeans") ||
    value.includes("shorts")
  ) {
    return "lower_body"
  }

  if (
    value.includes("outer") ||
    value.includes("jacket") ||
    value.includes("coat") ||
    value.includes("blazer")
  ) {
    return "outer"
  }

  if (
    value.includes("dress")
  ) {
    return "full_body"
  }

  return "upper_body"
}

function normalizeSubcategory(
  category?: string | null
): string {
  const value = (category ?? "").trim()

  return value || "other"
}

// ============================================================================
// 확장 컬럼 읽기
// ============================================================================

type Loose = Record<string, unknown>

function parseLoose(value: unknown): Loose | null {
  if (!value) return null
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === "object" ? (parsed as Loose) : null
    } catch {
      return null
    }
  }
  return typeof value === "object" ? (value as Loose) : null
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const BODY_PARTS: ProductBodyPart[] = [
  "upper_body",
  "lower_body",
  "outer",
  "full_body",
]

function readBodyPart(value: unknown): ProductBodyPart | null {
  const v = str(value) as ProductBodyPart
  return BODY_PARTS.includes(v) ? v : null
}

function readStatus(value: unknown): Product["status"] {
  const v = str(value)
  return v === "draft" || v === "archived" ? v : "active"
}

const EMPTY_DETAILS: Product["details"] = {
  material: "",
  color: "",
  size: "",
  fit: "",
  texture: "",
  stretch: "",
  transparency: "",
  thickness: "",
  season: "",
  manufacturer: "",
  country_of_origin: "",
  manufacturing_date: "",
  care_instructions: "",
  quality_assurance: "",
  after_sales_service: "",
  size_info: "",
  measurements: "",
}

function readDetails(value: unknown): Product["details"] {
  const raw = parseLoose(value)
  if (!raw) return { ...EMPTY_DETAILS }
  const out = { ...EMPTY_DETAILS }
  for (const key of Object.keys(out) as (keyof Product["details"])[]) {
    out[key] = str(raw[key])
  }
  return out
}

// ============================================================================
// Images
// ============================================================================

function createImage(
  product: ApiProduct
): ProductImage[] {
  // 1) media.images  2) image_url  3) placeholder
  const media = parseLoose(product.media)
  const list = Array.isArray(media?.images) ? media.images : []
  const images: ProductImage[] = []
  list.forEach((item, i) => {
    const img = parseLoose(item)
    const url = str(img?.url)
    if (!url) return
    images.push({
      id: `${product.id}-image-${i}`,
      url,
      alt: str(img?.alt) || product.name,
      type: str(img?.type) === "detail" ? "detail" : "main",
    })
  })
  if (images.length) {
    // 대표(main)를 맨 앞으로
    images.sort((a, b) => (a.type === "main" ? 0 : 1) - (b.type === "main" ? 0 : 1))
    return images
  }
  const imageUrl = str(product.image_url)
  if (imageUrl) {
    return [{ id: `${product.id}-image`, url: imageUrl, alt: product.name, type: "main" }]
  }
  return [
    {
      id: `${product.id}-image`,
      url: "/images/products/placeholder.svg",
      alt: product.name,
      type: "main",
    },
  ]
}

// ============================================================================
// Variant
// ============================================================================
// 기존 쇼핑몰 코드가 variant 가격을 cents 단위로 사용하므로
// 기존 동작을 유지한다.
// ============================================================================

function createVariant(
  product: ApiProduct
): ProductVariant {
  const price = product.price ?? 0

  return {
    id: `${product.id}-default`,
    productId: product.id,
    sku: product.id,
    name: "Default",
    price: Math.round(price * 100),
    currency: product.currency ?? "USD",

    inventory: {
      quantity: 0,
      trackInventory: false,
      allowBackorder: true,
    },

    options: [],

    images: createImage(product),
  }
}

// ============================================================================
// Product Mapping
// ============================================================================

function mapApiProduct(
  product: ApiProduct
): Product {
  const createdAt =
    product.created_at ??
    new Date().toISOString()

  const updatedAt =
    product.updated_at ??
    createdAt

  const avatarRaw =
    parseLoose(product.avatar)

  const mediaRaw =
    parseLoose(product.media)

  // 앱이 쓰는 3가지: 성별 · 착용 부위 · 3D 파일
  // 저장된 값이 있으면 그대로, 없으면(예전 상품) 추측으로 폴백
  const gender =
    normalizeGender(str(avatarRaw?.gender) || product.gender)

  const category =
    normalizeCategory(product.category)

  const subcategory =
    str(product.subcategory) ||
    normalizeSubcategory(product.category)

  const bodyPart =
    readBodyPart(avatarRaw?.body_part) ??
    normalizeBodyPart(product.subcategory || product.category)

  const images =
    createImage(product)

  const modelFile =
    str(mediaRaw?.model_file) ||
    (product.model_path ?? "")

  const variant =
    createVariant(product)

  return {
    // ------------------------------------------------------------------------
    // 기본 정보
    // ------------------------------------------------------------------------

    id: product.id,

    name: product.name,

    brand: product.brand ?? "",

    description:
      product.description ?? "",

    gender,

    product_code:
      str(product.product_code) || product.id,

    status:
      readStatus(product.status),

    // ------------------------------------------------------------------------
    // 분류
    // ------------------------------------------------------------------------

    category,

    subcategory,

    // ------------------------------------------------------------------------
    // 가격
    // ------------------------------------------------------------------------

    price: product.price ?? 0,

    currency:
      product.currency ?? "USD",

    // ------------------------------------------------------------------------
    // 상세정보 (Worker의 details 컬럼, 없으면 빈 값)
    // ------------------------------------------------------------------------

    details:
      readDetails(product.details),

    // ------------------------------------------------------------------------
    // Media
    // ------------------------------------------------------------------------

    media: {
      images,

      model_file:
        modelFile,
    },

    // ------------------------------------------------------------------------
    // Avatar / 3D
    // ------------------------------------------------------------------------

    avatar: {
      gender,

      body_part:
        bodyPart,

      size_compatibility:
        str(avatarRaw?.size_compatibility),
    },

    // ------------------------------------------------------------------------
    // 새로운 날짜 구조
    // ------------------------------------------------------------------------

    created_at:
      createdAt,

    updated_at:
      updatedAt,

    // ------------------------------------------------------------------------
    // 기존 쇼핑몰 코드 호환
    // ------------------------------------------------------------------------

    slug:
      createSlug(product.name),

    images,

    body:
      product.description ?? "",

    brandId:
      product.brand ?? "",

    categoryIds:
      product.category
        ? [product.category]
        : [],

    tags:
      product.gender
        ? [product.gender]
        : [],

    variants: [
      variant,
    ],

    rating: 0,

    reviewCount: 0,

    featured: true,

    // 기존 코드에서 사용하는 camelCase 날짜
    createdAt,

    updatedAt,

    // 기존 3D 구조 호환
    model3d: {
      modelPath:
        modelFile,

      gender,

      bodyPart,
    },
  }
}

// ============================================================================
// Fetch Products
// ============================================================================

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(
    PRODUCTS_API_URL,
    {
      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch products: ${response.status} ${response.statusText}`
    )
  }

  const data =
    (await response.json()) as ApiProductsResponse

  if (!data.success) {
    throw new Error(
      "Product API returned success=false"
    )
  }

  return data.products.map(
    mapApiProduct
  )
}

// ============================================================================
// Filters
// ============================================================================

function applyFilters(
  items: Product[],
  filters?: ProductFilters
): Product[] {
  if (!filters) {
    return items.filter(
      (p) => p.status === "active"
    )
  }

  let result =
    items.filter(
      (p) => p.status === "active"
    )

  // --------------------------------------------------------------------------
  // Category
  // --------------------------------------------------------------------------

  if (filters.category) {
    result =
      result.filter(
        (p) =>
          p.category ===
            filters.category ||
          p.categoryIds.includes(
            filters.category!
          )
      )
  }

  // --------------------------------------------------------------------------
  // Subcategory
  // --------------------------------------------------------------------------

  if (filters.subcategory) {
    result =
      result.filter(
        (p) =>
          p.subcategory ===
          filters.subcategory
      )
  }

  // --------------------------------------------------------------------------
  // Price
  // --------------------------------------------------------------------------

  if (filters.priceRange) {
    const {
      min,
      max,
    } = filters.priceRange

    result =
      result.filter(
        (p) => {
          const price =
            p.price

          if (
            min !== undefined &&
            price < min
          ) {
            return false
          }

          if (
            max !== undefined &&
            price > max
          ) {
            return false
          }

          return true
        }
      )
  }

  // --------------------------------------------------------------------------
  // Stock
  // --------------------------------------------------------------------------

  if (
    filters.inStock !==
    undefined
  ) {
    result =
      result.filter(
        (p) =>
          p.variants.some(
            (v) =>
              filters.inStock
                ? v.inventory.quantity > 0 ||
                  v.inventory.allowBackorder
                : true
          )
      )
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  if (filters.search) {
    const query =
      filters.search.toLowerCase()

    result =
      result.filter(
        (p) =>
          p.name
            .toLowerCase()
            .includes(query) ||

          p.brand
            .toLowerCase()
            .includes(query) ||

          p.description
            .toLowerCase()
            .includes(query) ||

          p.tags.some(
            (t) =>
              t.toLowerCase()
                .includes(query)
          )
      )
  }

  // --------------------------------------------------------------------------
  // Tags
  // --------------------------------------------------------------------------

  if (
    filters.tags &&
    filters.tags.length > 0
  ) {
    result =
      result.filter(
        (p) =>
          filters.tags!.some(
            (t) =>
              p.tags.includes(t)
          )
      )
  }

  return result
}

// ============================================================================
// Sorting
// ============================================================================

function applySort(
  items: Product[],
  sort?: SortOption
): Product[] {
  if (!sort) {
    return items
  }

  return [
    ...items,
  ].sort(
    (a, b) => {
      let comparison = 0

      switch (
        sort.field
      ) {
        case "price": {
          comparison =
            a.price -
            b.price

          break
        }

        case "name": {
          comparison =
            a.name.localeCompare(
              b.name
            )

          break
        }

        case "createdAt": {
          comparison =
            new Date(
              a.createdAt
            ).getTime() -
            new Date(
              b.createdAt
            ).getTime()

          break
        }

        default:
          comparison = 0
      }

      return sort.order === "desc"
        ? -comparison
        : comparison
    }
  )
}

// ============================================================================
// Pagination
// ============================================================================

function paginate<T>(
  items: T[],
  pagination?: PaginationParams
): PaginatedResult<T> {
  const page =
    pagination?.page ?? 1

  const limit =
    pagination?.limit ?? 12

  const total =
    items.length

  const totalPages =
    Math.ceil(
      total / limit
    )

  const offset =
    (page - 1) * limit

  return {
    items:
      items.slice(
        offset,
        offset + limit
      ),

    pagination: {
      total,

      page,

      limit,

      totalPages,

      hasNext:
        page < totalPages,

      hasPrev:
        page > 1,
    },
  }
}

// ============================================================================
// Repository
// ============================================================================

export const jsonProductRepository:
  ProductRepository = {

  // --------------------------------------------------------------------------
  // List
  // --------------------------------------------------------------------------

  async list(
    filters,
    sort,
    pagination
  ) {
    const products =
      await fetchProducts()

    let result =
      applyFilters(
        products,
        filters
      )

    result =
      applySort(
        result,
        sort
      )

    return paginate(
      result,
      pagination
    )
  },

  // --------------------------------------------------------------------------
  // Get by Slug
  // --------------------------------------------------------------------------

  async getBySlug(
    slug
  ) {
    const products =
      await fetchProducts()

    return (
      products.find(
        (p) =>
          p.slug === slug &&
          p.status === "active"
      ) ?? null
    )
  },

  // --------------------------------------------------------------------------
  // Get by ID
  // --------------------------------------------------------------------------

  async getById(
    id
  ) {
    const products =
      await fetchProducts()

    return (
      products.find(
        (p) =>
          p.id === id
      ) ?? null
    )
  },

  // --------------------------------------------------------------------------
  // Featured
  // --------------------------------------------------------------------------

  async getFeatured(
    limit = 4
  ) {
    const products =
      await fetchProducts()

    return products
      .filter(
        (p) =>
          p.featured &&
          p.status === "active"
      )
      .slice(
        0,
        limit
      )
  },

  // --------------------------------------------------------------------------
  // Category
  // --------------------------------------------------------------------------

  async getByCategory(
    categorySlug,
    pagination
  ) {
    const products =
      await fetchProducts()

    const categoryProducts =
      products.filter(
        (p) =>
          (
            p.category ===
              categorySlug ||
            p.categoryIds.includes(
              categorySlug
            ) ||
            p.subcategory ===
              categorySlug
          ) &&
          p.status === "active"
      )

    return paginate(
      categoryProducts,
      pagination
    )
  },

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  async search(
    query,
    pagination
  ) {
    const products =
      await fetchProducts()

    const filtered =
      applyFilters(
        products,
        {
          search: query,
        }
      )

    return paginate(
      filtered,
      pagination
    )
  },
}