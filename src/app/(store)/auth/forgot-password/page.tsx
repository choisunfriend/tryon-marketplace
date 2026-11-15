"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCardLayout } from "@/components/auth/auth-card-layout"
import { toast } from "sonner"
import { useL } from "@/i18n/use-l"

export default function ForgotPasswordPage() {
  const { L } = useL()
  const [email, setEmail] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    toast.success(L("재설정 링크를 보냈어요 (데모)", "Reset link sent (demo)"))
  }

  return (
    <AuthCardLayout
      title={L("비밀번호 재설정", "Reset your password")}
      subtitle={L("이메일을 입력하면 재설정 링크를 보내 드려요", "Enter your email and we’ll send you a reset link")}
      footerText={L("비밀번호가 기억나셨나요?", "Remember your password?")}
      footerLinkText={L("로그인", "Sign in")}
      footerLinkHref="/auth/login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{L("이메일", "Email")}</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">{L("재설정 링크 보내기", "Send Reset Link")}</Button>
      </form>
    </AuthCardLayout>
  )
}
