import type { Metadata } from "next"
import { getL } from "@/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const { L } = await getL()
  return {
    title: L("결제", "Checkout"),
    robots: { index: false, follow: false },
  }
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}
