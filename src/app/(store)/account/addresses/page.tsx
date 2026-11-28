import { redirect } from "next/navigation"

// (2026-11-28) 내 계정 한 화면으로 합침(정보·예약·로그아웃·탈퇴)
export default function Page() {
  redirect("/account")
}
