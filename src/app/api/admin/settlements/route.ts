import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { balances, listPayouts, recentEntries } from "@/lib/ledger"
import { activeProvider, intendedProvider } from "@/lib/payouts"

// (2026-11-01) 정산 현황 — GET
//   platform: 모든 입점사 잔액·지급·장부 + 입점사별 정산 업체 상태
//   입점사: 자기 것만 (+ 정산 업체 연결 안내)
export async function GET(request: Request) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const { session, db } = g
  const sid = session.role === "platform" ? null : session.sid
  try {
    const storeRows =
      (
        await (sid
          ? db.prepare(`SELECT id, name, country, currency, payout_provider, payout_status, payout_ref FROM stores WHERE id = ?`).bind(sid)
          : db.prepare(`SELECT id, name, country, currency, payout_provider, payout_status, payout_ref FROM stores WHERE review_status = 'approved'`)
        ).all<{ id: string; name: string; country: string; currency: string; payout_provider: string | null; payout_status: string; payout_ref: string | null }>()
      ).results ?? []
    const payoutSetup = storeRows.map((s) => {
      const intended = intendedProvider(s)
      const active = activeProvider({ ...s, contact_email: null, payout_account: null })
      return {
        storeId: s.id,
        storeName: s.name,
        country: s.country,
        currency: s.currency,
        provider: intended.id,
        providerLabel: intended.label,
        providerReady: active.id === intended.id, // false 면 연동 전 → 수동 송금
        payoutStatus: s.payout_status,
      }
    })
    return NextResponse.json(
      {
        success: true,
        role: session.role,
        balances: await balances(db, sid),
        payouts: await listPayouts(db, sid),
        entries: await recentEntries(db, sid),
        payoutSetup,
      },
      { headers: noStore }
    )
  } catch (e) {
    return fail(e instanceof Error ? e.message : "정산 정보를 읽지 못했습니다 — migrations/0002 를 실행했는지 확인하세요", 500)
  }
}
