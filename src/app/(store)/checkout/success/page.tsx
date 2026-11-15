"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle } from "lucide-react"
import { useOrdersStore } from "@/store/orders"
import { formatPrice, formatDate } from "@/lib/utils"
import { useL } from "@/i18n/use-l"

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const { L, lang } = useL()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const getOrderById = useOrdersStore((s) => s.getOrderById)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{L("불러오는 중...", "Loading...")}</h1>
        </div>
      </div>
    )
  }

  const order = orderId ? getOrderById(orderId) : undefined

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="h-16 w-16 text-success" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          {L("주문해 주셔서 감사합니다!", "Thank you for your order!")}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {L(
            "주문이 확정되었어요. 상품이 출발하면 배송 조회 정보를 이메일로 보내 드려요.",
            "Your order has been confirmed. We’ll send you an email with tracking details once it ships."
          )}
        </p>

        {order && (
          <Card className="mt-8 w-full text-left">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L("주문 번호", "Order number")}</span>
                <span className="font-medium">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L("날짜", "Date")}</span>
                <span>{formatDate(order.createdAt, lang)}</span>
              </div>
              <Separator />
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.name} &times; {item.quantity}
                  </span>
                  <span>{formatPrice(item.total)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L("상품 금액", "Subtotal")}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L("배송비", "Shipping")}</span>
                <span>{order.shipping === 0 ? L("무료", "Free") : formatPrice(order.shipping)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L("세금", "Tax")}</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>{L("합계", "Total")}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex gap-4">
          <Button asChild>
            <Link href="/account/orders">{L("주문 보기", "View Orders")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">{L("계속 쇼핑하기", "Continue Shopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
