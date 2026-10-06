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
const units = {
  skive: 'skiver',
  stk: 'stk',
  stykker: 'stk',
  stykk: 'stk',
  boks: 'bokser',
  bokser: 'bokser',
  gram: 'g',
  kg: 'g',
  kilo: 'g',
  liter: 'ml',
  l: 'ml',
  dl: 'ml',
  cl: 'ml',
  ml: 'ml',
  ss: 'ml',
  ts: 'ml'
}
const factors = {
  kg: 1000,
  kilo: 1000,
  l: 1000,
  liter: 1000,
  dl: 100,
  cl: 10,
  ss: 15,
  ts: 5
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
      const rawUnit = clean(item.unit)
      const unit =
        item.amount == null || !rawUnit ? 'g' : units[rawUnit] || rawUnit
      const amount =
        item.amount == null || !rawUnit
          ? item.grams
          : item.amount * (factors[rawUnit] || 1)
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
  if (item.unit === 'g' && item.amount >= 1000)
    return `${formatAmount(item.amount / 1000)} kg`
  if (item.unit === 'ml') {
    if (item.amount >= 1000) return `${formatAmount(item.amount / 1000)} l`
    if (item.amount >= 100) return `${formatAmount(item.amount / 100)} dl`
  }
  return `${formatAmount(item.amount)} ${item.unit}`
}

export function shoppingListText(items, checked = [], remainingOnly = true) {
  return items
    .filter((item) => !remainingOnly || !checked.includes(item.key))
    .map(
      (item) =>
        `${checked.includes(item.key) ? '[x]' : '[ ]'} ${item.name} – ${shoppingQuantity(item)}`
    )
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
