import { ApiError, validateRecipe, validateImage } from './validation.js'
import { digest, issueSession, passwordMatches, verifySession } from './auth.js'

const bucket = 'recipe-images'
async function readBody(request) {
  const limit = 6 * 1024 * 1024 + 256 * 1024
  if (Number(request.headers.get('content-length')) > limit)
    throw new ApiError(413, 'Filen eller oppskriften er for stor.')
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new ApiError(413, 'Filen eller oppskriften er for stor.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
function check(result) {
  if (result.error) throw new Error('Database or storage operation failed')
  return result.data
}

export function createHandler({ db, password, secret, origins }) {
  if (!password || !secret || secret.length < 32 || !origins.length)
    throw new Error('Missing backend configuration')
  return async (request) => {
    const origin = request.headers.get('origin')
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Headers': 'content-type, x-recipe-session',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      Vary: 'Origin'
    }
    if (origins.includes(origin))
      headers['Access-Control-Allow-Origin'] = origin
    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers })
    let uploadedPath = null
    let committed = false
    try {
      if (origin && !origins.includes(origin))
        throw new ApiError(403, 'Denne siden har ikke tilgang.')
      if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers })
      const path =
        new URL(request.url).pathname
          .replace(/^.*\/recipes-api/, '')
          .replace(/\/$/, '') || '/'
      if (path === '/login' && request.method === 'POST') {
        const address =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown'
        const allowed = check(
          await db.rpc('recipe_login_allowed', {
            limit_key: await digest(`${secret}:${address}`)
          })
        )
        if (!allowed)
          throw new ApiError(
            429,
            'For mange forsøk. Vent 15 minutter før du prøver igjen.'
          )
        const body = JSON.parse(
          new TextDecoder().decode(await readBody(request))
        )
        if (!(await passwordMatches(body.password, password)))
          throw new ApiError(401, 'Feil passord. Prøv igjen.')
        return respond({ token: await issueSession(secret, password) })
      }
      await verifySession(
        request.headers.get('x-recipe-session'),
        secret,
        password
      )
      if (path === '/session' && request.method === 'GET')
        return respond({ valid: true })

      async function present(row) {
        let image = row.external_image || null
        if (row.image_path)
          image = check(
            await db.storage.from(bucket).createSignedUrl(row.image_path, 86400)
          ).signedUrl
        return {
          ...row.recipe,
          id: row.id,
          image,
          has_uploaded_image: !!row.image_path,
          version: row.version
        }
      }
      if (path === '/recipes' && request.method === 'GET') {
        const rows = check(
          await db.from('recipes').select('*').order('id').limit(1000)
        )
        return respond(await Promise.all(rows.map(present)))
      }
      const match = path.match(/^\/recipes\/(\d+)$/)
      const id = match ? Number(match[1]) : null
      if (id !== null && (!Number.isSafeInteger(id) || id < 1))
        throw new ApiError(400, 'Ugyldig oppskrifts-ID.')
      const creating = path === '/recipes' && request.method === 'POST'
      if (creating || (match && request.method === 'PATCH')) {
        const body = await readBody(request)
        const form = await new Request(request.url, {
          method: 'POST',
          headers: {
            'Content-Type': request.headers.get('content-type') || ''
          },
          body
        }).formData()
        const value = JSON.parse(String(form.get('recipe')))
        const recipe = validateRecipe(value)
        let existing = null
        if (!creating) {
          existing = check(
            await db.from('recipes').select('*').eq('id', id).maybeSingle()
          )
          if (!existing)
            throw new ApiError(404, 'Oppskriften finnes ikke lenger.')
          if (value.version !== existing.version)
            throw new ApiError(
              409,
              'Oppskriften er endret av noen andre. Last den på nytt før du lagrer.'
            )
        }
        let imagePath = existing?.image_path || null
        let externalImage = existing?.external_image || null
        let copySource = null
        if (creating && form.has('copyFrom')) {
          const copyId = Number(form.get('copyFrom'))
          if (!Number.isSafeInteger(copyId) || copyId < 1)
            throw new ApiError(400, 'Ugyldig oppskrift å kopiere.')
          copySource = check(
            await db.from('recipes').select('*').eq('id', copyId).maybeSingle()
          )
          if (!copySource)
            throw new ApiError(404, 'Originaloppskriften finnes ikke lenger.')
          externalImage = copySource.external_image || null
        }
        if (form.get('removeImage') === 'true') {
          imagePath = null
          externalImage = null
        }
        const file = form.get('image')
        if (file && typeof file !== 'string' && file.size) {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const extension = validateImage(bytes, file.type)
          uploadedPath = `${crypto.randomUUID()}.${extension}`
          check(
            await db.storage.from(bucket).upload(uploadedPath, bytes, {
              contentType: file.type,
              upsert: false
            })
          )
          imagePath = uploadedPath
          externalImage = null
        } else if (
          copySource?.image_path &&
          form.get('removeImage') !== 'true'
        ) {
          const extension = copySource.image_path.split('.').pop()
          uploadedPath = `${crypto.randomUUID()}.${extension}`
          check(
            await db.storage
              .from(bucket)
              .copy(copySource.image_path, uploadedPath)
          )
          imagePath = uploadedPath
          externalImage = null
        }
        const record = {
          recipe,
          image_path: imagePath,
          external_image: externalImage
        }
        let row
        if (creating)
          row = check(
            await db.from('recipes').insert(record).select('*').single()
          )
        else {
          row = check(
            await db
              .from('recipes')
              .update({ ...record, version: existing.version + 1 })
              .eq('id', id)
              .eq('version', existing.version)
              .select('*')
              .maybeSingle()
          )
          if (!row)
            throw new ApiError(
              409,
              'Oppskriften er endret av noen andre. Last den på nytt før du lagrer.'
            )
        }
        committed = true
        if (existing?.image_path && existing.image_path !== imagePath) {
          const cleanup = await db.storage
            .from(bucket)
            .remove([existing.image_path])
          if (cleanup.error) console.error('Old image cleanup failed')
        }
        // A saved recipe must still be returned if a temporary image signing error occurs.
        try {
          return respond(await present(row), creating ? 201 : 200)
        } catch {
          return respond(
            {
              ...row.recipe,
              id: row.id,
              image: null,
              has_uploaded_image: !!row.image_path,
              version: row.version
            },
            creating ? 201 : 200
          )
        }
      }
      if (match && request.method === 'DELETE') {
        const value = JSON.parse(
          new TextDecoder().decode(await readBody(request))
        )
        if (!Number.isInteger(value.version))
          throw new ApiError(400, 'Oppskriftens versjon mangler.')
        const row = check(
          await db
            .from('recipes')
            .delete()
            .eq('id', id)
            .eq('version', value.version)
            .select('*')
            .maybeSingle()
        )
        if (!row)
          throw new ApiError(
            409,
            'Oppskriften er endret eller slettet. Last oppskriftene på nytt.'
          )
        if (row.image_path) {
          const cleanup = await db.storage.from(bucket).remove([row.image_path])
          if (cleanup.error)
            console.error('Deleted recipe image cleanup failed')
        }
        return respond({ deleted: id })
      }
      throw new ApiError(404, 'Fant ikke endepunktet.')
    } catch (error) {
      if (uploadedPath && !committed)
        await db.storage
          .from(bucket)
          .remove([uploadedPath])
          .catch(() => {})
      if (error instanceof ApiError)
        return respond({ message: error.message }, error.status)
      if (error instanceof SyntaxError || error instanceof TypeError)
        return respond(
          { message: 'Ugyldige data. Kontroller oppskriften og prøv igjen.' },
          400
        )
      console.error('Recipe API operation failed')
      return respond(
        { message: 'Kunne ikke fullføre. Prøv igjen om et øyeblikk.' },
        500
      )
    }
  }
}
