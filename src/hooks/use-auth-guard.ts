"use client"

// (2026-11-28) 진짜 손님 로그인(useCustomer)으로 — 로그인 안 돼 있으면 로그인 창을 띄우고 첫 화면으로
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCustomer } from "@/store/customer"
import { useLoginPrompt } from "@/components/auth/login-prompt"

export function useAuthGuard() {
  const me = useCustomer((s) => s.me)
  const ready = useCustomer((s) => s.ready)
  const show = useLoginPrompt((s) => s.show)
  const router = useRouter()
  const isAuthenticated = me?.kind === "member"

  useEffect(() => {
    if (ready && !isAuthenticated) {
      show(null, null)
      router.replace("/")
    }
  }, [ready, isAuthenticated, show, router])

  return { me, isAuthenticated, isLoading: !ready, isReady: ready && isAuthenticated }
}
