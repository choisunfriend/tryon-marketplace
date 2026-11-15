"use client"

import { formatPrice } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { siteConfig } from "@/lib/config"
import { useL } from "@/i18n/use-l"

interface CartSummaryProps {
  subtotal: number
}

export function CartSummary({ subtotal }: CartSummaryProps) {
  const { L } = useL()
  const shipping = subtotal >= siteConfig.freeShippingThreshold ? 0 : 599
  const tax = Math.round(subtotal * siteConfig.taxRate)
  const total = subtotal + shipping + tax

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{L("상품 금액", "Subtotal")}</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{L("배송비", "Shipping")}</span>
        <span>{shipping === 0 ? L("무료", "Free") : formatPrice(shipping)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{L("예상 세금", "Estimated tax")}</span>
        <span>{formatPrice(tax)}</span>
      </div>
      <Separator />
      <div className="flex justify-between font-medium">
        <span>{L("합계", "Total")}</span>
        <span>{formatPrice(total)}</span>
      </div>
      {subtotal > 0 && subtotal < siteConfig.freeShippingThreshold && (
        <p className="text-xs text-muted-foreground">
          {L(`${formatPrice(siteConfig.freeShippingThreshold - subtotal)} 더 담으면 무료 배송`, `Add ${formatPrice(siteConfig.freeShippingThreshold - subtotal)} more for free shipping`)}
        </p>
      )}
    </div>
  )
}
