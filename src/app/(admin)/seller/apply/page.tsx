"use client"
/* eslint-disable @next/next/no-html-link-for-pages -- 관리자·신청 화면은 일반 <a> 이동 */

import { FormEvent, useEffect, useRef, useState } from "react"
import { TranslateGuard } from "@/components/translate-guard"  // (2026-11-14) lang="ko" — 브라우저 번역 제안

// ============================================================================
// (2026-11-01) 입점 신청 — /seller/apply (누구나)
// 나라를 고르면 그 나라에 필요한 항목만 보임. 제출하면 "심사 중"으로 들어가고
// 운영자가 /admin/stores 에서 승인하면 /admin-login 으로 로그인할 수 있음.
// ============================================================================

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => void }
  }
}

const T = {
  KR: {
    title: "입점 신청",
    lead: "신청서를 보내면 심사 뒤 승인 여부를 알려드립니다. 승인되면 아래 이메일과 비밀번호로 판매자 관리 화면에 로그인할 수 있어요.",
    store: "스토어", name: "스토어 이름", slug: "스토어 주소 (영문 소문자·숫자·-)",
    contact: "담당자", contactName: "담당자 이름", phone: "연락처", email: "이메일 (로그인 아이디)", password: "비밀번호 (10자 이상)",
    business: "사업자 정보", submit: "신청하기", sending: "보내는 중…",
    done: "신청이 접수되었습니다. 심사가 끝나면 승인 여부를 확인할 수 있어요 (로그인을 시도하면 상태가 보입니다).",
    login: "판매자 로그인",
  },
  US: {
    title: "Seller application",
    lead: "Submit this form and we will review your application. Once approved, sign in to the seller dashboard with the email and password below.",
    store: "Store", name: "Store name", slug: "Store URL handle (lowercase letters, numbers, -)",
    contact: "Contact", contactName: "Contact name", phone: "Phone", email: "Email (login ID)", password: "Password (10+ characters)",
    business: "Business", submit: "Submit application", sending: "Sending…",
    done: "Application received. Try signing in later to see your review status.",
    login: "Seller sign in",
  },
} as const

const input = "w-full rounded-md border px-3 py-2 text-sm"

export default function SellerApplyPage() {
  const [country, setCountry] = useState<"KR" | "US">("KR")
  const t = T[country]
  const [f, setF] = useState<Record<string, string>>({})
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [token, setToken] = useState("")
  const tsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !tsRef.current) return
    const el = tsRef.current
    const render = () => window.turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, callback: setToken })
    if (window.turnstile) return render()
    const s = document.createElement("script")
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const business =
      country === "KR"
        ? { legalName: f.legalName, representative: f.representative, businessNumber: f.businessNumber, mailOrderNumber: f.mailOrderNumber, address: f.address }
        : { legalName: f.legalName, address: f.address, website: f.website }
    const payoutAccount = country === "KR" ? { bank: f.bank, holder: f.holder, number: f.number } : null
    try {
      const res = await fetch("/api/seller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country, name: f.name, slug: (f.slug ?? "").toLowerCase(), contactName: f.contactName, contactPhone: f.contactPhone,
          email: f.email, password: f.password, business, payoutAccount, turnstileToken: token,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-4">{t.done}</p>
        <a href="/admin-login" className="mt-6 inline-block underline">{t.login}</a>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <TranslateGuard lang="ko" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as "KR" | "US")}
          className="rounded-md border px-2 py-1 text-sm"
          aria-label="Country"
        >
          <option value="KR">🇰🇷 대한민국</option>
          <option value="US">🇺🇸 United States</option>
        </select>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{t.lead}</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-2 font-medium">{t.store}</legend>
          <input className={input} placeholder={t.name} value={f.name ?? ""} onChange={set("name")} required maxLength={80} />
          <input className={input} placeholder={t.slug} value={f.slug ?? ""} onChange={set("slug")} required pattern="(?!.*--)[a-z0-9][a-z0-9\-]{0,28}[a-z0-9]" />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-medium">{t.contact}</legend>
          <input className={input} placeholder={t.contactName} value={f.contactName ?? ""} onChange={set("contactName")} required />
          <input className={input} type="tel" placeholder={t.phone} value={f.contactPhone ?? ""} onChange={set("contactPhone")} required />
          <input className={input} type="email" autoComplete="username" placeholder={t.email} value={f.email ?? ""} onChange={set("email")} required />
          <input className={input} type="password" autoComplete="new-password" placeholder={t.password} value={f.password ?? ""} onChange={set("password")} required minLength={10} />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-medium">{t.business}</legend>
          {country === "KR" ? (
            <>
              <input className={input} placeholder="상호 (사업자등록증 상의 이름)" value={f.legalName ?? ""} onChange={set("legalName")} required />
              <input className={input} placeholder="대표자" value={f.representative ?? ""} onChange={set("representative")} required />
              <input className={input} placeholder="사업자등록번호 (예: 123-45-67890)" value={f.businessNumber ?? ""} onChange={set("businessNumber")} required />
              <input className={input} placeholder="통신판매업 신고번호 (예: 제2026-서울강남-0000호)" value={f.mailOrderNumber ?? ""} onChange={set("mailOrderNumber")} required />
              <input className={input} placeholder="사업장 주소" value={f.address ?? ""} onChange={set("address")} required />
            </>
          ) : (
            <>
              <input className={input} placeholder="Legal business name" value={f.legalName ?? ""} onChange={set("legalName")} required />
              <input className={input} placeholder="Business address" value={f.address ?? ""} onChange={set("address")} required />
              <input className={input} type="url" placeholder="Website (optional)" value={f.website ?? ""} onChange={set("website")} />
            </>
          )}
        </fieldset>

        {country === "KR" ? (
          <fieldset className="space-y-3">
            <legend className="mb-2 font-medium">정산 계좌</legend>
            <input className={input} placeholder="은행" value={f.bank ?? ""} onChange={set("bank")} required />
            <input className={input} placeholder="예금주" value={f.holder ?? ""} onChange={set("holder")} required />
            <input className={input} inputMode="numeric" placeholder="계좌번호 (숫자만)" value={f.number ?? ""} onChange={set("number")} required />
          </fieldset>
        ) : (
          <p className="rounded-md bg-neutral-50 p-3 text-sm text-muted-foreground">
            Payouts are sent through Payoneer. After approval you will get a link to connect your Payoneer account — bank and tax details are collected there.
          </p>
        )}

        {TURNSTILE_SITE_KEY && <div ref={tsRef} />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || (!!TURNSTILE_SITE_KEY && !token)}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? t.sending : t.submit}
        </button>
        <p className="text-center text-sm">
          <a href="/admin-login" className="underline">{t.login}</a>
        </p>
      </form>
    </main>
  )
}
