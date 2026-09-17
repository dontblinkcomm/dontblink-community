#!/usr/bin/env node
/** Offline, dependency-free exporter. It consumes the maintained registry, never ticker heuristics. */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SOURCE_URL = 'https://dontblink.community/data/ours.json'
export const SCHEMA = 'dontblink.verified.v1'
export const DISCLAIMER = 'dontblink provides launch infrastructure. This is NOT an audit and NOT a risk rating.'
const ADDRESS = /^0x[0-9a-f]{40}$/
const HASH = /^0x[0-9a-f]{64}$/
const ZERO = `0x${'0'.repeat(40)}`
const MODES = new Set(['v1', 'instant', 'queue', 'curve', 'sale', 'wink', 'unknown'])
export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export function address(value, optional = false) {
  if (optional && (value == null || value === '' || String(value).toLowerCase() === ZERO)) return null
  if (typeof value !== 'string' || !ADDRESS.test(value.toLowerCase()) || value.toLowerCase() === ZERO) throw new Error(`Invalid address: ${value}`)
  return value.toLowerCase()
}
const block = (value) => Number.isSafeInteger(value) && value > 0 ? value : null
const iso = (value) => {
  if (value == null || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : ''

function eventEvidence(row, lines) {
  const p = row.provenance
  if (!p) return null
  const emitter = address(p.emitter)
  const line = lines.find((l) => l.launcher?.toLowerCase() === emitter || l.launchers?.some((g) => g.address.toLowerCase() === emitter))
  if (!line || p.topic0?.toLowerCase() !== line.deployEvent?.topic0?.toLowerCase()) throw new Error(`Unrecognized launch evidence for ${row.token}`)
  if (!block(p.blockNumber) || typeof p.transactionHash !== 'string' || !HASH.test(p.transactionHash.toLowerCase()) || /^0x0+$/.test(p.transactionHash)) throw new Error(`Incomplete launch evidence for ${row.token}`)
  const deploymentBlock = line.launchers?.find((g) => g.address.toLowerCase() === emitter)?.deployBlock ?? line.deployBlock
  if (p.blockNumber < deploymentBlock) throw new Error(`Event predates launcher deployment for ${row.token}`)
  if (!['v1', 'portal', 'wink'].includes(line.id)) throw new Error(`Unsupported primary event line ${line.id}`)
  if (row.createdBlock && row.createdBlock !== p.blockNumber) throw new Error(`Creation block disagrees with evidence for ${row.token}`)
  return { kind: 'event', line: line.id, emitter, topic0: p.topic0.toLowerCase(), transactionHash: p.transactionHash.toLowerCase(), blockNumber: p.blockNumber }
}

function launchMode(row, evidence, lines) {
  if (evidence?.line === 'v1') return 'v1'
  if (evidence?.line === 'wink') return 'wink'
  if (evidence?.line === 'portal') {
    const mode = row.provenance.portalMode
    if (mode === 0) return 'instant'
    if (mode === 1) return 'queue'
    if (mode === 2) return 'curve'
    if (mode === 3) {
      const handler = row.handlerEvidence
      const portal = lines.find((line) => line.id === 'portal')
      const valid = handler && handler.emitter?.toLowerCase() === portal?.launcher.toLowerCase() &&
        handler.topic0?.toLowerCase() === portal?.deployEvent.companion.topic0.toLowerCase() &&
        handler.transactionHash?.toLowerCase() === evidence.transactionHash && handler.blockNumber === evidence.blockNumber
      const registered = valid && lines.find((line) => line.modeId === handler.modeId && line.launcher?.toLowerCase() === handler.handler?.toLowerCase())
      return registered && MODES.has(registered.mode) ? registered.mode : 'unknown'
    }
    return 'unknown'
  }
  // Historical instant rows include known mislabelled Handler launches. Do not promote that label to verified fact.
  return row.mode === 'v1' ? 'v1' : 'unknown'
}

export function buildRegistry({ snapshot, manifest, inputSha256, generatedAt = new Date().toISOString(), sourceUrl = SOURCE_URL, chainId = 4663 }) {
  if (chainId !== 4663) throw new Error('Only the Robinhood registry is connected; another chain needs a separate authoritative adapter')
  if (sourceUrl !== SOURCE_URL) throw new Error('Unexpected registry source; do not treat arbitrary token lists as authoritative')
  if (!/^[0-9a-f]{64}$/.test(inputSha256 ?? '')) throw new Error('Input SHA-256 is required')
  if (snapshot.chainId != null && snapshot.chainId !== chainId) throw new Error('Snapshot chain mismatch')
  if (!Array.isArray(snapshot.tokens) || !snapshot.tokens.length) throw new Error('Empty or malformed registry snapshot; refusing to replace known data')
  const timestamp = iso(generatedAt)
  const sourceSnapshotAt = iso(snapshot.at)
  if (!timestamp || !sourceSnapshotAt) throw new Error('Valid generation and source snapshot timestamps are required')
  if (Date.parse(sourceSnapshotAt) > Date.parse(timestamp) + 300_000) throw new Error('Snapshot timestamp is in the future')
  const lines = manifest.chains?.[String(chainId)]?.lines
  if (!lines) throw new Error('Chain absent from launcher manifest')
  const seen = new Set()
  const records = []
  for (const row of snapshot.tokens) {
    if (row.chainId != null && row.chainId !== chainId) throw new Error('Token chain mismatch')
    const token = address(row.token)
    if (seen.has(token)) throw new Error(`Duplicate chain/token identity: ${chainId}:${token}`)
    seen.add(token)
    const evidence = eventEvidence(row, lines)
    let source
    if (evidence) source = evidence.line === 'wink' ? 'registered' : 'factory'
    else if (['v1', 'instant', 'queue', 'curve', 'sale'].includes(row.mode) || (row.mode === 'unknown' && row.source === 'factory')) source = 'factory'
    else throw new Error(`No supported attribution evidence for ${token}; Wink requires its known emitter event`)
    if (row.mode === 'wink' && evidence?.line !== 'wink') throw new Error(`Wink has no valid emitter evidence: ${token}`)
    if (row.source != null && row.source !== source) throw new Error(`Attribution conflict for ${token}`)
    const pool = address(row.pool, true)
    const poolId = row.poolId == null ? null : String(row.poolId).toLowerCase()
    if (poolId !== null && (!HASH.test(poolId) || /^0x0+$/.test(poolId))) throw new Error(`Invalid pool ID for ${token}`)
    const mode = launchMode(row, evidence, lines)
    const reportedLaunchMode = MODES.has(row.mode) ? row.mode : 'unknown'
    // Routing may preserve a maintained UI hint without elevating it to verified mode evidence.
    const routeMode = mode === 'unknown' ? reportedLaunchMode : mode
    const route = routeMode === 'curve' ? `/curve/${token}` :
      routeMode === 'queue' || routeMode === 'sale' ? `/drop/${token}` :
      routeMode === 'wink' ? poolId ? `/t/${poolId}` : `/t/${token}?resolve=token` : `/t/${pool ?? token}`
    const tokenUrl = `https://dontblink.community${route}`
    records.push({
      schema: SCHEMA, chainId, token, recognized: true, source,
      launchedOnDontblink: source !== 'registered', launchMode: mode,
      reportedLaunchMode,
      pool, poolId, symbol: text(row.symbol, 64), name: text(row.name, 200),
      creator: address(row.creator, true), createdBlock: block(row.createdBlock), createdAt: iso(row.createdAt),
      lpLocked: null, lpLockContract: null, lpLockEvidence: null,
      tokenUrl, generatedAt: timestamp, sourceSnapshotAt,
      evidence: evidence ?? { kind: 'registry', uri: sourceUrl, inputSha256, note: 'Maintained Robinhood launch registry; individual launch event is not present in this snapshot.' },
      audited: false, riskAssessed: false, disclaimer: DISCLAIMER,
    })
  }
  records.sort((a, b) => a.token.localeCompare(b.token))
  const scan = Object.fromEntries(Object.entries(snapshot.scan ?? {}).map(([key, value]) => [key,
    key === 'wink' && value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).map(([emitter, height]) => [address(emitter), block(height)]))
      : block(value)]))
  // There is no verified completeness checkpoint in the legacy input. A market snapshot timestamp is not one.
  const coverage = {
    status: 'partial', absentMeans: 'unknown', scannedToBlock: null, scan,
    limitations: ['The site registry can exclude superseded internal launches; it is not a complete historical chain archive.',
      'Snapshot cursors do not establish coverage of every launcher and every historical block.',
      'Per-token LP custody has not been verified by this exporter.'],
  }
  if (!scan.wink || !Object.values(scan.wink).some((height) => height !== null)) coverage.limitations.push('No Wink scan checkpoint is present in this source snapshot.')
  const index = { schema: 'dontblink.verified.index.v1', chainId, generatedAt: timestamp, sourceSnapshotAt,
    source: { uri: sourceUrl, sha256: inputSha256 }, scannedToBlock: null, coverage,
    count: records.length, tokens: records.map(({ token, pool, poolId, symbol, source, launchMode, lpLocked }) => ({ token, pool, poolId, symbol, source, launchMode, lpLocked })) }
  return { records, index }
}

