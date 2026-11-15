"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Package, MapPin, Settings, Heart, LogOut } from "lucide-react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useAuthStore } from "@/store/auth"
import { useL } from "@/i18n/use-l"

const accountLinks = [
  { name: "Orders", ko: "주문", description: "View your order history and track shipments", descriptionKo: "주문 내역과 배송 상황을 확인하세요", href: "/account/orders", icon: Package },
  { name: "Addresses", ko: "주소", description: "Manage your shipping and billing addresses", descriptionKo: "배송지와 청구지 주소를 관리하세요", href: "/account/addresses", icon: MapPin },
  { name: "Wishlist", ko: "찜 목록", description: "Products you've saved for later", descriptionKo: "나중에 보려고 저장한 상품", href: "/wishlist", icon: Heart },
  { name: "Settings", ko: "설정", description: "Update your profile and preferences", descriptionKo: "프로필과 환경 설정을 바꾸세요", href: "/account/settings", icon: Settings },
]

export default function AccountPage() {
  const { L } = useL()
  const { user, isReady } = useAuthGuard()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()

  if (!isReady) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader title={L("내 계정", "My Account")} description={L(`${user?.firstName}님, 다시 오신 걸 환영해요!`, `Welcome back, ${user?.firstName}!`)}>
        <Button variant="outline" onClick={() => { logout(); router.push("/") }}>
          <LogOut className="mr-2 h-4 w-4" />
          {L("로그아웃", "Sign Out")}
        </Button>
      </PageHeader>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {accountLinks.map((item) => (
          <Link key={item.name} href={item.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  {L(item.ko, item.name)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{L(item.descriptionKo, item.description)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
