"use client"

import { FormEvent, useState } from "react"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://tryon-marketplace.choisunfriend.workers.dev"

const categories = [
  {
    value: "clothing",
    label: "Clothing",
    children: [
      {
        value: "outer",
        label: "Outer",
        children: [
          { value: "jacket", label: "Jacket" },
          { value: "coat", label: "Coat" },
          { value: "blazer", label: "Blazer" },
        ],
      },
      { value: "shirt", label: "Shirt" },
      { value: "tshirt", label: "T-Shirt" },
      { value: "hoodie", label: "Hoodie" },
      { value: "sweater", label: "Sweater" },
      {
        value: "pants",
        label: "Pants",
        children: [
          { value: "jeans", label: "Jeans" },
          { value: "shorts", label: "Shorts" },
        ],
      },
      { value: "skirt", label: "Skirt" },
      { value: "dress", label: "Dress" },
    ],
  },
  {
    value: "accessories",
    label: "Accessories",
    children: [
      { value: "bag", label: "Bag" },
      { value: "hat", label: "Hat" },
      { value: "cap", label: "Cap" },
      { value: "glasses", label: "Glasses" },
      { value: "watch", label: "Watch" },
      { value: "necklace", label: "Necklace" },
      { value: "earring", label: "Earring" },
      { value: "belt", label: "Belt" },
    ],
  },
]

