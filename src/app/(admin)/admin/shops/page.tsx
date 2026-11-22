"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { LocationPicker } from "@/components/salons/location-picker"
import { geocode } from "@/lib/map"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-22) 옷가게 지점 관리 — 미용실 관리(/admin/salons)와 같은 화면
//   · 지점 등록: 이름·주소·지도 위치·연락처·영업시간·매장 링크
//   · 메뉴판은 따로 없음 — 손님 지도(/salons)에서 이 입점사의 상품이 그대로 메뉴판으로 보임
//   · 상품 페이지에는 "매장에서 보기" 작은 지도로 이 지점들이 나옴
// ============================================================================

type Shop = {
  id: string
  store_id: string
  store_name: string
  name: string
  lat: number
  lng: number
  address: string | null
  phone: string | null
  hours: string | null
  link_url: string | null
  description: string | null
  cover_url: string | null
  status: "active" | "hidden"
  product_count: number
}

type Me = { role: "platform" | "owner" | "staff"; store: { id: string; name: string } | null }

const input = "w-full rounded-md border px-3 py-2 text-sm"

const emptyShop = {
  name: "",
  lat: null as number | null,
  lng: null as number | null,
  address: "",
  phone: "",
  hours: "",
  link_url: "",
  description: "",
  cover_url: "",
  status: "active" as "active" | "hidden",
  store_id: "",
}

