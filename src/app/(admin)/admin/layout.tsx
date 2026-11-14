"use client"
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination -- (2026-11-01) 관리자 화면은 일반 페이지 이동(<a>·location)을 씀 — layout.tsx 설명 */

import { useEffect, useState } from "react"
import { LayoutDashboard, Package, Users, RefreshCw, LogOut, Store, Wallet, Scissors } from "lucide-react"
import { TranslateGuard } from "@/components/translate-guard"

// (2026-11-01) 메뉴는 Next <Link>(화면 안 이동) 대신 일반 <a>(페이지 새로 열기) — Cloudflare 배포에서 눌러도 반응 없는 문제를 피함.
//   좁은 화면(폰)에서는 왼쪽 메뉴가 숨어 있어 위쪽 가로 메뉴를 따로 둠.
// 접근 확인은 서버(src/middleware.ts)가 서명 쿠키로 합니다.
// 쿠키가 없거나 위조되면 이 화면까지 오지 못하고 /admin-login 으로 보내집니다.

// platform: true → 플랫폼 운영자에게만 보임 (서버 middleware 도 같은 규칙으로 막음)
const adminNav = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "입점사", href: "/admin/stores", icon: Store, platform: true },
  { name: "Orders", href: "/admin/orders", icon: Package },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "정산", href: "/admin/settlements", icon: Wallet },
  { name: "R2 동기화", href: "/admin/sync", icon: RefreshCw, platform: true },
  // (2026-11-14) 「3D 굽기」 메뉴 뺌 — 상품 등록·수정 화면의 3D 칸 옆 「굽기」 버튼으로 옮김 (화면 /admin/bake 은 남아 있음)
  { name: "미용실", href: "/admin/salons", icon: Scissors }, // (2026-11-01) 미용실 지도·헤어스타일
  { name: "Customers", href: "/admin/customers", icon: Users },
]

type Me = { role: "platform" | "owner" | "staff"; store: { name: string } | null }

async function logout() {
  try {
    await fetch("/api/admin/logout", { method: "POST" })
  } finally {
    window.location.href = "/admin-login"
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.success && setMe({ role: d.role, store: d.store }))
      .catch(() => {})
  }, [])
  const nav = adminNav.filter((i) => !i.platform || me?.role === "platform")
  const who = !me ? "" : me.role === "platform" ? "플랫폼 운영자" : `${me.store?.name ?? ""} · ${me.role === "owner" ? "대표" : "직원"}`

  return (
    <div className="flex min-h-screen">
      {/* (2026-11-14) 관리자 화면 글자는 한국어 — lang="ko" 로 알려야 다른 언어 브라우저가 번역을 제안한다 */}
      <TranslateGuard lang="ko" />
      <aside className="hidden w-64 border-r bg-neutral-50 lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <a href="/admin" className="text-lg font-semibold">Admin</a>
        </div>
        {who && <p className="border-b px-6 py-2 text-xs text-muted-foreground">{who}</p>}
        <nav className="space-y-1 p-4">
          {nav.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </a>
          ))}
        </nav>
        <div className="mt-auto border-t p-4">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto border-b bg-neutral-50 px-3 py-2 text-sm lg:hidden">
          {nav.map((item) => (
            <a key={item.name} href={item.href} className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-white">
              {item.name}
            </a>
          ))}
          <button type="button" onClick={logout} className="whitespace-nowrap rounded px-3 py-1.5 text-muted-foreground">
            로그아웃
          </button>
        </nav>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
