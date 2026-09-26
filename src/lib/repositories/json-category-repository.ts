import type { Category, CategoryRepository } from "@/types"

const categories: Category[] = [
  {
    id: "cat-clothing",
    name: "Clothing",
    slug: "clothing",
    description: "Clothing selected for virtual try-on and outfit recommendations.",
    image: {
      url: "/images/products/placeholder.svg",
      alt: "Clothing",
    },
    order: 1,
  },
  {
    id: "cat-accessories",
    name: "Accessories",
    slug: "accessories",
    description: "Accessories selected to complete the look.",
    image: {
      url: "/images/products/placeholder.svg",
      alt: "Accessories",
    },
    order: 2,
  },
]

export const jsonCategoryRepository: CategoryRepository & {
  getChildren(parentId: string): Promise<Category[]>
  getTopLevel(): Promise<Category[]>
  getAncestors(categoryId: string): Promise<Category[]>
} = {
  async list() {
    return [...categories].sort((a, b) => a.order - b.order)
  },

  async getBySlug(slug) {
    return categories.find((c) => c.slug === slug) ?? null
  },

  async getById(id) {
    return categories.find((c) => c.id === id) ?? null
  },

  async getChildren(parentId) {
    return categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order)
  },

  async getTopLevel() {
    return [...categories].sort((a, b) => a.order - b.order)
  },

  async getAncestors(categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    return category ? [category] : []
  },
}