async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`)
  return d
}

export default function AdminShopsPage() {
  const { L } = useL()
  const [me, setMe] = useState<Me | null>(null)
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [form, setForm] = useState(emptyShop)

  const load = useCallback(async () => {
    try {
      setShops((await api("/api/admin/shops")).shops)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    api("/api/admin/me")
      .then((d) => {
        setMe({ role: d.role, store: d.store })
        if (d.role === "platform") api("/api/admin/stores").then((s) => setStores(s.stores)).catch(() => {})
      })
      .catch(() => {})
    void Promise.resolve().then(load)
  }, [load])

  function startEdit(s: Shop | null) {
    setMsg(null)
    if (!s) {
      setEditingId("new")
      setForm(emptyShop)
      return
    }
    setEditingId(s.id)
    setForm({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      address: s.address ?? "",
      phone: s.phone ?? "",
      hours: s.hours ?? "",
      link_url: s.link_url ?? "",
      description: s.description ?? "",
      cover_url: s.cover_url ?? "",
      status: s.status,
      store_id: s.store_id,
    })
  }

  async function findAddress() {
    if (!form.address.trim()) return
    try {
      const hit = await geocode(form.address)
      if (!hit) return setErr(L("주소를 찾지 못했어요 — 지도에서 직접 찍어 주세요", "Couldn't find that address — pick it on the map"))
      setForm((f) => ({ ...f, lat: hit.lat, lng: hit.lng }))
      setErr(null)
    } catch {
      setErr(L("주소 검색에 실패했어요", "Address search failed"))
    }
  }

  async function saveShop(e: FormEvent) {
    e.preventDefault()
    if (form.lat == null || form.lng == null) return setErr(L("지도에서 매장 위치를 찍어 주세요", "Pick the shop's location on the map"))
    const body: Record<string, unknown> = { ...form }
    if (me?.role !== "platform" || editingId !== "new") delete body.store_id
    try {
      if (editingId === "new") await api("/api/admin/shops", "POST", body)
      else await api(`/api/admin/shops/${editingId}`, "PATCH", body)
      setEditingId(null)
      setMsg(L("저장했어요", "Saved"))
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function removeShop(s: Shop) {
    if (!confirm(L(`「${s.name}」 매장을 지울까요? (상품은 그대로 남아요)`, `Delete the shop “${s.name}”? (Products stay)`))) return
    try {
      await api(`/api/admin/shops/${s.id}`, "DELETE")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={L("옷가게 매장", "Clothing shops")}
        description={L("지도에 오프라인 매장(지점)을 올립니다. 손님 지도에서는 이 입점사의 상품이 메뉴판으로 보이고, 바로 GYEOL 에서 입어 볼 수 있어요.", "Put your physical shops (branches) on the map. On the customer map your store's products show as the menu and can be tried on in GYEOL.")}
      />
      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{L("내 매장", "My shops")} {shops.length}</h2>
          <button type="button" className="rounded-md bg-black px-3 py-2 text-sm text-white" onClick={() => startEdit(null)}>
            {L("+ 매장 추가", "+ Add shop")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">{L("이름", "Name")}</th>
                {me?.role === "platform" && <th className="px-3 py-2">{L("입점사", "Store")}</th>}
                <th className="px-3 py-2">{L("주소", "Address")}</th>
                <th className="px-3 py-2">{L("상품", "Products")}</th>
                <th className="px-3 py-2">{L("상태", "Status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  {me?.role === "platform" && <td className="px-3 py-2">{s.store_name}</td>}
                  <td className="px-3 py-2 text-muted-foreground">{s.address ?? `${s.lat}, ${s.lng}`}</td>
                  <td className="px-3 py-2">{s.product_count}</td>
                  <td className="px-3 py-2">{s.status === "active" ? L("지도에 보임", "On the map") : L("숨김", "Hidden")}</td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <a className="underline" href={`/salons?shop=${s.id}`} target="_blank" rel="noopener noreferrer">{L("지도", "Map")}</a>
                    <button type="button" className="underline" onClick={() => startEdit(s)}>{L("수정", "Edit")}</button>
                    <button type="button" className="text-red-600 underline" onClick={() => removeShop(s)}>{L("삭제", "Delete")}</button>
                  </td>
                </tr>
              ))}
              {!shops.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{L("아직 매장이 없어요.", "No shops yet.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {/* 매장 등록·수정 */}
      {editingId && (
        <form onSubmit={saveShop} className="grid gap-4 rounded-md border p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-semibold">{editingId === "new" ? L("새 매장", "New shop") : L("매장 수정", "Edit shop")}</h2>
            {me?.role === "platform" && editingId === "new" && (
              <label className="block text-sm">
                {L("입점사", "Store")}
                <select className={input} value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} required>
                  <option value="">{L("골라 주세요", "Choose")}</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              {L("이름", "Name")}
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
            </label>
            <label className="block text-sm">
              {L("주소", "Address")}
              <div className="flex gap-2">
                <input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
                <button type="button" className="shrink-0 rounded-md border px-3 text-sm" onClick={findAddress}>{L("지도에서 찾기", "Find on map")}</button>
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                {L("전화", "Phone")}
                <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
              </label>
              <label className="block text-sm">
                {L("상태", "Status")}
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "hidden" })}>
                  <option value="active">{L("지도에 보임", "On the map")}</option>
                  <option value="hidden">{L("숨김", "Hidden")}</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              {L("영업시간", "Hours")}
              <input className={input} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={L("화~일 10:00-20:00 · 월 휴무", "Tue–Sun 10:00-20:00 · closed Mon")} maxLength={200} />
            </label>
            <label className="block text-sm">
              {L("매장 링크 (https · 지도·인스타 등)", "Shop link (https · maps, Instagram …)")}
              <input className={input} value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" />
            </label>
            <label className="block text-sm">
              {L("대표 사진 주소 (https 또는 /api/assets/…)", "Cover photo URL (https or /api/assets/…)")}
              <input className={input} value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
            </label>
            <label className="block text-sm">
              {L("소개", "About")}
              <textarea className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm">{L("위치 — 지도를 누르거나 핀을 끌어 정확히 맞춰 주세요", "Location — tap the map or drag the pin to place it exactly")}</p>
            <LocationPicker lat={form.lat} lng={form.lng} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
            <p className="text-xs text-muted-foreground">
              {form.lat != null ? L(`위도 ${form.lat} · 경도 ${form.lng}`, `Lat ${form.lat} · Lng ${form.lng}`) : L("아직 위치를 고르지 않았어요", "No location chosen yet")}
            </p>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">{L("저장", "Save")}</button>
              <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setEditingId(null)}>{L("취소", "Cancel")}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
