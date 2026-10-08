import { formatAmount } from './recipes.js'

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
          grams: 0
        })
      const group = groups.get(key)
      group.grams += item.grams
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      amount: group.grams,
      unit: 'g'
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb-NO'))
}

export function shoppingQuantity(item) {
  return `${formatAmount(item.grams)} g`
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
