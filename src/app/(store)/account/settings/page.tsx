"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useAuthStore } from "@/store/auth"
import { toast } from "sonner"
import { useL } from "@/i18n/use-l"

export default function SettingsPage() {
  const { L } = useL()
  const { user, isReady } = useAuthGuard()
  const updateProfile = useAuthStore((s) => s.updateProfile)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName)
      setLastName(user.lastName)
      setEmail(user.email)
    }
  }, [user])

  if (!isReady) return null

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    updateProfile({ firstName, lastName, email })
    toast.success(L("프로필을 바꿨어요", "Profile updated"))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader title={L("설정", "Settings")} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{L("프로필 정보", "Profile Information")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{L("이름", "First name")}</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{L("성", "Last name")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{L("이메일", "Email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit">{L("변경 저장", "Save Changes")}</Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle>{L("비밀번호 변경", "Change Password")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); toast.success(L("비밀번호를 바꿨어요 (데모)", "Password updated (demo)")) }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{L("현재 비밀번호", "Current password")}</Label>
              <Input id="currentPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{L("새 비밀번호", "New password")}</Label>
              <Input id="newPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{L("새 비밀번호 확인", "Confirm new password")}</Label>
              <Input id="confirmPassword" type="password" />
            </div>
            <Button type="submit">{L("비밀번호 바꾸기", "Update Password")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
