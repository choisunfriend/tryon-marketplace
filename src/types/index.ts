// ============================================================================
// Core Ecommerce Types — Backend-Agnostic Data Contract
// ============================================================================

// --- Brand ---
export interface Brand {
  id: string
  name: string
  slug: string
  description: string
}

// --- CMS-style Pages ---
export interface CmsPage {
  id: string
  title: string
  slug: string
  excerpt?: string
  body: string
  publishedAt: string
  updatedAt?: string
}

// --- Blog Posts ---
export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  body: string
  author: string
  tags: string[]
  coverImage?: ProductImage
  publishedAt: string
  updatedAt?: string
}

// ============================================================================
// Product
// ============================================================================

export type ProductStatus = "draft" | "active" | "archived"

export type ProductGender = "male" | "female" | "unisex"

export type ProductCategory = "clothing" | "accessories"

export type ProductBodyPart =
  | "upper_body"
  | "lower_body"
  | "outer"
  | "full_body"

export interface ProductImage {
  url: string
  alt: string
  width?: number
  height?: number
  type?: "main" | "detail"
}

// --------------------------------------------------------------------------
// Product Details
// --------------------------------------------------------------------------

export interface ProductDetails {
  // 의류 상세정보
  material: string
  color: string
  size: string
  fit: string
  texture: string
  stretch: string
  transparency: string
  thickness: string
  season: string

  // 제조 / 상품관리 정보
  manufacturer: string
  country_of_origin: string
  manufacturing_date: string
  care_instructions: string
  quality_assurance: string
  after_sales_service: string

  // 사이즈 / 실측 정보
  size_info: string
  measurements: string
}

// --------------------------------------------------------------------------
// Product Media
// --------------------------------------------------------------------------

export interface ProductMedia {
  images: ProductImage[]
  model_file: string
}

// --------------------------------------------------------------------------
// Avatar / 3D Application Information
// --------------------------------------------------------------------------

export interface ProductAvatar {
  gender: ProductGender
  body_part: ProductBodyPart
  size_compatibility: string
}

// --------------------------------------------------------------------------
// 3D Model Information
// --------------------------------------------------------------------------
// 기존 코드와의 호환을 위해 유지.
// 새로운 상품 구조에서는 media.model_file + avatar를 사용한다.

export interface Product3D {
  modelPath: string
  gender: string
  bodyPart: string
}

// --------------------------------------------------------------------------
// Product Options / Variants
// --------------------------------------------------------------------------

export interface ProductOption {
  name: string
  value: string
}

export interface VariantInventory {
  quantity: number
  trackInventory: boolean
  allowBackorder: boolean
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  name: string
  price: number
  compareAtPrice?: number
  currency: string
  inventory: VariantInventory
  options: ProductOption[]
  images: ProductImage[]
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
}

// ============================================================================
// Product
// ============================================================================

export interface Product {
  // 기본 정보
  id: string
  name: string
  brand: string
  description: string
  gender: ProductGender
  product_code: string
  status: ProductStatus

  // 분류 정보
  category: ProductCategory
  subcategory: string

  // 가격 정보
  price: number
  currency: string

  // 의류 상세 / 제조 / 사이즈
  details: ProductDetails

  // 이미지 / 3D
  media: ProductMedia

  // Avatar 적용 정보
  avatar: ProductAvatar

  // 시스템 날짜
  created_at: string
  updated_at: string

  // ------------------------------------------------------------------------
  // 기존 쇼핑몰 코드와의 호환 필드
  // ------------------------------------------------------------------------

  slug: string
  images: ProductImage[]
  body?: string

  brandId: string
  categoryIds: string[]
  tags: string[]

  variants: ProductVariant[]

  rating: number
  reviewCount: number
  featured: boolean

  // 기존 3D 구조 호환
  model3d?: Product3D
}

// ============================================================================
// Category
// ============================================================================

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  image?: ProductImage
  parentId?: string
  order: number
}

// ============================================================================
// Cart
// ============================================================================

export interface CartItem {
  id: string
  variantId: string
  productId: string
  name: string
  variantName: string
  image: ProductImage
  slug: string
  price: number
  quantity: number
  lineTotal: number
}

export interface Cart {
  id: string
  items: CartItem[]
  subtotal: number
  tax: number
  shipping: number
  total: number
  itemCount: number
}

// ============================================================================
// Order
// ============================================================================

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"

export interface OrderLineItem {
  id: string
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  image: ProductImage
  price: number
  quantity: number
  total: number
}

export interface Order {
  id: string
  orderNumber: string
  userId?: string
  items: OrderLineItem[]
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  shippingAddress: Address
  billingAddress?: Address
  customerEmail: string
  customerName: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// User
// ============================================================================

export type UserRole = "customer" | "admin"

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  addresses: Address[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Address
// ============================================================================

export type AddressType = "shipping" | "billing"

export interface Address {
  id: string
  type: AddressType
  firstName: string
  lastName: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
  isDefault: boolean
}

// ============================================================================
// Payment
// ============================================================================

export type PaymentMethod =
  | "card"
  | "bank_transfer"
  | "wallet"
  | "other"

export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  currency: string
  transactionId?: string
  metadata?: Record<string, string>
}

// ============================================================================
// Review
// ============================================================================

export interface Review {
  id: string
  productId: string
  userId: string
  rating: number
  title: string
  content: string
  verified: boolean
  createdAt: string
}

// ============================================================================
// Infrastructure Types
// ============================================================================

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError }

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: Record<string, string[]>
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: PaginationMeta
}

// ============================================================================
// Filtering & Sorting
// ============================================================================

export type SortOrder = "asc" | "desc"

export interface SortOption {
  field: string
  order: SortOrder
}

export interface PriceRange {
  min?: number
  max?: number
}

export interface ProductFilters {
  category?: string
  subcategory?: string
  priceRange?: PriceRange
  inStock?: boolean
  search?: string
  tags?: string[]
}

// ============================================================================
// Checkout Provider
// ============================================================================

export interface CheckoutSession {
  id: string
  url: string
  status: "open" | "complete" | "expired"
  orderId?: string
  metadata?: Record<string, string>
}

export interface WebhookResult {
  success: boolean
  orderId?: string
  error?: string
}

export interface CheckoutProvider {
  createSession(
    cart: Cart,
    customer?: {
      email: string
      shippingAddress?: Address
    }
  ): Promise<CheckoutSession>

  getSession(sessionId: string): Promise<CheckoutSession>

  handleWebhook(
    payload: unknown,
    signature: string
  ): Promise<WebhookResult>
}

// ============================================================================
// Data Repository Interfaces
// ============================================================================

export interface ProductRepository {
  list(
    filters?: ProductFilters,
    sort?: SortOption,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>

  getBySlug(slug: string): Promise<Product | null>

  getById(id: string): Promise<Product | null>

  getFeatured(limit?: number): Promise<Product[]>

  getByCategory(
    categorySlug: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>

  search(
    query: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Product>>
}

export interface CategoryRepository {
  list(): Promise<Category[]>

  getBySlug(slug: string): Promise<Category | null>

  getById(id: string): Promise<Category | null>
}

export interface OrderRepository {
  list(
    userId?: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Order>>

  getById(id: string): Promise<Order | null>

  create(
    order: Omit<Order, "id" | "createdAt" | "updatedAt">
  ): Promise<Order>

  updateStatus(
    id: string,
    status: OrderStatus
  ): Promise<Order>
}