"use client"
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination -- (2026-11-01) 관리자 화면은 일반 페이지 이동(<a>·location)을 씀 — layout.tsx 설명 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-01) 관리자 상품 목록 — 검색·상태 거르기·수정·삭제·상태 바로 바꾸기
// 데이터: GET /api/admin/products (D1 직접 · draft·archived 포함)
// ============================================================================

type Row = Record<string, unknown> & { id: string | number }

function str(v: unknown): string {
  return v == null ? "" : String(v)
}

// (2026-11-01) 목록 미리보기 — 주소 모양이 정상(/api/assets/… · http(s)://)이고 짧을 때만 그림.
//   data: 로 통째 저장된 큰 그림·이상한 값은 안 그림(폰에서 "페이지 응답 없음" 원인 후보). 끄기: 주소 끝 ?noimg=1 이면 그림 전부 안 씀
function imageOf(p: Row): string {
  const media = p.media as { images?: { url?: string; type?: string }[] } | undefined
  const imgs = media && typeof media === "object" && Array.isArray(media.images) ? media.images : []
  const u = str(p.image_url) || str((imgs.find((i) => i?.type === "main") ?? imgs[0])?.url)
  if (!u || u.length > 600) return ""
  return /^(\/api\/assets\/|https?:\/\/)/.test(u) ? u : ""
}

function money(p: Row): string {
  const n = Number(p.price)
  if (!isFinite(n)) return "-"
  const cur = str(p.currency) || "USD"
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n)
  } catch {
    return `${n} ${cur}`
  }
}

const STATUS = ["active", "draft", "archived"] as const

export default function AdminProductsListPage() {
  const { L } = useL()
  const statusLabel = (s: string) =>
    s === "all" ? L("전체", "All") : s === "active" ? L("판매 중", "Active") : s === "draft" ? L("임시", "Draft") : s === "archived" ? L("보관", "Archived") : s
  const [noImg] = useState(() => typeof window !== "undefined" && /[?&]noimg=1/.test(window.location.search))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [busy, setBusy] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRows(data.products ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return rows.filter((p) => {
      if (status !== "all" && (str(p.status) || "active") !== status) return false
      if (!k) return true
      return [p.name, p.brand, p.product_code, p.category, p.subcategory].some((v) => str(v).toLowerCase().includes(k))
    })
  }, [rows, q, status])

  async function remove(p: Row) {
    if (!window.confirm(L(`"${str(p.name)}" 상품을 삭제할까요?\n(이미지·3D 파일은 R2에 남아 [R2 동기화]에서 다시 등록할 수 있어요)`, `Delete "${str(p.name)}"?\n(Images and 3D files stay in R2 and can be re-added from [R2 sync])`))) return
    const id = String(p.id)
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRows((r) => r.filter((x) => String(x.id) !== id))
    } catch (e) {
      window.alert(L(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`, `Delete failed: ${e instanceof Error ? e.message : String(e)}`))
    } finally {
      setBusy("")
    }
  }

  async function setRowStatus(p: Row, next: string) {
    const id = String(p.id)
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error ?? `HTTP ${res.status}`)
      setRows((r) => r.map((x) => (String(x.id) === id ? { ...x, ...(data.product ?? { status: next }) } : x)))
    } catch (e) {
      window.alert(L(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`, `Status change failed: ${e instanceof Error ? e.message : String(e)}`))
    } finally {
      setBusy("")
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, active: 0, draft: 0, archived: 0 }
    rows.forEach((p) => {
      const s = str(p.status) || "active"
      c[s] = (c[s] ?? 0) + 1
    })
    return c
  }, [rows])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{L("상품", "Products")}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded border px-4 py-2 text-sm">
            {L("새로고침", "Refresh")}
          </button>
          <a href="/admin/products/new" className="rounded bg-black px-4 py-2 text-sm text-white">
            {L("+ 새 상품", "+ New product")}
          </a>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L("이름·브랜드·상품코드·분류 검색", "Search name, brand, product code, category")}
          className="w-full max-w-sm rounded border p-2 text-sm"
        />
        <div className="flex gap-1 text-sm">
          {(["all", ...STATUS] as string[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded px-3 py-1.5 ${status === s ? "bg-black text-white" : "border"}`}
            >
              {statusLabel(s)} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">{L("불러오는 중…", "Loading…")}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{rows.length ? L("조건에 맞는 상품이 없습니다.", "No products match.") : L("등록된 상품이 없습니다.", "No products yet.")}</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="p-3">{L("이미지", "Image")}</th>
                <th className="p-3">{L("이름", "Name")}</th>
                <th className="p-3">{L("분류", "Category")}</th>
                <th className="p-3">{L("가격", "Price")}</th>
                <th className="p-3">{L("상태", "Status")}</th>
                <th className="p-3">3D</th>
                <th className="p-3">{L("수정일", "Updated")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const id = String(p.id)
                const img = noImg ? "" : imageOf(p)
                const has3d = !!(str(p.model_path) || str((p.media as { model_file?: string } | undefined)?.model_file))
                return (
                  <tr key={id} className={`border-t ${busy === id ? "opacity-50" : ""}`}>
                    <td className="p-3">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 rounded object-cover" />
                      ) : (
                        <div className="h-14 w-14 rounded bg-neutral-100" />
                      )}
                    </td>
                    <td className="p-3">
                      <a href={`/admin/products/${encodeURIComponent(id)}`} className="font-medium hover:underline">
                        {str(p.name) || L("(이름 없음)", "(no name)")}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {[str(p.brand), str(p.product_code)].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="p-3">{[str(p.category), str(p.subcategory)].filter(Boolean).join(" / ")}</td>
                    <td className="p-3">{money(p)}</td>
                    <td className="p-3">
                      <select
                        value={str(p.status) || "active"}
                        disabled={busy === id}
                        onChange={(e) => void setRowStatus(p, e.target.value)}
                        className="rounded border p-1"
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">{has3d ? L("있음", "Yes") : "-"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{str(p.updated_at ?? p.created_at).slice(0, 10)}</td>
                    <td className="whitespace-nowrap p-3 text-right">
                      <a href={`/admin/products/${encodeURIComponent(id)}`} className="mr-2 rounded border px-3 py-1">
                        {L("수정", "Edit")}
                      </a>
                      <button
                        type="button"
                        disabled={busy === id}
                        onClick={() => void remove(p)}
                        className="rounded border border-red-300 px-3 py-1 text-red-700"
                      >
                        {L("삭제", "Delete")}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
