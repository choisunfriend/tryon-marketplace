import { Users } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { getL } from "@/i18n/server"

export default async function AdminCustomersPage() {
  const { L } = await getL()
  return (
    <div>
      <PageHeader title={L("고객", "Customers")} description={L("고객 목록을 보고 관리합니다.", "View and manage your customer base.")} />
      <EmptyState
        icon={Users}
        title={L("아직 고객이 없습니다", "No customers yet")}
        description={L("손님이 계정을 만들면 고객 정보가 채워집니다.", "Customer data will populate as users create accounts.")}
      />
    </div>
  )
}
