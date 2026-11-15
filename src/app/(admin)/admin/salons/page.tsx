"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { LocationPicker } from "@/components/salons/location-picker"
import { formatMinor, geocode } from "@/lib/map"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-01) 미용실 관리 — 입점사(미용실) 계정 · 플랫폼 운영자
//   · 미용실(지점) 등록: 이름·주소·지도 위치·연락처·영업시간·예약 링크
//   · 헤어스타일은 GYEOL 앱의 「미용실에 올리기」로만 추가 (→ /admin/salons/upload)
//     여기서는 이름·가격·대상·순서·숨김만 고침 (스타일 모양은 앱에서 다시 만들어 올림)
//   손님은 매장의 /salons 지도에서 미용실을 찾아 GYEOL 앱으로 3D 로 입어 봅니다.
// ============================================================================

type Salon = {
  id: string
  store_id: string
  store_name: string
  name: string
  lat: number
  lng: number
  address: string | null
  phone: string | null
  hours: string | null
  booking_url: string | null
  description: string | null
  cover_url: string | null
  status: "active" | "hidden"
  style_count: number
}

type Style = {
  id: string
  name: string
  gender: "male" | "female" | "both"
  price_minor: number | null
  currency: string | null
  duration_min: number | null
  thumbnail_url: string | null
  spec: string
  sort: number
  status: "active" | "hidden"
}

type Me = { role: "platform" | "owner" | "staff"; store: { id: string; name: string } | null }

const input = "w-full rounded-md border px-3 py-2 text-sm"

const emptySalon = {
  name: "",
  lat: null as number | null,
  lng: null as number | null,
  address: "",
  phone: "",
  hours: "",
  booking_url: "",
  description: "",
  cover_url: "",
  status: "active" as "active" | "hidden",
  store_id: "",
}

const emptyStyle = {
  name: "",
  gender: "both" as Style["gender"],
  price: "",
  currency: "",
  duration_min: "",
  thumbnail_url: "",
  sort: "0",
  status: "active" as Style["status"],
}

function digitsOf(cur: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur || "KRW" }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
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

