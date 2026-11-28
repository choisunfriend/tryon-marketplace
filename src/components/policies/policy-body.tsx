"use client"
// (2026-11-28) 약관 본문 — 정책 페이지와 로그인 창 팝업이 같이 씀
import { useL } from "@/i18n/use-l"
import { POLICIES } from "@/lib/policy-text"

export function PolicyBody({ doc, compact = false }: { doc: string; compact?: boolean }) {
  const { L } = useL()
  const d = POLICIES[doc]
  if (!d) return null
  return (
    <div className={compact ? "space-y-4 text-sm" : "space-y-6"}>
      <p className="text-sm text-muted-foreground">{L(...d.effective)}</p>
      {d.intro && <p className="text-muted-foreground">{L(...d.intro)}</p>}
      {d.articles.map((a, i) => (
        <section key={i} className="space-y-2">
          <h2 className={compact ? "font-semibold" : "text-lg font-semibold"}>{L(...a.h)}</h2>
          {a.p.map((p, j) => <p key={j} className="leading-relaxed text-muted-foreground">{L(...p)}</p>)}
        </section>
      ))}
    </div>
  )
}
