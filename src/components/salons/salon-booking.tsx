"use client"

// ============================================================================
// (2026-11-28) 미용실 스케줄표(손님용) + 예약하기
//   · 날짜를 고르면 30분 칸마다 "예약됨 / 가능"만 보임 — 누가 예약했는지는 안 보임
//   · 빈 칸을 누르면 로그인 확인 → 예약 창(시술·이름·연락처·메모) → 결제 없이 "예약 요청"
//   · 원장은 관리자 화면(/admin/bookings)에서 같은 칸을 예약자 정보와 함께 봄
// 영업시간(hours)은 자유 글이라 칸 범위를 정확히 모릅니다 → 기본 09:00~20:30, 원장이 확인 후 확정
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRequireLogin } from "@/components/auth/login-prompt"
import { useCustomer } from "@/store/customer"
import { useL } from "@/i18n/client"

interface StyleLite {
  id: string
  name: string
  duration_min: number | null
}

const SLOTS: string[] = []
for (let h = 9; h <= 20; h++) for (const m of ["00", "30"]) SLOTS.push(`${String(h).padStart(2, "0")}:${m}`)

function localDate(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function SalonBooking({ salonId, salonName, styles }: { salonId: string; salonName: string; styles: StyleLite[] }) {
  const { L, lang } = useL()
  const requireLogin = useRequireLogin()
  const me = useCustomer((s) => s.me)
  const api = useCustomer((s) => s.api)
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => localDate(i)), [])
  const [date, setDate] = useState(days[0])
  const [taken, setTaken] = useState<string[] | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [styleId, setStyleId] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    fetch(`/api/salons/${encodeURIComponent(salonId)}/schedule?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setTaken(Array.isArray(d.taken) ? d.taken : []) })
      .catch(() => { if (alive) setTaken([]) })
    return () => { alive = false }
  }, [salonId, date, tick])

  // 오늘이면 지난 시각은 막음
  const nowHM = useMemo(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }, [])

  function choose(t: string) {
    requireLogin(() => {
      setName((n) => n || me?.displayName || "")
      setPick(t)
    }, L("예약하려면 로그인해 주세요.", "Please sign in to book."))
  }

  async function submit() {
    if (!pick) return
    setBusy(true)
    const r = await api<{ booking: { date: string; time: string } }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ salonId, styleId: styleId || null, date, time: pick, name, phone, note }),
    })
    setBusy(false)
    if (r.ok) {
      toast.success(L(`${date} ${pick} 예약을 요청했어요. 미용실에서 확인하면 확정돼요.`, `Requested ${date} ${pick}. The salon will confirm it.`))
      setPick(null)
      setNote("")
      load()
    } else {
      toast.error(r.data.error ?? L("예약하지 못했어요", "Couldn't book"))
      if (r.status === 409) load()
    }
  }

  const dayLabel = (d: string) => {
    const dt = new Date(d + "T12:00:00")
    return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric", weekday: "short" }).format(dt)
  }

  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-semibold">{L("예약 스케줄", "Schedule")}</h3>
      <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => { setTaken(null); setDate(d) }}
            className={`shrink-0 rounded-md border px-2 py-1 text-xs ${d === date ? "border-foreground bg-foreground text-background" : "hover:bg-accent"}`}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>
      {taken === null ? (
        <p className="text-xs text-muted-foreground">{L("불러오는 중…", "Loading…")}</p>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {SLOTS.map((t) => {
            const isTaken = taken.includes(t)
            const past = date === days[0] && t <= nowHM
            const off = isTaken || past
            return (
              <button
                key={t}
                disabled={off}
                onClick={() => choose(t)}
                className={`rounded border py-1.5 text-xs ${off ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : "hover:border-foreground"}`}
                aria-label={`${t} ${isTaken ? L("예약됨", "booked") : past ? "" : L("예약 가능", "available")}`}
              >
                {t}
                {isTaken && <span className="block text-[10px] no-underline">{L("예약됨", "Booked")}</span>}
              </button>
            )
          })}
        </div>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{L("결제 없이 예약만 받아요. 미용실 확인 후 확정됩니다.", "No payment needed. The salon confirms your request.")}</p>

      <Dialog open={!!pick} onOpenChange={(o) => { if (!o) setPick(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{L("예약하기", "Book")}</DialogTitle>
            <DialogDescription>{salonName} · {date} {pick}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {styles.length > 0 && (
              <label className="block space-y-1 text-sm">
                <span>{L("시술", "Service")}</span>
                <select className="h-10 w-full rounded-md border bg-background px-2" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                  <option value="">{L("상담 후 결정", "Decide at the salon")}</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.duration_min ? ` (${s.duration_min}${L("분", " min")})` : ""}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span>{L("이름", "Name")}</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{L("연락처", "Phone")}</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" autoComplete="tel" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{L("메모 (선택)", "Note (optional)")}</span>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
            </label>
            <p className="text-[11px] text-muted-foreground">
              {L("이름·연락처는 예약 확인을 위해 이 미용실에만 보여요.", "Your name and phone are shared only with this salon to confirm the booking.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPick(null)}>{L("닫기", "Close")}</Button>
            <Button disabled={busy || !name.trim() || phone.trim().length < 6} onClick={submit}>
              {busy ? L("보내는 중…", "Sending…") : L("예약 요청", "Request booking")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
