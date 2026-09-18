#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { address, SCHEMA, DISCLAIMER } from './generate.mjs'
import { validateTokenLifecycle, validateDirectoryLifecycle } from './lifecycle.mjs'

export function parseJsonResponse(response, body, expectedSchema) {
  if (!response.ok) return { recognized: null, reason: `http_${response.status}`, transportStatus: response.status }
  if (!/application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('Successful response is not JSON (possible SPA fallback)')
  let data
  try { data = JSON.parse(body) } catch { throw new Error('Invalid JSON response (possible HTML fallback)') }
  if (data.schema !== expectedSchema) throw new Error(`Unexpected API schema: ${data.schema}`)
  return data
}

export function validateRecord(record, chainId, token) {
  assert.equal(record.schema, SCHEMA)
  assert.equal(record.chainId, chainId)
  assert.equal(record.token, address(token))
  assert.equal(record.audited, false)
  assert.equal(record.riskAssessed, false)
  assert.equal(record.disclaimer, DISCLAIMER)
  assert(record.recognized === true || record.recognized === null)
  assert.equal(record.lpLocked, null, 'Current exporter has no LP custody proof')
  assert.equal(record.lpLockContract, null)
  assert(Number.isFinite(Date.parse(record.sourceSnapshotAt)))
  assert(Number.isFinite(Date.parse(record.generatedAt)))
  if (record.recognized === null) { assert.equal(record.reason, 'not_in_current_registry'); return }
  assert(['factory', 'clone', 'registered'].includes(record.source))
  assert.equal(record.launchedOnDontblink, record.source !== 'registered')
  assert(['v1', 'instant', 'queue', 'curve', 'sale', 'wink', 'unknown'].includes(record.launchMode))
  assert.equal(address(record.pool, true), record.pool)
  assert(record.poolId === null || (/^0x[0-9a-f]{64}$/.test(record.poolId) && !/^0x0+$/.test(record.poolId)))
  assert.equal(record.lpLockEvidence, null)
  assert(record.evidence?.kind === 'registry' || record.evidence?.kind === 'event')
  if (record.evidence.kind === 'event') {
    assert.equal(address(record.evidence.emitter), record.evidence.emitter)
    assert(/^0x[0-9a-f]{64}$/.test(record.evidence.topic0))
    assert(/^0x[0-9a-f]{64}$/.test(record.evidence.transactionHash) && !/^0x0+$/.test(record.evidence.transactionHash))
    assert(Number.isSafeInteger(record.evidence.blockNumber) && record.evidence.blockNumber > 0)
  } else {
    assert.equal(record.evidence.uri, 'https://dontblink.community/data/ours.json')
    assert(/^[0-9a-f]{64}$/.test(record.evidence.inputSha256))
  }
  if (record.source === 'registered') {
    assert.equal(record.evidence.kind, 'event')
    assert.equal(record.evidence.line, 'wink')
    assert.equal(record.launchMode, 'wink')
  }
  assert(record.tokenUrl.startsWith('https://dontblink.community/'))
  assert(Number.isFinite(Date.parse(record.sourceSnapshotAt)))
  assert(Number.isFinite(Date.parse(record.generatedAt)))
  assert(!('imageUrl' in record) && !('gt' in record))
  if (record.lifecycle !== undefined) validateTokenLifecycle(record)
}
export function validateIndex(index) {
  if (index.lifecycle !== undefined) validateDirectoryLifecycle(index)
  assert.equal(index.schema, 'dontblink.verified.index.v1')
  assert.equal(index.chainId, 4663)
  assert.equal(index.scannedToBlock, null, 'A legacy cursor is not complete coverage')
  assert.equal(index.coverage.status, 'partial')
  assert.equal(index.coverage.absentMeans, 'unknown')
  assert.equal(index.count, index.tokens.length)
  assert.equal(index.source.uri, 'https://dontblink.community/data/ours.json')
  assert(/^[0-9a-f]{64}$/.test(index.source.sha256))
  assert.equal(new Set(index.tokens.map((row) => address(row.token))).size, index.count)
  assert(Number.isFinite(Date.parse(index.generatedAt)))
  assert(Number.isFinite(Date.parse(index.sourceSnapshotAt)))
}

export async function verifyDirectory(directory) {
  const dir = resolve(directory)
  const index = JSON.parse(await readFile(resolve(dir, 'index.json'), 'utf8'))
  validateIndex(index)
  const canonical = JSON.parse(await readFile(resolve(dir, `${index.chainId}/index.json`), 'utf8'))
  assert.deepEqual(canonical, index)
  const records = []
  for (const summary of index.tokens) {
    const record = JSON.parse(await readFile(resolve(dir, `${index.chainId}/${summary.token}.json`), 'utf8'))
    validateRecord(record, index.chainId, summary.token)
    assert.equal(record.recognized, true)
    if (index.lifecycle) validateTokenLifecycle(record, index.lifecycle.inputs)
    else assert.equal(record.lifecycle, undefined)
    records.push(record)
    for (const key of Object.keys(summary)) assert.deepEqual(record[key], summary[key], `Index disagrees on ${summary.token}.${key}`)
    assert.deepEqual(JSON.parse(await readFile(resolve(dir, `${summary.token}.json`), 'utf8')), record)
  }
  if (index.lifecycle) validateDirectoryLifecycle(index, records)
  const indexed = new Set(index.tokens.map((row) => row.token))
  let tombstones = 0
  for (const file of await readdir(resolve(dir, String(index.chainId)))) {
    if (!/^0x[0-9a-f]{40}\.json$/.test(file)) continue
    const token = file.slice(0, -5)
    if (indexed.has(token)) continue
    const record = JSON.parse(await readFile(resolve(dir, `${index.chainId}/${file}`), 'utf8'))
    validateRecord(record, index.chainId, token)
    assert.equal(record.recognized, null, 'Unindexed old positive would survive copy-without-delete')
    assert.deepEqual(JSON.parse(await readFile(resolve(dir, file), 'utf8')), record)
    tombstones++
  }
  const chains = JSON.parse(await readFile(resolve(dir, 'chains.json'), 'utf8'))
  assert.equal(chains.schema, 'dontblink.verified.chains.v1')
  assert.equal(chains.legacyAliasChainId, 4663)
  assert.deepEqual(chains.chains.map((chain) => chain.chainId), [4663])
  for (const file of await readdir(dir)) {
    if (!/^0x[0-9a-f]{40}\.json$/.test(file)) continue
    const alias = JSON.parse(await readFile(resolve(dir, file), 'utf8'))
    assert.deepEqual(alias, JSON.parse(await readFile(resolve(dir, `${index.chainId}/${file}`), 'utf8')), 'Every legacy alias must belong to this chain')
  }
  return { count: index.count, tombstones, coverage: index.coverage.status, sourceSnapshotAt: index.sourceSnapshotAt }
}

export async function verifyHttp(base, all = false) {
  const url = new URL(base.endsWith('/') ? base : `${base}/`)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Expected HTTP(S) base URL')
  const get = async (path, schema) => {
    const response = await fetch(new URL(path, url), { signal: AbortSignal.timeout(30_000), headers: { Origin: 'https://gmgn.ai' } })
    const data = parseJsonResponse(response, await response.text(), schema)
    if (response.ok) {
      const cors = response.headers.get('access-control-allow-origin')
      assert(cors === '*' || cors === 'https://gmgn.ai', `GMGN browser Origin is not allowed for ${path}`)
    }
    return { data, response }
  }
  const { data: index, response } = await get('index.json', 'dontblink.verified.index.v1')
  validateIndex(index)
  const cors = response.headers.get('access-control-allow-origin')
  assert(cors === '*' || cors === 'https://gmgn.ai', 'GMGN browser Origin is not allowed by published host')
  const sample = all ? index.tokens : [...new Map([
    ...index.tokens.slice(0, 2), ...index.tokens.filter((t) => t.source === 'registered').slice(0, 2), ...index.tokens.slice(-1),
  ].map((row) => [row.token, row])).values()]
  for (const row of sample) {
    const { data } = await get(`${index.chainId}/${row.token}.json`, SCHEMA)
    validateRecord(data, index.chainId, row.token)
    assert.equal(data.recognized, true)
    if (index.lifecycle) validateTokenLifecycle(data, index.lifecycle.inputs)
    else assert.equal(data.lifecycle, undefined)
    for (const key of Object.keys(row)) assert.deepEqual(data[key], row[key])
    const alias = await get(`${row.token}.json`, SCHEMA)
    assert.deepEqual(alias.data, data)
  }
  const canonical = await get(`${index.chainId}/index.json`, index.schema)
  assert.deepEqual(canonical.data, index)
  let absent = '0x0000000000000000000000000000000000000001'
  const present = new Set(index.tokens.map((t) => t.token))
  for (let n = 2; present.has(absent); n++) absent = `0x${n.toString(16).padStart(40, '0')}`
  const unknown = await get(`${index.chainId}/${absent}.json`, SCHEMA)
  assert(unknown.response.status === 404 || unknown.response.ok, 'Unknown-address request must not fail with a server or authorization error')
  assert.equal(unknown.data.recognized, null, 'Unknown address must never inherit an SPA or another token response')
  if (unknown.response.ok) validateRecord(unknown.data, index.chainId, absent)
  const otherChain = await get(`56/${index.tokens[0].token}.json`, SCHEMA)
  assert(otherChain.response.status === 404 || otherChain.response.ok, 'Unsupported-chain probe failed at the transport layer')
  assert.equal(otherChain.data.recognized, null, 'A Robinhood address must not be recognized on an unsupported chain')
  if (otherChain.response.ok) {
    assert.equal(otherChain.data.chainId, 56)
    assert.equal(otherChain.data.token, index.tokens[0].token)
  }
  return { count: index.count, checkedTokens: sample.length, cors, unknownStatus: unknown.response.status,
    unknownVerdict: 'unknown', unsupportedChainStatus: otherChain.response.status,
    generatedAt: index.generatedAt, sourceSnapshotAt: index.sourceSnapshotAt, coverage: index.coverage.status }
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--url' && args[1]) console.log(JSON.stringify(await verifyHttp(args[1], args.includes('--all'))))
  else if (args[0]) console.log(JSON.stringify(await verifyDirectory(args[0])))
  else throw new Error('Usage: node verify.mjs <output/data/verified> | --url <base-url> [--all]')
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
