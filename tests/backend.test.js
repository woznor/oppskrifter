import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHandler } from '../supabase/functions/recipes-api/handler.js'
import {
  issueSession,
  verifySession,
  passwordMatches
} from '../supabase/functions/recipes-api/auth.js'
import {
  validateRecipe,
  validateImage
} from '../supabase/functions/recipes-api/validation.js'

const password = 'test-only-password'
const secret = 'test-only-session-secret-at-least-32-characters'
const origin = 'https://example.test'
const recipe = {
  name: 'Testrett',
  portions: 1,
  meal_types: [2],
  steps: ['Stek maten.'],
  ingredients: [{ name: 'Egg', amount: 2, unit: 'stk', grams: 110 }],
  protein_addons: [],
  nutrients: { calories: 150, protein: 12, carbs: 1, fat: 10, fibre: 0 }
}

function database() {
  const db = {
    rows: [],
    files: new Set(),
    nextId: 1,
    attempts: 0,
    failWrite: false,
    failUpload: false
  }
  db.rpc = async () => ({ data: ++db.attempts <= 15, error: null })
  db.storage = {
    from: () => ({
      upload: async (path) => {
        if (db.failUpload) return { error: new Error('upload failure') }
        db.files.add(path)
        return { data: { path } }
      },
      remove: async (paths) => {
        paths.forEach((path) => db.files.delete(path))
        return { data: [] }
      },
      createSignedUrl: async (path) => ({
        data: { signedUrl: `https://storage.test/${path}?signed=true` }
      })
    })
  }
  db.from = () => {
    let operation = 'select'
    let record
    const conditions = []
    const query = {
      select() {
        return query
      },
      order() {
        return query
      },
      limit() {
        return query
      },
      eq(key, value) {
        conditions.push([key, value])
        return query
      },
      insert(value) {
        operation = 'insert'
        record = value
        return query
      },
      update(value) {
        operation = 'update'
        record = value
        return query
      },
      delete() {
        operation = 'delete'
        return query
      },
      async execute(single = false) {
        if (operation !== 'select' && db.failWrite)
          return { error: new Error('write failure') }
        let rows = db.rows.filter((row) =>
          conditions.every(([key, value]) => row[key] === value)
        )
        if (operation === 'insert') {
          const row = {
            ...structuredClone(record),
            id: db.nextId++,
            version: 1
          }
          db.rows.push(row)
          rows = [row]
        }
        if (operation === 'update')
          rows.forEach((row) => Object.assign(row, structuredClone(record)))
        if (operation === 'delete')
          db.rows = db.rows.filter((row) => !rows.includes(row))
        return {
          data: structuredClone(single ? rows[0] || null : rows),
          error: null
        }
      },
      maybeSingle() {
        return query.execute(true)
      },
      single() {
        return query.execute(true)
      },
      then(resolve, reject) {
        return query.execute().then(resolve, reject)
      }
    }
    return query
  }
  return db
}
async function setup() {
  const db = database()
  const handle = createHandler({ db, password, secret, origins: [origin] })
  const token = await issueSession(secret, password)
  const call = (path, options = {}, authorized = true) =>
    handle(
      new Request(`https://api.test/functions/v1/recipes-api${path}`, {
        ...options,
        headers: {
          origin,
          ...(authorized ? { 'x-recipe-session': token } : {}),
          ...options.headers
        }
      })
    )
  return { db, call }
}
function form(value = recipe, image = null, removeImage = false) {
  const body = new FormData()
  body.set('recipe', JSON.stringify(value))
  body.set('removeImage', String(removeImage))
  if (image) body.set('image', image, 'photo.jpg')
  return body
}
const photo = () =>
  new Blob([new Uint8Array([255, 216, 255, 224, 0, 1])], { type: 'image/jpeg' })

