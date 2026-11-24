"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCardLayout } from "@/components/auth/auth-card-layout"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { loginSchema } from "@/lib/validators"
import { useL } from "@/i18n/use-l"

export default function LoginPage() {
  const { L, loc } = useL()
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      toast.error(loc(result.error.issues[0].message))
      return
    }
    setLoading(true)
    const success = login(email, password)
    if (success) {
      toast.success(L("다시 오신 걸 환영해요!", "Welcome back!"))
      router.push("/account")
    } else {
      toast.error(L("이메일 또는 비밀번호가 올바르지 않아요", "Invalid email or password"))
    }
    setLoading(false)
  }

  return (
    <AuthCardLayout
      title={L("다시 오신 걸 환영해요", "Welcome back")}
      subtitle={L("계속하려면 로그인하세요", "Sign in to your account to continue")}
      footerText={L("계정이 없으신가요?", "Don’t have an account?")}
      footerLinkText={L("회원가입", "Sign up")}
      footerLinkHref="/auth/register"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{L("이메일", "Email")}</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{L("비밀번호", "Password")}</Label>
            <Link href="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              {L("비밀번호를 잊으셨나요?", "Forgot password?")}
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? L("로그인 중...", "Signing in...") : L("로그인", "Sign In")}
        </Button>
      </form>
    </AuthCardLayout>
  )
}
