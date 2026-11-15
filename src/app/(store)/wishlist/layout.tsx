import type { Metadata } from "next"
import { getL } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("찜 목록", "Wishlist"),
    description: L("저장한 상품.", "Your saved products."),
  }
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children
}
