import type { Category, CategoryRepository } from "@/types"

const categories: Category[] = [
  // ==========================================================================
  // CLOTHING
  // ==========================================================================

  {
    id: "cat-clothing",
    name: "Clothing",
    slug: "clothing",
    description:
      "Clothing selected for virtual try-on and outfit recommendations.",
    image: {
      url: "/images/products/placeholder.svg",
      alt: "Clothing",
    },
    order: 1,
  },

  // --------------------------------------------------------------------------
  // Clothing > Outer
  // --------------------------------------------------------------------------

  {
    id: "cat-outer",
    name: "Outer",
    slug: "outer",
    description: "Outerwear including jackets, coats, and blazers.",
    parentId: "cat-clothing",
    order: 1,
  },

  {
    id: "cat-jacket",
    name: "Jacket",
    slug: "jacket",
    description: "Jackets.",
    parentId: "cat-outer",
    order: 1,
  },

  {
    id: "cat-coat",
    name: "Coat",
    slug: "coat",
    description: "Coats.",
    parentId: "cat-outer",
    order: 2,
  },

  {
    id: "cat-blazer",
    name: "Blazer",
    slug: "blazer",
    description: "Blazers.",
    parentId: "cat-outer",
    order: 3,
  },

  // --------------------------------------------------------------------------
  // Clothing > Tops
  // --------------------------------------------------------------------------

  {
    id: "cat-shirt",
    name: "Shirt",
    slug: "shirt",
    description: "Shirts.",
    parentId: "cat-clothing",
    order: 2,
  },

  {
    id: "cat-tshirt",
    name: "T-Shirt",
    slug: "tshirt",
    description: "T-shirts.",
    parentId: "cat-clothing",
    order: 3,
  },

  {
    id: "cat-hoodie",
    name: "Hoodie",
    slug: "hoodie",
    description: "Hoodies.",
    parentId: "cat-clothing",
    order: 4,
  },

  {
    id: "cat-sweater",
    name: "Sweater",
    slug: "sweater",
    description: "Sweaters and knitwear.",
    parentId: "cat-clothing",
    order: 5,
  },

  // --------------------------------------------------------------------------
  // Clothing > Bottoms
  // --------------------------------------------------------------------------

  {
    id: "cat-pants",
    name: "Pants",
    slug: "pants",
    description: "Pants and trousers.",
    parentId: "cat-clothing",
    order: 6,
  },

  {
    id: "cat-jeans",
    name: "Jeans",
    slug: "jeans",
    description: "Jeans.",
    parentId: "cat-pants",
    order: 1,
  },

  {
    id: "cat-shorts",
    name: "Shorts",
    slug: "shorts",
    description: "Shorts.",
    parentId: "cat-pants",
    order: 2,
  },

  // --------------------------------------------------------------------------
  // Clothing > Other
  // --------------------------------------------------------------------------

  {
    id: "cat-skirt",
    name: "Skirt",
    slug: "skirt",
    description: "Skirts.",
    parentId: "cat-clothing",
    order: 7,
  },

  {
    id: "cat-dress",
    name: "Dress",
    slug: "dress",
    description: "Dresses.",
    parentId: "cat-clothing",
    order: 8,
  },

  // ==========================================================================
  // ACCESSORIES
  // ==========================================================================

  {
    id: "cat-accessories",
    name: "Accessories",
    slug: "accessories",
    description:
      "Accessories selected to complete the look.",
    image: {
      url: "/images/products/placeholder.svg",
      alt: "Accessories",
    },
    order: 2,
  },

  // --------------------------------------------------------------------------
  // Accessories
  // --------------------------------------------------------------------------

  {
    id: "cat-bag",
    name: "Bag",
    slug: "bag",
    description: "Bags.",
    parentId: "cat-accessories",
    order: 1,
  },

  {
    id: "cat-hat",
    name: "Hat",
    slug: "hat",
    description: "Hats.",
    parentId: "cat-accessories",
    order: 2,
  },

  {
    id: "cat-cap",
    name: "Cap",
    slug: "cap",
    description: "Caps.",
    parentId: "cat-accessories",
    order: 3,
  },

  {
    id: "cat-glasses",
    name: "Glasses",
    slug: "glasses",
    description: "Glasses and eyewear.",
    parentId: "cat-accessories",
    order: 4,
  },

  {
    id: "cat-watch",
    name: "Watch",
    slug: "watch",
    description: "Watches.",
    parentId: "cat-accessories",
    order: 5,
  },

  {
    id: "cat-necklace",
    name: "Necklace",
    slug: "necklace",
    description: "Necklaces.",
    parentId: "cat-accessories",
    order: 6,
  },

  {
    id: "cat-earring",
    name: "Earring",
    slug: "earring",
    description: "Earrings.",
    parentId: "cat-accessories",
    order: 7,
  },

  {
    id: "cat-belt",
    name: "Belt",
    slug: "belt",
    description: "Belts.",
    parentId: "cat-accessories",
    order: 8,
  },
]

// ============================================================================
// Repository
// ============================================================================

export const jsonCategoryRepository: CategoryRepository & {
  getChildren(parentId: string): Promise<Category[]>
  getTopLevel(): Promise<Category[]>
  getAncestors(categoryId: string): Promise<Category[]>
} = {
  // --------------------------------------------------------------------------
  // All categories
  // --------------------------------------------------------------------------

  async list() {
    return [...categories].sort(
      (a, b) => {
        if (a.parentId !== b.parentId) {
          if (!a.parentId) return -1
          if (!b.parentId) return 1
          return a.parentId.localeCompare(b.parentId)
        }

        return a.order - b.order
      }
    )
  },

  // --------------------------------------------------------------------------
  // Get by slug
  // --------------------------------------------------------------------------

  async getBySlug(slug) {
    return (
      categories.find(
        (c) => c.slug === slug
      ) ?? null
    )
  },

  // --------------------------------------------------------------------------
  // Get by ID
  // --------------------------------------------------------------------------

  async getById(id) {
    return (
      categories.find(
        (c) => c.id === id
      ) ?? null
    )
  },

  // --------------------------------------------------------------------------
  // Get children
  // --------------------------------------------------------------------------

  async getChildren(parentId) {
    return categories
      .filter(
        (c) =>
          c.parentId === parentId
      )
      .sort(
        (a, b) =>
          a.order - b.order
      )
  },

  // --------------------------------------------------------------------------
  // Get top-level categories
  // --------------------------------------------------------------------------

  async getTopLevel() {
    return categories
      .filter(
        (c) =>
          !c.parentId
      )
      .sort(
        (a, b) =>
          a.order - b.order
      )
  },

  // --------------------------------------------------------------------------
  // Get ancestors
  // --------------------------------------------------------------------------

  async getAncestors(categoryId) {
    const result: Category[] = []

    let current =
      categories.find(
        (c) =>
          c.id === categoryId
      )

    while (current) {
      result.unshift(current)

      if (!current.parentId) {
        break
      }

      current =
        categories.find(
          (c) =>
            c.id === current!.parentId
        )
    }

    return result
  },
}