export default function AdminProductsPage() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const [category, setCategory] = useState("clothing")
  const [subcategory, setSubcategory] = useState("")

  const selectedCategory =
    categories.find(
      (item) => item.value === category
    )

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setMessage("")

    const form =
      new FormData(event.currentTarget)

    const payload = {
      // ======================================================================
      // 기본 정보
      // ======================================================================

      name:
        String(
          form.get("name") ?? ""
        ).trim(),

      brand:
        String(
          form.get("brand") ?? ""
        ).trim(),

      description:
        String(
          form.get("description") ?? ""
        ).trim(),

      gender:
        String(
          form.get("gender") ?? ""
        ),

      product_code:
        String(
          form.get("product_code") ?? ""
        ).trim(),

      status:
        String(
          form.get("status") ?? "active"
        ),

      // ======================================================================
      // 분류
      // ======================================================================

      category,

      subcategory,

      // ======================================================================
      // 가격
      // ======================================================================

      price:
        Number(
          form.get("price") ?? 0
        ),

      currency:
        String(
          form.get("currency") ?? "USD"
        ),

      // ======================================================================
      // 의류 상세정보
      // ======================================================================

      details: {
        material:
          String(
            form.get("material") ?? ""
          ).trim(),

        color:
          String(
            form.get("color") ?? ""
          ).trim(),

        size:
          String(
            form.get("size") ?? ""
          ).trim(),

        fit:
          String(
            form.get("fit") ?? ""
          ).trim(),

        texture:
          String(
            form.get("texture") ?? ""
          ).trim(),

        stretch:
          String(
            form.get("stretch") ?? ""
          ).trim(),

        transparency:
          String(
            form.get("transparency") ?? ""
          ).trim(),

        thickness:
          String(
            form.get("thickness") ?? ""
          ).trim(),

        season:
          String(
            form.get("season") ?? ""
          ).trim(),

        // 제조 / 관리
        manufacturer:
          String(
            form.get("manufacturer") ?? ""
          ).trim(),

        country_of_origin:
          String(
            form.get("country_of_origin") ?? ""
          ).trim(),

        manufacturing_date:
          String(
            form.get("manufacturing_date") ?? ""
          ).trim(),

        care_instructions:
          String(
            form.get("care_instructions") ?? ""
          ).trim(),

        quality_assurance:
          String(
            form.get("quality_assurance") ?? ""
          ).trim(),

        after_sales_service:
          String(
            form.get("after_sales_service") ?? ""
          ).trim(),

        // 사이즈 / 실측
        size_info:
          String(
            form.get("size_info") ?? ""
          ).trim(),

        measurements:
          String(
            form.get("measurements") ?? ""
          ).trim(),
      },

      // ======================================================================
      // 이미지
      // ======================================================================

      media: {
        images: [
          {
            url:
              String(
                form.get("main_image") ?? ""
              ).trim(),

            alt:
              String(
                form.get("name") ?? ""
              ).trim(),

            type: "main",
          },

          ...[
            "detail_image_1",
            "detail_image_2",
            "detail_image_3",
          ]
            .map((field) => {
              const url =
                String(
                  form.get(field) ?? ""
                ).trim()

              if (!url) {
                return null
              }

              return {
                url,
                alt:
                  String(
                    form.get("name") ?? ""
                  ).trim(),
                type: "detail" as const,
              }
            })
            .filter(
              (
                image
              ): image is {
                url: string
                alt: string
                type: "detail"
              } =>
                image !== null
            ),
        ],

        model_file:
          String(
            form.get("model_file") ?? ""
          ).trim(),
      },

      // ======================================================================
      // Avatar / 3D
      // ======================================================================

      avatar: {
        gender:
          String(
            form.get("avatar_gender") ?? ""
          ),

        body_part:
          String(
            form.get("body_part") ?? ""
          ),

        size_compatibility:
          String(
            form.get(
              "size_compatibility"
            ) ?? ""
          ).trim(),
      },

      // ======================================================================
      // 기존 Worker 호환 필드
      // ======================================================================

      image_url:
        String(
          form.get("main_image") ?? ""
        ).trim(),

      model_path:
        String(
          form.get("model_file") ?? ""
        ).trim(),

      featured:
        form.get("featured") === "on",
    }

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/products`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        )

      const data =
        await response.json()

      if (
        !response.ok ||
        data.success === false
      ) {
        throw new Error(
          data.error ??
            "Failed to create product"
        )
      }

      event.currentTarget.reset()

      setCategory("clothing")
      setSubcategory("")

      setMessage(
        "Product saved."
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save product"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-semibold">
        Add Product
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-10"
      >
        {/* ================================================================== */}
        {/* 기본 정보 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Basic Information
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Product name
            </label>

            <input
              name="name"
              required
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Brand
              </label>

              <input
                name="brand"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Product code
              </label>

              <input
                name="product_code"
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>

            <textarea
              name="description"
              rows={5}
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Gender
              </label>

              <select
                name="gender"
                defaultValue="unisex"
                className="w-full rounded border p-2"
              >
                <option value="male">
                  Men
                </option>

                <option value="female">
                  Women
                </option>

                <option value="unisex">
                  Unisex
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Status
              </label>

              <select
                name="status"
                defaultValue="active"
                className="w-full rounded border p-2"
              >
                <option value="active">
                  Active
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="archived">
                  Archived
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 분류 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Category
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Category
              </label>

              <select
                name="category"
                value={category}
                onChange={(event) => {
                  setCategory(
                    event.target.value
                  )
                  setSubcategory("")
                }}
                className="w-full rounded border p-2"
              >
                {categories.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Subcategory
              </label>

              <select
                name="subcategory"
                value={subcategory}
                onChange={(event) =>
                  setSubcategory(
                    event.target.value
                  )
                }
                className="w-full rounded border p-2"
              >
                <option value="">
                  Select
                </option>

                {selectedCategory?.children?.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {selectedCategory?.children?.some(
            (item) =>
              "children" in item &&
              item.value ===
                subcategory
          ) && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Detail Category
              </label>

              <select
                name="detail_category"
                defaultValue=""
                className="w-full rounded border p-2"
              >
                <option value="">
                  Select
                </option>

                {selectedCategory.children
                  .find(
                    (item) =>
                      item.value ===
                      subcategory
                  )
                  ?.children?.map(
                    (item) => (
                      <option
                        key={item.value}
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
              </select>
            </div>
          )}
        </section>

        {/* ================================================================== */}
        {/* 가격 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Price
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Price
              </label>

              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Currency
              </label>

              <select
                name="currency"
                defaultValue="USD"
                className="w-full rounded border p-2"
              >
                <option value="USD">
                  USD
                </option>

                <option value="KRW">
                  KRW
                </option>

                <option value="EUR">
                  EUR
                </option>

                <option value="JPY">
                  JPY
                </option>

                <option value="CNY">
                  CNY
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 의류 상세정보 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Product Details
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Material
              </label>

              <input
                name="material"
                placeholder="Wool 80%, Nylon 20%"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Color
              </label>

              <input
                name="color"
                placeholder="Navy"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Size
              </label>

              <input
                name="size"
                placeholder="M"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Fit
              </label>

              <input
                name="fit"
                placeholder="Regular"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Texture
              </label>

              <input
                name="texture"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Stretch
              </label>

              <input
                name="stretch"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Transparency
              </label>

              <input
                name="transparency"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Thickness
              </label>

              <input
                name="thickness"
                placeholder="Medium"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Season
              </label>

              <input
                name="season"
                placeholder="Fall/Winter"
                className="w-full rounded border p-2"
              />
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 제조 / 관리 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Manufacturing & Care
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Manufacturer
              </label>

              <input
                name="manufacturer"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Country of Origin
              </label>

              <input
                name="country_of_origin"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Manufacturing Date
              </label>

              <input
                name="manufacturing_date"
                type="date"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Quality Assurance
              </label>

              <input
                name="quality_assurance"
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Care Instructions
            </label>

            <textarea
              name="care_instructions"
              rows={3}
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              After Sales Service
            </label>

            <textarea
              name="after_sales_service"
              rows={3}
              className="w-full rounded border p-2"
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 사이즈 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Size & Measurements
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Size Information
            </label>

            <input
              name="size_info"
              placeholder="M"
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Measurements
            </label>

            <textarea
              name="measurements"
              rows={4}
              placeholder="Shoulder 45cm / Chest 54cm / Length 72cm"
              className="w-full rounded border p-2"
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 이미지 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Images
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Main Image URL
            </label>

            <input
              name="main_image"
              type="url"
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Detail Image 1
              </label>

              <input
                name="detail_image_1"
                type="url"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Detail Image 2
              </label>

              <input
                name="detail_image_2"
                type="url"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Detail Image 3
              </label>

              <input
                name="detail_image_3"
                type="url"
                className="w-full rounded border p-2"
              />
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* 3D / Avatar */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            3D / Avatar
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Model File
            </label>

            <input
              name="model_file"
              className="w-full rounded border p-2"
              placeholder="models/jacket.glb"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Model Gender
              </label>

              <select
                name="avatar_gender"
                defaultValue="unisex"
                className="w-full rounded border p-2"
              >
                <option value="male">
                  Man
                </option>

                <option value="female">
                  Woman
                </option>

                <option value="unisex">
                  Unisex
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Body Part
              </label>

              <select
                name="body_part"
                defaultValue="upper_body"
                className="w-full rounded border p-2"
              >
                <option value="upper_body">
                  Upper
                </option>

                <option value="lower_body">
                  Pants
                </option>

                <option value="outer">
                  Outer
                </option>

                <option value="full_body">
                  Full Body
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Size Compatibility
            </label>

            <input
              name="size_compatibility"
              placeholder="M / Regular body"
              className="w-full rounded border p-2"
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 기타 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Publishing
          </h2>

          <label className="flex items-center gap-2">
            <input
              name="featured"
              type="checkbox"
            />

            <span>
              Featured product
            </span>
          </label>
        </section>

        {/* ================================================================== */}
        {/* Submit */}
        {/* ================================================================== */}

        <div className="border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Product"}
          </button>

          {message && (
            <p className="mt-3 text-sm">
              {message}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}