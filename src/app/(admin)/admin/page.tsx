"use client"
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination -- (2026-11-01) 관리자 화면은 일반 페이지 이동(<a>·location)을 씀 — layout.tsx 설명 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Archive, Box, FileEdit, Package } from "lucide-react"

// (2026-11-01) 가짜 숫자($12,345 · 156건 등)를 빼고 D1 상품 숫자만 보여 줌.
// 주문·고객은 아직 데모(브라우저 localStorage)라 여기 넣지 않음.

type Row = { id: string | number; name?: string; status?: string; updated_at?: string; created_at?: string; model_path?: string }

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
        setRows(data.products ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const n = (s?: string) => (rows ?? []).filter((p) => (p.status || "active") === s).length
  const stats = [
    { name: "전체 상품", value: rows ? rows.length : "…", icon: Package },
    { name: "판매 중 (active)", value: rows ? n("active") : "…", icon: Box },
    { name: "임시 (draft)", value: rows ? n("draft") : "…", icon: FileEdit },
    { name: "보관 (archived)", value: rows ? n("archived") : "…", icon: Archive },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" description="상품 현황" />

      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>최근 바뀐 상품</CardTitle>
          <a href="/admin/products" className="text-sm underline">
            전체 보기
          </a>
        </CardHeader>
        <CardContent>
          {!rows ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 상품이 없습니다. <a href="/admin/products/new" className="underline">새 상품 등록</a>
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {rows.slice(0, 8).map((p) => (
                <li key={String(p.id)} className="flex items-center justify-between py-2">
                  <a href={`/admin/products/${encodeURIComponent(String(p.id))}`} className="hover:underline">
                    {p.name || "(이름 없음)"}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {p.status || "active"} · {String(p.updated_at ?? p.created_at ?? "").slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
