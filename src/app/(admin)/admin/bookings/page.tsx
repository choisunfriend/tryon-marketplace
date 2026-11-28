"use client"

// ============================================================================
// (2026-11-28) 미용실 원장 — 예약 스케줄표
//   · 날짜별 예약 목록(예약자 이름·연락처·시술·메모) · 확정 / 취소 / 방문 완료 / 노쇼
//   · 손님 지도에는 같은 칸이 "예약됨"으로만 보입니다(예약자 정보는 여기서만)
//   · 1분마다 새로 읽음 — 미용실용 앱의 푸시 알림을 붙이기 전까지 새 예약 확인용
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useL } from "@/i18n/client"

interface Row {
  id: string
  salon_id: string
  salon_name: string
  style_name: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  note: string | null
  date: string
  time: string
  duration_min: number
  status: "requested" | "confirmed" | "cancelled" | "done" | "noshow"
  cancelled_by: string | null
  created_at: string
}

function ymd(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function AdminBookingsPage() {
  const { L } = useL()
  const [from, setFrom] = useState(ymd(0))
  const [days, setDays] = useState(14)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [salon, setSalon] = useState("")

  const to = useMemo(() => {
    const d = new Date(from + "T12:00:00")
    d.setDate(d.getDate() + days - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [from, days])

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/bookings?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (!d.success) throw new Error(d.error)
        setRows(d.bookings)
        setErr(null)
      })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)) })
    const t = setTimeout(load, 60000)
    return () => { alive = false; clearTimeout(t) }
  }, [from, to, tick, load])

  async function setStatus(id: string, status: Row["status"]) {
    const r = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.success) { toast.success(L("바꿨어요", "Updated")); load() }
    else toast.error(d.error ?? L("바꾸지 못했어요", "Couldn't update"))
  }

  const salons = useMemo(() => Array.from(new Map((rows ?? []).map((r) => [r.salon_id, r.salon_name])).entries()), [rows])
  const shown = (rows ?? []).filter((r) => !salon || r.salon_id === salon)
  const byDate = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of shown) m.set(r.date, [...(m.get(r.date) ?? []), r])
    return Array.from(m.entries())
  }, [shown])

  const label: Record<Row["status"], string> = {
    requested: L("확인 대기", "Pending"),
    confirmed: L("확정", "Confirmed"),
    cancelled: L("취소", "Cancelled"),
    done: L("방문 완료", "Completed"),
    noshow: L("노쇼", "No-show"),
  }
  const tone: Record<Row["status"], string> = {
    requested: "bg-amber-100 text-amber-900",
    confirmed: "bg-emerald-100 text-emerald-900",
    cancelled: "bg-neutral-200 text-neutral-600 line-through",
    done: "bg-sky-100 text-sky-900",
    noshow: "bg-rose-100 text-rose-900",
  }
  const pending = (rows ?? []).filter((r) => r.status === "requested").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{L("예약 스케줄", "Bookings")}</h1>
          <p className="text-sm text-muted-foreground">
            {L(`확인 대기 ${pending}건 · 1분마다 새로 읽어요`, `${pending} pending · refreshes every minute`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 rounded-md border bg-background px-2" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2">
            <option value={1}>{L("하루", "1 day")}</option>
            <option value={7}>{L("1주", "1 week")}</option>
            <option value={14}>{L("2주", "2 weeks")}</option>
            <option value={31}>{L("한 달", "1 month")}</option>
          </select>
          {salons.length > 1 && (
            <select value={salon} onChange={(e) => setSalon(e.target.value)} className="h-9 rounded-md border bg-background px-2">
              <option value="">{L("모든 미용실", "All salons")}</option>
              {salons.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={load}>{L("새로고침", "Refresh")}</Button>
        </div>
      </div>

      {err && <p className="rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}
      {rows === null && !err && <p className="text-sm text-muted-foreground">{L("불러오는 중…", "Loading…")}</p>}
      {rows && byDate.length === 0 && <p className="text-sm text-muted-foreground">{L("이 기간에는 예약이 없어요.", "No bookings in this period.")}</p>}

      {byDate.map(([d, list]) => (
        <section key={d} className="space-y-2">
          <h2 className="text-sm font-semibold">{d}</h2>
          <ul className="divide-y rounded-lg border">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {r.time} <span className="text-xs text-muted-foreground">({r.duration_min}{L("분", "min")})</span>
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${tone[r.status]}`}>{label[r.status]}</span>
                  </p>
                  <p className="text-sm">
                    {r.customer_name ?? L("(탈퇴한 고객)", "(deleted user)")}
                    {r.customer_phone && <> · <a className="underline" href={`tel:${r.customer_phone.replace(/[^0-9+]/g, "")}`}>{r.customer_phone}</a></>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {salons.length > 1 ? `${r.salon_name} · ` : ""}{r.style_name ?? L("시술 상담", "Consultation")}
                    {r.customer_email ? ` · ${r.customer_email}` : ""}
                  </p>
                  {r.note && <p className="whitespace-pre-line text-xs">“{r.note}”</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.status === "requested" && <Button size="sm" onClick={() => void setStatus(r.id, "confirmed")}>{L("확정", "Confirm")}</Button>}
                  {(r.status === "requested" || r.status === "confirmed") && (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, "cancelled")}>{L("취소", "Cancel")}</Button>
                  )}
                  {r.status === "confirmed" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, "done")}>{L("방문 완료", "Completed")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void setStatus(r.id, "noshow")}>{L("노쇼", "No-show")}</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
