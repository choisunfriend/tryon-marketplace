"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { formatMinor } from "@/lib/countries"
import { useL } from "@/i18n/client"

// ============================================================================
// (2026-11-01) 정산
//   운영자: 입점사별 미지급 잔액 → [지급] · 진행 중 지급 → [지급 완료]/[실패] · 장부 수동 기록
//   입점사: 내 잔액 · 지급 내역 · 장부 · 정산 받는 방법
// 정산 업체(토스·페이오니아)가 연동 전이면 "수동 송금" — 운영자가 직접 보내고 완료 처리.
// ============================================================================

type Balance = { store_id: string; store_name: string; country: string; currency: string; balance_minor: number; sales_minor: number; entries: number }
type Payout = { id: string; store_id: string; store_name: string; provider: string; amount_minor: number; currency: string; status: string; provider_ref: string | null; error: string | null; created_at: string }
type Entry = { id: string; store_id: string; type: string; amount_minor: number; currency: string; order_ref: string | null; memo: string | null; payout_id: string | null; created_at: string }
type Setup = { storeId: string; storeName: string; country: string; currency: string; provider: string; providerLabel: string; providerReady: boolean; payoutStatus: string }

type KoEn = Record<string, { ko: string; en: string }>
const TYPE_LABEL: KoEn = {
  sale: { ko: "판매", en: "Sale" },
  commission: { ko: "수수료", en: "Commission" },
  refund: { ko: "환불", en: "Refund" },
  adjustment: { ko: "조정", en: "Adjustment" },
}
const PAYOUT_LABEL: KoEn = {
  processing: { ko: "진행 중", en: "Processing" },
  paid: { ko: "지급 완료", en: "Paid" },
  failed: { ko: "실패", en: "Failed" },
}
const PROVIDER_LABEL: KoEn = {
  manual: { ko: "수동 송금", en: "Manual transfer" },
  toss: { ko: "토스", en: "Toss" },
  payoneer: { ko: "Payoneer", en: "Payoneer" },
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

const cell = "px-3 py-2"

export default function SettlementsPage() {
  const { L, lang } = useL()
  const lab = (t: KoEn, k: string) => (t[k] ? L(t[k].ko, t[k].en) : k)
  const date = (v: string) => new Date(v).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")
  const [d, setD] = useState<{ role: string; balances: Balance[]; payouts: Payout[]; entries: Entry[]; payoutSetup: Setup[] } | null>(null)
  const [error, setError] = useState("")
  const [entry, setEntry] = useState({ storeId: "", type: "sale", amount: "", orderRef: "", memo: "" })
  const platform = d?.role === "platform"

  const load = useCallback(async () => {
    try {
      const data = await call("/api/admin/settlements", "GET")
      setD(data)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // 첫 불러오기 — 비동기 결과로만 state 를 바꿈
  useEffect(() => {
    call("/api/admin/settlements", "GET")
      .then(setD)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function pay(b: Balance) {
    const setup = d?.payoutSetup.find((s) => s.storeId === b.store_id)
    const how = setup?.providerReady ? setup.providerLabel : L("수동 송금 (업체 연동 전 — 직접 보낸 뒤 [지급 완료])", "Manual transfer (provider not connected — send it yourself, then [Paid])")
    if (!window.confirm(L(`${b.store_name}에 ${formatMinor(b.balance_minor, b.currency)} 지급할까요?\n방법: ${how}`, `Pay ${formatMinor(b.balance_minor, b.currency)} to ${b.store_name}?\nMethod: ${how}`))) return
    void act(() => call("/api/admin/settlements/payouts", "POST", { storeId: b.store_id }))
  }

  function mark(p: Payout, status: "paid" | "failed") {
    const ref = status === "paid" ? window.prompt(L("송금 확인 번호·메모 (선택)", "Transfer reference / memo (optional)")) ?? undefined : undefined
    const err = status === "failed" ? window.prompt(L("실패 사유", "Reason for failure")) ?? "" : undefined
    if (status === "failed" && !err) return
    void act(() => call(`/api/admin/settlements/payouts/${p.id}`, "PATCH", { status, providerRef: ref || undefined, error: err }))
  }

  function addEntry(e: FormEvent) {
    e.preventDefault()
    void act(async () => {
      await call("/api/admin/settlements/entries", "POST", { ...entry, amount: Number(entry.amount) })
      setEntry({ ...entry, amount: "", orderRef: "", memo: "" })
    })
  }

  return (
    <div>
      <PageHeader title={L("정산", "Settlements")} description={platform ? L("입점사별 미지급 잔액과 지급", "Unpaid balances and payouts by store") : L("내 정산 잔액과 지급 내역", "My balance and payout history")} />
      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!d && !error && <p className="mt-6 text-sm text-muted-foreground">{L("불러오는 중…", "Loading…")}</p>}

      {d && (
        <>
          {/* 정산 받는 방법 */}
          <section className="mt-6">
            <h2 className="font-semibold">{L("정산 방법", "Payout method")}</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {d.payoutSetup.map((s) => (
                    <tr key={s.storeId} className="border-t first:border-t-0">
                      {platform && <td className={cell}>{s.storeName}</td>}
                      <td className={cell}>{s.country} · {s.currency}</td>
                      <td className={cell}>{s.providerLabel}</td>
                      <td className={cell}>
                        {s.providerReady ? (
                          <span className="text-green-700">{L("연동됨", "Connected")}</span>
                        ) : (
                          <span className="text-amber-700">{L("연동 준비 중 — 운영자가 직접 송금", "Not connected yet — the operator sends payouts manually")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 잔액 */}
          <section className="mt-8">
            <h2 className="font-semibold">{L("미지급 잔액", "Unpaid balance")}</h2>
            {d.balances.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{L("지급할 잔액이 없습니다.", "No balance to pay out.")}</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      {platform && <th className={cell}>{L("입점사", "Store")}</th>}
                      <th className={cell}>{L("판매액", "Sales")}</th>
                      <th className={cell}>{L("지급할 금액", "To pay")}</th>
                      <th className={cell}>{L("장부 줄", "Ledger lines")}</th>
                      {platform && <th className={cell} />}
                    </tr>
                  </thead>
                  <tbody>
                    {d.balances.map((b) => (
                      <tr key={b.store_id + b.currency} className="border-t">
                        {platform && <td className={cell}>{b.store_name}</td>}
                        <td className={cell}>{formatMinor(b.sales_minor, b.currency)}</td>
                        <td className={`${cell} font-semibold`}>{formatMinor(b.balance_minor, b.currency)}</td>
                        <td className={cell}>{b.entries}</td>
                        {platform && (
                          <td className={`${cell} text-right`}>
                            <button
                              type="button"
                              disabled={b.balance_minor <= 0}
                              onClick={() => pay(b)}
                              className="rounded-md bg-neutral-900 px-3 py-1 text-white disabled:opacity-40"
                            >
                              {L("지급", "Pay")}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 지급 내역 */}
          <section className="mt-8">
            <h2 className="font-semibold">{L("지급 내역", "Payouts")}</h2>
            {d.payouts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{L("아직 없습니다.", "None yet.")}</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      <th className={cell}>{L("날짜", "Date")}</th>
                      {platform && <th className={cell}>{L("입점사", "Store")}</th>}
                      <th className={cell}>{L("금액", "Amount")}</th>
                      <th className={cell}>{L("방법", "Method")}</th>
                      <th className={cell}>{L("상태", "Status")}</th>
                      {platform && <th className={cell} />}
                    </tr>
                  </thead>
                  <tbody>
                    {d.payouts.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className={cell}>{date(p.created_at)}</td>
                        {platform && <td className={cell}>{p.store_name}</td>}
                        <td className={cell}>{formatMinor(p.amount_minor, p.currency)}</td>
                        <td className={cell}>{lab(PROVIDER_LABEL, p.provider)}</td>
                        <td className={cell}>
                          {lab(PAYOUT_LABEL, p.status)}
                          {p.error && <span className="block text-xs text-red-700">{p.error}</span>}
                          {p.provider_ref && <span className="block text-xs text-muted-foreground">{p.provider_ref}</span>}
                        </td>
                        {platform && (
                          <td className={`${cell} space-x-2 whitespace-nowrap text-right`}>
                            {p.status === "processing" && (
                              <>
                                <button type="button" className="underline" onClick={() => mark(p, "paid")}>{L("지급 완료", "Mark paid")}</button>
                                <button type="button" className="text-red-700 underline" onClick={() => mark(p, "failed")}>{L("실패", "Mark failed")}</button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 장부 */}
          <section className="mt-8">
            <h2 className="font-semibold">{L("장부 (최근 100줄)", "Ledger (last 100 lines)")}</h2>
            {d.entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {L("아직 없습니다. 결제가 연동되면 주문마다 판매·수수료가 자동으로 쌓입니다.", "Nothing yet. Once payments are connected, each order adds sale and commission lines automatically.")}
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      <th className={cell}>{L("날짜", "Date")}</th>
                      {platform && <th className={cell}>{L("입점사", "Store")}</th>}
                      <th className={cell}>{L("구분", "Type")}</th>
                      <th className={cell}>{L("금액", "Amount")}</th>
                      <th className={cell}>{L("주문 · 메모", "Order · memo")}</th>
                      <th className={cell}>{L("지급", "Payout")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className={cell}>{date(e.created_at)}</td>
                        {platform && (
                          <td className={cell}>{d.payoutSetup.find((s) => s.storeId === e.store_id)?.storeName ?? e.store_id}</td>
                        )}
                        <td className={cell}>{lab(TYPE_LABEL, e.type)}</td>
                        <td className={`${cell} ${e.amount_minor < 0 ? "text-red-700" : ""}`}>{formatMinor(e.amount_minor, e.currency)}</td>
                        <td className={`${cell} text-xs`}>
                          {e.order_ref}
                          {e.memo && <span className="block text-muted-foreground">{e.memo}</span>}
                        </td>
                        <td className={`${cell} text-xs`}>{e.payout_id ? L("묶임", "Included") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {platform && (
            <form onSubmit={addEntry} className="mt-8 max-w-xl space-y-3 rounded-lg border p-5 text-sm">
              <h2 className="font-semibold">{L("장부 수동 기록", "Manual ledger entry")}</h2>
              <p className="text-xs text-muted-foreground">{L("결제 연동 전 테스트나 예외 처리용. 판매를 넣으면 수수료 줄이 자동으로 같이 들어갑니다.", "For testing before payments are connected, or for exceptions. Adding a sale also adds its commission line.")}</p>
              <select className="w-full rounded-md border px-3 py-2" value={entry.storeId} onChange={(e) => setEntry({ ...entry, storeId: e.target.value })} required>
                <option value="">{L("입점사 선택", "Choose a store")}</option>
                {d.payoutSetup.map((s) => (
                  <option key={s.storeId} value={s.storeId}>{s.storeName} ({s.currency})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select className="rounded-md border px-3 py-2" value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })}>
                  <option value="sale">{L("판매", "Sale")}</option>
                  <option value="refund">{L("환불", "Refund")}</option>
                  <option value="adjustment">{L("조정(±)", "Adjustment (±)")}</option>
                </select>
                <input className="flex-1 rounded-md border px-3 py-2" type="number" step="any" placeholder={L("금액 (예: 12000 · 19.99)", "Amount (e.g. 12000 · 19.99)")} value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} required />
              </div>
              <input className="w-full rounded-md border px-3 py-2" placeholder={L("주문번호 (선택)", "Order number (optional)")} value={entry.orderRef} onChange={(e) => setEntry({ ...entry, orderRef: e.target.value })} />
              <input className="w-full rounded-md border px-3 py-2" placeholder={L("메모 (조정은 필수)", "Memo (required for adjustments)")} value={entry.memo} onChange={(e) => setEntry({ ...entry, memo: e.target.value })} />
              <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-white">{L("기록", "Record")}</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
