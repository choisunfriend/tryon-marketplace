"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ProductCard } from "@/components/products/product-card"
import { useWishlistStore } from "@/store/wishlist"
import type { Product } from "@/types"
import data from "@/data/products.json"
import { useL } from "@/i18n/use-l"

// TODO: 찜 목록은 아직 예전 데모 JSON을 봅니다(Worker 상품 아님). 타입만 맞춰 빌드가 되게 함.
const allProducts = data.products as unknown as Product[]

export default function WishlistPage() {
  const { L } = useL()
  const wishlistItems = useWishlistStore((s) => s.items)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <PageHeader title={L("찜 목록", "Wishlist")} />
      </div>
    )
  }

  const wishlistedProducts = allProducts.filter((p) =>
    wishlistItems.some((w) => w.productId === p.id)
  )

  if (wishlistedProducts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <PageHeader title={L("찜 목록", "Wishlist")} />
        <EmptyState
          icon={Heart}
          title={L("찜한 상품이 없어요", "Your wishlist is empty")}
          description={L("마음에 드는 상품을 저장해 두면 나중에 쉽게 찾을 수 있어요.", "Save products you love to find them easily later.")}
          actionLabel={L("상품 둘러보기", "Browse Products")}
          actionHref="/shop"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        title={L("찜 목록", "Wishlist")}
        description={L(`${wishlistedProducts.length}개`, `${wishlistedProducts.length} ${wishlistedProducts.length === 1 ? "item" : "items"}`)}
      />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {wishlistedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
