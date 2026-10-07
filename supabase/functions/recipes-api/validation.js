export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function text(value, field, max = 250, required = true) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new ApiError(400, `Kontroller ${field}.`)
  }
  return value.trim()
}
function number(value, field, max = 100000, nullable = false) {
  if (nullable && value === null) return null
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  ) {
    throw new ApiError(400, `Kontroller ${field}.`)
  }
  return value
}
function ingredient(value) {
  if (!value || typeof value !== 'object')
    throw new ApiError(400, 'Ugyldig ingrediens.')
  return {
    name: text(value.name, 'ingrediensnavn'),
    amount: number(value.amount, 'mengde', 100000, true),
    unit: value.unit === null ? null : text(value.unit, 'enhet', 40),
    grams: number(value.grams, 'gramvekt')
  }
}
export function validateRecipe(value) {
  if (!value || typeof value !== 'object')
    throw new ApiError(400, 'Ugyldig oppskrift.')
  const portions = number(value.portions, 'porsjoner', 100)
  if (!Number.isInteger(portions) || portions < 1)
    throw new ApiError(400, 'Velg 1–100 porsjoner.')
  if (
    !Array.isArray(value.meal_types) ||
    value.meal_types.length > 4 ||
    value.meal_types.some(
      (type) => !Number.isInteger(type) || type < 0 || type > 3
    )
  ) {
    throw new ApiError(400, 'Velg gyldige måltider.')
  }
  if (!Array.isArray(value.steps) || value.steps.length > 100)
    throw new ApiError(400, 'Ugyldige steg.')
  if (
    !Array.isArray(value.ingredients) ||
    !value.ingredients.length ||
    value.ingredients.length > 100 ||
    !Array.isArray(value.protein_addons) ||
    value.protein_addons.length > 30
  ) {
    throw new ApiError(400, 'Legg inn 1–100 ingredienser.')
  }
  const nutrients = {}
  for (const field of ['calories', 'protein', 'carbs', 'fat', 'fibre'])
    nutrients[field] = number(value.nutrients?.[field], field)
  const duration =
    value.duration_minutes == null
      ? null
      : number(value.duration_minutes, 'total tid', 10080)
  if (duration !== null && (!Number.isInteger(duration) || duration < 1))
    throw new ApiError(400, 'Oppgi total tid i hele minutter.')
  // Client IDs, uploaded paths and signed image URLs are deliberately excluded.
  return {
    name: text(value.name, 'navn'),
    portions,
    duration_minutes: duration,
    rating: value.rating == null ? null : number(value.rating, 'vurdering', 5),
    protein_powder: value.protein_powder === true,
    heatable: typeof value.heatable === 'boolean' ? value.heatable : null,
    must_be_heated: value.must_be_heated === true,
    meal_types: [...new Set(value.meal_types)],
    category_icon:
      value.category_icon == null
        ? null
        : text(value.category_icon, 'ikon', 100),
    steps: value.steps.map((step) => text(step, 'steg', 4000)),
    ingredients: value.ingredients.map(ingredient),
    protein_addons: value.protein_addons.map(ingredient),
    nutrients
  }
}
export function validateImage(bytes, mime) {
  if (!bytes.length || bytes.length > 6 * 1024 * 1024)
    throw new ApiError(400, 'Bildet må være mindre enn 6 MB.')
  const starts = (signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  if (mime === 'image/jpeg' && starts([255, 216, 255])) return 'jpg'
  if (mime === 'image/png' && starts([137, 80, 78, 71, 13, 10, 26, 10]))
    return 'png'
  const decode = (value) => new TextDecoder().decode(value)
  if (
    mime === 'image/webp' &&
    decode(bytes.slice(0, 4)) === 'RIFF' &&
    decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'webp'
  throw new ApiError(400, 'Velg et JPEG-, PNG- eller WebP-bilde.')
}
