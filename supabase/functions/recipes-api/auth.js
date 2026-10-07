import { ApiError } from './validation.js'
const encoder = new TextEncoder()
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
const decode = (value) =>
  Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (character) => character.charCodeAt(0)
  )

export async function digest(value) {
  return encode(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  )
}
export async function passwordMatches(input, expected) {
  if (typeof input !== 'string' || input.length > 1000) return false
  const a = await digest(input)
  const b = await digest(expected)
  let mismatch = 0
  for (let index = 0; index < a.length; index++)
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return mismatch === 0
}
async function signingKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}
export async function issueSession(secret, password, now = Date.now()) {
  const payload = encode(
    encoder.encode(
      JSON.stringify({
        exp: Math.floor(now / 1000) + 30 * 86400,
        version: await digest(password)
      })
    )
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    encoder.encode(payload)
  )
  return `${payload}.${encode(new Uint8Array(signature))}`
}
export async function verifySession(token, secret, password, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 2000) throw new Error()
    const parts = token.split('.')
    if (
      parts.length !== 2 ||
      !(await crypto.subtle.verify(
        'HMAC',
        await signingKey(secret),
        decode(parts[1]),
        encoder.encode(parts[0])
      ))
    )
      throw new Error()
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0])))
    if (
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(now / 1000) ||
      payload.version !== (await digest(password))
    )
      throw new Error()
    return true
  } catch {
    throw new ApiError(401, 'Logg inn på nytt for å fortsette.')
  }
}
