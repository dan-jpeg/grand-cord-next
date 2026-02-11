const MAX_DESIGNERS = 8

export function normalizeDesignerNames(
  designerNames: string[] | null | undefined
): string[] {
  if (!designerNames) return []

  return designerNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_DESIGNERS)
}

export function formatDesignerNames(
  designerNames: string[] | null | undefined
): string {
  return normalizeDesignerNames(designerNames).join(', ')
}
