"use client"
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination -- (2026-11-01) 관리자 화면은 일반 페이지 이동(<a>·location)을 씀 — layout.tsx 설명 */

import { FormEvent, useEffect, useState } from "react"
import { ModelUploadField } from "@/components/admin/model-upload-field"
import { useL } from "@/i18n/client"

// (2026-11-14) 분류 이름 한국어 — 값(value)은 그대로, 화면 글자만
const CAT_KO: Record<string, string> = {
  Clothing: "의류", Outer: "아우터", Jacket: "재킷", Coat: "코트", Blazer: "블레이저", Shirt: "셔츠",
  "T-Shirt": "티셔츠", Hoodie: "후디", Sweater: "스웨터", Pants: "바지", Jeans: "청바지", Shorts: "반바지",
  Skirt: "치마", Dress: "원피스", Accessories: "액세서리", Bag: "가방", Hat: "모자", Cap: "캡",
  Glasses: "안경", Watch: "시계", Necklace: "목걸이", Earring: "귀걸이", Belt: "벨트",
}

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
  initialValue = "",
}: {
  name: string
  label: string
  kind: "image" | "model"
  folder: string
  accept: string
  placeholder?: string
  resetSignal: number
  initialValue?: string
}) {
  const { L } = useL()
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState("")

  useEffect(() => {
    setValue(initialValue)
    setStatus("")
  }, [resetSignal, initialValue])

  async function handleFile(file: File | undefined) {
    if (!file || !folder) return
    setStatus(L("업로드 중…", "Uploading…"))
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
        throw new Error(data.error ?? L("업로드 실패", "Upload failed"))
      }
      setValue(kind === "image" ? data.url : data.key)
      setStatus(L(`올림 · ${(file.size / 1024).toFixed(0)}KB`, `Uploaded · ${(file.size / 1024).toFixed(0)}KB`))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : L("업로드 실패", "Upload failed"))
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

