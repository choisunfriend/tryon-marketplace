import { z } from "zod"
import { bi } from "@/i18n/l"

// --- Address ---

export const addressSchema = z.object({
  firstName: z.string().min(1, bi("이름을 넣어 주세요", "First name is required")),
  lastName: z.string().min(1, bi("성을 넣어 주세요", "Last name is required")),
  line1: z.string().min(1, bi("주소를 넣어 주세요", "Address is required")),
  line2: z.string().optional(),
  city: z.string().min(1, bi("도시를 넣어 주세요", "City is required")),
  state: z.string().min(1, bi("시·도를 넣어 주세요", "State is required")),
  postalCode: z.string().min(1, bi("우편번호를 넣어 주세요", "Postal code is required")),
  country: z.string().min(1, bi("나라를 넣어 주세요", "Country is required")),
  phone: z.string().optional(),
})

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
  password: z.string().min(8, bi("비밀번호는 8자 이상이어야 해요", "Password must be at least 8 characters")),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(1, bi("이름을 넣어 주세요", "First name is required")),
    lastName: z.string().min(1, bi("성을 넣어 주세요", "Last name is required")),
    email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
    password: z.string().min(8, bi("비밀번호는 8자 이상이어야 해요", "Password must be at least 8 characters")),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: bi("비밀번호가 일치하지 않아요", "Passwords don’t match"),
    path: ["confirmPassword"],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
})

// --- Checkout ---

export const checkoutFormSchema = z.object({
  email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  sameAsShipping: z.boolean().default(true),
})

// --- Contact ---

export const contactFormSchema = z.object({
  name: z.string().min(1, bi("이름을 넣어 주세요", "Name is required")),
  email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
  subject: z.string().min(1, bi("제목을 넣어 주세요", "Subject is required")),
  message: z.string().min(10, bi("메시지는 10자 이상이어야 해요", "Message must be at least 10 characters")),
})

// --- Newsletter ---

export const newsletterSchema = z.object({
  email: z.string().email(bi("이메일 주소가 올바르지 않아요", "Invalid email address")),
})

// --- Type exports ---

export type AddressFormData = z.infer<typeof addressSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type CheckoutFormData = z.infer<typeof checkoutFormSchema>
export type ContactFormData = z.infer<typeof contactFormSchema>
export type NewsletterFormData = z.infer<typeof newsletterSchema>
