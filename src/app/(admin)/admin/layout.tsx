"use client"

import Link from "next/link"
import { LayoutDashboard, Package, Users, RefreshCw, Shirt, LogOut } from "lucide-react"

// 접근 확인은 서버(src/middleware.ts)가 서명 쿠키로 합니다.
// 쿠키가 없거나 위조되면 이 화면까지 오지 못하고 /admin-login 으로 보내집니다.

const adminNav = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Orders", href: "/admin/orders", icon: Package },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "R2 동기화", href: "/admin/sync", icon: RefreshCw },
  { name: "3D 굽기", href: "/admin/bake", icon: Shirt },
  { name: "Customers", href: "/admin/customers", icon: Users },
]

async function logout() {
  try {
    await fetch("/api/admin/logout", { method: "POST" })
  } finally {
    window.location.href = "/admin-login"
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-neutral-50 lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/admin" className="text-lg font-semibold">Admin</Link>
        </div>
        <nav className="space-y-1 p-4">
          {adminNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
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
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  )
}
