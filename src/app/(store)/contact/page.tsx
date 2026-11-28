"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Mail } from "lucide-react"
import { siteConfig } from "@/lib/config"
import { toast } from "sonner"
import { contactFormSchema } from "@/lib/validators"
import { useL } from "@/i18n/use-l"

export default function ContactPage() {
  const { L, loc } = useL()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const result = contactFormSchema.safeParse(form)
    if (!result.success) {
      toast.error(loc(result.error.issues[0].message))
      return
    }

    // (2026-11-28) 보내는 서버가 없으므로 메일 앱으로 넘김(예전 템플릿은 보낸 척만 했음)
    setLoading(true)
    const body = `${form.message}\n\n— ${form.name} <${form.email}>`
    window.location.href = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent("[Today's Stylepeek] " + form.subject)}&body=${encodeURIComponent(body)}`
    toast.success(L("메일 앱에서 보내기를 눌러 주세요.", "Press send in your mail app."))
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        title={L("문의하기", "Contact Us")}
        description={L(
          "앱 사용, 미용실 예약, 입점 문의 등 무엇이든 편하게 연락 주세요.",
          "Questions about the app, salon bookings or becoming a seller? We’d love to hear from you."
        )}
      />

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {/* Contact info cards */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                {L("이메일", "Email")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {siteConfig.contact.email}
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Contact form */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{L("이름", "Name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={L("이름", "Your name")}
                    value={form.name}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{L("이메일", "Email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">{L("제목", "Subject")}</Label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder={L("템플릿 질문, 맞춤 작업 문의, 프로젝트 의뢰 등", "Template question, customization help, or project inquiry")}
                  value={form.subject}
                  onChange={handleChange}
                  required
                  aria-required="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">{L("메시지", "Message")}</Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder={L("프로젝트나 궁금한 점을 적어 주세요...", "Tell us about your project or question...")}
                  rows={5}
                  value={form.message}
                  onChange={handleChange}
                  required
                  aria-required="true"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading ? L("보내는 중...", "Sending...") : L("메시지 보내기", "Send Message")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
