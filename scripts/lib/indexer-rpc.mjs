export const RPC_USER_AGENT = 'dontblink-indexer/1.0 (+https://dontblink.community)'
export const RPC_BACKOFF = [2_000, 5_000, 10_000, 20_000, 40_000, 60_000]

/** Retry transport failures on one endpoint. Never substitute a lagging RPC. */
export function createRpc(url, {
  fetchFn = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  backoff = RPC_BACKOFF, timeoutMs = 30_000,
  warn = message => console.error(message),
} = {}) {
  let id = 0
  return async function rpc(method, params) {
    const requestId = ++id
    for (let attempt = 0; ; attempt++) {
      let response
      let failure
      try {
        const r = await fetchFn(url, {
          method: 'POST', signal: AbortSignal.timeout(timeoutMs),
          headers: { 'content-type': 'application/json', 'user-agent': RPC_USER_AGENT },
          body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
        })
        const raw = await r.text()
        // Do not log HTML challenges, request parameters or response payloads.
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        try { response = JSON.parse(raw) } catch { throw new Error('non-JSON response') }
        if (!response || typeof response !== 'object' || Array.isArray(response)
          || response.jsonrpc !== '2.0' || response.id !== requestId
          || (!Object.hasOwn(response, 'result') && !response.error)) {
          throw new Error('invalid JSON-RPC response')
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : 'transport failure'
      }
      if (!failure && response.error) {
        // A valid business error cannot be fixed by repeating the same call.
        const message = String(response.error.message ?? 'JSON-RPC error')
        const business = [3, -32600, -32601, -32602].includes(response.error.code) || /execution reverted/i.test(message)
        if (!business && (/too many requests|rate limit/i.test(message) || response.error.code === 429)) failure = 'RPC rate limit'
        else throw new Error(`${method}: ${message}`)
      }
      if (!failure) return response.result
      if (attempt >= backoff.length) throw new Error(`${method}: ${failure}; retries exhausted (${attempt + 1} attempts)`)
      warn(`${method}: ${failure}; retry ${attempt + 1}/${backoff.length} in ${backoff[attempt]}ms`)
      await sleep(backoff[attempt])
    }
  }
}

export function validSnapshot(value) {
  const at = typeof value?.at === 'number' ? value.at : Date.parse(value?.at)
  return Number.isFinite(at) && at > 0 && Array.isArray(value?.tokens) && value.tokens.length > 0
    && value.tokens.every(row => /^0x[0-9a-f]{40}$/i.test(row?.token ?? ''))
    && value.scan !== null && typeof value.scan === 'object' && !Array.isArray(value.scan)
}
