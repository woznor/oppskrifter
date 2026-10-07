const normalize = (value) =>
  String(value ?? '')
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')

export const mealTypeOptions = [
  { title: 'Alle måltider', value: null },
  { title: 'Frokost', value: 0 },
  { title: 'Lunsj', value: 1 },
  { title: 'Middag', value: 2 },
  { title: 'Kvelds', value: 3 }
]

export function filterRecipes(
  recipes,
  search,
  proteinOnly,
  sort,
  mealType = null
) {
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean)
  const result = recipes.filter((recipe) => {
    const text = normalize(
      [
        recipe.name,
        ...recipe.ingredients.map((item) => item.name),
        ...recipe.protein_addons.map((item) => item.name)
      ].join(' ')
    )
    return (
      terms.every((term) => text.includes(term)) &&
      (!proteinOnly || recipe.nutrients.protein >= 30) &&
      (mealType === null || recipe.meal_types?.includes(mealType))
    )
  })
  if (sort === 'name')
    result.sort((a, b) => a.name.localeCompare(b.name, 'nb-NO'))
  if (sort === 'protein')
    result.sort((a, b) => b.nutrients.protein - a.nutrients.protein)
  if (sort === 'calories')
    result.sort((a, b) => a.nutrients.calories - b.nutrients.calories)
  return result
}
export function formatAmount(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits }).format(value)
}

export function ingredientQuantity(ingredient, servings, portions) {
  const factor = servings / portions
  const measure = ingredientMeasure(ingredient)
  return `${formatAmount(measure.amount * factor, measure.unit === 'dl' ? 4 : 2)} ${measure.unit}`
}

export function ingredientMeasure(ingredient) {
  const unit = String(ingredient.unit ?? '')
    .trim()
    .toLowerCase()
  const volumeInDl = {
    l: 10,
    liter: 10,
    dl: 1,
    cl: 0.1,
    ml: 0.01,
    ss: 0.15,
    ts: 0.05
  }
  if (ingredient.amount != null && Object.hasOwn(volumeInDl, unit)) {
    return { amount: ingredient.amount * volumeInDl[unit], unit: 'dl' }
  }
  return { amount: ingredient.grams, unit: 'g' }
}