// (2026-11-01) 앞머리: 입점사 계정은 "{slug}--" (서버가 이 앞머리 폴더만 새로 허용), 플랫폼은 "p-"
function newUploadFolder(prefix = "p-"): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}${Date.now().toString(36)}-${rand}`
}

// ============================================================================
// (2026-11-01) 등록·수정 겸용 — product 가 있으면 그 값으로 채우고 PUT /api/admin/products/{id}
// ============================================================================

export type AdminProduct = Record<string, unknown> & { id?: string | number }

type Loose = Record<string, unknown>

function obj(v: unknown): Loose {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Loose
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      return JSON.parse(v) as Loose
    } catch {
      return {}
    }
  }
  return {}
}

function str(v: unknown): string {
  return v == null ? "" : String(v)
}

// 상품 → 입력칸 이름별 처음 값
function initialValues(p: AdminProduct | null | undefined): Record<string, string> {
  if (!p) return {}
  const details = obj(p.details)
  const media = obj(p.media)
  const avatar = obj(p.avatar)
  const images = Array.isArray(media.images) ? (media.images as Loose[]) : []
  const main = images.find((i) => i && i.type === "main")
  const detail = images.filter((i) => i && i.type !== "main")
  const v: Record<string, string> = {
    name: str(p.name),
    brand: str(p.brand),
    description: str(p.description),
    gender: str(p.gender),
    product_code: str(p.product_code),
    status: str(p.status),
    price: p.price == null ? "" : String(p.price),
    currency: str(p.currency),
    main_image: str(main?.url ?? p.image_url),
    detail_image_1: str(detail[0]?.url),
    detail_image_2: str(detail[1]?.url),
    detail_image_3: str(detail[2]?.url),
    model_file: str(media.model_file ?? p.model_path),
    avatar_gender: str(avatar.gender),
    body_part: str(avatar.body_part),
    size_compatibility: str(avatar.size_compatibility),
    detail_category: str(details.detail_category),
  }
  for (const k of [
    "material", "color", "size", "fit", "texture", "stretch", "transparency", "thickness", "season",
    "manufacturer", "country_of_origin", "manufacturing_date", "care_instructions",
    "quality_assurance", "after_sales_service", "size_info", "measurements",
  ]) v[k] = str(details[k])
  return v
}

// 이미 올린 파일 경로에서 R2 폴더(products/{folder}/…)를 찾음 — 수정 때 같은 폴더에 올리게
function folderOf(vals: Record<string, string>): string {
  for (const k of ["main_image", "model_file", "detail_image_1"]) {
    const m = /products\/([A-Za-z0-9_-]{1,80})\//.exec(decodeURIComponent(vals[k] ?? ""))
    if (m) return m[1]
  }
  return ""
}

export default function ProductForm({ product }: { product?: AdminProduct | null }) {
  const { L } = useL()
  const cat = (label: string) => L(CAT_KO[label] ?? label, label)
  const editId = product?.id != null ? String(product.id) : ""
  const iv = initialValues(product)
  const pick = (k: string, d = "") => (iv[k] ? iv[k] : d)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // 이번 상품 파일을 모을 R2 폴더 (products/{folder}/...) — 저장 후 새로 뽑음
  const [uploadFolder, setUploadFolder] = useState("")
  const [resetSignal, setResetSignal] = useState(0)

  const [folderPrefix, setFolderPrefix] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFolderPrefix(typeof d?.folderPrefix === "string" ? d.folderPrefix : "p-"))
      .catch(() => setFolderPrefix("p-"))
  }, [])

  useEffect(() => {
    if (folderPrefix === null) return // 앞머리를 알기 전에는 폴더를 안 정함(업로드 버튼은 folder 없으면 꺼져 있음)
    setUploadFolder((editId && resetSignal === 0 && folderOf(iv)) || newUploadFolder(folderPrefix))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal, editId, folderPrefix])

  const [category, setCategory] = useState(str(product?.category) || "clothing")
  const [subcategory, setSubcategory] = useState(str(product?.subcategory))

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
        // (2026-11-01) 세부 분류(Outer → Jacket 등) — 예전엔 고르기만 하고 저장 안 됨
        detail_category:
          String(
            form.get("detail_category") ?? ""
          ).trim(),

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
          // 관리자 프록시를 거쳐 백엔드에 등록 (백엔드 토큰은 서버에만 있음)
          editId
            ? `/api/admin/products/${encodeURIComponent(editId)}`
            : "/api/admin/products",
          {
            method: editId ? "PUT" : "POST",
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
            L("상품을 저장하지 못했습니다", "Failed to create product")
        )
      }

      if (editId) {
        setMessage(L("수정했습니다.", "Saved."))
        window.location.assign("/admin/products")
        return
      }

      formElement.reset()
      setResetSignal((n) => n + 1)

      setCategory("clothing")
      setSubcategory("")

      setMessage(
        L("등록했습니다.", "Product added.")
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : L("상품을 저장하지 못했습니다", "Failed to save product")
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-8 text-2xl font-semibold">
        {editId ? L("상품 수정", "Edit Product") : L("상품 등록", "Add Product")}
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
            {L("기본 정보", "Basic Information")}
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("상품 이름", "Product name")}
            </label>

            <input
              name="name"
              defaultValue={pick("name")}
              required
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("브랜드", "Brand")}
              </label>

              <input
                name="brand"
              defaultValue={pick("brand")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("상품 코드", "Product code")}
              </label>

              <input
                name="product_code"
              defaultValue={pick("product_code")}
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("설명", "Description")}
            </label>

            <textarea
              name="description"
              defaultValue={pick("description")}
              rows={5}
              className="w-full rounded border p-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("성별", "Gender")}
              </label>

              <select
                name="gender"
                defaultValue={pick("gender", "unisex")}
                className="w-full rounded border p-2"
              >
                <option value="male">
                  {L("남성", "Men")}
                </option>

                <option value="female">
                  {L("여성", "Women")}
                </option>

                <option value="unisex">
                  {L("남녀 공용", "Unisex")}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("상태", "Status")}
              </label>

              <select
                name="status"
                defaultValue={pick("status", "active")}
                className="w-full rounded border p-2"
              >
                <option value="active">
                  {L("판매 중", "Active")}
                </option>

                <option value="draft">
                  {L("임시", "Draft")}
                </option>

                <option value="archived">
                  {L("보관", "Archived")}
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
            {L("분류", "Category")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("분류", "Category")}
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
                      {cat(item.label)}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("세부 분류", "Subcategory")}
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
                  {L("선택", "Select")}
                </option>

                {selectedCategory?.children?.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {cat(item.label)}
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
                {L("상세 분류", "Detail Category")}
              </label>

              <select
                name="detail_category"
                defaultValue={pick("detail_category")}
                className="w-full rounded border p-2"
              >
                <option value="">
                  {L("선택", "Select")}
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
                        {cat(item.label)}
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
            {L("가격", "Price")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("가격", "Price")}
              </label>

              <input
                name="price"
              defaultValue={pick("price")}
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("통화", "Currency")}
              </label>

              <select
                name="currency"
                defaultValue={pick("currency", "USD")}
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
            {L("상품 상세", "Product Details")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("소재", "Material")}
              </label>

              <input
                name="material"
              defaultValue={pick("material")}
                placeholder={L("울 80%, 나일론 20%", "Wool 80%, Nylon 20%")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("색상", "Color")}
              </label>

              <input
                name="color"
              defaultValue={pick("color")}
                placeholder={L("네이비", "Navy")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("사이즈", "Size")}
              </label>

              <input
                name="size"
              defaultValue={pick("size")}
                placeholder="M"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("핏", "Fit")}
              </label>

              <input
                name="fit"
              defaultValue={pick("fit")}
                placeholder={L("레귤러", "Regular")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("촉감", "Texture")}
              </label>

              <input
                name="texture"
              defaultValue={pick("texture")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("신축성", "Stretch")}
              </label>

              <input
                name="stretch"
              defaultValue={pick("stretch")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("비침", "Transparency")}
              </label>

              <input
                name="transparency"
              defaultValue={pick("transparency")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("두께", "Thickness")}
              </label>

              <input
                name="thickness"
              defaultValue={pick("thickness")}
                placeholder={L("보통", "Medium")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("계절", "Season")}
              </label>

              <input
                name="season"
              defaultValue={pick("season")}
                placeholder={L("가을/겨울", "Fall/Winter")}
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
            {L("제조·관리", "Manufacturing & Care")}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("제조사", "Manufacturer")}
              </label>

              <input
                name="manufacturer"
              defaultValue={pick("manufacturer")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("원산지", "Country of Origin")}
              </label>

              <input
                name="country_of_origin"
              defaultValue={pick("country_of_origin")}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("제조 연월", "Manufacturing Date")}
              </label>

              <input
                name="manufacturing_date"
              defaultValue={pick("manufacturing_date")}
                type="date"
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("품질 보증 기준", "Quality Assurance")}
              </label>

              <input
                name="quality_assurance"
              defaultValue={pick("quality_assurance")}
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("세탁·관리 방법", "Care Instructions")}
            </label>

            <textarea
              name="care_instructions"
              defaultValue={pick("care_instructions")}
              rows={3}
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("A/S 안내", "After Sales Service")}
            </label>

            <textarea
              name="after_sales_service"
              defaultValue={pick("after_sales_service")}
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
            {L("사이즈·실측", "Size & Measurements")}
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("사이즈 정보", "Size Information")}
            </label>

            <input
              name="size_info"
              defaultValue={pick("size_info")}
              placeholder="M"
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("실측", "Measurements")}
            </label>

            <textarea
              name="measurements"
              defaultValue={pick("measurements")}
              rows={4}
              placeholder={L("어깨 45cm / 가슴 54cm / 총장 72cm", "Shoulder 45cm / Chest 54cm / Length 72cm")}
              className="w-full rounded border p-2"
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 이미지 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {L("이미지", "Images")}
          </h2>

          <p className="text-xs text-muted-foreground">
            {L("파일 저장 위치", "Files are saved to")}: R2 tryon-marketplace-assets / products/{uploadFolder || "…"}/
          </p>

          <UploadField
            name="main_image"
            label={L("대표 이미지", "Main Image")}
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            placeholder={L("파일을 고르거나 https:// 주소 입력", "Choose a file or enter an https:// address")}
            resetSignal={resetSignal}
            initialValue={pick("main_image")}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <UploadField
            name="detail_image_1"
            label={L("상세 이미지 1", "Detail Image 1")}
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
            initialValue={pick("detail_image_1")}
          />

            <UploadField
            name="detail_image_2"
            label={L("상세 이미지 2", "Detail Image 2")}
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
            initialValue={pick("detail_image_2")}
          />

            <UploadField
            name="detail_image_3"
            label={L("상세 이미지 3", "Detail Image 3")}
            kind="image"
            folder={uploadFolder}
            accept="image/jpeg,image/png,image/webp,image/gif"
            
            resetSignal={resetSignal}
            initialValue={pick("detail_image_3")}
          />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 3D / Avatar */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {L("3D / 아바타", "3D / Avatar")}
          </h2>

          {/* (2026-11-14) OBJ 칸 · MTL 칸 따로 + 옆에 3D 굽기 패널 — model-upload-field.tsx */}
          <ModelUploadField
            name="model_file"
            label={L("3D 옷 (OBJ + MTL)", "3D garment (OBJ + MTL)")}
            folder={uploadFolder}
            placeholder={L("파일을 고르거나 R2 경로 입력", "Choose a file or enter an R2 path")}
            resetSignal={resetSignal}
            initialValue={pick("model_file")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("모델 성별", "Model Gender")}
              </label>

              <select
                name="avatar_gender"
                defaultValue={pick("avatar_gender", "unisex")}
                className="w-full rounded border p-2"
              >
                <option value="male">
                  {L("남자", "Man")}
                </option>

                <option value="female">
                  {L("여자", "Woman")}
                </option>

                <option value="unisex">
                  {L("남녀 공용", "Unisex")}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {L("옷 종류", "Body Part")}
              </label>

              <select
                name="body_part"
                defaultValue={pick("body_part", "upper_body")}
                className="w-full rounded border p-2"
              >
                <option value="upper_body">
                  {L("상의", "Upper")}
                </option>

                <option value="lower_body">
                  {L("하의", "Pants")}
                </option>

                <option value="outer">
                  {L("아우터", "Outer")}
                </option>

                <option value="full_body">
                  {L("전신", "Full Body")}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {L("맞는 체형", "Size Compatibility")}
            </label>

            <input
              name="size_compatibility"
              defaultValue={pick("size_compatibility")}
              placeholder={L("M / 보통 체형", "M / Regular body")}
              className="w-full rounded border p-2"
            />
          </div>
        </section>

        {/* ================================================================== */}
        {/* 기타 */}
        {/* ================================================================== */}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            {L("게시", "Publishing")}
          </h2>

          <label className="flex items-center gap-2">
            <input
              name="featured"
              type="checkbox"
              defaultChecked={product?.featured === true || product?.featured === 1}
            />

            <span>
              {L("추천 상품", "Featured product")}
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
              ? L("저장 중…", "Saving...")
              : editId
                ? L("변경 저장", "Save Changes")
                : L("상품 저장", "Save Product")}
          </button>

          <button
            type="button"
            onClick={() => window.location.assign("/admin/products")}
            className="ml-3 rounded border px-6 py-3"
          >
            {L("취소", "Cancel")}
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