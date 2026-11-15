import type { Metadata } from "next"
import { getL } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("장바구니", "Cart"),
    description: L("장바구니를 확인하세요.", "Review your shopping cart."),
  }
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
