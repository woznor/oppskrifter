import fs from 'node:fs/promises'
import {
  validateRecipe,
  validateImage
} from '../supabase/functions/recipes-api/validation.js'

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key)
  throw new Error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally. Never commit the service-role key.'
  )
const source = JSON.parse(
  await fs.readFile(new URL('../data/meals.json', import.meta.url), 'utf8')
)
const items = source.map((recipe) => {
  if (!Number.isSafeInteger(recipe.id) || recipe.id < 1)
    throw new Error('Invalid recipe ID')
  const image = recipe.image || null
  if (image && !/^https?:\/\//.test(image))
    throw new Error('Invalid external image URL')
  return { ...validateRecipe(recipe), id: recipe.id, image }
})
if (new Set(items.map((recipe) => recipe.id)).size !== items.length)
  throw new Error('Duplicate recipe IDs')
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json'
}
async function call(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  })
  if (!response.ok)
    throw new Error(`Import request failed (${response.status})`)
  return response.status === 204 ? null : response.json()
}
const count = await call('/rest/v1/rpc/import_recipe_backup', {
  method: 'POST',
  body: JSON.stringify({ items })
})
console.log(`Imported ${count} recipes. Existing IDs were left unchanged.`)
if (process.argv.includes('--images')) {
  const rows = await call(
    '/rest/v1/recipes?select=id,external_image,image_path,version'
  )
  async function importImage(row) {
    if (row.image_path || !row.external_image) return
    let path = null
    try {
      const response = await fetch(row.external_image, {
        signal: AbortSignal.timeout(20000)
      })
      if (
        !response.ok ||
        Number(response.headers.get('content-length')) > 6291456
      )
        throw new Error()
      const reader = response.body.getReader()
      const parts = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 6291456) {
          await reader.cancel()
          throw new Error()
        }
        parts.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const part of parts) {
        bytes.set(part, offset)
        offset += part.length
      }
      const mime = response.headers.get('content-type')?.split(';')[0]
      const extension = validateImage(bytes, mime)
      path = `${crypto.randomUUID()}.${extension}`
      await call(`/storage/v1/object/recipe-images/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': mime },
        body: bytes
      })
      const changed = await call(
        `/rest/v1/recipes?id=eq.${row.id}&version=eq.${row.version}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            image_path: path,
            external_image: null,
            version: row.version + 1
          })
        }
      )
      if (!changed.length) throw new Error()
      console.log(`Stored image for recipe ${row.id}.`)
    } catch {
      if (path)
        await call('/storage/v1/object/recipe-images', {
          method: 'DELETE',
          body: JSON.stringify({ prefixes: [path] })
        }).catch(() => {})
      console.log(
        `Could not store image for recipe ${row.id}; original URL retained. Upload a replacement in the editor.`
      )
    }
  }
  for (let offset = 0; offset < rows.length; offset += 4) {
    await Promise.all(rows.slice(offset, offset + 4).map(importImage))
  }
}
