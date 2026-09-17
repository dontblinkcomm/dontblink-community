// Shared by the production ours.mjs patch and the bounded evidence replay.
// Public Doppler factory/implementation identity is never proof of a dontblink launch.
const ADDRESS = /^0x[0-9a-f]{40}$/i
const WORD = /^0x[0-9a-f]{64}$/i
const nonzero = (v, pattern) => typeof v === 'string' && pattern.test(v) && !/^0x0+$/i.test(v)
export const isPoolId = value => nonzero(value, WORD)
const topicAddress = value => WORD.test(value ?? '') && /^0x0{24}/i.test(value) ? `0x${value.slice(-40)}`.toLowerCase() : null
const finite = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null
const nonnegative = value => { const n = finite(value); return n !== null && n >= 0 ? n : null }

export function launchProvenance(log, event) {
  const blockNumber = Number(log.blockNumber)
  if (!ADDRESS.test(log.address ?? '') || !WORD.test(log.topics?.[0] ?? '') || !WORD.test(log.transactionHash ?? '') || !Number.isSafeInteger(blockNumber) || blockNumber < 0 || log.removed) throw new Error('Invalid launch event evidence')
  return { event, topic0: log.topics[0].toLowerCase(), emitter: log.address.toLowerCase(), transactionHash: log.transactionHash.toLowerCase(), blockNumber }
}

export function winkLaunch(log, line, previous, metadata = {}) {
  const emitter = line.launchers.find(l => l.address.toLowerCase() === String(log.address).toLowerCase())
  const token = topicAddress(log.topics?.[1]), creator = topicAddress(log.topics?.[2])
  if (!emitter || String(log.topics?.[0]).toLowerCase() !== line.deployEvent.topic0.toLowerCase() || !token || !creator || /^0x0+$/.test(token) || Number(log.blockNumber) < emitter.deployBlock) throw new Error('Unverified Wink launch')
  const provenance = launchProvenance(log, 'WinkModeLaunched')
  const old = previous?.token?.toLowerCase() === token ? previous : {}
  return {
    ...old, token, pool: null, poolId: isPoolId(old.poolId) ? old.poolId.toLowerCase() : null,
    mode: 'wink', source: 'registered', creator,
    name: metadata.name || old.name || token,
    symbol: metadata.symbol || old.symbol || token.slice(-4),
    imageUrl: old.imageUrl ?? null, createdBlock: provenance.blockNumber, createdAt: old.createdAt ?? null,
    provenance,
  }
}

/** Only base-side, token-matched V4 pools: using quote-side pricing would price the wrong asset. */
export function selectWinkPool(token, response) {
  if (!Array.isArray(response?.data)) throw new Error('Invalid GT token pools response')
  const expected = `robinhood_${token.toLowerCase()}`
  return response.data.filter(p => isPoolId(p.attributes?.address) && p.relationships?.base_token?.data?.id?.toLowerCase() === expected)
    .sort((a, b) => (nonnegative(b.attributes.reserve_in_usd) ?? -1) - (nonnegative(a.attributes.reserve_in_usd) ?? -1) || String(a.attributes.address).localeCompare(String(b.attributes.address)))[0] ?? null
}

export function applyWinkPool(row, response, observedAt) {
  if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('GT observation time is required')
  const p = selectWinkPool(row.token, response)
  // A failed/empty discovery never erases previously measured price or its timestamp.
  if (!p) return row
  const a = p.attributes, base = response.included?.find(t => t.id === p.relationships.base_token.data.id)?.attributes
  const buys = nonnegative(a.transactions?.h24?.buys), sells = nonnegative(a.transactions?.h24?.sells)
  const image = base?.image_url
  return {
    ...row, pool: null, poolId: a.address.toLowerCase(),
    name: base?.name || row.name, symbol: base?.symbol || row.symbol,
    imageUrl: row.imageUrl ?? (image && image !== 'missing.png' ? image : null),
    gt: {
      price: nonnegative(a.base_token_price_usd), c1h: finite(a.price_change_percentage?.h1), c24h: finite(a.price_change_percentage?.h24),
      vol: nonnegative(a.volume_usd?.h24), fdv: nonnegative(a.fdv_usd), tx: buys !== null && sells !== null ? buys + sells : null,
      at: a.pool_created_at ?? null, pAt: observedAt, name: a.name ?? null, dex: p.relationships?.dex?.data?.id ?? null,
      img: image && image !== 'missing.png' ? image : null,
    },
  }
}
