"use client"

// (2026-11-28) 로그인 — 애플 로그인(앱이 처리). 로그인되면 내 계정으로.
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCustomer } from "@/store/customer"
import { useLoginPrompt } from "@/components/auth/login-prompt"

export default function LoginPage() {
  const router = useRouter()
  const me = useCustomer((s) => s.me)
  const ready = useCustomer((s) => s.ready)
  const show = useLoginPrompt((s) => s.show)
  useEffect(() => {
    if (!ready) return
    if (me?.kind === "member") router.replace("/account")
    else show(null, () => router.replace("/account"))
  }, [ready, me, show, router])
  return <div className="min-h-[50vh]" />
}
