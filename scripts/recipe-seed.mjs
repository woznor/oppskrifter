import fs from 'node:fs/promises'
import { validateRecipe } from '../supabase/functions/recipes-api/validation.js'
const source = JSON.parse(
  await fs.readFile(new URL('../data/meals.json', import.meta.url), 'utf8')
)
const items = source.map((recipe) => ({
  ...validateRecipe(recipe),
  id: recipe.id,
  image: recipe.image || null
}))
if (
  new Set(items.map((recipe) => recipe.id)).size !== items.length ||
  items.some((recipe) => !Number.isSafeInteger(recipe.id) || recipe.id < 1)
)
  throw new Error('Invalid or duplicate recipe IDs')
const data = JSON.stringify(items)
let delimiter = '$recipe_import$'
while (data.includes(delimiter))
  delimiter = `$recipe_import_${crypto.randomUUID().replaceAll('-', '')}$`
await fs.writeFile(
  new URL('../supabase/seed.sql', import.meta.url),
  `-- Imports missing IDs only. Does not overwrite recipes edited in the backend.\nselect public.import_recipe_backup(${delimiter}${data}${delimiter}::jsonb);\n`
)
console.log(`Prepared ${items.length} recipes in supabase/seed.sql.`)
