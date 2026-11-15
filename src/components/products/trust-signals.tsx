import { Truck, RotateCcw, Shield } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { siteConfig } from "@/lib/config"
import { useL } from "@/i18n/use-l"

export function TrustSignals() {
  const { L } = useL()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Truck className="h-4 w-4" />
        <span>{L(`${formatPrice(siteConfig.freeShippingThreshold)} 이상 주문 시 무료 배송`, `Free shipping on orders over ${formatPrice(siteConfig.freeShippingThreshold)}`)}</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <RotateCcw className="h-4 w-4" />
        <span>{L("30일 간편 반품", "30-day hassle-free returns")}</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>{L("안전한 결제", "Secure checkout")}</span>
      </div>
    </div>
  )
}
