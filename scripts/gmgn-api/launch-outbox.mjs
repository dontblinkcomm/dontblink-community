#!/usr/bin/env node
/** Offline preparation only. There is deliberately no HTTP transport, credential reader, acknowledgement or delivered transition. */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename, rm, rmdir } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateRecord } from './verify.mjs'
import { platformBadgeFor } from './platform-badge.mjs'

export const OUTBOX_SCHEMA = 'dontblink.gmgn.outbox.v1'
const HASH = /^0x[0-9a-f]{64}$/
const ADDRESS = /^0x[0-9a-f]{40}$/
const sha = value => createHash('sha256').update(value).digest('hex')
const hex = (value, pattern, label) => { assert.equal(typeof value, 'string', label); const normalized = value.toLowerCase(); assert(pattern.test(normalized) && !/^0x0+$/.test(normalized), label); return normalized }
const integer = (value, label) => { const n = typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value) ? Number(BigInt(value)) : value; assert(Number.isSafeInteger(n) && n >= 0, label); return n }
const timestamp = value => { assert.equal(typeof value, 'string'); assert(Number.isFinite(Date.parse(value)), 'Invalid observation timestamp'); return new Date(value).toISOString() }
const addressWord = word => { assert(/^0{24}[0-9a-f]{40}$/.test(word), 'Invalid ABI address word'); return `0x${word.slice(24)}` }

/** Inputs must come from a trusted read-only receipt/canonical-block observer, not a browser's success toast.
 * This validates the imported evidence; it does not independently fetch or attest the blockchain. */
