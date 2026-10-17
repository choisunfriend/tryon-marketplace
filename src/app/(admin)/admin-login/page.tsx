"use client"

import { FormEvent, Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

// 관리자 로그인 — 비밀번호는 서버(/api/admin/login)에서만 확인합니다.

function LoginForm() {
  const params = useSearchParams()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // 로그인 뒤 돌아갈 곳은 /admin 아래로만 (외부 주소로 튕기는 open redirect 방지)
  const nextRaw = params.get("next") ?? "/admin"
  const next = /^\/admin(\/[A-Za-z0-9/_-]*)?$/.test(nextRaw) ? nextRaw : "/admin"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      window.location.href = next
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패")
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">관리자 로그인</h1>
      <input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="관리자 비밀번호"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "확인 중…" : "로그인"}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
