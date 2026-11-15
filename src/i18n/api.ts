import { loc } from "./l"
import { getLang } from "./server"

// ============================================================================
// (2026-11-14) API 응답 한/영 — export const POST = withLang(async (req) => …)
// ============================================================================
// 라우트·lib 는 오류 문구를 bi("한국어", "English") 로 만든다. 응답이 JSON 이고 그런 문구가
// 들어 있으면, 보내기 직전에 이 요청의 언어(?lang·쿠키·브라우저 언어)만 남긴다.
// JSON.stringify 는 U+E000~E002 를 그대로 두므로 본문 글자에서 바로 바꿀 수 있다.
// ============================================================================

export function withLang<A extends unknown[]>(
  handler: (...args: A) => Response | undefined | Promise<Response | undefined>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const res = await handler(...args)
    if (!res) return res as unknown as Response // 원래 라우트가 돌려준 그대로
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("application/json") || !res.body) return res
    const text = await res.clone().text()
    if (text.indexOf("") < 0) return res
    const headers = new Headers(res.headers)
    headers.delete("content-length")
    return new Response(loc(text, await getLang()), { status: res.status, statusText: res.statusText, headers })
  }
}
