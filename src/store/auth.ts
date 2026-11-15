"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, Address } from "@/types"

interface AuthState {
  user: User | null
  isAuthenticated: boolean

  login: (email: string, password: string) => boolean
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => boolean
  logout: () => void
  updateProfile: (data: Partial<Pick<User, "firstName" | "lastName" | "email">>) => void
  addAddress: (address: Omit<Address, "id">) => void
  removeAddress: (id: string) => void
}

// (2026-11-15 보안) 템플릿의 가짜 계정(admin@example.com / password123)을 지웠습니다.
// 손님 로그인은 아직 없습니다 — 진짜 로그인을 붙일 때 이 파일을 바꿉니다.
const CUSTOMER_SIGNUP_OPEN = false
const DEMO_USERS: Array<User & { password: string }> = []

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: (email, password) => {
        const found = DEMO_USERS.find(
          (u) => u.email === email && u.password === password
        )
        if (found) {
          const { password: _, ...user } = found
          set({ user, isAuthenticated: true })
          return true
        }
        return false
      },

      register: (data) => {
        if (!CUSTOMER_SIGNUP_OPEN) return false
        const exists = DEMO_USERS.some((u) => u.email === data.email)
        if (exists) return false

        const newUser: User = {
          id: `user-${Date.now()}`,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: "customer",
          addresses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set({ user: newUser, isAuthenticated: true })
        return true
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      updateProfile: (data) => {
        const user = get().user
        if (!user) return
        set({
          user: {
            ...user,
            ...data,
            updatedAt: new Date().toISOString(),
          },
        })
      },

      addAddress: (address) => {
        const user = get().user
        if (!user) return
        const newAddress: Address = {
          ...address,
          id: `addr-${Date.now()}`,
        }
        set({
          user: {
            ...user,
            addresses: [...user.addresses, newAddress],
          },
        })
      },

      removeAddress: (id) => {
        const user = get().user
        if (!user) return
        set({
          user: {
            ...user,
            addresses: user.addresses.filter((a) => a.id !== id),
          },
        })
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
