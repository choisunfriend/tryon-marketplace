"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCardLayout } from "@/components/auth/auth-card-layout"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { registerSchema } from "@/lib/validators"
import { useL } from "@/i18n/use-l"

export default function RegisterPage() {
  const { L, loc } = useL()
  const router = useRouter()
  const register = useAuthStore((s) => s.register)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = registerSchema.safeParse(form)
    if (!validation.success) { toast.error(loc(validation.error.issues[0].message)); return }
    setLoading(true)
    const success = register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password })
    if (success) { toast.success(L("계정을 만들었어요!", "Account created!")); router.push("/account") }
    else { toast.error(L("이미 이 이메일로 가입된 계정이 있어요", "An account with this email already exists")) }
    setLoading(false)
  }

  return (
    <AuthCardLayout
      title={L("계정 만들기", "Create an account")}
      subtitle={L("가입하고 쇼핑을 시작하세요", "Join us to start shopping")}
      footerText={L("이미 계정이 있으신가요?", "Already have an account?")}
      footerLinkText={L("로그인", "Sign in")}
      footerLinkHref="/auth/login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{L("이름", "First name")}</Label>
            <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{L("성", "Last name")}</Label>
            <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{L("이메일", "Email")}</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{L("비밀번호", "Password")}</Label>
          <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{L("비밀번호 확인", "Confirm password")}</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? L("만드는 중...", "Creating...") : L("계정 만들기", "Create Account")}
        </Button>
      </form>
    </AuthCardLayout>
  )
}