export async function writeRegistry(directory, registry) {
  const output = resolve(directory)
  const { records, index } = registry
  let previous = null
  try { previous = JSON.parse(await readFile(resolve(output, 'index.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (previous && (previous.schema !== 'dontblink.verified.index.v1' || previous.chainId !== index.chainId)) throw new Error('Existing output is not the same managed chain registry')
  const files = new Map()
  for (const record of records) {
    files.set(`${record.chainId}/${record.token}.json`, record)
    if (record.chainId === 4663) files.set(`${record.token}.json`, record)
  }
  // Existing deployments copy without --delete. Replace removed positives with explicit unknown records.
  const live = new Set(records.map((row) => row.token))
  for (const row of previous?.tokens ?? []) {
    const token = address(row.token)
    if (live.has(token)) continue
    const tombstone = { schema: SCHEMA, chainId: index.chainId, token, recognized: null,
      reason: 'not_in_current_registry', generatedAt: index.generatedAt, sourceSnapshotAt: index.sourceSnapshotAt,
      source: null, launchMode: 'unknown', lpLocked: null, lpLockContract: null, audited: false, riskAssessed: false, disclaimer: DISCLAIMER }
    files.set(`${index.chainId}/${token}.json`, tombstone)
    if (index.chainId === 4663) files.set(`${token}.json`, tombstone)
  }
  files.set(`${index.chainId}/index.json`, index)
  files.set('chains.json', { schema: 'dontblink.verified.chains.v1', chains: [{ chainId: index.chainId, index: `${index.chainId}/index.json`, coverage: 'partial' }], legacyAliasChainId: 4663 })
  files.set('index.json', index)
  for (const [relative, body] of files) {
    const destination = resolve(output, relative)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(`${destination}.tmp`, `${JSON.stringify(body)}\n`)
    await rename(`${destination}.tmp`, destination)
  }
  return { count: records.length, written: files.size, directory: output }
}

async function main() {
  const [input, output, manifestPath = new URL('../launch-manifest/launchers.json', import.meta.url).pathname] = process.argv.slice(2)
  if (!input || !output) throw new Error('Usage: node generate.mjs <ours.json> <output/data/verified> [launchers.json]')
  const raw = await readFile(input, 'utf8')
  const registry = buildRegistry({ snapshot: JSON.parse(raw), manifest: JSON.parse(await readFile(manifestPath, 'utf8')), inputSha256: sha256(raw) })
  console.log(JSON.stringify(await writeRegistry(output, registry)))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
