import { redirect } from "next/navigation"

// (2026-11-28) 데모 결제 완료 화면은 닫아 둠 — 결제 없이 "주문 완료"가 보이지 않게
export default function Page() {
  redirect("/shop")
}
