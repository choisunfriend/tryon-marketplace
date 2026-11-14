"use client"
/* eslint-disable @next/next/no-html-link-for-pages -- 일반 <a> 이동 */

import { FormEvent, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"

// ============================================================================
// (2026-11-01) GYEOL 앱 「미용실에 올리기」 받는 화면
// ============================================================================
// 앱이 새 창으로 /admin/salons/upload#d=<base64url JSON { spec, thumb }> 를 엶.
//   · #뒤는 서버로 가지 않음 · 로그인 전이면 /admin-login 을 거쳐 그대로 돌아옴
//   · 읽자마자 주소창에서 #d 를 지움(뒤로 가기·기록에 안 남게)
// 여기서 미용실·이름·가격만 정해 저장 → 썸네일은 R2 에 올리고 스타일은 /api/admin/salons/{id}/styles 로
// ============================================================================

type Salon = { id: string; name: string; store_name: string }
type Payload = { spec: Record<string, unknown> & { name?: string; color?: string }; thumb: string | null }

const input = "w-full rounded-md border px-3 py-2 text-sm"

function readHash(): Payload | null {
  const m = /[#&]d=([A-Za-z0-9_-]+)/.exec(window.location.hash)
  if (!m) return null
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    const d = JSON.parse(json) as Payload
    if (!d || typeof d.spec !== "object" || !d.spec) return null
    if (d.thumb && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.thumb)) d.thumb = null
    return d
  } catch {
    return null
  }
}

function digitsOf(cur: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur || "KRW" }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

async function uploadThumb(dataUrl: string, folderPrefix: string): Promise<string | null> {
  // data: 주소는 CSP(connect-src)에 막히므로 fetch 대신 직접 풀어 씀
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1))
  const blob = new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: "image/jpeg" })
  const fd = new FormData()
  fd.append("file", new File([blob], `style-${Date.now().toString(36)}.jpg`, { type: "image/jpeg" }))
  fd.append("kind", "image")
  fd.append("folder", `${folderPrefix}salon-styles`)
  const r = await fetch("/api/assets/upload", { method: "POST", body: fd })
  const d = await r.json().catch(() => ({}))
  return r.ok && d.success ? (d.url as string) : null
}

export default function SalonStyleUploadPage() {
  const [payload, setPayload] = useState<Payload | null | undefined>(undefined)
  const [salons, setSalons] = useState<Salon[]>([])
  const [folderPrefix, setFolderPrefix] = useState("p-")
  const [form, setForm] = useState({ salonId: "", name: "", gender: "both", price: "", currency: "", duration_min: "" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    const d = readHash()
    if (window.location.hash) history.replaceState(null, "", window.location.pathname)
    void Promise.resolve().then(() => {
      setPayload(d)
      if (d) setForm((f) => ({ ...f, name: String(d.spec.name ?? "").slice(0, 80) }))
    })
    fetch("/api/admin/salons", { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => {
        if (!x.success) throw new Error(x.error)
        setSalons(x.salons)
        if (x.salons.length === 1) setForm((f) => ({ ...f, salonId: x.salons[0].id }))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "미용실 목록을 읽지 못했어요"))
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => x.success && setFolderPrefix(x.folderPrefix))
      .catch(() => {})
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!payload || !form.salonId) return
    setBusy(true)
    setErr(null)
    try {
      let thumbnail_url: string | null = null
      if (payload.thumb) thumbnail_url = await uploadThumb(payload.thumb, folderPrefix).catch(() => null)
      const cur = form.currency.trim().toUpperCase()
      const r = await fetch(`/api/admin/salons/${form.salonId}/styles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          gender: form.gender,
          price_minor: form.price === "" ? null : Math.round(Number(form.price) * 10 ** digitsOf(cur)),
          ...(cur ? { currency: cur } : {}),
          duration_min: form.duration_min === "" ? null : Number(form.duration_min),
          thumbnail_url,
          spec: { ...payload.spec, name: form.name },
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`)
      setDone(salons.find((s) => s.id === form.salonId)?.name ?? "미용실")
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (payload === undefined) return <p className="text-sm text-muted-foreground">불러오는 중…</p>

  if (!payload) {
    return (
      <div className="max-w-xl space-y-3">
        <PageHeader title="스타일 올리기" description="GYEOL 앱에서 머리를 만든 뒤 「미용실에 올리기」를 누르면 이 화면이 열립니다." />
        <p className="text-sm text-muted-foreground">받은 스타일이 없어요. 앱에서 다시 눌러 주세요.</p>
        <a href="/admin/salons" className="text-sm underline">미용실 관리로</a>
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-xl space-y-3">
        <PageHeader title="올렸어요" description={`「${form.name}」이(가) ${done}의 헤어스타일로 지도에 올라갔어요.`} />
        <div className="flex gap-3 text-sm">
          <a href="/admin/salons" className="underline">미용실 관리로</a>
          <button type="button" className="underline" onClick={() => window.close()}>이 창 닫기</button>
        </div>
      </div>
    )
  }

  const color = typeof payload.spec.color === "string" ? payload.spec.color : "#6b5a4a"
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="스타일 올리기" description="GYEOL 에서 만든 머리를 내 미용실 헤어스타일로 등록합니다." />
      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="flex items-center gap-4 rounded-md border p-3">
        {payload.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={payload.thumb} alt="" className="h-24 w-24 rounded object-cover" />
        ) : (
          <span className="h-24 w-24 rounded" style={{ background: color }} />
        )}
        <div className="text-sm text-muted-foreground">
          <p>머리색 <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: color }} /> {color}</p>
          <p>구역 {Object.keys((payload.spec.cut as object) ?? {}).length}개 · 길이는 손님 두상 비율에 맞춰 적용돼요</p>
        </div>
      </div>

      {!salons.length ? (
        <p className="text-sm">
          먼저 <a href="/admin/salons" className="underline">미용실을 등록</a>해 주세요. 등록한 뒤 앱에서 다시 「미용실에 올리기」를 누르면 됩니다.
        </p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm">
            미용실
            <select className={input} value={form.salonId} onChange={(e) => setForm({ ...form, salonId: e.target.value })} required>
              <option value="">골라 주세요</option>
              {salons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.store_name && s.store_name !== s.name ? ` · ${s.store_name}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            스타일 이름
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-sm">
              대상
              <select className={input} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="both">공용</option>
                <option value="female">여성</option>
                <option value="male">남성</option>
              </select>
            </label>
            <label className="block text-sm">
              가격
              <input className={input} type="number" min={0} step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="문의" />
            </label>
            <label className="block text-sm">
              통화
              <input className={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="기본" maxLength={3} />
            </label>
            <label className="block text-sm">
              소요(분)
              <input className={input} type="number" min={0} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            </label>
          </div>
          <button type="submit" disabled={busy} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? "올리는 중…" : "지도에 올리기"}
          </button>
        </form>
      )}
    </div>
  )
}