export default function AdminSalonsPage() {
  const { L } = useL()
  const genderLabel = (g: string) => (g === "female" ? L("여성", "Women") : g === "male" ? L("남성", "Men") : g === "both" ? L("공용", "Unisex") : g)
  const [me, setMe] = useState<Me | null>(null)
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [salons, setSalons] = useState<Salon[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [form, setForm] = useState(emptySalon)

  const [styleSalon, setStyleSalon] = useState<Salon | null>(null)
  const [styles, setStyles] = useState<Style[]>([])
  const [styleEditing, setStyleEditing] = useState<string | "new" | null>(null)
  const [sform, setSform] = useState(emptyStyle)

  const load = useCallback(async () => {
    try {
      setSalons((await api("/api/admin/salons")).salons)
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
    void Promise.resolve().then(load) // 첫 목록
  }, [load])

  const loadStyles = useCallback(async (salon: Salon) => {
    setStyleSalon(salon)
    setStyleEditing(null)
    try {
      setStyles((await api(`/api/admin/salons/${salon.id}/styles`)).styles)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [])

  function startEdit(s: Salon | null) {
    setMsg(null)
    if (!s) {
      setEditingId("new")
      setForm(emptySalon)
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
      booking_url: s.booking_url ?? "",
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

  async function saveSalon(e: FormEvent) {
    e.preventDefault()
    if (form.lat == null || form.lng == null) return setErr(L("지도에서 미용실 위치를 찍어 주세요", "Pick the salon's location on the map"))
    const body: Record<string, unknown> = { ...form }
    if (me?.role !== "platform" || editingId !== "new") delete body.store_id
    try {
      if (editingId === "new") await api("/api/admin/salons", "POST", body)
      else await api(`/api/admin/salons/${editingId}`, "PATCH", body)
      setEditingId(null)
      setMsg(L("저장했어요", "Saved"))
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function removeSalon(s: Salon) {
    if (!confirm(L(`「${s.name}」과 그 헤어스타일 ${s.style_count}개를 지울까요?`, `Delete “${s.name}” and its ${s.style_count} hairstyles?`))) return
    try {
      await api(`/api/admin/salons/${s.id}`, "DELETE")
      if (styleSalon?.id === s.id) setStyleSalon(null)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  function startStyle(st: Style) {
    setMsg(null)
    const cur = st.currency ?? ""
    setStyleEditing(st.id)
    setSform({
      name: st.name,
      gender: st.gender,
      price: st.price_minor == null ? "" : String(st.price_minor / 10 ** digitsOf(cur)),
      currency: cur,
      duration_min: st.duration_min == null ? "" : String(st.duration_min),
      thumbnail_url: st.thumbnail_url ?? "",
      sort: String(st.sort),
      status: st.status,
    })
  }

  async function saveStyle(e: FormEvent) {
    e.preventDefault()
    if (!styleSalon || !styleEditing) return
    const cur = sform.currency.trim().toUpperCase()
    const body = {
      name: sform.name,
      gender: sform.gender,
      price_minor: sform.price === "" ? null : Math.round(Number(sform.price) * 10 ** digitsOf(cur)),
      ...(cur ? { currency: cur } : {}),
      duration_min: sform.duration_min === "" ? null : Number(sform.duration_min),
      thumbnail_url: sform.thumbnail_url,
      sort: Number(sform.sort) || 0,
      status: sform.status,
    }
    try {
      await api(`/api/admin/salons/${styleSalon.id}/styles/${styleEditing}`, "PATCH", body)
      setStyleEditing(null)
      setMsg(L("스타일을 저장했어요", "Style saved"))
      loadStyles(styleSalon)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function removeStyle(st: Style) {
    if (!styleSalon || !confirm(L(`「${st.name}」을 지울까요?`, `Delete “${st.name}”?`))) return
    try {
      await api(`/api/admin/salons/${styleSalon.id}/styles/${st.id}`, "DELETE")
      loadStyles(styleSalon)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={L("미용실", "Salons")}
        description={L("지도에 미용실을 올리고, 손님이 GYEOL 에서 3D 로 입어 볼 헤어스타일을 등록합니다.", "Put salons on the map and register hairstyles customers can try on in 3D in GYEOL.")}
      />
      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {/* 미용실 목록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{L("내 미용실", "My salons")} {salons.length}</h2>
          <button type="button" className="rounded-md bg-black px-3 py-2 text-sm text-white" onClick={() => startEdit(null)}>
            {L("+ 미용실 추가", "+ Add salon")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">{L("이름", "Name")}</th>
                {me?.role === "platform" && <th className="px-3 py-2">{L("입점사", "Store")}</th>}
                <th className="px-3 py-2">{L("주소", "Address")}</th>
                <th className="px-3 py-2">{L("스타일", "Styles")}</th>
                <th className="px-3 py-2">{L("상태", "Status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {salons.map((s) => (
                <tr key={s.id} className={`border-t ${styleSalon?.id === s.id ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  {me?.role === "platform" && <td className="px-3 py-2">{s.store_name}</td>}
                  <td className="px-3 py-2 text-muted-foreground">{s.address ?? `${s.lat}, ${s.lng}`}</td>
                  <td className="px-3 py-2">{s.style_count}</td>
                  <td className="px-3 py-2">{s.status === "active" ? L("지도에 보임", "On the map") : L("숨김", "Hidden")}</td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" className="underline" onClick={() => loadStyles(s)}>{L("헤어스타일", "Hairstyles")}</button>
                    <button type="button" className="underline" onClick={() => startEdit(s)}>{L("수정", "Edit")}</button>
                    <button type="button" className="text-red-600 underline" onClick={() => removeSalon(s)}>{L("삭제", "Delete")}</button>
                  </td>
                </tr>
              ))}
              {!salons.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{L("아직 미용실이 없어요.", "No salons yet.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 미용실 등록·수정 */}
      {editingId && (
        <form onSubmit={saveSalon} className="grid gap-4 rounded-md border p-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-semibold">{editingId === "new" ? L("새 미용실", "New salon") : L("미용실 수정", "Edit salon")}</h2>
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
              {L("예약 링크 (https)", "Booking link (https)")}
              <input className={input} value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} placeholder="https://booking.naver.com/…" />
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

      {/* 헤어스타일 */}
      {styleSalon && (
        <section className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{L(`「${styleSalon.name}」 헤어스타일`, `“${styleSalon.name}” hairstyles`)} {styles.length}</h2>
            <p className="text-xs text-muted-foreground">{L("스타일 추가는 GYEOL 앱 손질 화면의 「미용실에 올리기」로", "Add styles with “Post to salon” on the GYEOL app’s styling screen")}</p>
          </div>
          <ul className="divide-y rounded-md border">
            {styles.map((st) => {
              let color = "#7a6149"
              try {
                color = JSON.parse(st.spec).color ?? color
              } catch {
                /* 무시 */
              }
              return (
                <li key={st.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="h-8 w-8 shrink-0 rounded" style={{ background: color }} />
                  <span className="flex-1">
                    <b>{st.name}</b> <span className="text-muted-foreground">· {genderLabel(st.gender)} · {formatMinor(st.price_minor, st.currency) ?? L("가격 문의", "Price on request")}
                      {st.status === "hidden" ? L(" · 숨김", " · hidden") : ""}</span>
                  </span>
                  <button type="button" className="underline" onClick={() => startStyle(st)}>{L("수정", "Edit")}</button>
                  <button type="button" className="text-red-600 underline" onClick={() => removeStyle(st)}>{L("삭제", "Delete")}</button>
                </li>
              )
            })}
            {!styles.length && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {L("아직 스타일이 없어요. GYEOL 앱에서 머리를 만든 뒤 「미용실에 올리기」를 눌러 주세요.", "No styles yet. Create a hairstyle in the GYEOL app, then tap “Post to salon”.")}
              </li>
            )}
          </ul>

          {styleEditing && (
            <form onSubmit={saveStyle} className="max-w-xl">
              <div className="space-y-3">
                <label className="block text-sm">
                  {L("스타일 이름", "Style name")}
                  <input className={input} value={sform.name} onChange={(e) => setSform({ ...sform, name: e.target.value })} maxLength={80} required />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block text-sm">
                    {L("대상", "For")}
                    <select className={input} value={sform.gender} onChange={(e) => setSform({ ...sform, gender: e.target.value as Style["gender"] })}>
                      <option value="both">{L("공용", "Unisex")}</option>
                      <option value="female">{L("여성", "Women")}</option>
                      <option value="male">{L("남성", "Men")}</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    {L("가격", "Price")}
                    <input className={input} type="number" min={0} step="any" value={sform.price} onChange={(e) => setSform({ ...sform, price: e.target.value })} placeholder={L("문의", "On request")} />
                  </label>
                  <label className="block text-sm">
                    {L("통화", "Currency")}
                    <input className={input} value={sform.currency} onChange={(e) => setSform({ ...sform, currency: e.target.value })} placeholder={L("입점사 기본", "Store default")} maxLength={3} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block text-sm">
                    {L("소요(분)", "Duration (min)")}
                    <input className={input} type="number" min={0} value={sform.duration_min} onChange={(e) => setSform({ ...sform, duration_min: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    {L("순서", "Order")}
                    <input className={input} type="number" min={0} value={sform.sort} onChange={(e) => setSform({ ...sform, sort: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    {L("상태", "Status")}
                    <select className={input} value={sform.status} onChange={(e) => setSform({ ...sform, status: e.target.value as Style["status"] })}>
                      <option value="active">{L("보임", "Visible")}</option>
                      <option value="hidden">{L("숨김", "Hidden")}</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  {L("썸네일 주소 (https 또는 /api/assets/…)", "Thumbnail URL (https or /api/assets/…)")}
                  <input className={input} value={sform.thumbnail_url} onChange={(e) => setSform({ ...sform, thumbnail_url: e.target.value })} />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">{L("저장", "Save")}</button>
                  <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setStyleEditing(null)}>{L("취소", "Cancel")}</button>
                </div>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
