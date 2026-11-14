import type { D1Database } from "@/lib/products-db"
import { activeProvider, type PayoutStore } from "@/lib/payouts"

// ============================================================================
// (2026-11-01) 정산 장부 · 지급
// ============================================================================
// 금액은 최소 단위 정수(KRW 원 · USD 센트). 판매자 잔액 = 아직 지급 안 된(payout_id 없음) 줄의 합.
//
// 결제 연동 뒤 주문이 결제 완료되면 recordSale 을, 환불되면 recordRefund 를 부르면 됩니다.
// (지금은 정산 화면의 [수동 기록]으로 넣어 볼 수 있음)
// ============================================================================

export type LedgerType = "sale" | "commission" | "refund" | "adjustment"

async function insertEntry(
  db: D1Database,
  e: { storeId: string; type: LedgerType; amountMinor: number; currency: string; orderRef?: string | null; memo?: string | null }
) {
  await db
    .prepare(
      `INSERT INTO ledger_entries (id, store_id, type, amount_minor, currency, order_ref, memo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), e.storeId, e.type, Math.trunc(e.amountMinor), e.currency, e.orderRef ?? null, e.memo ?? null, new Date().toISOString())
    .run()
}

async function storeFinance(db: D1Database, storeId: string) {
  return db
    .prepare(`SELECT id, currency, commission_rate FROM stores WHERE id = ?`)
    .bind(storeId)
    .first<{ id: string; currency: string; commission_rate: number }>()
}

// 판매: +판매액, -수수료 (수수료율은 입점사 commission_rate)
export async function recordSale(db: D1Database, i: { storeId: string; grossMinor: number; orderRef: string; memo?: string }) {
  const s = await storeFinance(db, i.storeId)
  if (!s) throw new Error("입점사가 없습니다")
  if (!Number.isInteger(i.grossMinor) || i.grossMinor <= 0) throw new Error("판매액은 0보다 커야 합니다")
  const fee = Math.round(i.grossMinor * s.commission_rate)
  await insertEntry(db, { storeId: s.id, type: "sale", amountMinor: i.grossMinor, currency: s.currency, orderRef: i.orderRef, memo: i.memo })
  if (fee > 0) {
    await insertEntry(db, {
      storeId: s.id,
      type: "commission",
      amountMinor: -fee,
      currency: s.currency,
      orderRef: i.orderRef,
      memo: `수수료 ${(s.commission_rate * 100).toFixed(1)}%`,
    })
  }
}

// 환불: -환불액, +돌려줄 수수료
export async function recordRefund(db: D1Database, i: { storeId: string; refundMinor: number; orderRef: string; memo?: string }) {
  const s = await storeFinance(db, i.storeId)
  if (!s) throw new Error("입점사가 없습니다")
  if (!Number.isInteger(i.refundMinor) || i.refundMinor <= 0) throw new Error("환불액은 0보다 커야 합니다")
  const fee = Math.round(i.refundMinor * s.commission_rate)
  await insertEntry(db, { storeId: s.id, type: "refund", amountMinor: -i.refundMinor, currency: s.currency, orderRef: i.orderRef, memo: i.memo })
  if (fee > 0) await insertEntry(db, { storeId: s.id, type: "commission", amountMinor: fee, currency: s.currency, orderRef: i.orderRef, memo: "환불 수수료 반환" })
}

export async function recordAdjustment(db: D1Database, i: { storeId: string; amountMinor: number; memo: string }) {
  const s = await storeFinance(db, i.storeId)
  if (!s) throw new Error("입점사가 없습니다")
  if (!Number.isInteger(i.amountMinor) || i.amountMinor === 0) throw new Error("조정액이 올바르지 않습니다")
  await insertEntry(db, { storeId: s.id, type: "adjustment", amountMinor: i.amountMinor, currency: s.currency, memo: i.memo })
}

// 입점사별 미지급 잔액
export async function balances(db: D1Database, storeId?: string | null) {
  const where = storeId ? "WHERE l.payout_id IS NULL AND l.store_id = ?" : "WHERE l.payout_id IS NULL"
  const stmt = db.prepare(
    `SELECT l.store_id, s.name AS store_name, s.country, l.currency,
            SUM(l.amount_minor) AS balance_minor,
            SUM(CASE WHEN l.type = 'sale' THEN l.amount_minor ELSE 0 END) AS sales_minor,
            COUNT(*) AS entries
       FROM ledger_entries l JOIN stores s ON s.id = l.store_id
       ${where}
      GROUP BY l.store_id, l.currency
      ORDER BY balance_minor DESC`
  )
  const r = await (storeId ? stmt.bind(storeId) : stmt).all<{
    store_id: string
    store_name: string
    country: string
    currency: string
    balance_minor: number
    sales_minor: number
    entries: number
  }>()
  return r.results ?? []
}

export async function recentEntries(db: D1Database, storeId: string | null, limit = 100) {
  const stmt = storeId
    ? db.prepare(`SELECT * FROM ledger_entries WHERE store_id = ? ORDER BY created_at DESC LIMIT ?`).bind(storeId, limit)
    : db.prepare(`SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT ?`).bind(limit)
  return (await stmt.all()).results ?? []
}

export async function listPayouts(db: D1Database, storeId: string | null, limit = 100) {
  const sql = `SELECT p.*, s.name AS store_name FROM payouts p JOIN stores s ON s.id = p.store_id
               ${storeId ? "WHERE p.store_id = ?" : ""} ORDER BY p.created_at DESC LIMIT ?`
  const stmt = storeId ? db.prepare(sql).bind(storeId, limit) : db.prepare(sql).bind(limit)
  return (await stmt.all()).results ?? []
}

function parseJson(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "string" || !v) return null
  try {
    const o = JSON.parse(v)
    return o && typeof o === "object" ? o : null
  } catch {
    return null
  }
}

// 지급 만들기: 미지급 줄을 이 지급에 묶고(동시에 두 번 눌러도 한 번만 묶임) 업체로 송금 요청
export async function createPayout(db: D1Database, storeId: string) {
  const s = await db
    .prepare(
      `SELECT id, name, country, currency, contact_email, payout_provider, payout_ref, payout_account, status FROM stores WHERE id = ?`
    )
    .bind(storeId)
    .first<{
      id: string
      name: string
      country: string
      currency: string
      contact_email: string | null
      payout_provider: string | null
      payout_ref: string | null
      payout_account: string | null
      status: string
    }>()
  if (!s) throw new Error("입점사가 없습니다")

  const store: PayoutStore & { payout_provider: string | null } = { ...s, payout_account: parseJson(s.payout_account) }
  const provider = activeProvider(store)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db
    .prepare(`UPDATE ledger_entries SET payout_id = ? WHERE store_id = ? AND currency = ? AND payout_id IS NULL`)
    .bind(id, s.id, s.currency)
    .run()
  const sum = await db
    .prepare(`SELECT COALESCE(SUM(amount_minor), 0) AS total FROM ledger_entries WHERE payout_id = ?`)
    .bind(id)
    .first<{ total: number }>()
  const amount = sum?.total ?? 0
  if (amount <= 0) {
    await db.prepare(`UPDATE ledger_entries SET payout_id = NULL WHERE payout_id = ?`).bind(id).run()
    throw new Error("지급할 잔액이 없습니다")
  }

  await db
    .prepare(
      `INSERT INTO payouts (id, store_id, provider, amount_minor, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`
    )
    .bind(id, s.id, provider.id, amount, s.currency, now, now)
    .run()

  let result
  try {
    result = await provider.send({ id, amountMinor: amount, currency: s.currency, store })
  } catch (e) {
    result = { status: "failed" as const, error: e instanceof Error ? e.message : String(e) }
  }
  await setPayoutStatus(db, id, result.status, {
    providerRef: "providerRef" in result ? result.providerRef : undefined,
    error: "error" in result ? result.error : undefined,
  })
  return { id, provider: provider.id, amountMinor: amount, currency: s.currency, status: result.status }
}

// 지급 상태 바꾸기 — failed 면 묶었던 장부 줄을 풀어 다시 잔액으로 (업체 웹훅·운영자 수동 공용)
export async function setPayoutStatus(
  db: D1Database,
  id: string,
  status: "processing" | "paid" | "failed",
  extra: { providerRef?: string; error?: string } = {}
) {
  const cur = await db.prepare(`SELECT status FROM payouts WHERE id = ?`).bind(id).first<{ status: string }>()
  if (!cur) return false
  if (cur.status === "paid" || cur.status === "failed") throw new Error("이미 끝난 지급입니다")
  await db
    .prepare(
      `UPDATE payouts SET status = ?, provider_ref = COALESCE(?, provider_ref), error = ?, updated_at = ? WHERE id = ?`
    )
    .bind(status, extra.providerRef ?? null, extra.error ?? null, new Date().toISOString(), id)
    .run()
  if (status === "failed") {
    await db.prepare(`UPDATE ledger_entries SET payout_id = NULL WHERE payout_id = ?`).bind(id).run()
  }
  return true
}
