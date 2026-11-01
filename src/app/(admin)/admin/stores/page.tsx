"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"

// ============================================================================
// (2026-11-01) 입점사 관리 — 플랫폼 운영자 전용 (middleware 가 다른 역할은 /admin 으로 돌려보냄)
//   · 목록: 상태·상품 수·대표 이메일
//   · 새 입점사 + 대표 계정 만들기
//   · 상태 바꾸기: pending(심사 중) → active(영업) ↔ suspended(정지)
//   · 계정 추가 (owner / staff)
// ============================================================================

type StoreItem = {
  id: string
  slug: string
  name: string
  status: "pending" | "active" | "suspended"
  commission_rate: number
  product_count: number
  owner_emails: string | null
  created_at: string
}

const STATUS_LABEL: Record<StoreItem["status"], string> = {
  pending: "심사 중",
  active: "영업 중",
  suspended: "정지",
}

const input = "w-full rounded-md border px-3 py-2 text-sm"

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreItem[] | null>(null)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ slug: "", name: "", ownerEmail: "", ownerPassword: "" })

  const load = useCallback(async () => {
    try {
      setStores((await call("/api/admin/stores", "GET")).stores)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg("")
    try {
      await call("/api/admin/stores", "POST", { ...form, status: "active" })
      setMsg(`"${form.name}" 입점사를 만들었습니다. 대표 계정: ${form.ownerEmail}`)
      setForm({ slug: "", name: "", ownerEmail: "", ownerPassword: "" })
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(s: StoreItem, status: StoreItem["status"]) {
    if (status === "suspended" && !window.confirm(`"${s.name}" 입점사를 정지할까요?\n그 입점사 계정은 바로 관리자 화면을 못 씁니다.`)) return
    try {
      await call(`/api/admin/stores/${s.id}`, "PATCH", { status })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function addUser(s: StoreItem) {
    const email = window.prompt(`"${s.name}"에 추가할 계정 이메일`)
    if (!email) return
    const password = window.prompt("비밀번호 (10자 이상)")
    if (!password) return
    const owner = window.confirm("대표(owner) 권한으로 만들까요?\n[취소] 를 누르면 직원(staff)으로 만듭니다.")
    try {
      await call(`/api/admin/stores/${s.id}/users`, "POST", { email, password, role: owner ? "owner" : "staff" })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader title="입점사" description="마켓플레이스에 들어온 스토어와 그 관리 계정" />

      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">slug</th>
              <th className="px-4 py-2">상태</th>
              <th className="px-4 py-2">상품</th>
              <th className="px-4 py-2">대표 계정</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {stores === null && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  불러오는 중…
                </td>
              </tr>
            )}
            {stores?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.slug}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      s.status === "active"
                        ? "text-green-700"
                        : s.status === "pending"
                          ? "text-amber-700"
                          : "text-red-700"
                    }
                  >
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td className="px-4 py-2">{s.product_count}</td>
                <td className="px-4 py-2 text-xs">{s.owner_emails ?? "-"}</td>
                <td className="space-x-2 whitespace-nowrap px-4 py-2 text-right">
                  {s.status !== "active" && (
                    <button type="button" className="underline" onClick={() => setStatus(s, "active")}>
                      승인·재개
                    </button>
                  )}
                  {s.status === "active" && s.id !== "default" && (
                    <button type="button" className="text-red-700 underline" onClick={() => setStatus(s, "suspended")}>
                      정지
                    </button>
                  )}
                  <button type="button" className="underline" onClick={() => addUser(s)}>
                    계정 추가
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="mt-8 max-w-lg space-y-3 rounded-lg border p-6">
        <h2 className="font-semibold">새 입점사</h2>
        <input
          className={input}
          placeholder="입점사 이름 (예: 무드웨어)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className={input}
          placeholder="slug — 영문 소문자·숫자·- (예: moodwear)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          pattern="(?!.*--)[a-z0-9][a-z0-9\-]{0,28}[a-z0-9]"
          required
        />
        <input
          className={input}
          type="email"
          placeholder="대표 이메일 (로그인 아이디)"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          required
        />
        <input
          className={input}
          type="password"
          autoComplete="new-password"
          placeholder="대표 첫 비밀번호 (10자 이상)"
          value={form.ownerPassword}
          onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
          minLength={10}
          required
        />
        {msg && <p className="text-sm">{msg}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "입점사 만들기"}
        </button>
      </form>
    </div>
  )
}
