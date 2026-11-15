"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Package } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useOrdersStore } from "@/store/orders"
import { formatPrice, formatDate } from "@/lib/utils"
import { useL } from "@/i18n/use-l"

export default function OrdersPage() {
  const { L, lang } = useL()
  const { user, isReady } = useAuthGuard()
  const orders = useOrdersStore((s) => s.orders)

  if (!isReady) return null

  const userOrders = user
    ? orders.filter((o) => o.customerEmail === user.email)
    : orders

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        title={L("주문 내역", "Order History")}
        description={
          userOrders.length > 0
            ? L(`주문 ${userOrders.length}건`, `${userOrders.length} ${userOrders.length === 1 ? "order" : "orders"}`)
            : undefined
        }
      />

      {userOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={L("아직 주문이 없어요", "No orders yet")}
          description={L("주문하시면 여기에 나타나요.", "When you place an order, it will appear here.")}
          actionLabel={L("쇼핑 시작하기", "Start Shopping")}
          actionHref="/shop"
        />
      ) : (
        <div className="mt-8 space-y-4">
          {userOrders.map((order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt, lang)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-medium">{formatPrice(order.total)}</span>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {order.items.map((item) => (
                    <span key={item.id} className="mr-3">
                      {item.name} &times; {item.quantity}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
