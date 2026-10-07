import assert from 'node:assert/strict'
const url = (process.env.VITE_RECIPE_API_URL || '').replace(/\/$/, '')
const password = process.env.SITE_PASSWORD
if (!url || !password)
  throw new Error('Set VITE_RECIPE_API_URL and SITE_PASSWORD locally.')
const origin = 'https://woznor.github.io'
let token = ''
async function request(path, options = {}, session = true) {
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      Origin: origin,
      ...(session && token ? { 'x-recipe-session': token } : {}),
      ...options.headers
    }
  })
}
function form(recipe, image = null, removeImage = false) {
  const body = new FormData()
  body.set('recipe', JSON.stringify(recipe))
  body.set('removeImage', String(removeImage))
  if (image) body.set('image', image, 'test.png')
  return body
}
assert.equal((await request('/recipes', {}, false)).status, 401)
assert.equal(
  (
    await request(
      '/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'deliberately-wrong-test-password' })
      },
      false
    )
  ).status,
  401
)
const login = await request(
  '/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  },
  false
)
assert.equal(login.status, 200, 'Backend login failed')
token = (await login.json()).token
assert.equal((await request('/session')).status, 200)
const before = await (await request('/recipes')).json()
assert(Array.isArray(before) && before.length > 0)
console.log(
  `Verified authenticated access to ${before.length} recipes; ${before.filter((recipe) => recipe.has_uploaded_image).length} stored images.`
)
const recipe = {
  name: `Temporary verification ${crypto.randomUUID()}`,
  portions: 1,
  meal_types: [0, 1],
  ingredients: [{ name: 'Egg', amount: 2, unit: 'stk', grams: 110 }],
  protein_addons: [],
  steps: ['Test only.'],
  nutrients: { calories: 150, protein: 12, carbs: 1, fat: 10, fibre: 0 }
}
const photo = new Blob(
  [
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64'
    )
  ],
  { type: 'image/png' }
)
let created
let duplicated
try {
  const response = await request('/recipes', {
    method: 'POST',
    body: form(recipe, photo)
  })
  assert.equal(response.status, 201, 'Create failed')
  created = await response.json()
  assert(created.has_uploaded_image && created.image)
  assert.equal(
    (await fetch(created.image)).status,
    200,
    'Signed image unavailable'
  )
  const previous = structuredClone(created)
  const copyForm = form({ ...created, name: `${recipe.name} copy` })
  copyForm.set('copyFrom', String(created.id))
  const copyResponse = await request('/recipes', {
    method: 'POST',
    body: copyForm
  })
  assert.equal(copyResponse.status, 201, 'Duplication failed')
  duplicated = await copyResponse.json()
  assert.notEqual(duplicated.id, created.id)
  assert.notEqual(
    new URL(duplicated.image).pathname,
    new URL(created.image).pathname
  )
  const edit = await request(`/recipes/${created.id}`, {
    method: 'PATCH',
    body: form({ ...created, name: `${recipe.name} edited` }, photo)
  })
  assert.equal(edit.status, 200, 'Edit failed')
  created = await edit.json()
  assert.equal(
    (
      await request(`/recipes/${created.id}`, {
        method: 'PATCH',
        body: form(previous)
      })
    ).status,
    409,
    'Stale edit accepted'
  )
  const remove = await request(`/recipes/${created.id}`, {
    method: 'PATCH',
    body: form(created, null, true)
  })
  assert.equal(remove.status, 200, 'Image removal failed')
  created = await remove.json()
  assert.equal(created.image, null)
  assert.equal(created.has_uploaded_image, false)
  console.log(
    'Verified create, edit, image upload/replacement/removal and stale-edit rejection.'
  )
} finally {
  for (const target of [created, duplicated].filter(Boolean)) {
    if (target === duplicated)
      assert.equal(
        (await fetch(target.image)).status,
        200,
        'Duplicate image lost after deleting original'
      )
    const response = await request(`/recipes/${target.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: target.version })
    })
    assert.equal(response.status, 200, 'Test recipe cleanup failed')
  }
}
const after = await (await request('/recipes')).json()
const stable = (rows) =>
  rows.map((row) => ({
    ...row,
    image:
      row.has_uploaded_image && row.image
        ? new URL(row.image).pathname
        : row.image
  }))
const { isDeepStrictEqual } = await import('node:util')
assert(
  isDeepStrictEqual(stable(after), stable(before)),
  'Original recipes changed during verification'
)
console.log('Verified deletion; all original recipes are unchanged.')
