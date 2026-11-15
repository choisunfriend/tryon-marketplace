import { Badge } from "@/components/ui/badge"
import type { OrderStatus } from "@/types"
import { useL } from "@/i18n/use-l"

const statusStyles: Record<OrderStatus, string> = {
  pending: "bg-status-pending-bg text-status-pending-text",
  processing: "bg-status-processing-bg text-status-processing-text",
  shipped: "bg-status-shipped-bg text-status-shipped-text",
  delivered: "bg-status-delivered-bg text-status-delivered-text",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-text",
  refunded: "bg-status-refunded-bg text-status-refunded-text",
}

const statusKo: Record<OrderStatus, string> = {
  pending: "대기",
  processing: "처리 중",
  shipped: "배송 중",
  delivered: "배송 완료",
  cancelled: "취소됨",
  refunded: "환불됨",
}

interface OrderStatusBadgeProps {
  status: OrderStatus
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const { L } = useL()
  return (
    <Badge className={statusStyles[status] ?? ""} variant="secondary">
      {L(statusKo[status] ?? status, status.charAt(0).toUpperCase() + status.slice(1))}
    </Badge>
  )
}
