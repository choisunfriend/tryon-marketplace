import type {
  Product,
  ProductFilters,
  ProductRepository,
  SortOption,
  PaginationParams,
  PaginatedResult,
  ProductVariant,
  ProductImage,
} from "@/types"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

const PRODUCTS_API_URL = `${API_BASE_URL}/api/products`

interface ApiProduct {
  id: string
  name: string
  brand?: string | null
  category?: string | null
  subcategory?: string | null
  gender?: string | null
  price?: number | null
  currency?: string | null
  description?: string | null

  // 3D model
  model_path?: string | null
  model_gender?: string | null
  body_part?: string | null

  created_at?: string | null
  updated_at?: string | null
}

interface ApiProductsResponse {
  success: boolean
  products: ApiProduct[]
}

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function createImage(product: ApiProduct): ProductImage[] {
  return [
    {
      id: `${product.id}-image`,
      url: "/images/products/placeholder.svg",
      alt: product.name,
    },
  ]
}

function createVariant(product: ApiProduct): ProductVariant {
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

function mapApiProduct(product: ApiProduct): Product {
  const createdAt =
    product.created_at ?? new Date().toISOString()

  const updatedAt =
    product.updated_at ?? createdAt

  return {
    id: product.id,
    name: product.name,
    slug: createSlug(product.name),
    description: product.description ?? "",
    body: product.description ?? "",
    images: createImage(product),
    status: "active",
    brandId: product.brand ?? "",
    categoryIds: product.category
      ? [product.category]
      : [],
    tags: product.gender
      ? [product.gender]
      : [],
    variants: [createVariant(product)],
    rating: 0,
    reviewCount: 0,
    featured: true,
    createdAt,
    updatedAt,

    // 3D model
    // 현재는 하나의 일체형 바디 모델을 사용하며
    // 상품 사이즈와 연결하지 않습니다.
    model3d: product.model_path
      ? {
          modelPath: product.model_path,
          gender: product.model_gender ?? "",
          bodyPart: product.body_part ?? "",
        }
      : undefined,
  }
}

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(PRODUCTS_API_URL, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch products: ${response.status} ${response.statusText}`
    )
  }

  const data =
    (await response.json()) as ApiProductsResponse

  if (!data.success) {
    throw new Error("Product API returned success=false")
  }

  return data.products.map(mapApiProduct)
}

function applyFilters(
  items: Product[],
  filters?: ProductFilters
): Product[] {
  if (!filters) {
    return items.filter((p) => p.status === "active")
  }

  let result = items.filter(
    (p) => p.status === "active"
  )

  if (filters.category) {
    result = result.filter((p) =>
      p.categoryIds.includes(filters.category!)
    )
  }

  if (filters.priceRange) {
    const { min, max } = filters.priceRange

    result = result.filter((p) => {
      const price = p.variants[0]?.price ?? 0

      if (
        min !== undefined &&
        price < min * 100
      ) {
        return false
      }

      if (
        max !== undefined &&
        price > max * 100
      ) {
        return false
      }

      return true
    })
  }

  if (filters.inStock !== undefined) {
    result = result.filter((p) =>
      p.variants.some((v) =>
        filters.inStock
          ? v.inventory.quantity > 0 ||
            v.inventory.allowBackorder
          : true
      )
    )
  }

  if (filters.search) {
    const query =
      filters.search.toLowerCase()

    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description
          .toLowerCase()
          .includes(query) ||
        p.tags.some((t) =>
          t.toLowerCase().includes(query)
        )
    )
  }

  if (
    filters.tags &&
    filters.tags.length > 0
  ) {
    result = result.filter((p) =>
      filters.tags!.some((t) =>
        p.tags.includes(t)
      )
    )
  }

  return result
}

function applySort(
  items: Product[],
  sort?: SortOption
): Product[] {
  if (!sort) return items

  return [...items].sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case "price": {
        const priceA =
          a.variants[0]?.price ?? 0

        const priceB =
          b.variants[0]?.price ?? 0

        comparison =
          priceA - priceB

        break
      }

      case "name":
        comparison =
          a.name.localeCompare(b.name)

        break

      case "createdAt":
        comparison =
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime()

        break

      default:
        comparison = 0
    }

    return sort.order === "desc"
      ? -comparison
      : comparison
  })
}

function paginate<T>(
  items: T[],
  pagination?: PaginationParams
): PaginatedResult<T> {
  const page =
    pagination?.page ?? 1

  const limit =
    pagination?.limit ?? 12

  const total = items.length

  const totalPages =
    Math.ceil(total / limit)

  const offset =
    (page - 1) * limit

  return {
    items: items.slice(
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

export const jsonProductRepository: ProductRepository = {
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

  async getBySlug(slug) {
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

  async getById(id) {
    const products =
      await fetchProducts()

    return (
      products.find(
        (p) => p.id === id
      ) ?? null
    )
  },

  async getFeatured(limit = 4) {
    const products =
      await fetchProducts()

    return products
      .filter(
        (p) =>
          p.featured &&
          p.status === "active"
      )
      .slice(0, limit)
  },

  async getByCategory(
    categorySlug,
    pagination
  ) {
    const products =
      await fetchProducts()

    const categoryProducts =
      products.filter(
        (p) =>
          p.categoryIds.includes(
            categorySlug
          ) &&
          p.status === "active"
      )

    return paginate(
      categoryProducts,
      pagination
    )
  },

  async search(
    query,
    pagination
  ) {
    const products =
      await fetchProducts()

    const filtered =
      applyFilters(
        products,
        { search: query }
      )

    return paginate(
      filtered,
      pagination
    )
  },
}