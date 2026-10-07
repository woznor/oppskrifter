export const apiUrl = (import.meta.env.VITE_RECIPE_API_URL || '').replace(
  /\/$/,
  ''
)
const sessionKey = 'kamilla-backend-session-v1'
let token = ''
try {
  token = localStorage.getItem(sessionKey) || ''
} catch {
  /* Session can live in memory. */
}

export function setSession(value) {
  token = value || ''
  try {
    if (token) localStorage.setItem(sessionKey, token)
    else localStorage.removeItem(sessionKey)
  } catch {
    /* Keep the in-memory session when storage is unavailable. */
  }
}
export function hasSession() {
  return !!token
}
export async function apiRequest(path, options = {}) {
  if (!apiUrl) throw new Error('Backend er ikke konfigurert ennå.')
  const headers = { ...options.headers }
  if (token) headers['x-recipe-session'] = token
  let response
  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  } catch {
    throw new Error(
      'Kunne ikke koble til. Sjekk nettforbindelsen og prøv igjen.'
    )
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') {
      setSession('')
      window.dispatchEvent(new Event('recipe-session-expired'))
    }
    const error = new Error(
      data.message || 'Kunne ikke fullføre forespørselen.'
    )
    error.status = response.status
    throw error
  }
  return data
}
export async function login(password) {
  const data = await apiRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  setSession(data.token)
}
export function saveRecipe(recipe, file, removeImage, copyFrom = null) {
  const form = new FormData()
  form.set('recipe', JSON.stringify(recipe))
  form.set('removeImage', String(removeImage))
  if (copyFrom !== null) form.set('copyFrom', String(copyFrom))
  if (file) form.set('image', file)
  return apiRequest(recipe.id ? `/recipes/${recipe.id}` : '/recipes', {
    method: recipe.id ? 'PATCH' : 'POST',
    body: form
  })
}
