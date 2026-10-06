import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  aggregateIngredients,
  createShoppingEntry,
  shoppingQuantity
} from './shopping.js'

const combine = (ingredients) => aggregateIngredients([{ ingredients }])
const item = (name, amount, unit, grams) => ({ name, amount, unit, grams })

test('same ingredients merge despite case and spacing; variants remain separate', () => {
  const result = combine([
    item(' Hvitost ', 2, 'skiver', 26),
    item('hvitost', 3, 'skive', 39),
    item('Hvitost, lett', 1, 'skiver', 13)
  ])
  assert.equal(result.length, 2)
  assert.equal(result.find((row) => row.key === 'hvitost').amount, 5)
  assert.equal(result.find((row) => row.key === 'hvitost').grams, 65)
})
test('explicit ingredient synonyms merge', () => {
  const result = combine([
    item('Middels stor potet', 1, 'stk', 80),
    item('middels store poteter', 2, 'stk', 160)
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].amount, 3)
})
test('mixed unit families use supplied weights instead of guessed densities', () => {
  const result = combine([
    item('Hvetemel', 1, 'dl', 60),
    item('hvetemel', 100, 'g', 100)
  ])
  assert.equal(shoppingQuantity(result[0]), '160 g')
})
test('compatible volume units and weight units are converted before summing', () => {
  const volume = combine([
    item('Melk', 1, 'dl', 103),
    item('melk', 2, 'ss', 31)
  ])
  assert.equal(shoppingQuantity(volume[0]), '1,3 dl')
  const weight = combine([
    item('Ris', 0.5, 'kg', 500),
    item('ris', 600, 'g', 600)
  ])
  assert.equal(shoppingQuantity(weight[0]), '1,1 kg')
})
test('weight-only ingredients combine with counted ingredients by weight', () => {
  const result = combine([
    item('Mozzarella', null, null, 30),
    item('mozzarella', 1, 'stk', 125)
  ])
  assert.equal(shoppingQuantity(result[0]), '155 g')
})
test('adding a recipe scales quantities, only includes chosen addons, and never mutates recipes', () => {
  const recipe = {
    id: 1,
    name: 'Test',
    portions: 2,
    ingredients: [item('Egg', 2, 'stk', 110)],
    protein_addons: [item('Skyr', 1, 'boks', 160), item('Pulver', 30, 'g', 30)]
  }
  const original = structuredClone(recipe)
  const entry = createShoppingEntry(recipe, 4, [0])
  assert.equal(entry.ingredients.length, 2)
  assert.equal(entry.ingredients[0].amount, 4)
  assert.equal(entry.ingredients[1].grams, 320)
  assert.equal(createShoppingEntry(recipe, 2).ingredients.length, 1)
  assert.deepEqual(recipe, original)
  assert.notEqual(entry.id, createShoppingEntry(recipe, 4).id)
})
test('removing a selected dish reduces aggregated amounts', () => {
  const entries = [
    { ingredients: [item('Egg', 2, 'stk', 110)] },
    { ingredients: [item('egg', 1, 'stk', 55)] }
  ]
  assert.equal(aggregateIngredients(entries)[0].amount, 3)
  assert.equal(aggregateIngredients(entries.slice(1))[0].amount, 1)
  assert.deepEqual(aggregateIngredients([]), [])
})
test('all recipe ingredients can be aggregated without losing weight', () => {
  const recipes = JSON.parse(
    fs.readFileSync(new URL('../public/meals.json', import.meta.url), 'utf8')
  )
  const entries = recipes.map((recipe) => createShoppingEntry(recipe, 3))
  const expected = entries
    .flatMap((entry) => entry.ingredients)
    .reduce((sum, ingredient) => sum + ingredient.grams, 0)
  const result = aggregateIngredients(entries)
  assert(
    Math.abs(result.reduce((sum, row) => sum + row.grams, 0) - expected) <
      0.000001
  )
  assert(
    result.every(
      (row) => Number.isFinite(row.amount) && Number.isFinite(row.grams)
    )
  )
})
