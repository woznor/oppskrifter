import { formatAmount, ingredientMeasure } from './recipes.js'

const clean = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('nb-NO')
    .trim()
    .replace(/\s+/g, ' ')
// Only explicit equivalents: product variants and different cuts remain separate.
const aliases = {
  'middels stor potet': 'potet',
  'middels store poteter': 'potet',
  'middels store gulrøtter': 'gulrot',
  'grønn pesto': 'pesto, grønn',
  'sjampinjong, fersk': 'sjampinjong, rå'
}
export function ingredientKey(name) {
  const key = clean(name)
  return aliases[key] || key
}

export function createShoppingEntry(recipe, servings, addonIndexes = []) {
  const factor = servings / recipe.portions
  return {
    id: globalThis.crypto.randomUUID(),
    recipeId: recipe.id,
    name: recipe.name,
    servings,
    ingredients: [
      ...recipe.ingredients,
      ...recipe.protein_addons.filter((_, index) =>
        addonIndexes.includes(index)
      )
    ].map((item) => ({
      name: item.name,
      amount: item.amount == null ? null : item.amount * factor,
      unit: item.unit,
      grams: item.grams * factor
    }))
  }
}

export function aggregateIngredients(entries) {
  const groups = new Map()
  for (const entry of entries) {
    for (const item of entry.ingredients) {
      const key = ingredientKey(item.name)
      if (!groups.has(key))
        groups.set(key, {
          key,
          name: aliases[clean(item.name)] || item.name,
          grams: 0,
          measures: new Map()
        })
      const group = groups.get(key)
      group.grams += item.grams
      const { unit, amount } = ingredientMeasure(item)
      group.measures.set(unit, (group.measures.get(unit) || 0) + amount)
    }
  }
  return [...groups.values()]
    .map((group) => {
      // All source ingredients have weights. Mixed unit families are summed by weight,
      // never by assuming that a millilitre equals a gram.
      const [unit, amount] =
        group.measures.size === 1 ? [...group.measures][0] : ['g', group.grams]
      return {
        key: group.key,
        name: group.name,
        grams: group.grams,
        amount,
        unit
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'nb-NO'))
}

export function shoppingQuantity(item) {
  const measure = ingredientMeasure(item)
  return `${formatAmount(measure.amount, measure.unit === 'dl' ? 4 : 2)} ${measure.unit}`
}

export function shoppingListText(items, checked = [], remainingOnly = true) {
  return items
    .filter((item) => !remainingOnly || !checked.includes(item.key))
    .map((item) => `${item.name} – ${shoppingQuantity(item)}`)
    .join('\n')
}

export function replaceWeekEntries(entries, planned) {
  return [
    ...entries.filter((entry) => entry.source !== 'week-menu'),
    ...planned.map(({ recipe, servings }) => ({
      ...createShoppingEntry(recipe, servings),
      source: 'week-menu'
    }))
  ]
}
