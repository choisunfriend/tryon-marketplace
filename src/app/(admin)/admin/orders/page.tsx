import { Package } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { getL } from "@/i18n/server"

export default async function AdminOrdersPage() {
  const { L } = await getL()
  return (
    <div>
      <PageHeader title={L("주문", "Orders")} description={L("손님 주문을 관리하고 확인합니다.", "Manage and track customer orders.")} />
      <EmptyState
        icon={Package}
        title={L("아직 주문이 없습니다", "No orders yet")}
        description={L("손님이 구매하면 여기에 주문이 나타납니다.", "Orders will appear here once customers start purchasing.")}
      />
    </div>
  )
}
