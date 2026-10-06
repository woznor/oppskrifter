const normalize = (value) =>
  String(value ?? '')
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')

export function filterRecipes(recipes, search, proteinOnly, sort) {
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
      (!proteinOnly || recipe.nutrients.protein >= 30)
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
export function formatAmount(value) {
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(
    value
  )
}

export function ingredientQuantity(ingredient, servings, portions) {
  const factor = servings / portions
  if (ingredient.amount != null && ingredient.unit && ingredient.unit !== 'g') {
    return `${formatAmount(ingredient.amount * factor)} ${ingredient.unit}`
  }
  return `${formatAmount(ingredient.grams * factor)} g`
}
