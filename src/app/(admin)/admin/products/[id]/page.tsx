"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import ProductForm, { type AdminProduct } from "@/components/admin/product-form"

// (2026-11-01) 상품 수정 — GET /api/admin/products/{id} 로 읽어 폼에 채우고 PUT 으로 저장
export default function AdminEditProductPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id ?? "")
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/admin/products/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
        if (alive) setProduct(data.product)
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [id])

  if (error)
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        <Link href="/admin/products" className="text-sm underline">
          목록으로
        </Link>
      </div>
    )
  if (!product) return <p className="p-6 text-sm text-muted-foreground">불러오는 중…</p>
  return <ProductForm key={String(product.id)} product={product} />
}
