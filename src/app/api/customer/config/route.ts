// GET /api/customer/config — 앱이 어떤 로그인 버튼을 보여 줄지 (켜진 로그인 방식)
//   → { success, providers: { apple: bool, google: bool, kakao: bool } }
import { cjson, preflight } from "@/lib/customer-auth"
import { providerEnabled } from "@/lib/oidc"

export function GET(request: Request) {
  return cjson(request, {
    success: true,
    providers: {
      apple: providerEnabled("apple"),
      google: providerEnabled("google"),
      kakao: providerEnabled("kakao"),
    },
  })
}
export const OPTIONS = (request: Request) => preflight(request)
