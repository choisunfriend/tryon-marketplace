"use client"

// ============================================================================
// (2026-11-28) 내 계정 — 정보 · 내 예약(취소) · 로그아웃 · 계정 삭제(탈퇴)
//   앱스토어 규정(5.1.1(v)): 계정을 만들 수 있으면 앱 안에서 삭제할 수 있어야 함
// ============================================================================

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useL } from "@/i18n/use-l"
import { useCustomer } from "@/store/customer"

interface MyBooking {
  id: string
  salon_name: string | null
  salon_address: string | null
  salon_phone: string | null
  style_name: string | null
  date: string
  time: string
  status: "requested" | "confirmed" | "cancelled" | "done" | "noshow"
}

export default function AccountPage() {
  const { L } = useL()
  const router = useRouter()
  const { me, isReady, isLoading } = useAuthGuard()
  const api = useCustomer((s) => s.api)
  const logout = useCustomer((s) => s.logout)
  const deleteAccount = useCustomer((s) => s.deleteAccount)
  const [bookings, setBookings] = useState<MyBooking[] | null>(null)
  const [askDelete, setAskDelete] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!isReady) return
    let alive = true
    api<{ bookings: MyBooking[] }>("/api/bookings").then((r) => { if (alive) setBookings(r.ok ? r.data.bookings : []) })
    return () => { alive = false }
  }, [isReady, api, tick])

  const statusText = (s: MyBooking["status"]) =>
    ({
      requested: L("확인 대기", "Pending"),
      confirmed: L("확정", "Confirmed"),
      cancelled: L("취소됨", "Cancelled"),
      done: L("방문 완료", "Completed"),
      noshow: L("노쇼", "No-show"),
    })[s]

  async function cancel(id: string) {
    const r = await api(`/api/bookings/${id}`, { method: "DELETE" })
    if (r.ok) {
      toast.success(L("예약을 취소했어요", "Booking cancelled"))
      load()
    } else toast.error(r.data.error ?? L("취소하지 못했어요", "Couldn't cancel"))
  }

  async function doDelete() {
    setBusy(true)
    const ok = await deleteAccount()
    setBusy(false)
    if (ok) {
      setAskDelete(false)
      toast.success(L("계정을 삭제했어요", "Your account has been deleted"))
      router.replace("/")
    } else toast.error(L("삭제하지 못했어요. 다시 시도해 주세요", "Couldn't delete. Please try again"))
  }

  if (isLoading || !isReady || !me) return <div className="min-h-[50vh]" />
  const confirmWord = L("삭제", "DELETE")

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">{L("내 계정", "My account")}</h1>
        <p className="text-sm text-muted-foreground">
          {me.displayName || L("이름 없음", "No name")}
          {me.email ? ` · ${me.email}` : ""}
          {me.providers.length ? ` · ${me.providers.map((p) => (p === "apple" ? "Apple" : p === "google" ? "Google" : "Kakao")).join(", ")}` : ""}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{L("내 예약", "My bookings")}</h2>
        {bookings === null ? (
          <p className="text-sm text-muted-foreground">{L("불러오는 중…", "Loading…")}</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L("아직 예약이 없어요. 미용실 지도에서 예약해 보세요.", "No bookings yet. Book from the salon map.")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{b.salon_name ?? L("미용실", "Salon")}</p>
                  <p className="text-sm">{b.date} {b.time}{b.style_name ? ` · ${b.style_name}` : ""}</p>
                  {b.salon_phone && <p className="text-xs text-muted-foreground">{b.salon_phone}</p>}
                  <p className="text-xs text-muted-foreground">{statusText(b.status)}</p>
                </div>
                {(b.status === "requested" || b.status === "confirmed") && (
                  <Button variant="outline" size="sm" onClick={() => cancel(b.id)}>{L("취소", "Cancel")}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <Button variant="outline" onClick={async () => { await logout(); router.replace("/") }}>
          {L("로그아웃", "Sign out")}
        </Button>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setTyped(""); setAskDelete(true) }}>
          {L("계정 삭제", "Delete account")}
        </Button>
      </section>

      <Dialog open={askDelete} onOpenChange={(o) => { if (!o) setAskDelete(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{L("계정을 삭제할까요?", "Delete your account?")}</DialogTitle>
            <DialogDescription>
              {L(
                "계정과 찜 목록, 로그인 연결이 지워지고 앞으로의 예약은 모두 취소됩니다. 되돌릴 수 없어요.",
                "Your account, wishlist and sign-in links will be removed and upcoming bookings cancelled. This can't be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">{L(`확인하려면 "${confirmWord}"를 입력하세요`, `Type "${confirmWord}" to confirm`)}</p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskDelete(false)}>{L("그만두기", "Keep account")}</Button>
            <Button variant="destructive" disabled={busy || typed.trim() !== confirmWord} onClick={doDelete}>
              {busy ? L("삭제 중…", "Deleting…") : L("계정 삭제", "Delete account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
