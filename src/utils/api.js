import { API_URL } from '../config'

// ---------------------------------------------------------------------------
// In-flight request deduplication map: prevents the same GET URL from being
// fetched multiple times simultaneously (e.g. fast re-renders, HMR reloads).
// ---------------------------------------------------------------------------
const _inflightRequests = new Map()

// Cache TTL: 5 minutes for GET responses.
const CACHE_TTL_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Helper: sleep for `ms` milliseconds.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Helper: raw fetch with exponential backoff retry on 429 Too Many Requests.
// Retries up to `maxRetries` times, starting with `initialDelayMs` (doubles
// each attempt).
// ---------------------------------------------------------------------------
const fetchWithRetry = async (url, options = {}, maxRetries = 3, initialDelayMs = 2000) => {
  let delay = initialDelayMs
  let res
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt < maxRetries) {
      console.warn(
        `[api] 429 received for ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
      )
      await sleep(delay)
      delay *= 2 // exponential backoff
    }
  }
  // All retries exhausted — return the last response as-is so callers can handle it.
  return res
}

// ---------------------------------------------------------------------------
// cachedFetch
//
// A fetch wrapper that:
//   1. Caches GET responses in sessionStorage for CACHE_TTL_MS (5 min).
//   2. Deduplicates concurrent GET requests for the same URL.
//   3. Retries automatically with exponential backoff on 429 (up to 3 times).
//   4. Invalidates ALL cached GET entries on any POST (mutation) request.
//
// Usage:
//   import { cachedFetch } from '../utils/api'
//   const res = await cachedFetch(`${API_URL}?action=getTrips`)
// ---------------------------------------------------------------------------
export const cachedFetch = async (url, options = {}) => {
  const isGet = !options.method || options.method.toUpperCase() === 'GET'

  // ── POST / mutation path ───────────────────────────────────────────────────
  if (!isGet) {
    // Invalidate all cached GET responses so next load is fresh.
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith('api_cache_')) keysToRemove.push(key)
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))

    // Execute mutation request directly (no caching, no retry).
    return fetch(url, options)
  }

  // ── GET path ───────────────────────────────────────────────────────────────
  const cacheKey = `api_cache_${url}`

  // 1. Serve from sessionStorage if still fresh.
  const stored = sessionStorage.getItem(cacheKey)
  if (stored) {
    try {
      const { data, timestamp } = JSON.parse(stored)
      if (Date.now() - timestamp < CACHE_TTL_MS) {
        return makeMockResponse(data)
      }
    } catch {
      sessionStorage.removeItem(cacheKey)
    }
  }

  // 2. Deduplicate: reuse an in-flight promise for the same URL.
  if (_inflightRequests.has(url)) {
    try {
      const text = await _inflightRequests.get(url)
      return makeMockResponse(text)
    } catch (err) {
      throw err
    }
  }

  // 3. Fetch from network with retry; register in flight-map while pending.
  const fetchPromise = fetchWithRetry(url, options).then(async (res) => {
    if (res.ok) {
      try {
        const text = await res.clone().text()
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: text, timestamp: Date.now() }))
        return text
      } catch (e) {
        console.warn('[api] Failed to cache response:', e)
        return res.text()
      }
    }
    // Non-OK response after retries — throw so callers see the error.
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
  })

  _inflightRequests.set(url, fetchPromise)
  try {
    const text = await fetchPromise
    _inflightRequests.delete(url)
    return makeMockResponse(text)
  } catch (err) {
    _inflightRequests.delete(url)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Internal helper: returns a Response-like object from a cached text string.
// ---------------------------------------------------------------------------
function makeMockResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(text),
    text: async () => text,
    clone() { return this },
  }
}
