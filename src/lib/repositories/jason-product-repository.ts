```ts
import type {
  Product,
  ProductFilters,
  ProductRepository,
  SortOption,
  PaginationParams,
  PaginatedResult,
  ProductImage,
  ProductVariant,
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
  gender?: string | null
  price?: number | null
  currency?: string | null
  description?: string | null
  model_path?: string | null
  created_at?: string | null
}

interface ProductsApiResponse {
  success: boolean
  products: ApiProduct[]
  error?: string
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function createImage(product: ApiProduct): ProductImage[] {
  if (!product.model_path) {
    return []
  }

  return [
    {
      url: product.model_path,
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
  const createdAt = product.created_at ?? new Date().toISOString()
  const images = createImage(product)

  return {
    id: product.id,
    name: product.name,
    slug: createSlug(product.name),
    description: product.description ?? "",
    body: product.description ?? "",
    images,
    status: "active",
    brandId: product.brand ?? "",
    categoryIds: product.category ? [product.category] : [],
    tags: product.gender ? [product.gender] : [],
    variants: [createVariant(product)],
    rating: 0,
    reviewCount: 0,
    featured: false,
    createdAt,
    updatedAt: createdAt,
  }
}

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(PRODUCTS_API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch products: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as ProductsApiResponse

  if (!data.success) {
    throw new Error(data.error ?? "Failed to fetch products")
  }

  return data.products.map(mapApiProduct)
}

function applyFilters(
  items: Product[],
  filters?: ProductFilters
): Product[] {
  if (!filters) return items

  let result = items.filter((p) => p.status === "active")

  if (filters.category) {
    result = result.filter((p) =>
      p.categoryIds.includes(filters.category!)
    )
  }

  if (filters.priceRange) {
    const { min, max } = filters.priceRange

    result = result.filter((p) => {
      const price = p.variants[0]?.price ?? 0

      if (min !== undefined && price < min) return false
      if (max !== undefined && price > max) return false

      return true
    })
  }

  if (filters.inStock !== undefined) {
    result = result.filter((p) =>
      p.variants.some((v) =>
        filters.inStock
          ? v.inventory.quantity > 0 || v.inventory.allowBackorder
          : true
      )
    )
  }

  if (filters.search) {
    const query = filters.search.toLowerCase()

    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query))
    )
  }

  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((p) =>
      filters.tags!.some((tag) => p.tags.includes(tag))
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
        const priceA = a.variants[0]?.price ?? 0
        const priceB = b.variants[0]?.price ?? 0

        comparison = priceA - priceB
        break
      }

      case "name":
        comparison = a.name.localeCompare(b.name)
        break

      case "createdAt":
        comparison =
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
        break

      default:
        comparison = 0
    }

    return sort.order === "desc" ? -comparison : comparison
  })
}

function paginate<T>(
  items: T[],
  pagination?: PaginationParams
): PaginatedResult<T> {
  const page = pagination?.page ?? 1
  const limit = pagination?.limit ?? 12

  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit

  return {
    items: items.slice(offset, offset + limit),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

export const jsonProductRepository: ProductRepository = {
  async list(filters, sort, pagination) {
    const products = await fetchProducts()

    let result = applyFilters(products, filters)
    result = applySort(result, sort)

    return paginate(result, pagination)
  },

  async getBySlug(slug) {
    const products = await fetchProducts()

    return (
      products.find(
        (product) =>
          product.slug === slug &&
          product.status === "active"
      ) ?? null
    )
  },

  async getById(id) {
    const products = await fetchProducts()

    return products.find((product) => product.id === id) ?? null
  },

  async getFeatured(limit = 4) {
    const products = await fetchProducts()

    return products
      .filter(
        (product) =>
          product.featured &&
          product.status === "active"
      )
      .slice(0, limit)
  },

  async getByCategory(categorySlug, pagination) {
    const products = await fetchProducts()

    const categoryProducts = products.filter(
      (product) =>
        product.categoryIds.includes(categorySlug) &&
        product.status === "active"
    )

    return paginate(categoryProducts, pagination)
  },

  async search(query, pagination) {
    const products = await fetchProducts()

    const filtered = applyFilters(products, {
      search: query,
    })

    return paginate(filtered, pagination)
  },
}
```
