"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-01) 입점사 관리 — 플랫폼 운영자 전용 (middleware 가 다른 역할은 /admin 으로 돌려보냄)
//   · 목록: 상태·상품 수·대표 이메일
//   · 새 입점사 + 대표 계정 만들기
//   · 상태 바꾸기: pending(심사 중) → active(영업) ↔ suspended(정지)
//   · 계정 추가 (owner / staff)
// ============================================================================
/* eslint-disable @next/next/no-html-link-for-pages -- 일반 <a> 이동 */

type StoreItem = {
  id: string
  slug: string
  name: string
  country: string
  currency: string
  review_status: "pending" | "approved" | "rejected"
  review_note: string | null
  applied_at: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  business_info: string | null
  payout_account: string | null
  status: "pending" | "active" | "suspended"
  commission_rate: number
  product_count: number
  owner_emails: string | null
  created_at: string
}

const STATUS_LABEL: Record<StoreItem["status"], { ko: string; en: string }> = {
  pending: { ko: "심사 중", en: "Under review" },
  active: { ko: "영업 중", en: "Active" },
  suspended: { ko: "정지", en: "Suspended" },
}

const input = "w-full rounded-md border px-3 py-2 text-sm"

const BIZ_LABEL: Record<string, { ko: string; en: string }> = {
  legalName: { ko: "상호", en: "Business name" },
  representative: { ko: "대표자", en: "Representative" },
  businessNumber: { ko: "사업자등록번호", en: "Business reg. no." },
  mailOrderNumber: { ko: "통신판매업", en: "Mail-order no." },
  address: { ko: "주소", en: "Address" },
  website: { ko: "웹사이트", en: "Website" },
  bank: { ko: "은행", en: "Bank" },
  holder: { ko: "예금주", en: "Account holder" },
  number: { ko: "계좌", en: "Account" },
}

