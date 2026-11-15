"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useL } from "@/i18n/use-l"

export function NewsletterForm() {
  const { L } = useL()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setTimeout(() => {
      toast.success(L("구독해 주셔서 감사합니다!", "Thanks for subscribing!"))
      setEmail("")
      setLoading(false)
    }, 500)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-md gap-2">
      <input
        type="email"
        placeholder={L("이메일을 입력하세요", "Enter your email")}
        aria-label={L("뉴스레터 받을 이메일", "Email address for newsletter")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      <Button variant="secondary" type="submit" disabled={loading}>
        {loading ? "..." : L("구독하기", "Subscribe")}
      </Button>
    </form>
  )
}
