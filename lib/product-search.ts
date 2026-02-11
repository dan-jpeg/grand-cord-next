type SearchableProduct = {
    name: string
    slug?: string | null
    designerNames?: string[]
    material?: string | null
    color?: string | null
    keywords?: string[]
}

function normalize(value: string | null | undefined): string {
    return value?.toLowerCase().trim() ?? ''
}

export function matchesProductSearch(product: SearchableProduct, query: string): boolean {
    const q = normalize(query)
    if (!q) return true

    const searchableFields = [
        product.name,
        product.slug || '',
        product.material || '',
        product.color || '',
        ...(product.designerNames || []),
        ...(product.keywords || []),
    ]

    const haystack = searchableFields.map((field) => normalize(field)).join(' ')
    const terms = q.split(/\s+/).filter(Boolean)

    // All terms must be present somewhere across searchable product fields.
    return terms.every((term) => haystack.includes(term))
}
