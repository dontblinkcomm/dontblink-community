// Additive lifecycle read model. Only exact chain/address references are joined.
// The public Thesis service is an attestation source, not proof of token ownership.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const THESIS_URL = 'https://dontblink-thesis.lawson-e69.workers.dev/board'
export const DIRECTORY_SCHEMA = 'dontblink.lifecycle.directory.v1'
export const TOKEN_SCHEMA = 'dontblink.lifecycle.token.v1'
const SNAPSHOT_SCHEMA = 'dontblink.lifecycle.thesis-snapshot.v1'
const LIMIT = 2 * 1024 * 1024
const hash = value => createHash('sha256').update(value).digest('hex')
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0+$/.test(value)
const iso = value => {
  if (value == null || value === '') throw new Error('Missing source timestamp')
  const n = new Date(value); if (!Number.isFinite(n.valueOf())) throw new Error('Invalid source timestamp')
  return n.toISOString()
}
const text = (value, max) => { if (typeof value !== 'string' || value.length > max) throw new Error('Invalid Thesis text'); return value }
const optionalAddress = value => { if (value == null || value === '') return null; if (!address(value)) throw new Error('Invalid Thesis address'); return value.toLowerCase() }
const unknownGmgn = () => ({ submission: { status: 'unknown', evidence: [] }, listing: { status: 'unknown', evidence: [] } })
const tokenId = token => `token:4663:${token}`

export function captureTheses(raw, observedAt = new Date().toISOString()) {
  if (Buffer.byteLength(raw) > LIMIT) throw new Error('Thesis response exceeds size limit')
  const body = JSON.parse(raw), observation = iso(observedAt), sourceAt = iso(body.at)
  if (body.chainId != null && body.chainId !== 4663) throw new Error('Thesis chain mismatch')
  if (!Array.isArray(body.theses) || body.theses.length > 2000) throw new Error('Invalid Thesis board')
  if (Date.parse(sourceAt) > Date.parse(observation) + 300_000) throw new Error('Thesis source timestamp is in the future')
  const ids = new Set()
  const records = body.theses.map(row => {
    if (!row || typeof row !== 'object' || !/^[0-9a-f]{12}$/.test(row.id) || ids.has(row.id)) throw new Error('Invalid or duplicate Thesis ID')
    ids.add(row.id)
    if ((row.chainId != null && row.chainId !== 4663) || (row.tokenChainId != null && row.tokenChainId !== 4663)) throw new Error('Thesis chain mismatch')
    const author = optionalAddress(row.author)
    if (!author) throw new Error('Missing Thesis author')
    const createdAt = iso(row.at), boundAt = row.boundAt == null ? null : iso(row.boundAt)
    if (Date.parse(createdAt) > Date.parse(sourceAt) + 300_000 || (boundAt && (Date.parse(boundAt) < Date.parse(createdAt) || Date.parse(boundAt) > Date.parse(sourceAt) + 300_000))) throw new Error('Invalid Thesis chronology')
    return { id: row.id, name: text(row.name, 200), ticker: text(row.ticker, 64), stock: text(row.stock, 64),
      author, token: optionalAddress(row.token), createdAt, boundAt, boundBy: optionalAddress(row.boundBy),
      uri: `https://dontblink.community/thesis/${row.id}` }
  }).sort((a, b) => a.id.localeCompare(b.id))
  // Deliberately exclude pitch text, supporter wallet lists and comments.
  return { schema: SNAPSHOT_SCHEMA, uri: THESIS_URL, observedAt: observation, sourceAt,
    responseSha256: hash(raw), recordsSha256: hash(JSON.stringify(records)), records }
}
export function validateLifecycleInput(input) {
  assert(input && typeof input === 'object')
  const { thesisSnapshot: snapshot, refresh } = input
  assert(refresh && ['not_attempted', 'ok', 'failed'].includes(refresh.status))
  assert(refresh.attemptedAt === null || iso(refresh.attemptedAt) === refresh.attemptedAt)
  assert(refresh.status === 'not_attempted' ? refresh.attemptedAt === null && refresh.reason === null : refresh.attemptedAt !== null)
  assert(refresh.status === 'failed' ? /^(http_\d{3}|invalid_response|network_error)$/.test(refresh.reason) : refresh.reason === null)
  if (snapshot === null) { assert.notEqual(refresh.status, 'ok'); return }
  assert.equal(snapshot.schema, SNAPSHOT_SCHEMA); assert.equal(snapshot.uri, THESIS_URL)
  assert(/^[0-9a-f]{64}$/.test(snapshot.responseSha256)); assert.equal(iso(snapshot.observedAt), snapshot.observedAt)
  // Round-trip through the actual normalizer validates every persisted row and chronology.
  const normalized = captureTheses(JSON.stringify({ at: snapshot.sourceAt, theses: snapshot.records.map(r => ({
    id: r.id, name: r.name, ticker: r.ticker, stock: r.stock, author: r.author, token: r.token,
    at: r.createdAt, boundAt: r.boundAt, boundBy: r.boundBy,
  })) }), snapshot.observedAt)
  assert.deepEqual(snapshot.records, normalized.records)
  assert.equal(snapshot.sourceAt, normalized.sourceAt)
  assert.equal(snapshot.recordsSha256, normalized.recordsSha256)
  if (refresh.status === 'ok') assert.equal(refresh.attemptedAt, snapshot.observedAt)
  if (refresh.attemptedAt) assert(Date.parse(refresh.attemptedAt) >= Date.parse(snapshot.observedAt))
}
export const emptyLifecycleInput = () => ({ thesisSnapshot: null, refresh: { status: 'not_attempted', attemptedAt: null, reason: null } })