export function prepareLaunchNotification({ record, receipt, canonicalBlock, head, observedAt, manifest, minConfirmations = 64 }, now = Date.now()) {
  validateRecord(record, 4663, record.token)
  assert.equal(record.recognized, true, 'Unknown sources cannot create launch notifications')
  assert.equal(record.evidence.kind, 'event', 'Historical registry entries need actual event/receipt evidence before notification backfill')
  const at = timestamp(observedAt)
  assert(Date.parse(at) <= now + 60_000 && now - Date.parse(at) <= 3_600_000, 'Canonical observation must be recent; reread before preparing old events')
  assert(Number.isSafeInteger(minConfirmations) && minConfirmations >= 1 && minConfirmations <= 100_000, 'Invalid confirmation policy')
  assert(receipt && (receipt.status === 'success' || receipt.status === '0x1'), 'A successful receipt is required; rejected, reverted and unknown attempts are excluded')
  assert.equal(receipt.chainId, 4663, 'Receipt chain mismatch')
  assert.equal(canonicalBlock?.chainId, 4663, 'Canonical block chain mismatch')
  assert.equal(head?.chainId, 4663, 'Head chain mismatch')
  const transactionHash = hex(receipt.transactionHash, HASH, 'Receipt transaction hash')
  const blockHash = hex(receipt.blockHash, HASH, 'Receipt block hash')
  const blockNumber = integer(receipt.blockNumber, 'Receipt block number')
  assert.equal(hex(canonicalBlock.hash, HASH, 'Canonical hash'), blockHash, 'Receipt is not canonical at observation')
  assert.equal(integer(canonicalBlock.number, 'Canonical block number'), blockNumber)
  const headNumber = integer(head.number, 'Observed head')
  hex(head.hash, HASH, 'Observed head hash')
  assert(headNumber - blockNumber + 1 >= minConfirmations, 'Insufficient observed confirmations')
  if (headNumber === blockNumber) assert.equal(head.hash.toLowerCase(), blockHash, 'Head hash mismatch')
  const e = record.evidence
  assert.equal(transactionHash, e.transactionHash)
  assert.equal(blockNumber, e.blockNumber)
  if (record.createdBlock != null) assert.equal(record.createdBlock, blockNumber)
  const line = manifest?.chains?.['4663']?.lines?.find(l => l.id === e.line)
  assert(line && ['v1', 'portal', 'wink'].includes(line.id), 'Unsupported launch event adapter')
  assert.equal(record.source, line.id === 'wink' ? 'registered' : 'factory', 'Launch adapter source mismatch; mechanism integration cannot become exclusive origin')
  const emitter = hex(e.emitter, ADDRESS, 'Emitter')
  const deployment = line.launcher?.toLowerCase() === emitter ? line.deployBlock : line.launchers?.find(l=>l.address.toLowerCase()===emitter)?.deployBlock
  assert(Number.isSafeInteger(deployment) && blockNumber >= deployment, 'Emitter not in reviewed manifest at this height')
  assert.equal(e.topic0, line.deployEvent.topic0.toLowerCase())
  assert(Array.isArray(receipt.logs) && receipt.logs.length <= 2048, 'Invalid or excessive receipt logs')
  const matches = receipt.logs.filter(log => log.address?.toLowerCase() === emitter && log.topics?.[0]?.toLowerCase() === e.topic0 &&
    log.topics?.[line.id === 'portal' ? 2 : 1]?.toLowerCase() === `0x${'0'.repeat(24)}${record.token.slice(2)}`)
  assert.equal(matches.length, 1, 'Exactly one matching launch event is required')
  const log = matches[0]
  assert(log.removed !== true, 'Removed log cannot create a notification')
  for (const [key, expected] of [['transactionHash',transactionHash],['blockHash',blockHash]]) if (log[key] != null) assert.equal(log[key].toLowerCase(), expected, `Log ${key} mismatch`)
  if (log.blockNumber != null) assert.equal(integer(log.blockNumber, 'Log block'), blockNumber)
  const logIndex = integer(log.logIndex, 'Log index is required for event deduplication')
  assert.equal(log.topics.length, line.id === 'portal' ? 4 : 3, 'Unexpected event topic layout')
  for (const topic of log.topics) assert(/^0x[0-9a-f]{64}$/i.test(topic), 'Invalid event topic')
  const creator = addressWord(log.topics[line.id === 'portal' ? 3 : 2].slice(2).toLowerCase())
  if (record.creator != null) assert.equal(creator, record.creator, 'Event creator mismatch')
  assert(typeof log.data === 'string' && /^0x[0-9a-f]*$/i.test(log.data), 'Invalid event data')
  const words = log.data.slice(2).toLowerCase().match(/.{1,64}/g) ?? []
  assert.equal(words.length, line.id === 'portal' ? 7 : line.id === 'v1' ? 3 : 4, 'Unexpected event data length')
  assert(words.every(word => word.length === 64), 'Truncated event data')
  if (line.id === 'wink') for (const word of words) addressWord(word)
  else {
    const pool = addressWord(words[line.id === 'portal' ? 3 : 0])
    if (record.pool !== null) assert.equal(pool, record.pool, 'Launch pool mismatch')
    if (line.id === 'portal') { assert(BigInt(`0x${words[0]}`) <= 65535n); assert(BigInt(`0x${words[1]}`) <= 255n); addressWord(words[2]) }
    assert(BigInt(`0x${words.at(-1)}`) <= 18446744073709551615n, 'Invalid event uint64')
  }
  // Event identity excludes name/logo, generatedAt and observation time, so metadata refreshes and repeated observations dedupe.
  const id = `dontblink:launch:4663:${transactionHash}:${logIndex}:${emitter}:${record.token}`
  const payload = {
    schema: 'dontblink.launch-notification.v1', id, type: 'launch.confirmed',
    chainId: 4663, token: record.token,
    source: record.source, launchedOnDontblink: record.launchedOnDontblink,
    platformBadge: platformBadgeFor(record),
    launch: { transactionHash, blockHash, blockNumber, logIndex, emitter, topic0: e.topic0 },
    registryUrl: `https://dontblink.community/data/verified/4663/${record.token}.json`,
  }
  return { payload, observation: { observedAt: at, headNumber, headHash: head.hash.toLowerCase(), minConfirmations,
    authority: 'imported_receipt_and_canonical_block', note: 'Locally validated supplied evidence; no independent RPC verification or GMGN delivery.' } }
}

