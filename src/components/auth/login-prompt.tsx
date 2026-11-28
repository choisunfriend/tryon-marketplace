"use client"

// ============================================================================
// (2026-11-28) 로그인 창 — 예약하기·구매하기·내 계정을 눌렀는데 로그인이 안 돼 있으면 뜸
//   const requireLogin = useRequireLogin()
//   requireLogin(() => openBooking())   // 로그인돼 있으면 바로, 아니면 로그인 창 → 로그인 끝나면 이어서
// 로그인 자체는 앱이 합니다(애플 로그인). 앱 밖(웹)에서는 "앱에서 로그인" 안내만 보입니다.
// ============================================================================

import { useEffect } from "react"
import Link from "next/link"
import { create } from "zustand"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useL } from "@/i18n/use-l"
import { inNativeApp, listenForAppHello } from "@/lib/app-bridge"
import { useCustomer, wireCustomerBridge } from "@/store/customer"

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
  const { L } = useL()
  const { open, reason, then, close } = useLoginPrompt()
  const me = useCustomer((s) => s.me)
  const loggingIn = useCustomer((s) => s.loggingIn)
  const error = useCustomer((s) => s.error)
  const login = useCustomer((s) => s.login)

  useEffect(() => {
    const off1 = listenForAppHello()
    const off2 = wireCustomerBridge()
    return () => { off1(); off2() }
  }, [])

  // 로그인이 끝나면 창을 닫고 누르려던 동작을 이어서
  useEffect(() => {
    if (open && me?.kind === "member") {
      const t = then
      close()
      t?.()
    }
  }, [open, me, then, close])

  const native = typeof window !== "undefined" && inNativeApp()

  return (
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
            <Button
              className="h-11 w-full bg-black text-white hover:bg-black/90"
              disabled={loggingIn}
              onClick={() => login("apple")}
            >
              <span aria-hidden className="mr-2 text-lg leading-none"></span>
              {loggingIn ? L("로그인 중…", "Signing in…") : L("Apple로 계속하기", "Continue with Apple")}
            </Button>
            {error && error !== "cancelled" && (
              <p className="text-sm text-destructive">{L("로그인하지 못했어요. 다시 시도해 주세요.", "Couldn't sign in. Please try again.")}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {L("로그인하면 이용약관과 개인정보처리방침에 동의하게 됩니다.", "By continuing you agree to the Terms and Privacy Policy.")}{" "}
              <Link className="underline" href="/policies/terms">{L("약관", "Terms")}</Link> ·{" "}
              <Link className="underline" href="/policies/privacy">{L("개인정보", "Privacy")}</Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {L("로그인은 Today's Stylepeek 앱에서 할 수 있어요. 앱을 설치한 뒤 다시 시도해 주세요.", "Sign-in is available in the Today's Stylepeek app. Please try again in the app.")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
