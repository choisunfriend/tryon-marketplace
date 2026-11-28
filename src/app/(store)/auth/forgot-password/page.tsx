import { redirect } from "next/navigation"

// (2026-11-28) 이메일 가입·비밀번호는 쓰지 않음 — 애플 로그인으로
export default function Page() {
  redirect("/auth/login")
}
