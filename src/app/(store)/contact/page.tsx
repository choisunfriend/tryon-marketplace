"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Mail, Globe, GitFork } from "lucide-react"
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

    setLoading(true)
    // In production, send to support@epicdesignlabs.com via API route or form service
    setTimeout(() => {
      toast.success(L("메시지를 보냈어요! 곧 답해 드릴게요.", "Message sent! We’ll get back to you soon."))
      setForm({ name: "", email: "", subject: "", message: "" })
      setLoading(false)
    }, 500)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        title={L("문의하기", "Contact Us")}
        description={L(
          "템플릿에 대해 궁금한 점이 있거나, 맞춤 작업이 필요하거나, 저희 팀과 함께 일하고 싶으신가요? 편하게 연락 주세요.",
          "Have a question about the starter template, need help with customization, or want to work with our team? We’d love to hear from you."
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
                href="mailto:support@epicdesignlabs.com"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                support@epicdesignlabs.com
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4" />
                {L("웹사이트", "Website")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href="https://epicdesignlabs.com"
                target="_blank"
                rel="noopener"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                epicdesignlabs.com
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <GitFork className="h-4 w-4" />
                GitHub
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href="https://github.com/Epic-Design-Labs/nextjs-ecommerce-starter"
                target="_blank"
                rel="noopener"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {L("GitHub에서 보기", "View on GitHub")}
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