// Invoked only from the existing ours producer hook, inside its existing publisher lock.
// A single bounded GET; optional lifecycle unavailability never invents an empty successful board.
export async function refreshTheses(previous = emptyLifecycleInput(), { fetchImpl = globalThis.fetch, observedAt = new Date().toISOString() } = {}) {
  validateLifecycleInput(previous)
  let reason = 'network_error'
  try {
    const response = await fetchImpl(THESIS_URL, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } })
    if (!response.ok) { reason = `http_${response.status}`; throw new Error(reason) }
    reason = 'invalid_response'
    if (!/application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error(reason)
    const reader = response.body?.getReader(); if (!reader) throw new Error(reason)
    const chunks = []; let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        size += value.length; if (size > LIMIT) throw new Error('Response too large')
        chunks.push(Buffer.from(value))
      }
    } finally { await reader.cancel().catch(() => {}) }
    const thesisSnapshot = captureTheses(Buffer.concat(chunks).toString('utf8'), observedAt)
    return { thesisSnapshot, refresh: { status: 'ok', attemptedAt: iso(observedAt), reason: null } }
  } catch {
    return { thesisSnapshot: previous.thesisSnapshot, refresh: { status: 'failed', attemptedAt: iso(observedAt), reason } }
  }
}
function origin(thesis, input) {
  const source = input.thesisSnapshot
  return { thesisId: thesis.id, uri: thesis.uri, author: thesis.author, createdAt: thesis.createdAt,
    relationship: 'service_reported_exact_token_reference', boundAt: thesis.boundAt, boundBy: thesis.boundBy,
    ownershipVerified: false, evidence: { kind: 'thesis_service_record', uri: THESIS_URL, id: thesis.id,
      observedAt: source.observedAt, responseSha256: source.responseSha256, recordsSha256: source.recordsSha256 } }
}
export function tokenLifecycle(record, input) {
  const linked = input.thesisSnapshot?.records.filter(r => r.token === record.token) ?? []
  return { schema: TOKEN_SCHEMA, projectId: tokenId(record.token), chainId: record.chainId, token: record.token,
    origin: { status: linked.length ? 'service_record_observed' : 'unknown', theses: linked.map(t => origin(t, input)) },
    launch: { status: record.evidence.kind === 'event' ? 'event_observed' : 'registry_observed',
      createdAt: record.createdAt, evidence: record.evidence }, gmgn: unknownGmgn() }
}
export function directoryLifecycle(records, input, generatedAt) {
  validateLifecycleInput(input)
  const snapshot = input.thesisSnapshot
  if (snapshot && Date.parse(snapshot.observedAt) > Date.parse(generatedAt) + 300_000) throw new Error('Lifecycle observation is in the future')
  if (input.refresh.attemptedAt && Date.parse(input.refresh.attemptedAt) > Date.parse(generatedAt) + 300_000) throw new Error('Lifecycle refresh is in the future')
  const known = new Set(records.map(r => r.token))
  const byToken = new Map()
  for (const thesis of snapshot?.records ?? []) {
    const list = byToken.get(thesis.token) ?? []; list.push(thesis); byToken.set(thesis.token, list)
  }
  const projects = records.filter(r => byToken.has(r.token)).map(r => ({ id: tokenId(r.token), kind: 'token', chainId: 4663, token: r.token,
    name: r.name, symbol: r.symbol, url: r.tokenUrl, record: `4663/${r.token}.json`,
    thesisIds: (byToken.get(r.token) ?? []).map(t => t.id),
    launchStatus: r.evidence.kind === 'event' ? 'event_observed' : 'registry_observed', gmgnStatus: 'unknown' }))
  for (const thesis of snapshot?.records ?? []) {
    if (known.has(thesis.token)) continue
    projects.push({ id: `thesis:${thesis.id}`, kind: 'thesis', chainId: 4663, token: thesis.token,
      name: thesis.name, symbol: thesis.ticker, url: thesis.uri, record: null, thesisIds: [thesis.id],
      launchStatus: 'unknown', gmgnStatus: 'unknown' })
  }
  projects.sort((a, b) => a.id.localeCompare(b.id))
  const ageSeconds = snapshot ? Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(snapshot.sourceAt)) / 1000)) : null
  return { schema: DIRECTORY_SCHEMA, generatedAt, inputs: input,
    coverage: { status: 'partial', absentMeans: 'unknown', supportedChainIds: [4663], otherChains: 'not_connected',
      thesis: { status: snapshot ? 'observed_subset' : 'unavailable', count: snapshot?.records.length ?? null,
        sourceAt: snapshot?.sourceAt ?? null, observedAt: snapshot?.observedAt ?? null, ageSeconds,
        freshness: snapshot ? ageSeconds > 7200 || input.refresh.status === 'failed' ? 'stale' : 'recent' : 'unavailable',
        staleAfterSeconds: 7200 },
      gmgn: 'no_submission_or_listing_evidence', limitations: [
        'Projects are observed token identities and public Thesis records, not a complete project or historical archive.',
        'The public Thesis board does not expose pagination/completeness or cryptographic binding proofs; names are never used to join.',
        'A service-reported token reference does not prove ownership, endorsement, or a token creation transaction.',
        'Unobserved launch and GMGN states mean unknown, not rejected, unlaunched, or unlisted.',
        'No other chain adapter or GMGN submission/listing observer is connected.',
      ] },
    tokenProjects: { count: records.length, indexPointer: '/tokens', recordTemplate: '4663/{token}.json', idTemplate: 'token:4663:{token}' },
    totalProjectCount: records.length + projects.filter(p => p.kind === 'thesis').length,
    pagination: { mode: 'bounded_snapshot', serverPagination: false, maxThesisRecords: 2000, maxThesisResponseBytes: LIMIT, nameMaxLength: 200, symbolMaxLength: 64 },
    count: projects.length, projects }
}
export function attachLifecycle(registry, input) {
  registry.index.lifecycle = directoryLifecycle(registry.records, input, registry.index.generatedAt)
  for (const record of registry.records) record.lifecycle = tokenLifecycle(record, input)
  return registry
}
export function validateTokenLifecycle(record, input) {
  const lifecycle = record.lifecycle
  assert.equal(lifecycle.schema, TOKEN_SCHEMA); assert.equal(lifecycle.chainId, record.chainId); assert.equal(lifecycle.token, record.token)
  assert.equal(lifecycle.projectId, tokenId(record.token)); assert.deepEqual(lifecycle.gmgn, unknownGmgn())
  assert.deepEqual(lifecycle.launch, { status: record.evidence.kind === 'event' ? 'event_observed' : 'registry_observed', createdAt: record.createdAt, evidence: record.evidence })
  assert.equal(lifecycle.origin.status, lifecycle.origin.theses.length ? 'service_record_observed' : 'unknown')
  for (const item of lifecycle.origin.theses) {
    assert.equal(item.relationship, 'service_reported_exact_token_reference'); assert.equal(item.ownershipVerified, false)
    assert.equal(item.evidence.kind, 'thesis_service_record'); assert.equal(item.evidence.uri, THESIS_URL)
    assert(/^[0-9a-f]{12}$/.test(item.thesisId)); assert.equal(item.thesisId, item.evidence.id)
    assert.equal(item.uri, `https://dontblink.community/thesis/${item.thesisId}`)
    assert(address(item.author)); assert.equal(iso(item.createdAt), item.createdAt)
    assert(item.boundBy === null || address(item.boundBy)); assert(item.boundAt === null || iso(item.boundAt) === item.boundAt)
    if (item.boundAt) assert(Date.parse(item.boundAt) >= Date.parse(item.createdAt))
    assert.equal(iso(item.evidence.observedAt), item.evidence.observedAt)
    assert(/^[0-9a-f]{64}$/.test(item.evidence.responseSha256)); assert(/^[0-9a-f]{64}$/.test(item.evidence.recordsSha256))
  }
  if (input) assert.deepEqual(lifecycle, tokenLifecycle(record, input))
}
export function validateDirectoryLifecycle(index, records) {
  const lifecycle = index.lifecycle
  assert.equal(lifecycle.schema, DIRECTORY_SCHEMA); validateLifecycleInput(lifecycle.inputs)
  assert.equal(lifecycle.generatedAt, index.generatedAt)
  assert.equal(lifecycle.count, lifecycle.projects.length)
  assert.equal(new Set(lifecycle.projects.map(p => p.id)).size, lifecycle.count)
  // Full derivation is checked when record metadata is available; HTTP samples still check identities and joins.
  const tokenProjects = lifecycle.projects.filter(p => p.kind === 'token')
  const referenced = new Set(lifecycle.inputs.thesisSnapshot?.records.map(t => t.token) ?? [])
  assert.deepEqual(tokenProjects.map(p => p.token).sort(), index.tokens.filter(t => referenced.has(t.token)).map(t => t.token).sort())
  for (const p of lifecycle.projects) {
    assert.equal(p.chainId, 4663); assert.equal(p.gmgnStatus, 'unknown')
    text(p.name, 200); text(p.symbol, 64); assert.equal(new URL(p.url).origin, 'https://dontblink.community')
    assert(['token', 'thesis'].includes(p.kind)); assert(['unknown', 'registry_observed', 'event_observed'].includes(p.launchStatus))
    if (p.kind === 'token') { assert.equal(p.id, tokenId(p.token)); assert.equal(p.record, `4663/${p.token}.json`); assert.notEqual(p.launchStatus, 'unknown') }
    else { assert.equal(p.record, null); assert.equal(p.launchStatus, 'unknown'); assert.equal(p.id, `thesis:${p.thesisIds[0]}`) }
  }
  // Re-derive also without metadata: preserves structural coverage, every thesis and all relationships.
  const placeholders = index.tokens.map(t => {
    const p = tokenProjects.find(p => p.token === t.token)
    return { ...t, name: p?.name, symbol: p?.symbol, tokenUrl: p?.url, evidence: { kind: p?.launchStatus === 'event_observed' ? 'event' : 'registry' } }
  })
  assert.deepEqual(lifecycle, directoryLifecycle(records ?? placeholders, lifecycle.inputs, index.generatedAt))
}
