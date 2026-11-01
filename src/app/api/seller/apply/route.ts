import { NextResponse } from "next/server"
import { getProductsDb } from "@/lib/products-db"
import { isSameOriginWrite, MIN_PASSWORD } from "@/lib/security"
import { COUNTRIES } from "@/lib/countries"
import { createApplication, EMAIL_RE, SLUG_RE } from "@/lib/stores-db"

// ============================================================================
// (2026-11-01) 입점 신청 — POST /api/seller/apply (누구나)
// ============================================================================
// 심사 중 입점사 + 대표 계정을 만듭니다. 운영자가 /admin/stores 에서 승인해야 로그인 가능.
// 스팸 막기:
//   · 같은 IP 1시간 5번 (Worker 인스턴스별 보조 수단)
//   · TURNSTILE_SECRET_KEY 가 있으면 Cloudflare Turnstile 토큰 필수
//     (화면 쪽은 NEXT_PUBLIC_TURNSTILE_SITE_KEY — 둘 다 넣어야 켜짐)
// ============================================================================

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, { n: number; at: number }>()

const RESERVED = new Set(["p", "admin", "api", "seller", "shop", "gyeol", "default", "www", "app"])

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } })
}

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

// 한국 사업자등록번호 검증 (10자리 · 체크섬)
function validKrBizNo(raw: string): boolean {
  const d = raw.replace(/-/g, "")
  if (!/^\d{10}$/.test(d)) return false
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i]
  sum += Math.floor((Number(d[8]) * 5) / 10)
  return (10 - (sum % 10)) % 10 === Number(d[9])
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const data = (await res.json()) as { success?: boolean }
    return !!data.success
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return fail("허용되지 않은 요청 출처입니다", 403)

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown"
  const now = Date.now()
  const h = hits.get(ip)
  const cur = h && now - h.at < WINDOW_MS ? h : { n: 0, at: now }
  if (cur.n >= MAX_PER_WINDOW) return fail("신청이 너무 많습니다. 잠시 뒤 다시 해 주세요", 429)
  hits.set(ip, { n: cur.n + 1, at: cur.at })

  let b: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > 16 * 1024) return fail("요청이 너무 큽니다", 413)
    b = JSON.parse(text)
  } catch {
    return fail("JSON 형식이 아닙니다")
  }

  if (!(await verifyTurnstile(str(b.turnstileToken, 4096), ip))) return fail("자동 입력 방지 확인에 실패했습니다", 400)

  const country = str(b.country, 2).toUpperCase()
  if (!COUNTRIES[country]) return fail("입점 가능한 나라가 아닙니다")

  const slug = str(b.slug, 30).toLowerCase()
  const name = str(b.name, 80)
  const contactName = str(b.contactName, 80)
  const contactPhone = str(b.contactPhone, 30)
  const email = str(b.email, 254)
  const password = typeof b.password === "string" ? b.password : ""

  if (!name) return fail("상호(스토어 이름)를 넣어 주세요")
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return fail("스토어 주소는 영문 소문자·숫자·- 2~30자로 넣어 주세요 ('--' 불가)")
  if (!contactName) return fail("담당자 이름을 넣어 주세요")
  if (!/^[+0-9 ()-]{7,30}$/.test(contactPhone)) return fail("연락처가 올바르지 않습니다")
  if (!EMAIL_RE.test(email)) return fail("이메일이 올바르지 않습니다")
  if (password.length < MIN_PASSWORD || password.length > 256) return fail(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`)

  const bi = (b.business && typeof b.business === "object" ? b.business : {}) as Record<string, unknown>
  const pa = (b.payoutAccount && typeof b.payoutAccount === "object" ? b.payoutAccount : {}) as Record<string, unknown>
  let business: Record<string, string>
  let payoutAccount: Record<string, string> | null = null

  if (country === "KR") {
    business = {
      legalName: str(bi.legalName, 120),
      representative: str(bi.representative, 80),
      businessNumber: str(bi.businessNumber, 20).replace(/-/g, ""),
      mailOrderNumber: str(bi.mailOrderNumber, 60),
      address: str(bi.address, 300),
    }
    if (!business.legalName || !business.representative || !business.address) return fail("사업자 정보(상호·대표자·주소)를 모두 넣어 주세요")
    if (!validKrBizNo(business.businessNumber)) return fail("사업자등록번호가 올바르지 않습니다")
    if (!business.mailOrderNumber) return fail("통신판매업 신고번호를 넣어 주세요")
    payoutAccount = {
      bank: str(pa.bank, 40),
      holder: str(pa.holder, 80),
      number: str(pa.number, 40).replace(/[^0-9]/g, ""),
    }
    if (!payoutAccount.bank || !payoutAccount.holder || !/^\d{8,20}$/.test(payoutAccount.number)) {
      return fail("정산 계좌(은행·예금주·계좌번호)를 확인해 주세요")
    }
  } else {
    business = {
      legalName: str(bi.legalName, 120),
      address: str(bi.address, 300),
      website: str(bi.website, 200),
    }
    if (!business.legalName || !business.address) return fail("Legal business name and address are required")
    if (business.website && !/^https?:\/\/[^\s]+$/.test(business.website)) return fail("Website must start with http(s)://")
    // 미국 등 해외 판매자 계좌·세금 정보는 승인 뒤 정산 업체(페이오니아) 가입 과정에서 받음
  }

  const db = await getProductsDb()
  if (!db) return fail("서버 설정 오류(DB)", 503)
  try {
    await createApplication(db, { country, slug, name, contactName, contactPhone, email, password, business, payoutAccount })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "신청하지 못했습니다", 409)
  }
  return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } })
}
