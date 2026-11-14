"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { formatMinor } from "@/lib/countries"

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

const TYPE_LABEL: Record<string, string> = { sale: "판매", commission: "수수료", refund: "환불", adjustment: "조정" }
const PAYOUT_LABEL: Record<string, string> = { processing: "진행 중", paid: "지급 완료", failed: "실패" }
const PROVIDER_LABEL: Record<string, string> = { manual: "수동 송금", toss: "토스", payoneer: "Payoneer" }

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
    const how = setup?.providerReady ? setup.providerLabel : "수동 송금 (업체 연동 전 — 직접 보낸 뒤 [지급 완료])"
    if (!window.confirm(`${b.store_name}에 ${formatMinor(b.balance_minor, b.currency)} 지급할까요?\n방법: ${how}`)) return
    void act(() => call("/api/admin/settlements/payouts", "POST", { storeId: b.store_id }))
  }

  function mark(p: Payout, status: "paid" | "failed") {
    const ref = status === "paid" ? window.prompt("송금 확인 번호·메모 (선택)") ?? undefined : undefined
    const err = status === "failed" ? window.prompt("실패 사유") ?? "" : undefined
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
      <PageHeader title="정산" description={platform ? "입점사별 미지급 잔액과 지급" : "내 정산 잔액과 지급 내역"} />
      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!d && !error && <p className="mt-6 text-sm text-muted-foreground">불러오는 중…</p>}

      {d && (
        <>
          {/* 정산 받는 방법 */}
          <section className="mt-6">
            <h2 className="font-semibold">정산 방법</h2>
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
                          <span className="text-green-700">연동됨</span>
                        ) : (
                          <span className="text-amber-700">연동 준비 중 — 운영자가 직접 송금</span>
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
            <h2 className="font-semibold">미지급 잔액</h2>
            {d.balances.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">지급할 잔액이 없습니다.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      {platform && <th className={cell}>입점사</th>}
                      <th className={cell}>판매액</th>
                      <th className={cell}>지급할 금액</th>
                      <th className={cell}>장부 줄</th>
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
                              지급
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
            <h2 className="font-semibold">지급 내역</h2>
            {d.payouts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">아직 없습니다.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      <th className={cell}>날짜</th>
                      {platform && <th className={cell}>입점사</th>}
                      <th className={cell}>금액</th>
                      <th className={cell}>방법</th>
                      <th className={cell}>상태</th>
                      {platform && <th className={cell} />}
                    </tr>
                  </thead>
                  <tbody>
                    {d.payouts.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className={cell}>{new Date(p.created_at).toLocaleDateString()}</td>
                        {platform && <td className={cell}>{p.store_name}</td>}
                        <td className={cell}>{formatMinor(p.amount_minor, p.currency)}</td>
                        <td className={cell}>{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                        <td className={cell}>
                          {PAYOUT_LABEL[p.status] ?? p.status}
                          {p.error && <span className="block text-xs text-red-700">{p.error}</span>}
                          {p.provider_ref && <span className="block text-xs text-muted-foreground">{p.provider_ref}</span>}
                        </td>
                        {platform && (
                          <td className={`${cell} space-x-2 whitespace-nowrap text-right`}>
                            {p.status === "processing" && (
                              <>
                                <button type="button" className="underline" onClick={() => mark(p, "paid")}>지급 완료</button>
                                <button type="button" className="text-red-700 underline" onClick={() => mark(p, "failed")}>실패</button>
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
            <h2 className="font-semibold">장부 (최근 100줄)</h2>
            {d.entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                아직 없습니다. 결제가 연동되면 주문마다 판매·수수료가 자동으로 쌓입니다.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-muted-foreground">
                    <tr>
                      <th className={cell}>날짜</th>
                      {platform && <th className={cell}>입점사</th>}
                      <th className={cell}>구분</th>
                      <th className={cell}>금액</th>
                      <th className={cell}>주문 · 메모</th>
                      <th className={cell}>지급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className={cell}>{new Date(e.created_at).toLocaleDateString()}</td>
                        {platform && (
                          <td className={cell}>{d.payoutSetup.find((s) => s.storeId === e.store_id)?.storeName ?? e.store_id}</td>
                        )}
                        <td className={cell}>{TYPE_LABEL[e.type] ?? e.type}</td>
                        <td className={`${cell} ${e.amount_minor < 0 ? "text-red-700" : ""}`}>{formatMinor(e.amount_minor, e.currency)}</td>
                        <td className={`${cell} text-xs`}>
                          {e.order_ref}
                          {e.memo && <span className="block text-muted-foreground">{e.memo}</span>}
                        </td>
                        <td className={`${cell} text-xs`}>{e.payout_id ? "묶임" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {platform && (
            <form onSubmit={addEntry} className="mt-8 max-w-xl space-y-3 rounded-lg border p-5 text-sm">
              <h2 className="font-semibold">장부 수동 기록</h2>
              <p className="text-xs text-muted-foreground">결제 연동 전 테스트나 예외 처리용. 판매를 넣으면 수수료 줄이 자동으로 같이 들어갑니다.</p>
              <select className="w-full rounded-md border px-3 py-2" value={entry.storeId} onChange={(e) => setEntry({ ...entry, storeId: e.target.value })} required>
                <option value="">입점사 선택</option>
                {d.payoutSetup.map((s) => (
                  <option key={s.storeId} value={s.storeId}>{s.storeName} ({s.currency})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select className="rounded-md border px-3 py-2" value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })}>
                  <option value="sale">판매</option>
                  <option value="refund">환불</option>
                  <option value="adjustment">조정(±)</option>
                </select>
                <input className="flex-1 rounded-md border px-3 py-2" type="number" step="any" placeholder="금액 (예: 12000 · 19.99)" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} required />
              </div>
              <input className="w-full rounded-md border px-3 py-2" placeholder="주문번호 (선택)" value={entry.orderRef} onChange={(e) => setEntry({ ...entry, orderRef: e.target.value })} />
              <input className="w-full rounded-md border px-3 py-2" placeholder="메모 (조정은 필수)" value={entry.memo} onChange={(e) => setEntry({ ...entry, memo: e.target.value })} />
              <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-white">기록</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