function kv(json: string | null): [string, string][] {
  if (!json) return []
  try {
    return Object.entries(JSON.parse(json) as Record<string, string>).filter(([, v]) => v)
  } catch {
    return []
  }
}

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
  const { L } = useL()
  const [stores, setStores] = useState<StoreItem[] | null>(null)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ slug: "", name: "", ownerEmail: "", ownerPassword: "" })
  const applications = (stores ?? []).filter((s) => s.review_status === "pending")

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
      setMsg(L(`"${form.name}" 입점사를 만들었습니다. 대표 계정: ${form.ownerEmail}`, `Created store "${form.name}". Owner account: ${form.ownerEmail}`))
      setForm({ slug: "", name: "", ownerEmail: "", ownerPassword: "" })
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(s: StoreItem, status: StoreItem["status"]) {
    if (status === "suspended" && !window.confirm(L(`"${s.name}" 입점사를 정지할까요?\n그 입점사 계정은 바로 관리자 화면을 못 씁니다.`, `Suspend "${s.name}"?\nIts accounts lose access to the admin right away.`))) return
    try {
      await call(`/api/admin/stores/${s.id}`, "PATCH", { status })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function review(s: StoreItem, decision: "approve" | "reject") {
    let note: string | null = null
    if (decision === "reject") {
      note = window.prompt(L(`"${s.name}" 신청을 거절하는 이유 (신청자에게 보입니다)`, `Reason for rejecting "${s.name}" (the applicant will see it)`))
      if (!note) return
    } else if (!window.confirm(L(`"${s.name}" 입점을 승인할까요? 바로 로그인·상품 등록이 가능해집니다.`, `Approve "${s.name}"? They can sign in and add products right away.`))) return
    try {
      await call(`/api/admin/stores/${s.id}/review`, "POST", { decision, note })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function addUser(s: StoreItem) {
    const email = window.prompt(L(`"${s.name}"에 추가할 계정 이메일`, `Email of the account to add to "${s.name}"`))
    if (!email) return
    const password = window.prompt(L("비밀번호 (10자 이상)", "Password (10+ characters)"))
    if (!password) return
    const owner = window.confirm(L("대표(owner) 권한으로 만들까요?\n[취소] 를 누르면 직원(staff)으로 만듭니다.", "Create it with owner permissions?\nPress [Cancel] to create a staff account."))
    try {
      await call(`/api/admin/stores/${s.id}/users`, "POST", { email, password, role: owner ? "owner" : "staff" })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader title={L("입점사", "Stores")} description={L("마켓플레이스에 들어온 스토어와 그 관리 계정", "Stores on the marketplace and their admin accounts")} />

      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <p className="mt-4 text-sm text-muted-foreground">
        {L("입점 신청 주소", "Seller application page")}: <a href="/seller/apply" className="underline">/seller/apply</a> —{" "}
        {L("판매자에게 이 주소를 알려 주세요.", "share this address with sellers.")}
      </p>

      <h2 className="mt-8 font-semibold">
        {L("심사 대기", "Pending review")} {applications.length > 0 && <span className="text-amber-700">({applications.length})</span>}
      </h2>
      {stores !== null && applications.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{L("대기 중인 신청이 없습니다.", "No pending applications.")}</p>}
      <div className="mt-3 space-y-3">
        {applications.map((s) => (
          <div key={s.id} className="rounded-lg border border-amber-300 bg-amber-50/40 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-medium">
                {s.name} <span className="font-mono text-xs text-muted-foreground">/{s.slug}</span>{" "}
                <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs">{s.country} · {s.currency}</span>
              </p>
              <p className="text-xs text-muted-foreground">{s.applied_at ? new Date(s.applied_at).toLocaleString(L("ko-KR", "en-US")) : ""}</p>
            </div>
            <p className="mt-1">
              {s.contact_name} · {s.contact_phone} · {s.contact_email}
            </p>
            <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
              {[...kv(s.business_info), ...kv(s.payout_account)].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{BIZ_LABEL[k] ? L(BIZ_LABEL[k].ko, BIZ_LABEL[k].en) : k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
            {s.country === "KR" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {L(
                  "확인: 국세청 홈택스 사업자 상태 조회 · 공정위 통신판매사업자 조회",
                  "Verify: NTS Hometax business status lookup · FTC mail-order business lookup"
                )}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => review(s, "approve")} className="rounded-md bg-neutral-900 px-3 py-1.5 text-white">
                {L("승인", "Approve")}
              </button>
              <button type="button" onClick={() => review(s, "reject")} className="rounded-md border px-3 py-1.5 text-red-700">
                {L("거절", "Reject")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-semibold">{L("입점사", "Stores")}</h2>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">{L("이름", "Name")}</th>
              <th className="px-4 py-2">slug</th>
              <th className="px-4 py-2">{L("상태", "Status")}</th>
              <th className="px-4 py-2">{L("상품", "Products")}</th>
              <th className="px-4 py-2">{L("대표 계정", "Owner account")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {stores === null && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  {L("불러오는 중…", "Loading…")}
                </td>
              </tr>
            )}
            {stores?.filter((s) => s.review_status !== "pending").map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.slug} · {s.country}</td>
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
                    {s.review_status === "rejected" ? L("거절됨", "Rejected") : L(STATUS_LABEL[s.status].ko, STATUS_LABEL[s.status].en)}
                  </span>
                  {s.review_status === "rejected" && s.review_note && (
                    <p className="text-xs text-muted-foreground">{s.review_note}</p>
                  )}
                </td>
                <td className="px-4 py-2">{s.product_count}</td>
                <td className="px-4 py-2 text-xs">{s.owner_emails ?? "-"}</td>
                <td className="space-x-2 whitespace-nowrap px-4 py-2 text-right">
                  {s.status !== "active" && (
                    <button type="button" className="underline" onClick={() => setStatus(s, "active")}>
                      {L("승인·재개", "Approve / resume")}
                    </button>
                  )}
                  {s.status === "active" && s.id !== "default" && (
                    <button type="button" className="text-red-700 underline" onClick={() => setStatus(s, "suspended")}>
                      {L("정지", "Suspend")}
                    </button>
                  )}
                  <button type="button" className="underline" onClick={() => addUser(s)}>
                    {L("계정 추가", "Add account")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="mt-8 max-w-lg space-y-3 rounded-lg border p-6">
        <h2 className="font-semibold">{L("입점사 직접 만들기", "Create a store directly")}</h2>
        <p className="text-xs text-muted-foreground">{L("보통은 판매자가 /seller/apply 로 신청합니다. 직접 섭외한 곳만 여기서 만드세요 (한국·바로 영업).", "Sellers normally apply at /seller/apply. Only create stores you recruited directly here (Korea, active right away).")}</p>
        <input
          className={input}
          placeholder={L("입점사 이름 (예: 무드웨어)", "Store name (e.g. Moodwear)")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className={input}
          placeholder={L("slug — 영문 소문자·숫자·- (예: moodwear)", "slug — lowercase letters, numbers, - (e.g. moodwear)")}
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          pattern="(?!.*--)[a-z0-9][a-z0-9\-]{0,28}[a-z0-9]"
          required
        />
        <input
          className={input}
          type="email"
          placeholder={L("대표 이메일 (로그인 아이디)", "Owner email (login ID)")}
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          required
        />
        <input
          className={input}
          type="password"
          autoComplete="new-password"
          placeholder={L("대표 첫 비밀번호 (10자 이상)", "Owner’s first password (10+ characters)")}
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
          {busy ? L("만드는 중…", "Creating…") : L("입점사 만들기", "Create store")}
        </button>
      </form>
    </div>
  )
}
