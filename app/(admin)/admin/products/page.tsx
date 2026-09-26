"use client"

import { FormEvent, useState } from "react"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

export default function AdminProductsPage() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage("")

    const form = new FormData(event.currentTarget)

    const payload = {
      name: String(form.get("name") ?? "").trim(),
      brand: String(form.get("brand") ?? "").trim(),
      category: String(form.get("category") ?? ""),
      gender: String(form.get("gender") ?? ""),
      price: Number(form.get("price") ?? 0),
      currency: String(form.get("currency") ?? "USD"),
      description: String(form.get("description") ?? "").trim(),
      image_url: String(form.get("image_url") ?? "").trim(),
      model_path: String(form.get("model_path") ?? "").trim(),
      featured: form.get("featured") === "on",
      status: String(form.get("status") ?? "active"),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        throw new Error(data.error ?? "Failed to create product")
      }

      event.currentTarget.reset()
      setMessage("Product saved.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Add Product</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Product name</label>
          <input name="name" required className="w-full rounded border p-2" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Brand</label>
          <input name="brand" className="w-full rounded border p-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select name="category" defaultValue="clothing" className="w-full rounded border p-2">
              <option value="clothing">Clothing</option>
              <option value="accessories">Accessories</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Gender</label>
            <select name="gender" defaultValue="unspecified" className="w-full rounded border p-2">
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="unisex">Unisex</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Price</label>
            <input name="price" type="number" min="0" step="0.01" required className="w-full rounded border p-2" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Currency</label>
            <select name="currency" defaultValue="USD" className="w-full rounded border p-2">
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea name="description" rows={5} className="w-full rounded border p-2" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Product image URL</label>
          <input name="image_url" type="url" className="w-full rounded border p-2" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">3D model path</label>
          <input name="model_path" className="w-full rounded border p-2" placeholder="/models/example.glb" />
        </div>

        <div className="flex items-center gap-2">
          <input id="featured" name="featured" type="checkbox" />
          <label htmlFor="featured">Featured product</label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select name="status" defaultValue="active" className="w-full rounded border p-2">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Product"}
        </button>

        {message && <p className="text-sm">{message}</p>}
      </form>
    </div>
  )
}
