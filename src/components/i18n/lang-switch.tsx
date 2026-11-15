"use client"

import { setLang, useL } from "@/i18n/client"

// (2026-11-14) EN / 한국어 전환 버튼 — 관리자·입점 신청 화면
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang } = useL()
  const btn = (l: "en" | "ko", label: string) => (
    <button
      type="button"
      onClick={() => l !== lang && setLang(l)}
      aria-pressed={l === lang}
      className={`rounded px-2 py-1 text-xs ${l === lang ? "bg-black text-white" : "text-muted-foreground hover:bg-neutral-100"}`}
    >
      {label}
    </button>
  )
  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role="group" aria-label="Language / 언어">
      {btn("en", "EN")}
      {btn("ko", "한국어")}
    </div>
  )
}
