"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { LocationPicker } from "@/components/salons/location-picker"
import { formatMinor, geocode } from "@/lib/map"
import presets from "@/data/hair-presets.json"

// ============================================================================
// (2026-11-01) 미용실 관리 — 입점사(미용실) 계정 · 플랫폼 운영자
//   · 미용실(지점) 등록: 이름·주소·지도 위치·연락처·영업시간·예약 링크
//   · 헤어스타일 등록: GYEOL 스타일 스펙(JSON) — 기본 스타일 6가지에서 시작해 고쳐 쓰기
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
const PRESETS = presets as Record<string, Record<string, unknown> & { name?: string; color?: string }>

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

const firstPreset = Object.keys(PRESETS)[0]
const emptyStyle = {
  name: "",
  gender: "both" as Style["gender"],
  price: "",
  currency: "",
  duration_min: "",
  thumbnail_url: "",
  sort: "0",
  status: "active" as Style["status"],
  spec: JSON.stringify(PRESETS[firstPreset], null, 2),
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
      if (!hit) return setErr("주소를 찾지 못했어요 — 지도에서 직접 찍어 주세요")
      setForm((f) => ({ ...f, lat: hit.lat, lng: hit.lng }))
      setErr(null)
    } catch {
      setErr("주소 검색에 실패했어요")
    }
  }

  async function saveSalon(e: FormEvent) {
    e.preventDefault()
    if (form.lat == null || form.lng == null) return setErr("지도에서 미용실 위치를 찍어 주세요")
    const body: Record<string, unknown> = { ...form }
    if (me?.role !== "platform" || editingId !== "new") delete body.store_id
    try {
      if (editingId === "new") await api("/api/admin/salons", "POST", body)
      else await api(`/api/admin/salons/${editingId}`, "PATCH", body)
      setEditingId(null)
      setMsg("저장했어요")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function removeSalon(s: Salon) {
    if (!confirm(`「${s.name}」과 그 헤어스타일 ${s.style_count}개를 지울까요?`)) return
    try {
      await api(`/api/admin/salons/${s.id}`, "DELETE")
      if (styleSalon?.id === s.id) setStyleSalon(null)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  function startStyle(st: Style | null) {
    setMsg(null)
    if (!st) {
      setStyleEditing("new")
      setSform(emptyStyle)
      return
    }
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
      spec: JSON.stringify(JSON.parse(st.spec), null, 2),
    })
  }

  function specColor(): string {
    try {
      const c = JSON.parse(sform.spec).color
      return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#7a6149"
    } catch {
      return "#7a6149"
    }
  }

  function setSpecColor(c: string) {
    try {
      const o = JSON.parse(sform.spec)
      o.color = c.toUpperCase()
      setSform((f) => ({ ...f, spec: JSON.stringify(o, null, 2) }))
    } catch {
      setErr("스펙 JSON 이 깨져 있어 색을 바꿀 수 없어요")
    }
  }

  async function saveStyle(e: FormEvent) {
    e.preventDefault()
    if (!styleSalon) return
    let spec: unknown
    try {
      spec = JSON.parse(sform.spec)
    } catch {
      return setErr("스펙이 올바른 JSON 이 아닙니다")
    }
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
      spec,
    }
    try {
      if (styleEditing === "new") await api(`/api/admin/salons/${styleSalon.id}/styles`, "POST", body)
      else await api(`/api/admin/salons/${styleSalon.id}/styles/${styleEditing}`, "PATCH", body)
      setStyleEditing(null)
      setMsg("스타일을 저장했어요")
      loadStyles(styleSalon)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function removeStyle(st: Style) {
    if (!styleSalon || !confirm(`「${st.name}」을 지울까요?`)) return
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
      <PageHeader title="미용실" description="지도에 미용실을 올리고, 손님이 GYEOL 에서 3D 로 입어 볼 헤어스타일을 등록합니다." />
      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {/* 미용실 목록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">내 미용실 {salons.length}</h2>
          <button type="button" className="rounded-md bg-black px-3 py-2 text-sm text-white" onClick={() => startEdit(null)}>
            + 미용실 추가
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">이름</th>
                {me?.role === "platform" && <th className="px-3 py-2">입점사</th>}
                <th className="px-3 py-2">주소</th>
                <th className="px-3 py-2">스타일</th>
                <th className="px-3 py-2">상태</th>
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
                  <td className="px-3 py-2">{s.status === "active" ? "지도에 보임" : "숨김"}</td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" className="underline" onClick={() => loadStyles(s)}>헤어스타일</button>
                    <button type="button" className="underline" onClick={() => startEdit(s)}>수정</button>
                    <button type="button" className="text-red-600 underline" onClick={() => removeSalon(s)}>삭제</button>
                  </td>
                </tr>
              ))}
              {!salons.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">아직 미용실이 없어요.</td>
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
            <h2 className="font-semibold">{editingId === "new" ? "새 미용실" : "미용실 수정"}</h2>
            {me?.role === "platform" && editingId === "new" && (
              <label className="block text-sm">
                입점사
                <select className={input} value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} required>
                  <option value="">골라 주세요</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              이름
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
            </label>
            <label className="block text-sm">
              주소
              <div className="flex gap-2">
                <input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
                <button type="button" className="shrink-0 rounded-md border px-3 text-sm" onClick={findAddress}>지도에서 찾기</button>
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                전화
                <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
              </label>
              <label className="block text-sm">
                상태
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "hidden" })}>
                  <option value="active">지도에 보임</option>
                  <option value="hidden">숨김</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              영업시간
              <input className={input} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="화~일 10:00-20:00 · 월 휴무" maxLength={200} />
            </label>
            <label className="block text-sm">
              예약 링크 (https)
              <input className={input} value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} placeholder="https://booking.naver.com/…" />
            </label>
            <label className="block text-sm">
              대표 사진 주소 (https 또는 /api/assets/…)
              <input className={input} value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
            </label>
            <label className="block text-sm">
              소개
              <textarea className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm">위치 — 지도를 누르거나 핀을 끌어 정확히 맞춰 주세요</p>
            <LocationPicker lat={form.lat} lng={form.lng} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
            <p className="text-xs text-muted-foreground">
              {form.lat != null ? `위도 ${form.lat} · 경도 ${form.lng}` : "아직 위치를 고르지 않았어요"}
            </p>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">저장</button>
              <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setEditingId(null)}>취소</button>
            </div>
          </div>
        </form>
      )}

      {/* 헤어스타일 */}
      {styleSalon && (
        <section className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">「{styleSalon.name}」 헤어스타일 {styles.length}</h2>
            <button type="button" className="rounded-md bg-black px-3 py-2 text-sm text-white" onClick={() => startStyle(null)}>
              + 스타일 추가
            </button>
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
                    <b>{st.name}</b> <span className="text-muted-foreground">· {st.gender} · {formatMinor(st.price_minor, st.currency) ?? "가격 문의"}{st.status === "hidden" ? " · 숨김" : ""}</span>
                  </span>
                  <button type="button" className="underline" onClick={() => startStyle(st)}>수정</button>
                  <button type="button" className="text-red-600 underline" onClick={() => removeStyle(st)}>삭제</button>
                </li>
              )
            })}
            {!styles.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">아직 스타일이 없어요.</li>}
          </ul>

          {styleEditing && (
            <form onSubmit={saveStyle} className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm">
                  스타일 이름
                  <input className={input} value={sform.name} onChange={(e) => setSform({ ...sform, name: e.target.value })} maxLength={80} required />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block text-sm">
                    대상
                    <select className={input} value={sform.gender} onChange={(e) => setSform({ ...sform, gender: e.target.value as Style["gender"] })}>
                      <option value="both">공용</option>
                      <option value="female">여성</option>
                      <option value="male">남성</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    가격
                    <input className={input} type="number" min={0} step="any" value={sform.price} onChange={(e) => setSform({ ...sform, price: e.target.value })} placeholder="문의" />
                  </label>
                  <label className="block text-sm">
                    통화
                    <input className={input} value={sform.currency} onChange={(e) => setSform({ ...sform, currency: e.target.value })} placeholder="입점사 기본" maxLength={3} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block text-sm">
                    소요(분)
                    <input className={input} type="number" min={0} value={sform.duration_min} onChange={(e) => setSform({ ...sform, duration_min: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    순서
                    <input className={input} type="number" min={0} value={sform.sort} onChange={(e) => setSform({ ...sform, sort: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    상태
                    <select className={input} value={sform.status} onChange={(e) => setSform({ ...sform, status: e.target.value as Style["status"] })}>
                      <option value="active">보임</option>
                      <option value="hidden">숨김</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  썸네일 주소 (https 또는 /api/assets/…)
                  <input className={input} value={sform.thumbnail_url} onChange={(e) => setSform({ ...sform, thumbnail_url: e.target.value })} />
                </label>
                <label className="flex items-center gap-3 text-sm">
                  머리색
                  <input type="color" value={specColor()} onChange={(e) => setSpecColor(e.target.value)} />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">저장</button>
                  <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => setStyleEditing(null)}>취소</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm">
                  기본 스타일에서 시작
                  <select
                    className={input}
                    defaultValue=""
                    onChange={(e) => {
                      const p = PRESETS[e.target.value]
                      if (p) setSform((f) => ({ ...f, spec: JSON.stringify(p, null, 2), name: f.name || String(p.name ?? "") }))
                    }}
                  >
                    <option value="">— 골라서 스펙 채우기 —</option>
                    {Object.entries(PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{String(p.name ?? k)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  스타일 스펙 (GYEOL JSON — cut · perm · styling · color …)
                  <textarea
                    className={`${input} font-mono text-xs`}
                    rows={18}
                    value={sform.spec}
                    onChange={(e) => setSform({ ...sform, spec: e.target.value })}
                    spellCheck={false}
                  />
                </label>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
