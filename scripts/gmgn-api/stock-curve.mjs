// Stock Curve mode 9: authoritative events plus fixed-block read state.
// ABI source: dontblink-mech/src/v2/{StockCurveHandler,StockCurveSale,StockCurveV4Graduator}.sol.
// No signing, sending, wallet access, prices or inferred USD revenue.
import { keccak256 } from './keccak.mjs'
const hash = bytes => '0x' + Buffer.from(keccak256(bytes)).toString('hex')
export const signature = text => hash(Buffer.from(text))
export const SC = Object.freeze({
  opened: signature('StockCurveOpened(address,address,address,address,uint16,uint128,uint128,uint16,uint96,uint256)'),
  bought: signature('Bought(address,uint256,uint256,uint256,uint256,uint256)'),
  sold: signature('Sold(address,uint256,uint256,uint256,uint256)'),
  firstBuy: signature('CreatorFirstBuy(address,uint256,uint256)'),
  aligned: signature('GraduationAligned(uint256,uint256)'),
  graduatedTo: signature('GraduatedTo(address,uint256,uint256)'),
  graduated: signature('Graduated(address,bytes32,address,address,uint24,int24,uint128,uint256,uint256)'),
  collected: signature('FeesCollected(address,address,address,uint256,uint256,uint256,uint256)'),
  pending: signature('PendingCredited(address,address,uint256)'),
})
const ZERO = '0x' + '0'.repeat(40)
// v2 journals also cover sale-side graduation evidence. Rebuild older journals
// once from launch, otherwise already-graduated V1 tokens would miss GraduatedTo.
const JOURNAL_VERSION = 2
const address = value => {
  if (!/^0x[0-9a-f]{40}$/i.test(value ?? '') || value.toLowerCase() === ZERO) throw Error('Invalid Stock Curve address')
  return value.toLowerCase()
}
const wordAddress = value => {
  if (!/^[0-9a-f]{64}$/i.test(value ?? '') || !/^0{24}/.test(value)) throw Error('Invalid address word')
  return address('0x' + value.slice(24))
}
const topicAddress = value => wordAddress(value?.slice(2))
const words = (log, count) => {
  if (!new RegExp(`^0x[0-9a-f]{${count * 64}}$`, 'i').test(log.data ?? '')) throw Error('Malformed Stock Curve event data')
  return Array.from({ length: count }, (_, i) => log.data.slice(2 + i * 64, 66 + i * 64))
}
const uint = (w, bits = 256) => { const n = BigInt('0x' + w); if (n >= 1n << BigInt(bits)) throw Error('ABI integer overflow'); return n }
const int24 = w => {
  const n = BigInt.asIntN(256, uint(w))
  if (n <= 0n || n > 32767n) throw Error('Invalid Stock Curve tick spacing')
  return Number(n)
}
const number = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid event block/index'); return n }
export function eventEvidence(log, event, emitter, topic, indexed) {
  if (address(log.address) !== address(emitter) || log.topics?.length !== indexed + 1 || log.topics[0]?.toLowerCase() !== topic || log.removed) throw Error('Unrecognized Stock Curve event')
  if (!/^0x[0-9a-f]{64}$/i.test(log.transactionHash ?? '') || /^0x0+$/i.test(log.transactionHash)) throw Error('Invalid event transaction')
  return { event, emitter: address(log.address), topic0: topic, blockNumber: number(log.blockNumber), logIndex: number(log.logIndex), transactionHash: log.transactionHash.toLowerCase() }
}
export function openedStockCurve(row, log, line) {
  const evidence = eventEvidence(log, 'StockCurveOpened', line.launcher, SC.opened, 3)
  const token = topicAddress(log.topics[1]), curve = topicAddress(log.topics[2]), quote = topicAddress(log.topics[3])
  const w = words(log, 7), creator = wordAddress(w[0]), totalBps = Number(uint(w[1], 16))
  if (row?.token !== token || row.handlerEvidence?.modeId !== 9 || row.handlerEvidence?.handler?.toLowerCase() !== line.launcher.toLowerCase() ||
      row.handlerEvidence.transactionHash !== evidence.transactionHash || row.provenance?.transactionHash !== evidence.transactionHash ||
      row.createdBlock !== evidence.blockNumber || row.creator !== creator || evidence.blockNumber < line.deployBlock) throw Error('Stock Curve launch lacks matching Portal evidence')
  if (totalBps < 50 || totalBps > 1000 || totalBps % 2 || token === quote) throw Error('Invalid Stock Curve fee or quote')
  const old = row.stockCurve?.curve === curve ? row.stockCurve : {}
  return { ...row, mode: 'stockcurve', curve, quote, pool: null, poolId: old.pool?.poolId ?? null,
    stockCurve: { ...old, schema: 'dontblink.stock-curve.v1', token, handler: address(line.launcher), defaultGraduator: address(line.related.graduator.address), graduator: old.graduator ?? address(line.related.graduator.address),
      curve, quote, creator, totalBps, platformBps: totalBps / 2, creatorBps: totalBps / 2,
      thresholdRaw: uint(w[2], 128).toString(), virtualQuoteRaw: uint(w[3], 128).toString(), maxBuyBps: Number(uint(w[4], 16)),
      usdTarget8: uint(w[5], 96).toString(), launchUsdPrice8: uint(w[6]).toString(), launchEvidence: evidence } }
}
function decodeEvent(log, row) {
  const sc = row.stockCurve, topic = log.topics?.[0]?.toLowerCase()
  let event, w
  if ([SC.bought, SC.sold, SC.firstBuy].includes(topic)) {
    const name = topic === SC.bought ? 'Bought' : topic === SC.sold ? 'Sold' : 'CreatorFirstBuy'
    const evidence = eventEvidence(log, name, sc.curve, topic, 1)
    const participant = topicAddress(log.topics[1]); w = words(log, topic === SC.bought ? 5 : topic === SC.sold ? 4 : 2)
    event = { ...evidence, participant }
    if (topic === SC.bought) event = { ...event, quoteInRaw: uint(w[0]).toString(), tokensOutRaw: uint(w[1]).toString(), platformFeeRaw: uint(w[2]).toString(), creatorFeeRaw: uint(w[3]).toString(), refundRaw: uint(w[4]).toString() }
    else if (topic === SC.sold) event = { ...event, tokensInRaw: uint(w[0]).toString(), quoteOutRaw: uint(w[1]).toString(), platformFeeRaw: uint(w[2]).toString(), creatorFeeRaw: uint(w[3]).toString() }
    else {
      if (participant !== sc.creator || evidence.transactionHash !== sc.launchEvidence.transactionHash) throw Error('Unmatched creator first buy')
      event = { ...event, requestedQuoteRaw: uint(w[0]).toString(), tokensOutRaw: uint(w[1]).toString() }
    }
  } else if (topic === SC.aligned) {
    const evidence = eventEvidence(log, 'GraduationAligned', sc.curve, topic, 0); w = words(log, 2)
    event = { ...evidence, burnedRaw: uint(w[0]).toString(), keptRaw: uint(w[1]).toString() }
  } else if (topic === SC.graduatedTo) {
    const evidence = eventEvidence(log, 'GraduatedTo', sc.curve, topic, 1); w = words(log, 2)
    if (topicAddress(log.topics[1]) !== sc.graduator) throw Error('Graduation recipient mismatch')
    event = { ...evidence, graduator: sc.graduator, tokenAmountRaw: uint(w[0]).toString(), quoteAmountRaw: uint(w[1]).toString() }
  } else if (topic === SC.graduated) {
    const evidence = eventEvidence(log, 'Graduated', sc.graduator, topic, 2); w = words(log, 7)
    if (topicAddress(log.topics[1]) !== row.token) throw Error('Graduation token mismatch')
    const currency0 = wordAddress(w[0]), currency1 = wordAddress(w[1]), fee = Number(uint(w[2], 24)), tickSpacing = int24(w[3])
    if ([currency0, currency1].join() !== [row.token, sc.quote].sort().join() || fee !== sc.totalBps * 100) throw Error('Graduation pool does not match launch')
    const poolId = hash(Buffer.from(w[0] + w[1] + w[2] + w[3] + '0'.repeat(64), 'hex'))
    if (log.topics[2].toLowerCase() !== poolId) throw Error('Graduation PoolId mismatch')
    event = { ...evidence, poolId, currency0, currency1, fee, tickSpacing, hooks: ZERO,
      liquidityRaw: uint(w[4], 128).toString(), amount0Raw: uint(w[5]).toString(), amount1Raw: uint(w[6]).toString() }
  } else if (topic === SC.collected) {
    const evidence = eventEvidence(log, 'FeesCollected', sc.graduator, topic, 1); w = words(log, 6)
    if (topicAddress(log.topics[1]) !== row.token || wordAddress(w[1]) !== sc.creator) throw Error('Fee collection token/creator mismatch')
    event = { ...evidence, platform: wordAddress(w[0]), creator: wordAddress(w[1]),
      platform0Raw: uint(w[2]).toString(), creator0Raw: uint(w[3]).toString(), platform1Raw: uint(w[4]).toString(), creator1Raw: uint(w[5]).toString() }
  } else throw Error('Unsupported Stock Curve event')
  if (event.blockNumber < sc.launchEvidence.blockNumber) throw Error('Event predates Stock Curve launch')
  return event
}
const emptyTotals = () => ({ buys: 0, sells: 0, collections: 0, buyQuoteGrossRaw: '0', sellQuoteNetRaw: '0', sellQuoteGrossRaw: '0', refundsRaw: '0', platformCurveFeeRaw: '0', creatorCurveFeeRaw: '0', platform0CollectedRaw: '0', creator0CollectedRaw: '0', platform1CollectedRaw: '0', creator1CollectedRaw: '0' })
function add(total, key, amount) { total[key] = (BigInt(total[key]) + BigInt(amount)).toString() }
function fold(state, event) {
  const t = state.totals
  if (event.event === 'Bought') {
    t.buys++; add(t, 'buyQuoteGrossRaw', event.quoteInRaw); add(t, 'refundsRaw', event.refundRaw)
    add(t, 'platformCurveFeeRaw', event.platformFeeRaw); add(t, 'creatorCurveFeeRaw', event.creatorFeeRaw)
  } else if (event.event === 'Sold') {
    t.sells++; add(t, 'sellQuoteNetRaw', event.quoteOutRaw)
    add(t, 'sellQuoteGrossRaw', (BigInt(event.quoteOutRaw) + BigInt(event.platformFeeRaw) + BigInt(event.creatorFeeRaw)).toString())
    add(t, 'platformCurveFeeRaw', event.platformFeeRaw); add(t, 'creatorCurveFeeRaw', event.creatorFeeRaw)
  } else if (event.event === 'FeesCollected') {
    t.collections++
    for (const leg of ['platform0', 'creator0', 'platform1', 'creator1']) add(t, `${leg}CollectedRaw`, event[`${leg}Raw`])
  } else if (event.event === 'Graduated') state.pool = event
  else if (event.event === 'GraduationAligned') state.graduationAligned = event
  else if (event.event === 'GraduatedTo') state.graduatedTo = event
  else if (event.event === 'CreatorFirstBuy') state.firstBuy = event
}
function validateGraduation(sc) {
  const { pool, graduationAligned: aligned, graduatedTo: sent } = sc
  if (aligned && !sent) throw Error('Graduation alignment missing completed transfer')
  if (!sent) return // Pre-upgrade API snapshots and ungraduated curves stay readable.
  if (!pool) throw Error('Graduation transfer missing completed pool')
  const evidence = (event, name, emitter, topic) => {
    if (event.event !== name || event.emitter !== emitter || event.topic0 !== topic || event.blockNumber !== pool.blockNumber || event.transactionHash !== pool.transactionHash) throw Error('Graduation evidence mismatch')
    number(event.logIndex)
  }
  evidence(sent, 'GraduatedTo', sc.curve, SC.graduatedTo)
  if (sent.graduator !== sc.graduator || sent.logIndex <= pool.logIndex) throw Error('Graduation transfer order/recipient mismatch')
  for (const key of ['tokenAmountRaw', 'quoteAmountRaw']) if (!/^[1-9][0-9]*$/.test(sent[key])) throw Error('Invalid graduation transfer amount')
  const [tokenUsed, quoteUsed] = pool.currency0 === sc.token ? [pool.amount0Raw, pool.amount1Raw] : [pool.amount1Raw, pool.amount0Raw]
  if (BigInt(tokenUsed) > BigInt(sent.tokenAmountRaw) || BigInt(quoteUsed) > BigInt(sent.quoteAmountRaw)) throw Error('Graduation pool exceeds transferred assets')
  if (aligned) {
    evidence(aligned, 'GraduationAligned', sc.curve, SC.aligned)
    if (!/^(0|[1-9][0-9]*)$/.test(aligned.burnedRaw) || !/^[1-9][0-9]*$/.test(aligned.keptRaw) || aligned.logIndex >= pool.logIndex || BigInt(aligned.keptRaw) < BigInt(sent.tokenAmountRaw)) throw Error('Invalid graduation alignment')
  }
}
// Re-scan a bounded overlap and replace that tail before aggregating. Replays do not
// double count, including CreatorFirstBuy (disclosure only; Bought accounts the trade).
export function reduceStockCurve(row, logs, { fromBlock, toBlock, overlap = 5000 }) {
  const sc = row.stockCurve, old = sc.indexState?.version === JOURNAL_VERSION ? sc.indexState : null
  fromBlock = number(fromBlock); toBlock = number(toBlock)
  if (sc.indexState && !old && fromBlock !== sc.launchEvidence.blockNumber) throw Error('Legacy Stock Curve journal requires launch backfill')
  if (toBlock < fromBlock || old && (fromBlock > old.scannedToBlock + 1 || fromBlock <= old.baseBlock || toBlock < old.scannedToBlock)) throw Error('Invalid Stock Curve scan continuity')
  const combined = new Map((old?.recent ?? []).filter(e => e.blockNumber < fromBlock).map(e => [`${e.transactionHash}:${e.logIndex}`, e]))
  for (const log of logs) {
    const event = decodeEvent(log, row)
    if (event.blockNumber < fromBlock || event.blockNumber > toBlock) throw Error('Event outside Stock Curve scan')
    const id = `${event.transactionHash}:${event.logIndex}`
    if (combined.has(id) && JSON.stringify(combined.get(id)) !== JSON.stringify(event)) throw Error('Conflicting Stock Curve log')
    combined.set(id, event)
  }
  const sorted = [...combined.values()].sort((a,b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
  for (const first of sorted.filter(e => e.event === 'CreatorFirstBuy')) {
    const buy = sorted.find(e => e.event === 'Bought' && e.transactionHash === first.transactionHash && e.participant === first.participant && e.tokensOutRaw === first.tokensOutRaw)
    if (!buy || BigInt(buy.quoteInRaw) + BigInt(buy.refundRaw) !== BigInt(first.requestedQuoteRaw)) throw Error('First buy missing matching Bought accounting')
    first.acceptedQuoteRaw = buy.quoteInRaw; first.refundRaw = buy.refundRaw
  }
  const cutoff = Math.max(old?.baseBlock ?? 0, toBlock - overlap)
  const base = structuredClone(old?.base ?? { totals: emptyTotals(), firstBuy: null, pool: null, graduationAligned: null, graduatedTo: null })
  for (const event of sorted) if (event.blockNumber <= cutoff) fold(base, event)
  const recent = sorted.filter(e => e.blockNumber > cutoff)
  if (recent.length > 100000) throw Error('Stock Curve overlap exceeds bounded journal')
  const full = structuredClone(base)
  for (const event of recent) fold(full, event)
  validateGraduation({ ...sc, pool: full.pool, graduationAligned: full.graduationAligned, graduatedTo: full.graduatedTo })
  return { ...row, pool: null, poolId: full.pool?.poolId ?? null,
    stockCurve: { ...sc, pool: full.pool, creatorFirstBuy: full.firstBuy, totals: full.totals, graduationAligned: full.graduationAligned, graduatedTo: full.graduatedTo,
      indexState: { version: JOURNAL_VERSION, baseBlock: cutoff, scannedToBlock: toBlock, base, recent } } }
}
export function stockCurveScanFrom(row, overlap = 5000) {
  const state = row.stockCurve.indexState
  return state?.version === JOURNAL_VERSION ? Math.max(state.baseBlock + 1, state.scannedToBlock - overlap + 1) : row.stockCurve.launchEvidence.blockNumber
}
// Every registered handler retains its own cursor and companions. A legacy scalar
// cursor is intentionally rebuilt once; never assign a V1 checkpoint to a new line.
export function stockCurveDiscoveryPlan(lines, cursors, { head, overlap = 5000 }) {
  const seen = new Set()
  return lines.filter(line => line.modeId === 9).map(line => {
    const key = address(line.launcher), deployBlock = number(line.deployBlock)
    address(line.related?.graduator?.address)
    if (seen.has(key) || !deployBlock) throw Error('Invalid or duplicate Stock Curve manifest line')
    seen.add(key)
    const cursor = cursors && typeof cursors === 'object' ? cursors[key] : null
    if (cursor != null && number(cursor) > head) throw Error('Stock Curve discovery head moved backwards')
    return { line, key, fromBlock: cursor ? Math.max(deployBlock, cursor - overlap) : deployBlock, toBlock: head }
  }).filter(plan => plan.fromBlock <= head)
}
// GT FDV may lag a graduation burn. Revalue using the exact token supply read at
// this producer's head; on a failed read clear FDV instead of retaining a 1B value.
export function withStockCurveSupply(row, head) {
  if (row.mode !== 'stockcurve' || !row.gt) return row
  const state = row.stockCurve?.observed
  const valid = state?.blockNumber === head && /^(0|[1-9][0-9]*)$/.test(state.totalSupplyRaw) && Number.isInteger(state.tokenDecimals) && state.tokenDecimals >= 0 && state.tokenDecimals <= 36
  const price = row.gt.price
  const fdv = valid && typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price * (Number(state.totalSupplyRaw) / 10 ** state.tokenDecimals) : null
  return { ...row, gt: { ...row.gt, fdv: fdv !== null && Number.isFinite(fdv) ? fdv : null, fdvSupplyBlockNumber: valid ? head : null } }
}
const selector = text => signature(text).slice(0, 10)
const arg = addr => address(addr).slice(2).padStart(64, '0')
// Only a successful complete pass updates this snapshot. pending is a live balance,
// never summed PendingCredited logs: successful claimPending emits no matching claim event.
export async function refreshStockCurve(row, { rpc, getLogs, head, overlap = 5000 }) {
  let sc = row.stockCurve
  const block = '0x' + head.toString(16)
  const read = async (to, data) => rpc('eth_call', [{ to, data }, block])
  const readAddress = async (to, data) => wordAddress((await read(to, data)).slice(2))
  // A stalled curve can change its own graduator through governance retry. Bind
  // to this token's curve, not the current mode-9 handler or its default address.
  const [registeredCurve, registeredToken, actualToken, opener, graduator] = await Promise.all([
    readAddress(sc.handler, selector('curveOf(address)') + arg(row.token)),
    readAddress(sc.handler, selector('tokenOfCurve(address)') + arg(sc.curve)),
    readAddress(sc.curve, selector('token()')),
    readAddress(sc.curve, selector('opener()')),
    readAddress(sc.curve, selector('graduator()')),
  ])
  if (registeredCurve !== sc.curve || registeredToken !== row.token || actualToken !== row.token || opener !== sc.handler) throw Error('Stock Curve token/handler binding mismatch')
  if (graduator !== sc.graduator) {
    sc = { ...sc, graduator, indexState: undefined }
    row = { ...row, stockCurve: sc } // Force one full replay on the new emitter.
  }
  const from = stockCurveScanFrom(row, overlap)
  const curveLogs = await getLogs(sc.curve, [SC.bought, SC.sold, SC.firstBuy, SC.aligned, SC.graduatedTo], from, head)
  const graduationLogs = await getLogs(sc.graduator, [SC.graduated, SC.collected], from, head, ['0x' + arg(row.token)])
  let updated = reduceStockCurve(row, [...curveLogs, ...graduationLogs], { fromBlock: from, toBlock: head, overlap })
  const graduated = BigInt(await read(sc.curve, selector('graduated()'))) === 1n
  const stalled = BigInt(await read(sc.curve, selector('stalled()'))) === 1n
  if (graduated !== Boolean(updated.stockCurve.pool)) throw Error('Graduation event/state mismatch; preserve previous snapshot')
  if (graduated && !updated.stockCurve.graduatedTo) throw Error('Graduation missing sale transfer evidence; preserve previous snapshot')
  const platformRaw = await read(sc.handler, selector('platformFeeTo()'))
  const platform = wordAddress(platformRaw.slice(2))
  const quoteDecimals = Number(BigInt(await read(sc.quote, selector('decimals()'))))
  if (!Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 36) throw Error('Unsupported quote decimals')
  const totalSupplyRaw = BigInt(await read(row.token, selector('totalSupply()'))).toString()
  const tokenDecimals = Number(BigInt(await read(row.token, selector('decimals()'))))
  const minTotalBps = Number(BigInt(await read(sc.curve, selector('MIN_TOTAL_BPS()'))))
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) throw Error('Unsupported token decimals')
  if (![50, 100].includes(minTotalBps) || sc.totalBps < minTotalBps) throw Error('Stock Curve fee below deployed implementation minimum')
  const pending = []
  for (const contract of [sc.curve, sc.graduator]) for (const asset of contract === sc.curve ? [sc.quote] : [sc.quote, row.token]) for (const recipient of [...new Set([platform, sc.creator])]) {
    pending.push({ contract, asset, recipient, amountRaw: BigInt(await read(contract, selector('pending(address,address)') + arg(asset) + arg(recipient))).toString() })
  }
  const raisedRaw = BigInt(await read(sc.curve, selector('raised()'))).toString()
  const tokensSoldRaw = BigInt(await read(sc.curve, selector('tokensSold()'))).toString()
  let position = null
  if (graduated) {
    const raw = await read(sc.graduator, selector('positions(address)') + arg(row.token))
    const w = words({ data: raw }, 8), pool = updated.stockCurve.pool
    if (wordAddress(w[0]) !== pool.currency0 || wordAddress(w[1]) !== pool.currency1 || Number(uint(w[2], 24)) !== pool.fee || int24(w[3]) !== pool.tickSpacing || uint(w[6], 128).toString() !== pool.liquidityRaw || wordAddress(w[7]) !== sc.creator) throw Error('Graduation position/event mismatch')
    position = { tickLower: Number(BigInt.asIntN(256, uint(w[4]))), tickUpper: Number(BigInt.asIntN(256, uint(w[5]))), liquidityRaw: pool.liquidityRaw, owner: sc.graduator, creator: sc.creator }
  }
  const observed = { blockNumber: head, graduated, stalled, raisedRaw, tokensSoldRaw, quoteDecimals, tokenDecimals, totalSupplyRaw, minTotalBps, platform, pending, position,
    binding: { handler: opener, curve: registeredCurve, token: actualToken, graduator },
    pendingCoverage: 'current_platform_and_creator_only; former platform recipients query pending(asset,recipient) directly' }
  updated.stockCurve = { ...updated.stockCurve, observed, status: graduated ? 'graduated' : stalled ? 'stalled' : 'curve' }
  return updated
}
// Additive API payload: omit the internal overlap journal, preserve raw exact units.
export function publicStockCurve(row) {
  if (!row.stockCurve) return null
  const { indexState, ...publicData } = row.stockCurve
  return { ...publicData, scannedToBlock: indexState?.scannedToBlock ?? null,
    feeAccounting: 'Curve fees and V4 collections are accrued allocations; pending balances may not yet have reached recipients. V4 amounts cover only the locked graduation position, not all LPs.',
    volumeAccounting: 'Bought.quoteIn is accepted gross input after cap/refund. Sold.quoteOut is net; gross adds both fees. CreatorFirstBuy is disclosure, never a second trade.',
    supplyAccounting: 'observed.totalSupplyRaw is the live total supply at observed.blockNumber, not circulating supply. GraduationAligned reports only alignment burn; GraduatedTo reports measured post-burn transfers and Graduated reports assets actually used by the locked position. Additional dust/user burns can reduce total supply further.' }
}
export function validateStockCurvePublic(sc, expected) {
  if (sc.schema !== 'dontblink.stock-curve.v1' || sc.token !== address(expected.token) || sc.creator !== address(expected.creator) || expected.pool !== null) throw Error('Invalid Stock Curve API identity')
  for (const key of ['curve', 'quote', 'handler', 'graduator']) address(sc[key])
  if (expected.handler && sc.handler !== address(expected.handler)) throw Error('Stock Curve API handler mismatch')
  if (expected.graduator && (sc.defaultGraduator ?? sc.graduator) !== address(expected.graduator)) throw Error('Stock Curve API default graduator mismatch')
  if (sc.defaultGraduator) address(sc.defaultGraduator)
  if (sc.defaultGraduator && sc.graduator !== sc.defaultGraduator && !sc.observed?.binding) throw Error('Stock Curve API override lacks binding proof')
  if (sc.launchEvidence?.emitter !== sc.handler || sc.launchEvidence.topic0 !== SC.opened || sc.launchEvidence.transactionHash !== expected.transactionHash) throw Error('Stock Curve API launch mismatch')
  if (!Number.isInteger(sc.totalBps) || sc.totalBps < 50 || sc.totalBps > 1000 || sc.totalBps % 2 || sc.platformBps !== sc.totalBps / 2 || sc.creatorBps !== sc.totalBps / 2) throw Error('Invalid Stock Curve API fee')
  for (const key of ['thresholdRaw', 'virtualQuoteRaw', 'usdTarget8', 'launchUsdPrice8']) if (!/^[1-9][0-9]*$/.test(sc[key])) throw Error('Invalid Stock Curve API amount')
  if (sc.pool) {
    const p = sc.pool
    if (p.emitter !== sc.graduator || p.topic0 !== SC.graduated || p.hooks !== ZERO || p.fee !== sc.totalBps * 100 || !Number.isInteger(p.tickSpacing) || p.tickSpacing < 1 || p.tickSpacing > 32767 ||
        [p.currency0, p.currency1].join() !== [sc.token, sc.quote].sort().join()) throw Error('Invalid Stock Curve API graduated pool')
    const encoded = [BigInt(p.currency0), BigInt(p.currency1), BigInt(p.fee), BigInt(p.tickSpacing), 0n].map(n => n.toString(16).padStart(64, '0')).join('')
    if (hash(Buffer.from(encoded, 'hex')) !== p.poolId) throw Error('Stock Curve API PoolId does not match key')
  }
  if ((sc.pool?.poolId ?? null) !== expected.poolId) throw Error('Stock Curve API pool mismatch')
  validateGraduation(sc)
  if (sc.observed) {
    number(sc.observed.blockNumber)
    if (!['curve', 'stalled', 'graduated'].includes(sc.status) || sc.observed.graduated !== Boolean(sc.pool)) throw Error('Stock Curve API state mismatch')
    if (sc.observed.binding) for (const key of ['handler', 'curve', 'token', 'graduator']) if (sc.observed.binding[key] !== sc[key]) throw Error('Stock Curve API binding mismatch')
    // Existing v1 payloads without the additive supply snapshot remain readable.
    if (['totalSupplyRaw', 'tokenDecimals', 'minTotalBps'].some(key => key in sc.observed)) {
      if (!/^(0|[1-9][0-9]*)$/.test(sc.observed.totalSupplyRaw) || !Number.isInteger(sc.observed.tokenDecimals) || sc.observed.tokenDecimals < 0 || sc.observed.tokenDecimals > 36 || ![50, 100].includes(sc.observed.minTotalBps) || sc.totalBps < sc.observed.minTotalBps) throw Error('Invalid Stock Curve API supply/implementation snapshot')
      if (sc.observed.graduated && !sc.graduatedTo) throw Error('Missing Stock Curve API graduation transfer')
    }
    for (const entry of sc.observed.pending) {
      address(entry.contract); address(entry.asset); address(entry.recipient)
      if (!/^(0|[1-9][0-9]*)$/.test(entry.amountRaw)) throw Error('Invalid pending amount')
    }
  }
  if ('indexState' in sc) throw Error('Internal Stock Curve journal leaked to API')
}
