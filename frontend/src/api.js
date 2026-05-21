const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handle(res) {
  if (res.status === 409) {
    const data = await res.json()
    const err = new Error('Conflict')
    err.status = 409
    err.data = data
    throw err
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const getDocuments = (params = {}) => {
  const url = new URL(`${BASE}/documents`)
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v))
  return fetch(url).then(handle)
}

export const getCategories = (type) => {
  const url = new URL(`${BASE}/categories`)
  if (type) url.searchParams.set('type', type)
  return fetch(url).then(handle)
}

export const createDocument = (formData) =>
  fetch(`${BASE}/documents`, { method: 'POST', body: formData }).then(handle)

export const bulkImport = (data) =>
  fetch(`${BASE}/documents/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handle)

export const createCategory = (data) =>
  fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(handle)

export const getNotes = (docId) =>
  fetch(`${BASE}/documents/${docId}/notes`).then(handle)
