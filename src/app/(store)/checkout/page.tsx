import { redirect } from "next/navigation"

// (2026-11-28) 결제는 아직 열지 않음(예약만) — 결제를 붙일 때 원래 화면을 되살립니다(git 기록)
export default function Page() {
  redirect("/shop")
}
