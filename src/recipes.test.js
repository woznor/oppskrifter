import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { filterRecipes, formatAmount, ingredientQuantity } from './recipes.js'
const recipes = JSON.parse(
  fs.readFileSync(new URL('../data/meals.json', import.meta.url), 'utf8')
)

test('all recipes remain available with empty or cleared search', () => {
  assert.equal(
    filterRecipes(recipes, '', false, 'original').length,
    recipes.length
  )
  assert.equal(
    filterRecipes(recipes, null, false, 'original').length,
    recipes.length
  )
})
test('search finds ingredients and protein additions regardless of case or accents', () => {
  assert(
    filterRecipes(recipes, 'COTTAGE cheese', false, 'original').some(
      (recipe) => recipe.id === 1
    )
  )
  assert.deepEqual(
    filterRecipes(recipes, 'brod', false, 'original'),
    filterRecipes(recipes, 'brød', false, 'original')
  )
  assert(filterRecipes(recipes, 'kjott', false, 'original').length > 0)
})
test('all search terms must match and search combines with the protein filter', () => {
  assert.equal(
    filterRecipes(recipes, 'pasta xyzmissing', false, 'original').length,
    0
  )
  const results = filterRecipes(recipes, 'kylling', true, 'original')
  assert(results.length > 0)
  assert(results.every((recipe) => recipe.nutrients.protein >= 30))
})
test('sorting orders results without mutating the source collection', () => {
  const ids = recipes.map((recipe) => recipe.id)
  for (const [sort, field, direction] of [
    ['protein', 'protein', -1],
    ['calories', 'calories', 1]
  ]) {
    const results = filterRecipes(recipes, '', false, sort)
    assert(
      results.every(
        (recipe, index) =>
          index === 0 ||
          direction *
            (recipe.nutrients[field] - results[index - 1].nutrients[field]) >=
            0
      )
    )
  }
  const names = filterRecipes(recipes, '', false, 'name')
  assert(
    names.every(
      (recipe, index) =>
        index === 0 ||
        names[index - 1].name.localeCompare(recipe.name, 'nb-NO') <= 0
    )
  )
  assert.deepEqual(
    recipes.map((recipe) => recipe.id),
    ids
  )
})
test('fractional ingredient amounts use Norwegian formatting', () => {
  assert.equal(formatAmount(0.5), '0,5')
  assert.equal(formatAmount(2 / 3), '0,67')
})
test('servings scale both unit quantities and weight-only ingredients', () => {
  assert.equal(
    ingredientQuantity({ amount: 0.5, unit: 'stk', grams: 52 }, 3, 1),
    '156 g'
  )
  assert.equal(
    ingredientQuantity({ amount: null, unit: null, grams: 30 }, 2, 1),
    '60 g'
  )
  assert.equal(
    ingredientQuantity({ amount: 100, unit: 'g', grams: 100 }, 1, 2),
    '50 g'
  )
})

test('meal filters include multi-type recipes and distinguish breakfast code zero', () => {
  const breakfast = filterRecipes(recipes, '', false, 'original', 0)
  const dinner = filterRecipes(recipes, '', false, 'original', 2)
  const evening = filterRecipes(recipes, '', false, 'original', 3)
  assert(breakfast.some((recipe) => recipe.id === 1))
  assert(evening.some((recipe) => recipe.id === 1))
  assert(!dinner.some((recipe) => recipe.id === 1))
  assert(dinner.some((recipe) => recipe.id === 2))
  assert(breakfast.every((recipe) => recipe.meal_types.includes(0)))
  assert.equal(
    filterRecipes(recipes, '', false, 'original', null).length,
    recipes.length
  )
  const combined = filterRecipes(recipes, 'ost', true, 'protein', 0)
  assert(combined.length > 0)
  assert(
    combined.every(
      (recipe) =>
        recipe.meal_types.includes(0) && recipe.nutrients.protein >= 30
    )
  )
})

test('ingredient display uses only grams or decilitres, preserving small volumes', () => {
  for (const recipe of recipes)
    for (const ingredient of [...recipe.ingredients, ...recipe.protein_addons])
      assert.match(
        ingredientQuantity(ingredient, 1, recipe.portions),
        / (g|dl)$/
      )
  assert.equal(
    ingredientQuantity({ amount: 0.5, unit: 'ts', grams: 2 }, 1, 1),
    '0,025 dl'
  )
  assert.equal(
    ingredientQuantity({ amount: 250, unit: 'ml', grams: 258 }, 2, 1),
    '5 dl'
  )
})
