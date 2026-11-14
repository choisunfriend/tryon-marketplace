import type { PayoutProvider } from "./types"

// 수동 — 운영자가 은행·업체 화면에서 직접 보내고, 정산 화면에서 [지급 완료]를 누름.
// 업체 연동 전·secret 이 없을 때 자동으로 이걸 씀.
export const manualProvider: PayoutProvider = {
  id: "manual",
  label: "수동 송금",
  isConfigured: () => true,
  supports: () => true,
  async send() {
    return { status: "processing" }
  },
}
