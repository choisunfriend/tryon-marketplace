"use client"

import { Button } from "@/components/ui/button"
import { useL } from "@/i18n/use-l"

export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { L } = useL()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">{L("문제가 생겼어요", "Something went wrong")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {L("이 페이지를 불러오지 못했어요", "We couldn’t load this page")}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {L("다시 시도해 주세요. 계속 안 되면 고객센터에 문의해 주세요.", "Please try again. If the problem persists, contact support.")}
      </p>
      <Button onClick={reset} className="mt-8">
        {L("다시 시도", "Try Again")}
      </Button>
    </div>
  )
}
