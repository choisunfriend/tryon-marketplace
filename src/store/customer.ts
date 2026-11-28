"use client"

// ============================================================================
// (2026-11-28) 손님 로그인 상태 — 진짜 서버(/api/customer/*)에 연결 (템플릿의 가짜 계정 대신)
// ============================================================================
// 로그인은 앱(네이티브)이 합니다. 쇼핑몰은 iframe 이라 애플 로그인 창을 직접 못 띄우기 때문입니다.
//   쇼핑몰 → 앱  { type: "gyeol-auth-get" }            열릴 때 "로그인돼 있나?" 묻기
//   쇼핑몰 → 앱  { type: "gyeol-login", provider }     로그인 버튼 → 앱이 애플 로그인 → 서버 로그인
//   쇼핑몰 → 앱  { type: "gyeol-logout" }              로그아웃·탈퇴 뒤 앱이 토큰을 버리게
//   앱 → 쇼핑몰  { type: "gyeol-auth", token|null }     토큰 전달(키체인 대신 앱 저장소에 보관)
//   앱 → 쇼핑몰  { type: "gyeol-login-error", error }
// 토큰은 쇼핑몰 쪽에서는 메모리에만 둡니다(iframe 저장소는 막히거나 나뉘어 믿을 수 없음).
// ============================================================================

import { create } from "zustand"
import { parentAppOrigin, postToApp } from "@/lib/app-bridge"

export interface Me {
  id: string
  kind: "anonymous" | "member"
  displayName: string | null
  email: string | null
  lang: string | null
  providers: string[]
  createdAt: string
}

interface CustomerState {
  token: string | null
  me: Me | null
  ready: boolean // 앱에게 물어보고 답을 받았거나, 앱 밖이라 기다릴 필요가 없음
  loggingIn: boolean
  error: string | null
  setToken: (token: string | null) => Promise<void>
  refresh: () => Promise<void>
  login: (provider: "apple" | "google" | "kakao") => void
  logout: () => Promise<void>
  deleteAccount: () => Promise<boolean>
  api: <T = unknown>(path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: T & { success?: boolean; error?: string } }>
}

export const useCustomer = create<CustomerState>()((set, get) => ({
  token: null,
  me: null,
  ready: false,
  loggingIn: false,
  error: null,

  api: async (path, init = {}) => {
    const headers = new Headers(init.headers)
    const t = get().token
    if (t) headers.set("Authorization", `Bearer ${t}`)
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
    try {
      const r = await fetch(path, { ...init, headers, cache: "no-store" })
      const data = await r.json().catch(() => ({}))
      if (r.status === 401 && t) set({ token: null, me: null })
      return { ok: r.ok, status: r.status, data }
    } catch {
      return { ok: false, status: 0, data: { success: false, error: "network" } as never }
    }
  },

  setToken: async (token) => {
    set({ token, error: null })
    if (token) await get().refresh()
    else set({ me: null })
    set({ ready: true, loggingIn: false })
  },

  refresh: async () => {
    if (!get().token) return set({ me: null })
    const r = await get().api<{ customer: Me }>("/api/customer/me")
    set({ me: r.ok ? r.data.customer : null })
  },

  login: (provider) => {
    set({ loggingIn: true, error: null })
    if (!postToApp({ type: "gyeol-login", provider })) set({ loggingIn: false, error: "not-in-app" })
  },

  logout: async () => {
    if (get().token) await get().api("/api/customer/logout", { method: "POST" })
    postToApp({ type: "gyeol-logout" })
    set({ token: null, me: null })
  },

  deleteAccount: async () => {
    const r = await get().api("/api/customer/me", { method: "DELETE", body: JSON.stringify({ confirm: "DELETE" }) })
    if (!r.ok) return false
    postToApp({ type: "gyeol-logout", deleted: true })
    set({ token: null, me: null })
    return true
  },
}))

let wired = false
/** 레이아웃에서 한 번 — 앱이 보내는 토큰을 받고, 앱에게 지금 토큰을 물어봄 */
export function wireCustomerBridge(): () => void {
  if (typeof window === "undefined" || wired) return () => {}
  wired = true
  const onMessage = (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== parentAppOrigin()) return
    const d = e.data as { type?: string; token?: unknown; error?: unknown } | null
    if (!d || typeof d !== "object") return
    if (d.type === "gyeol-auth") {
      const t = typeof d.token === "string" && /^gy_[0-9a-f]{64}$/.test(d.token) ? d.token : null
      void useCustomer.getState().setToken(t)
    } else if (d.type === "gyeol-login-error") {
      useCustomer.setState({ loggingIn: false, error: typeof d.error === "string" ? d.error.slice(0, 200) : "error" })
    }
  }
  window.addEventListener("message", onMessage)
  // 앱 안이면 물어보고, 1.5초 안에 답이 없으면(예전 앱) 로그인 안 된 것으로
  const asked = postToApp({ type: "gyeol-auth-get" })
  setTimeout(() => { if (!useCustomer.getState().ready) useCustomer.setState({ ready: true }) }, asked ? 1500 : 0)
  return () => {
    window.removeEventListener("message", onMessage)
    wired = false
  }
}