function validateState(state) {
  assert.equal(state.schema, OUTBOX_SCHEMA); assert.equal(state.delivery, 'disabled_no_partner_contract'); assert(Array.isArray(state.entries) && state.entries.length <= 100_000)
  const seen = new Set()
  for (const entry of state.entries) {
    assert.equal(entry.state, 'prepared_not_sent'); assert.equal(entry.attempts, 0); assert.equal(entry.acknowledgement, null)
    assert.equal(entry.payloadHash, sha(JSON.stringify(entry.payload))); assert.equal(entry.id, entry.payload.id)
    assert.equal(entry.payload.schema, 'dontblink.launch-notification.v1'); assert.equal(entry.payload.type, 'launch.confirmed')
    assert(!seen.has(entry.id), 'Duplicate outbox identity'); seen.add(entry.id)
  }
  return state
}
export async function readOutbox(file) {
  try { return validateState(JSON.parse(await readFile(file, 'utf8'))) }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {schema:OUTBOX_SCHEMA,delivery:'disabled_no_partner_contract',entries:[]} }
}
/** Local-only persistent preparation. Lock is exclusive, stale locks require review; no sender or acknowledgement state exists. */
export async function prepareOutbox({ file, inputs, persist = false, now = Date.now() }) {
  assert(Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 1000, 'Prepare 1–1000 evidence inputs at a time')
  const prepared = inputs.map(input => prepareLaunchNotification(input, now))
  const path = resolve(file), lock = `${path}.lock`
  if (persist) { await mkdir(dirname(path), {recursive:true}); await mkdir(lock) }
  try {
    const state = await readOutbox(path), byId = new Map(state.entries.map(e=>[e.id,e]))
    let added=0
    for (const item of prepared) {
      const payloadHash=sha(JSON.stringify(item.payload)), previous=byId.get(item.payload.id)
      if (previous) { assert.equal(previous.payloadHash,payloadHash,'Same event has conflicting immutable evidence (possible reorg); preserve queue and investigate'); continue }
      byId.set(item.payload.id,{id:item.payload.id,payloadHash,payload:item.payload,observation:item.observation,state:'prepared_not_sent',attempts:0,acknowledgement:null,preparedAt:new Date(now).toISOString()});added++
    }
    const next=validateState({...state,entries:[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id))})
    if (persist && added) {
      const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`
      let handle, created = false
      try {
        handle = await open(tmp, 'wx', 0o600); created = true
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`); await handle.sync()
        await handle.close(); handle = null
        await rename(tmp, path)
      } finally { await handle?.close(); if (created) await rm(tmp, {force:true}) }
    }
    return {mode:persist?'persisted_local_only':'dry_run',delivery:state.delivery,added,duplicates:prepared.length-added,total:next.entries.length,sent:0,entries:prepared.map(p=>p.payload)}
  } finally { if(persist)await rmdir(lock) }
}
function outsideRepository(file, repository) { const r=relative(resolve(repository),resolve(file)); assert(r==='..'||r.startsWith(`..${process.platform==='win32'?'\\':'/'}`)||isAbsolute(r),'Keep private preparation state outside the public artifact/source repository') }
async function main(){
  const args=process.argv.slice(2), options={};for(let i=0;i<args.length;i++){const key=args[i];if(key==='--persist')options.persist=true;else if(['--input','--outbox','--repository'].includes(key)){assert(args[i+1]&&!args[i+1].startsWith('--'),`Missing ${key}`);options[key.slice(2)]=args[++i]}else throw Error(`Unsupported option ${key}; transport is not implemented`)}
  assert(options.input&&options.outbox&&options.repository,'Usage: node launch-outbox.mjs --input trusted-receipt-bundle.json --outbox /private/state/gmgn-outbox.json --repository /artifact/checkout [--persist]')
  outsideRepository(options.outbox,options.repository)
  const bundle=JSON.parse(await readFile(resolve(options.input),'utf8'))
  const result=await prepareOutbox({file:options.outbox,inputs:bundle.inputs,persist:options.persist===true})
  console.log(JSON.stringify(result,null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1})
