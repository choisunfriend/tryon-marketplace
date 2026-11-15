"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ShoppingBag, Heart, Shirt } from "lucide-react"
import { toast } from "sonner"
import { useCartStore } from "@/store/cart"
import { useWishlistStore } from "@/store/wishlist"
import { useRecentlyViewedStore } from "@/store/recently-viewed"
import { RecentlyViewed } from "@/components/products/recently-viewed"
import { StarRating } from "@/components/products/star-rating"
import { TrustSignals } from "@/components/products/trust-signals"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ProductGallery } from "@/components/products/product-gallery"
import { VariantSelector } from "@/components/products/variant-selector"
import { QuantitySelector } from "@/components/products/quantity-selector"
import { ProductGrid } from "@/components/products/product-grid"
import { formatPrice } from "@/lib/utils"
import { breadcrumbJsonLd } from "@/lib/structured-data"
import type { Product, Brand, Category } from "@/types"
import { listenForAppHello, parentAppOrigin, postToApp } from "@/lib/app-bridge"
import { useL } from "@/i18n/use-l"
import { catName } from "@/i18n/catalog"

interface ProductDetailViewProps {
  product: Product
  relatedProducts: Product[]
  brand: Brand | null
  categoryAncestors?: Category[]
}

export function ProductDetailView({
  product,
  relatedProducts,
  brand,
  categoryAncestors = [],
}: ProductDetailViewProps) {
  const { L } = useL()
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id ?? ""
  )
  const [quantity, setQuantity] = useState(1)

  const addToCart = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.openCart)
  const wishlistItems = useWishlistStore((s) => s.items)
  const addToWishlist = useWishlistStore((s) => s.addItem)
  const removeFromWishlist = useWishlistStore((s) => s.removeItem)

  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addItem)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // GYEOL 앱 iframe 안에서 열렸을 때만 "Try on" 버튼을 보여 줍니다.
  // 누르면 부모(GYEOL)에 gyeol-wear 메시지를 보내고, 앱이 3D 몸에 옷을 입힙니다.
  const [inGyeol, setInGyeol] = useState(false)
  useEffect(() => {
    // 허용된 GYEOL 앱 origin 이 부모일 때만 Try on 을 켭니다
    const update = () => setInGyeol(parentAppOrigin() !== null)
    update()
    const stop = listenForAppHello()
    const t = setTimeout(update, 800) // gyeol-hello 를 받은 뒤 다시 확인
    return () => {
      stop()
      clearTimeout(t)
    }
  }, [])
  const modelFile = product.media?.model_file || product.model3d?.modelPath || ""
  const canTryOn = inGyeol && /\.obj(\?|#|$)/i.test(modelFile)
  const handleTryOn = () => {
    // 부모가 허용된 GYEOL 앱일 때 그 origin 으로만 보냄 ("*" 금지)
    const sent = postToApp(
      {
        type: "gyeol-wear",
        id: product.id,
        // GYEOL 앱의 어댑터(_fromMarketplace)가 이 형태를 그대로 읽습니다
        item: {
          id: product.id,
          name: product.name,
          gender: product.avatar?.gender ?? product.gender,
          price: product.price,
          currency: product.currency,
          status: product.status,
          media: { model_file: new URL(modelFile, window.location.origin).href },
          avatar: { gender: product.avatar?.gender, body_part: product.avatar?.body_part },
        },
      }
    )
    if (sent) toast.success(L("GYEOL에서 입혀 보는 중…", "Trying it on in GYEOL…"))
    else toast.error(L("GYEOL 앱 안에서만 입어 볼 수 있어요", "You can only try it on inside the GYEOL app"))
  }
  const isWishlisted = mounted && wishlistItems.some((i) => i.productId === product.id)

  // Track recently viewed
  useEffect(() => {
    addRecentlyViewed({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.variants[0]?.price ?? 0,
      imageUrl: product.images[0]?.url ?? "",
      imageAlt: product.images[0]?.alt ?? product.name,
    })
  }, [product.id])

  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId
  )
  if (!selectedVariant) return null

  const isOnSale =
    selectedVariant.compareAtPrice &&
    selectedVariant.compareAtPrice > selectedVariant.price
  const inStock =
    selectedVariant.inventory.quantity > 0 ||
    selectedVariant.inventory.allowBackorder

  function handleAddToCart() {
    addToCart({
      variantId: selectedVariant!.id,
      productId: product.id,
      name: product.name,
      variantName: selectedVariant!.name,
      image: product.images[0] ?? { url: "", alt: product.name },
      slug: product.slug,
      price: selectedVariant!.price,
      quantity,
    })
    openCart()
  }

  function handleToggleWishlist() {
    if (isWishlisted) {
      removeFromWishlist(product.id)
      toast(L("찜 목록에서 뺐어요", "Removed from wishlist"))
    } else {
      addToWishlist({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: selectedVariant!.price,
        image: product.images[0] ?? { url: "", alt: product.name },
      })
      toast.success(L("찜 목록에 담았어요", "Added to wishlist"))
    }
  }

  const breadcrumbLd = breadcrumbJsonLd([
    { name: L("쇼핑", "Shop"), href: "/shop" },
    ...categoryAncestors.map((c) => ({ name: catName(L, c), href: `/${c.slug}` })),
    { name: product.name, href: `/${product.slug}` },
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((img) => img.url),
    sku: selectedVariant.sku,
    brand: brand ? { "@type": "Brand", name: brand.name } : undefined,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
    offers: {
      "@type": "Offer",
      price: (selectedVariant.price / 100).toFixed(2),
      priceCurrency: selectedVariant.currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]) }}
      />
      {/* Breadcrumb — shows category ancestry; product name is in the H1 below */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/shop" />}>{L("쇼핑", "Shop")}</BreadcrumbLink>
          </BreadcrumbItem>
          {categoryAncestors.map((cat, idx) => {
            const isLast = idx === categoryAncestors.length - 1
            return (
              <div key={cat.id} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{catName(L, cat)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={`/${cat.slug}`} />}>
                      {catName(L, cat)}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Product */}
      <div className="mt-2 grid gap-8 lg:grid-cols-2 lg:gap-16">
        {/* Gallery */}
        <ProductGallery images={product.images} productName={product.name} />

        {/* Info */}
        <div className="flex flex-col">
          <div>
            <StarRating rating={product.rating} reviewCount={product.reviewCount} />
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>

          {brand && (
            <Link
              href={`/${brand.slug}`}
              className="mt-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {brand.name}
            </Link>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {formatPrice(selectedVariant.price, selectedVariant.currency)}
            </span>
            {isOnSale && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(
                    selectedVariant.compareAtPrice!,
                    selectedVariant.currency
                  )}
                </span>
                <Badge variant="secondary">
                  {Math.round(
                    (1 -
                      selectedVariant.price /
                        selectedVariant.compareAtPrice!) *
                      100
                  )}
                  % off
                </Badge>
              </>
            )}
          </div>

          <p className="mt-4 text-muted-foreground">{product.description}</p>

          {/* Variants */}
          {product.variants.length > 1 && (
            <div className="mt-6 mb-6">
              <VariantSelector
                variants={product.variants}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
              />
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
              <QuantitySelector
                quantity={quantity}
                onQuantityChange={setQuantity}
                max={selectedVariant.inventory.quantity || 99}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={isWishlisted ? L("찜 해제", "Remove from wishlist") : L("찜하기", "Add to wishlist")}
                onClick={handleToggleWishlist}
              >
                <Heart className={`h-4 w-4 ${isWishlisted ? "fill-wishlist text-wishlist" : ""}`} />
              </Button>
            </div>
            <Button
              size="lg"
              className="w-full sm:flex-1"
              disabled={!inStock}
              onClick={handleAddToCart}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {inStock ? L("장바구니 담기", "Add to Cart") : L("품절", "Out of Stock")}
            </Button>
            {canTryOn && (
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:flex-1"
                onClick={handleTryOn}
              >
                <Shirt className="mr-2 h-4 w-4" />
                {L("입어 보기", "Try on")}
              </Button>
            )}
          </div>

          {!inStock && (
            <p className="mt-2 text-sm text-destructive">
              {L("지금은 품절된 상품이에요.", "This item is currently out of stock.")}
            </p>
          )}

          <Separator className="my-6" />

          <TrustSignals />
        </div>
      </div>

      {/* Full HTML description (below gallery/add-to-cart) */}
      {product.body && (
        <section className="mt-16 border-t pt-12">
          <div className="mx-auto max-w-3xl">
            <div
              className="blog-body"
              dangerouslySetInnerHTML={{ __html: product.body }}
            />
          </div>
        </section>
      )}

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">
            {L("함께 보면 좋은 상품", "You may also like")}
          </h2>
          <div className="mt-6">
            <ProductGrid products={relatedProducts} />
          </div>
        </section>
      )}

      {/* Recently viewed */}
      <RecentlyViewed excludeProductId={product.id} />
    </div>
  )
}
