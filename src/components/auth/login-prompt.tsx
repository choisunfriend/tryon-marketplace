"use client"

// ============================================================================
// (2026-11-28) 로그인 창 — 예약하기·구매하기·내 계정을 눌렀는데 로그인이 안 돼 있으면 뜸
//   const requireLogin = useRequireLogin()
//   requireLogin(() => openBooking())   // 로그인돼 있으면 바로, 아니면 로그인 창 → 로그인 끝나면 이어서
// 로그인 자체는 앱이 합니다(애플 로그인). 앱 밖(웹)에서는 "앱에서 로그인" 안내만 보입니다.
// ============================================================================

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { create } from "zustand"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useL } from "@/i18n/use-l"
import { inNativeApp, listenForAppHello } from "@/lib/app-bridge"
import { useCustomer, wireCustomerBridge } from "@/store/customer"
import { CONSENT_ITEMS, type ConsentId, savePendingConsent, takePendingConsent } from "@/lib/consent"
import { POLICIES } from "@/lib/policy-text"
import { PolicyBody } from "@/components/policies/policy-body"

const EMPTY = Object.fromEntries(CONSENT_ITEMS.map((i) => [i.id, false])) as Record<ConsentId, boolean>

interface PromptState {
  open: boolean
  reason: string | null
  then: (() => void) | null
  show: (reason: string | null, then: (() => void) | null) => void
  close: () => void
}

export const useLoginPrompt = create<PromptState>()((set) => ({
  open: false,
  reason: null,
  then: null,
  show: (reason, then) => set({ open: true, reason, then }),
  close: () => set({ open: false, then: null, reason: null }),
}))

export function useRequireLogin() {
  const me = useCustomer((s) => s.me)
  const show = useLoginPrompt((s) => s.show)
  return (then?: () => void, reason?: string) => {
    if (me?.kind === "member") then?.()
    else show(reason ?? null, then ?? null)
  }
}

export function LoginPrompt() {
  const { L, lang } = useL()
  const { open, reason, then, close } = useLoginPrompt()
  const me = useCustomer((s) => s.me)
  const loggingIn = useCustomer((s) => s.loggingIn)
  const error = useCustomer((s) => s.error)
  const login = useCustomer((s) => s.login)
  const api = useCustomer((s) => s.api)

  const [checks, setChecks] = useState(EMPTY)
  const [viewing, setViewing] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const allOn = CONSENT_ITEMS.every((i) => checks[i.id])
  const requiredOk = CONSENT_ITEMS.every((i) => !i.required || checks[i.id])

  const startLogin = () => {
    setTried(true)
    if (!requiredOk) return
    savePendingConsent(checks)
    login("apple")
  }

  useEffect(() => {
    const off1 = listenForAppHello()
    const off2 = wireCustomerBridge()
    return () => { off1(); off2() }
  }, [])

  // 로그인이 끝나면 창을 닫고 누르려던 동작을 이어서
  // 로그인 끝 → 체크해 둔 동의를 서버에 기록
  useEffect(() => {
    if (me?.kind !== "member") return
    const p = takePendingConsent()
    if (p) void api("/api/customer/consents", { method: "POST", body: JSON.stringify({ ...p, lang }) })
  }, [me, api, lang])

  useEffect(() => {
    if (open && me?.kind === "member") {
      const t = then
      close()
      t?.()
    }
  }, [open, me, then, close])

  const native = typeof window !== "undefined" && inNativeApp()

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{L("로그인", "Sign in")}</DialogTitle>
          <DialogDescription>
            {reason ?? L("예약·구매 내역을 기기를 바꿔도 이어서 볼 수 있어요.", "Keep your bookings and orders across devices.")}
          </DialogDescription>
        </DialogHeader>
        {native ? (
          <div className="space-y-3">
            {/* 약관 동의 — 모두 동의 + 항목별 [필수]/[선택] + ">" 전문 보기 */}
            <div className="rounded-md border">
              <label className="flex cursor-pointer items-start gap-2 border-b p-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-black" checked={allOn}
                  onChange={(e) => setChecks(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.id, e.target.checked])) as Record<ConsentId, boolean>)} />
                <span>
                  <span className="block text-sm font-semibold">{L("모두 동의합니다", "Agree to all")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {L("필수 및 선택(혜택 알림) 항목에 모두 동의합니다. 선택 항목은 동의하지 않아도 이용할 수 있어요.", "Includes required and optional (offers) items. You can use the service without the optional ones.")}
                  </span>
                </span>
              </label>
              <ul className="space-y-1 p-2">
                {CONSENT_ITEMS.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 px-1">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 py-1 text-sm">
                      <input type="checkbox" className="size-4 accent-black" checked={checks[it.id]}
                        onChange={(e) => setChecks({ ...checks, [it.id]: e.target.checked })} />
                      <span>
                        <span className={it.required ? "text-foreground" : "text-muted-foreground"}>
                          [{it.required ? L("필수", "Required") : L("선택", "Optional")}]
                        </span>{" "}
                        {L(...it.label)}
                      </span>
                    </label>
                    {it.doc && (
                      <button type="button" aria-label={L("내용 보기", "View")} className="p-1 text-muted-foreground"
                        onClick={() => setViewing(it.doc!)}>
                        <ChevronRight className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {tried && !requiredOk && (
              <p className="text-xs text-destructive">{L("필수 항목에 모두 동의해 주세요.", "Please accept all required items.")}</p>
            )}
            <Button
              className="h-11 w-full bg-black text-white hover:bg-black/90"
              disabled={loggingIn}
              onClick={startLogin}
            >
              <span aria-hidden className="mr-2 text-lg leading-none"></span>
              {loggingIn ? L("로그인 중…", "Signing in…") : L("동의하고 Apple로 계속하기", "Agree and continue with Apple")}
            </Button>
            {error && error !== "cancelled" && (
              <p className="text-sm text-destructive">{L("로그인하지 못했어요. 다시 시도해 주세요.", "Couldn't sign in. Please try again.")}</p>
            )}
            <p className="text-xs text-muted-foreground">
              <Link className="underline" href="/policies/privacy">{L("개인정보처리방침", "Privacy Policy")}</Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {L("로그인은 Today's Stylepeek 앱에서 할 수 있어요. 앱을 설치한 뒤 다시 시도해 주세요.", "Sign-in is available in the Today's Stylepeek app. Please try again in the app.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null) }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{viewing ? L(...POLICIES[viewing].title) : ""}</DialogTitle>
          <DialogDescription className="sr-only">{L("약관 내용", "Terms text")}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">{viewing && <PolicyBody doc={viewing} compact />}</div>
        <Button variant="outline" onClick={() => setViewing(null)}>{L("확인", "OK")}</Button>
      </DialogContent>
    </Dialog>
    </>
  )
}
