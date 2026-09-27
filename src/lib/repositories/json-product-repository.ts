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
// Images
// ============================================================================

function createImage(
  product: ApiProduct
): ProductImage[] {
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

  const gender =
    normalizeGender(product.gender)

  const category =
    normalizeCategory(product.category)

  const subcategory =
    normalizeSubcategory(product.category)

  const images =
    createImage(product)

  const modelFile =
    product.model_path ?? ""

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

    product_code: product.id,

    status: "active",

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
    // 상세정보
    // ------------------------------------------------------------------------
    // 현재 Worker에 해당 필드가 없기 때문에
    // 빈 값으로 준비한다.
    // 이후 DB/API가 확장되면 이 부분에서 그대로 연결한다.

    details: {
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
    },

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
        normalizeBodyPart(product.category),

      size_compatibility: "",
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

      bodyPart:
        normalizeBodyPart(product.category),
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