test('sessions reject forgery, expiry, missing tokens and password changes', async () => {
  const now = 1700000000000
  const token = await issueSession(secret, password, now)
  assert(await verifySession(token, secret, password, now))
  for (const [value, pass, time] of [
    [null, password, now],
    [`${token}a`, password, now],
    [token, 'changed', now],
    [token, password, now + 31 * 86400000]
  ])
    await assert.rejects(() => verifySession(value, secret, pass, time), {
      status: 401
    })
  assert(await passwordMatches(password, password))
  assert(!(await passwordMatches('wrong', password)))
})
test('all original recipes validate and invalid quantities cannot be persisted', () => {
  const backup = JSON.parse(
    fs.readFileSync(new URL('../data/meals.json', import.meta.url))
  )
  backup.forEach((value) => validateRecipe(value))
  assert.throws(() => validateRecipe({ ...recipe, portions: 0 }), {
    status: 400
  })
  assert.throws(() => validateRecipe({ ...recipe, meal_types: [4] }), {
    status: 400
  })
  assert.throws(
    () =>
      validateRecipe({
        ...recipe,
        ingredients: [{ name: 'Egg', amount: 1, unit: 'stk', grams: -1 }]
      }),
    { status: 400 }
  )
  const normalized = validateRecipe({
    ...recipe,
    id: 99,
    image_path: 'forged',
    image: 'forged'
  })
  assert(
    !('id' in normalized) &&
      !('image' in normalized) &&
      !('image_path' in normalized)
  )
})
test('API protects every data endpoint, rejects wrong passwords and limits attempts', async () => {
  const { call } = await setup()
  for (const [path, method] of [
    ['/recipes', 'GET'],
    ['/recipes', 'POST'],
    ['/recipes/1', 'PATCH'],
    ['/recipes/1', 'DELETE']
  ])
    assert.equal((await call(path, { method }, false)).status, 401)
  const login = (value) =>
    call(
      '/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: value })
      },
      false
    )
  assert.equal((await login('wrong')).status, 401)
  const response = await login(password)
  assert.equal(response.status, 200)
  assert(await verifySession((await response.json()).token, secret, password))
  for (let index = 0; index < 13; index++) await login('wrong')
  assert.equal((await login(password)).status, 429)
  assert.equal(
    (await call('/recipes', { headers: { origin: 'https://unapproved.test' } }))
      .status,
    403
  )
  const preflight = await call('/recipes', { method: 'OPTIONS' }, false)
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin)
})
test('recipe create/edit/delete persists data and prevents stale overwrites', async () => {
  const { db, call } = await setup()
  const created = await call('/recipes', { method: 'POST', body: form() })
  assert.equal(created.status, 201)
  const first = await created.json()
  const update = { ...first, name: 'Endret rett' }
  const saved = await call(`/recipes/${first.id}`, {
    method: 'PATCH',
    body: form(update)
  })
  assert.equal(saved.status, 200)
  const second = await saved.json()
  assert.equal(second.version, 2)
  assert.equal(
    (
      await call(`/recipes/${first.id}`, {
        method: 'PATCH',
        body: form(update)
      })
    ).status,
    409
  )
  assert.equal(
    (
      await call(`/recipes/${first.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: 1 })
      })
    ).status,
    409
  )
  assert.equal(db.rows[0].recipe.name, 'Endret rett')
  assert.equal(
    (
      await call(`/recipes/${first.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: 2 })
      })
    ).status,
    200
  )
  assert.equal((await (await call('/recipes')).json()).length, 0)
})
test('private images can be uploaded, replaced, removed and deleted with recipes', async () => {
  const { db, call } = await setup()
  let saved = await (
    await call('/recipes', { method: 'POST', body: form(recipe, photo()) })
  ).json()
  assert(saved.image.includes('signed=true'))
  assert.equal(db.files.size, 1)
  const previous = [...db.files][0]
  saved = await (
    await call(`/recipes/${saved.id}`, {
      method: 'PATCH',
      body: form(saved, photo())
    })
  ).json()
  assert.equal(db.files.size, 1)
  assert(!db.files.has(previous))
  saved = await (
    await call(`/recipes/${saved.id}`, {
      method: 'PATCH',
      body: form(saved, null, true)
    })
  ).json()
  assert.equal(saved.image, null)
  assert.equal(db.files.size, 0)
  saved = await (
    await call(`/recipes/${saved.id}`, {
      method: 'PATCH',
      body: form(saved, photo())
    })
  ).json()
  await call(`/recipes/${saved.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ version: saved.version })
  })
  assert.equal(db.files.size, 0)
})
test('failed writes clean up uploads and invalid images are rejected', async () => {
  const { db, call } = await setup()
  db.failWrite = true
  assert.equal(
    (await call('/recipes', { method: 'POST', body: form(recipe, photo()) }))
      .status,
    500
  )
  assert.equal(db.files.size, 0)
  db.failWrite = false
  const fake = new Blob(['not an image'], { type: 'image/jpeg' })
  assert.equal(
    (await call('/recipes', { method: 'POST', body: form(recipe, fake) }))
      .status,
    400
  )
  assert.equal(db.rows.length, 0)
  assert.throws(
    () => validateImage(new Uint8Array(6 * 1024 * 1024 + 1), 'image/jpeg'),
    { status: 400 }
  )
})
