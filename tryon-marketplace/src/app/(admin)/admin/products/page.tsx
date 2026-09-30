"use client"

import { FormEvent, useEffect, useState } from "react"

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


// ============================================================================
// 파일 업로드 필드 — 파일을 고르면 /api/assets/upload 로 R2에 올리고
// 돌려받은 값을 입력칸에 채운다. 입력칸에 주소를 직접 적어도 된다.
//   image → "/api/assets/products/{folder}/images/..." (스토어가 바로 보여줌)
//   model → "products/{folder}/model/..." (R2 키 — 기존 model_path 규칙 그대로)
// ============================================================================

function UploadField({
  name,
  label,
  kind,
  folder,
  accept,
  placeholder,
  resetSignal,
}: {
  name: string
  label: string
  kind: "image" | "model"
  folder: string
  accept: string
  placeholder?: string
  resetSignal: number
}) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    setValue("")
    setStatus("")
  }, [resetSignal])

  async function handleFile(file: File | undefined) {
    if (!file || !folder) return
    setStatus("업로드 중…")
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("kind", kind)
      body.append("folder", folder)
      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body,
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "업로드 실패")
      }
      setValue(kind === "image" ? data.url : data.key)
      setStatus(`올림 · ${(file.size / 1024).toFixed(0)}KB`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "업로드 실패")
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border p-2"
      />
      <div className="mt-1 flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          disabled={!folder}
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = ""
          }}
          className="text-xs"
        />
        {status && (
          <span className="text-xs text-muted-foreground">{status}</span>
        )}
      </div>
    </div>
  )
}

function newUploadFolder(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `p-${Date.now().toString(36)}-${rand}`
}

export default function AdminProductsPage() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // 이번 상품 파일을 모을 R2 폴더 (products/{folder}/...) — 저장 후 새로 뽑음
  const [uploadFolder, setUploadFolder] = useState("")
  const [resetSignal, setResetSignal] = useState(0)

  useEffect(() => {
    setUploadFolder(newUploadFolder())
  }, [resetSignal])

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

    const formElement = event.currentTarget

    const form =
      new FormData(formElement)

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

      formElement.reset()
      setResetSignal((n) => n + 1)

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

          <p className="text-xs text-muted-foreground">
            파일 저장 위치: R2 tryon-marketplace-assets / products/{uploadFolder || "…"}/
          </p>

          <UploadField
            name="main_image"
            label="Main Image"
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            placeholder="파일을 고르거나 https:// 주소 입력"
            resetSignal={resetSignal}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <UploadField
            name="detail_image_1"
            label="Detail Image 1"
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
          />

            <UploadField
            name="detail_image_2"
            label="Detail Image 2"
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
          />

            <UploadField
            name="detail_image_3"
            label="Detail Image 3"
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
          />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 3D / Avatar */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            3D / Avatar
          </h2>

          <UploadField
            name="model_file"
            label="Model File (.obj / .glb)"
            kind="model"
            folder={uploadFolder}
            accept=".obj,.mtl,.glb,.gltf"
            placeholder="파일을 고르거나 R2 경로 입력"
            resetSignal={resetSignal}
          />

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