// Compute the dontblink points snapshot from on-chain-verifiable data and publish it
// same-origin as /data/points.json (read by the Points page).
//
// Scoring (documented on the Points page — keep the two in sync):
//   - 1 USD of trade volume on any dontblink-launched pool = 1 point
//   - referral bonus: 10% of each invitee's base points goes to their referrer
//     (bindings come from the on-chain ReferralRegistry, event Bound)
//
// 08-17 rewrite — where the volume comes from:
//   Uniswap V3 `Swap` logs on our pools, read straight from the RPC. Not GeckoTerminal:
//   GT 429s GitHub Actions runners (shared Azure IPs) just like it 429s Cloudflare — the
//   first version of this script never produced a single row in production.
//   The trader is `tx.from` of the swap (tx.origin) — that's who pressed the button no
//   matter which router / aggregator (Fomo, Uniswap, our own SoftQuotaRouter) sat in between.
//   USD = |WETH leg| × ETH/USD (GT simple price, falling back to the boards snapshot).
//
//   data/points-ledger.json is the **cumulative** ledger: per-wallet totals + the set of
//   swap ids seen in the last 48h (dedupe window). Every run scans the last ~26h of blocks,
//   skips what it has already counted, and adds the rest. Points therefore accumulate from
//   2026-08-17 onwards; before that there is nothing (GT-era snapshots were always empty).
//
// KNOWN LIMITATIONS (read before trusting the numbers for any real reward gate):
//   - Points == gross volume, which is trivially wash-farmable: a wallet doing
//     round-trip self-trades inflates its own score for only gas+fee cost. If
//     these points ever gate a real airdrop, add a per-wallet cap / net-volume /
//     round-trip exclusion FIRST. `trades` per wallet is surfaced so lopsided
//     trade-count vs volume patterns are at least visible.
//   - Only WETH-quoted pools count (stock-quoted launches are skipped for now).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood'
const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const REFERRAL_REGISTRY = '0xe616b60bDD1E3aC0719eE2b81d2d0bd7018A957D'
const REGISTRY_DEPLOY_BLOCK = 6147237
// keccak256("Bound(address,address)")
const BOUND_TOPIC = '0x0d128562eaa47ab89086803e64a0f96847c0ed3cc63c26251f29ba1aede09d4e'
const LOG_CHUNK = 200_000 // eth_getLogs block window for the swap scan (RH RPC takes far more; keep responses small)
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73'
// keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)") — Uniswap V3 pool
const SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
const BLOCKS_PER_HOUR = 9 * 3600 // RH chain ≈ 9-10 blocks/s (measured 08-17)
const SCAN_HOURS = 26 // each run re-scans this much (overlaps the 30-min cadence generously)
const DEDUPE_HOURS = 48 // keep seen swap ids this long
const LEDGER = 'data/points-ledger.json'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- resilient GET against GeckoTerminal: retry on 429 / 5xx / network error ---
async function gt(path, { retries = 4 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(path.startsWith('http') ? path : `${GT}${path}`, { headers: { accept: 'application/json' } })
      if (r.status === 429 || r.status >= 500) {
        if (attempt >= retries) throw new Error(`GT ${path} ${r.status} (gave up)`)
        const backoff = 2000 * 2 ** attempt // 2s,4s,8s,16s
        console.error(`GT ${path} ${r.status}, retry in ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      if (!r.ok) throw new Error(`GT ${path} ${r.status}`)
      const j = await r.json()
      await sleep(1500) // stay far under GT burst limits between successful calls
      return j
    } catch (e) {
      // network-level failure (timeout / reset) — retry too
      if (attempt >= retries) throw e
      const backoff = 2000 * 2 ** attempt
      console.error(`GT ${path} threw "${e.message}", retry in ${backoff}ms`)
      await sleep(backoff)
    }
  }
}

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const j = await r.json()
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message}`)
  return j.result
}

// --- pure, testable scoring: no network, deterministic ---
// trades: [{ id?, trader, volumeUsd }]  referralBindings: [{ invitee, referrer }]
export function computePoints({ trades, referralBindings }) {
  const wallets = new Map() // addr -> { volumeUsd, trades }
  const seen = new Set() // trade id dedup (guards double-count across overlapping pools / reruns)
  for (const t of trades) {
    const trader = t.trader?.toLowerCase()
    const usd = Number(t.volumeUsd)
    if (!trader || !(usd > 0)) continue
    const id = t.id ? String(t.id) : `${trader}:${usd}`
    if (seen.has(id)) continue
    seen.add(id)
    const w = wallets.get(trader) ?? { volumeUsd: 0, trades: 0 }
    w.volumeUsd += usd
    w.trades += Number(t.trades ?? 1)
    wallets.set(trader, w)
  }

  const referrerOf = new Map() // invitee -> referrer
  const referrals = new Map() // referrer -> count
  for (const b of referralBindings) {
    const invitee = b.invitee?.toLowerCase()
    const referrer = b.referrer?.toLowerCase()
    if (!invitee || !referrer) continue
    if (invitee === referrer) continue // self-referral guard
    if (referrerOf.has(invitee)) continue // first binding wins (matches on-chain "bind once")
    referrerOf.set(invitee, referrer)
    referrals.set(referrer, (referrals.get(referrer) ?? 0) + 1)
  }

  const points = new Map() // addr -> points
  for (const [addr, w] of wallets) points.set(addr, w.volumeUsd)
  for (const [invitee, referrer] of referrerOf) {
    const base = wallets.get(invitee)?.volumeUsd ?? 0
    if (base > 0) points.set(referrer, (points.get(referrer) ?? 0) + base * 0.1)
  }

  return { wallets, referrerOf, referrals, points }
}

// 池子来源：data/ours.json（ours.mjs 每 10 分钟从链上事件 + v1 存档汇总的**全部** dontblink 币）。
// 只扫 24h 有成交的池（gt.tx > 0）+ 上一轮账本里出现过的池：没成交的池 getLogs 也是空。
async function activePools() {
  const ours = JSON.parse(await readFile('data/ours.json', 'utf8'))
  return (ours.tokens ?? [])
    .filter((t) => t.pool && t.gt && Number(t.gt.tx ?? 0) > 0)
    .sort((a, b) => Number(b.gt.vol ?? 0) - Number(a.gt.vol ?? 0))
    .map((t) => ({ token: t.token.toLowerCase(), pool: t.pool.toLowerCase(), symbol: t.symbol }))
}

async function rpcBatch(calls) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params }))),
  })
  const j = await r.json()
  if (!Array.isArray(j)) throw new Error(`RPC batch: ${JSON.stringify(j).slice(0, 200)}`)
  return j.sort((a, b) => a.id - b.id).map((x) => (x.error ? null : x.result))
}

// ETH/USD：GT simple price（会被限流）→ boards 快照里任一 /WETH 池的 quote_token_price_usd
async function ethUsd() {
  try {
    const j = await gt(`https://api.geckoterminal.com/api/v2/simple/networks/robinhood/token_price/${WETH}`, { retries: 1 })
    const v = Number(j?.data?.attributes?.token_prices?.[WETH])
    if (v > 0) return v
  } catch (e) {
    console.error(`ETH price via GT failed (${e.message}), using boards snapshot`)
  }
  const b = JSON.parse(await readFile('data/boards.json', 'utf8'))
  for (const key of ['pools', 'trending_pools', 'new_pools']) {
    for (const p of b?.boards?.[key]?.data ?? []) {
      const a = p.attributes ?? {}
      if (/\/ WETH/.test(a.name ?? '') && Number(a.quote_token_price_usd) > 0) return Number(a.quote_token_price_usd)
    }
  }
  throw new Error('no ETH/USD price available')
}

const toBig = (hex) => {
  const v = BigInt(hex)
  return v >= 1n << 255n ? v - (1n << 256n) : v
}
const abs = (v) => (v < 0n ? -v : v)

// 从链上 Swap 日志拿成交：[{ id, trader, volumeUsd, block }]
async function collectSwaps(pools, fromBlock, toBlock, price) {
  const byPool = new Map(pools.map((p) => [p.pool, p]))
  const addresses = [...byPool.keys()]
  if (addresses.length === 0) return []
  // 每个池 WETH 在哪一侧：token0 = 地址小的那个
  const wethIs0 = new Map(pools.map((p) => [p.pool, WETH < p.token]))

  const logs = []
  for (let from = fromBlock; from <= toBlock; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, toBlock)
    try {
      const chunk = await rpc('eth_getLogs', [
        { address: addresses, topics: [SWAP_TOPIC], fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) },
      ])
      logs.push(...chunk)
    } catch (e) {
      console.error(`swap logs [${from}-${to}] failed (non-fatal): ${e.message}`)
    }
  }

  // tx.from：按 hash 去重后分批查
  const hashes = [...new Set(logs.map((l) => l.transactionHash))]
  const from = new Map()
  // RPC 有每分钟请求数限制：批间歇 + 429 退避重试。查不到 from 的 swap 这一轮不记账、
  // 也不进 seen —— 下一轮（30 分钟后）会再试，不会漏。
  for (let i = 0; i < hashes.length; i += 40) {
    const slice = hashes.slice(i, i + 40)
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await rpcBatch(slice.map((h) => ({ method: 'eth_getTransactionByHash', params: [h] })))
        res.forEach((tx, k) => tx?.from && from.set(slice[k], tx.from.toLowerCase()))
        break
      } catch (e) {
        if (attempt === 3) console.error(`tx lookup batch failed: ${e.message}`)
        else await sleep(1500 * 2 ** attempt)
      }
    }
    await sleep(400)
  }

  const trades = []
  for (const l of logs) {
    const pool = l.address.toLowerCase()
    const data = l.data.slice(2)
    if (data.length < 64 * 2) continue
    const amount0 = toBig('0x' + data.slice(0, 64))
    const amount1 = toBig('0x' + data.slice(64, 128))
    const wethAmt = wethIs0.get(pool) ? amount0 : amount1
    const eth = Number(abs(wethAmt)) / 1e18
    const trader = from.get(l.transactionHash)
    if (!trader || !(eth > 0)) continue
    trades.push({ id: `${l.transactionHash}:${parseInt(l.logIndex, 16)}`, trader, volumeUsd: eth * price, block: parseInt(l.blockNumber, 16), pool })
  }
  return trades
}

async function loadLedger() {
  try {
    return JSON.parse(await readFile(LEDGER, 'utf8'))
  } catch {
    return { since: new Date().toISOString(), lastBlock: 0, wallets: {}, seen: {} }
  }
}

// 推荐绑定：增量扫。RH 的 RPC 一次 getLogs 能吃 4000 万个区块（08-17 实测），
// 但每分钟的请求数有限 —— 从部署块起按 45k 切 722 刀会被 "Too Many Requests"。
// 账本里记 referralBlock，每轮只扫新块；首轮一刀切完。
async function collectReferrals(ledger, head) {
  const bindings = ledger.referrals ?? []
  const from = (ledger.referralBlock ?? REGISTRY_DEPLOY_BLOCK - 1) + 1
  if (from > head) return bindings
  const REF_CHUNK = 5_000_000
  let scannedTo = from - 1
  for (let a = from; a <= head; a += REF_CHUNK) {
    const b = Math.min(a + REF_CHUNK - 1, head)
    try {
      const logs = await rpc('eth_getLogs', [
        {
          address: REFERRAL_REGISTRY,
          topics: [BOUND_TOPIC],
          fromBlock: '0x' + a.toString(16),
          toBlock: '0x' + b.toString(16),
        },
      ])
      for (const log of logs) {
        bindings.push({ invitee: '0x' + log.topics[1].slice(26), referrer: '0x' + log.topics[2].slice(26) })
      }
      scannedTo = b
    } catch (e) {
      console.error(`referral logs [${a}-${b}] failed (will retry next run): ${e.message}`)
      break
    }
  }
  ledger.referrals = bindings
  ledger.referralBlock = scannedTo
  return bindings
}

async function main() {
  const pools = await activePools()
  const ledger = await loadLedger()
  // 上一轮账本里的池也继续扫（今天没成交也可能有昨天没扫到的）
  for (const [pool, meta] of Object.entries(ledger.pools ?? {})) {
    if (!pools.some((p) => p.pool === pool)) pools.push({ pool, token: meta.token, symbol: meta.symbol })
  }
  if (pools.length === 0) console.error('no active dontblink pools in ours.json; writing empty snapshot')

  const head = parseInt(await rpc('eth_blockNumber', []), 16)
  const scanFrom = Math.max(1, head - SCAN_HOURS * BLOCKS_PER_HOUR)
  const price = await ethUsd()
  const swaps = await collectSwaps(pools, scanFrom, head, price)

  // 合并进累计账本（按 swap id 去重）
  let added = 0
  for (const t of swaps) {
    if (ledger.seen[t.id]) continue
    ledger.seen[t.id] = t.block
    const w = (ledger.wallets[t.trader] ??= { volumeUsd: 0, trades: 0 })
    w.volumeUsd += t.volumeUsd
    w.trades += 1
    added++
  }
  const keepAfter = head - DEDUPE_HOURS * BLOCKS_PER_HOUR
  for (const [id, blk] of Object.entries(ledger.seen)) if (blk < keepAfter) delete ledger.seen[id]
  ledger.lastBlock = head
  ledger.updated = new Date().toISOString()
  ledger.ethUsd = price
  ledger.pools = Object.fromEntries(pools.map((p) => [p.pool, { token: p.token, symbol: p.symbol }]))
  const referralBindings = await collectReferrals(ledger, head)
  await mkdir('data', { recursive: true })
  await writeFile(LEDGER, JSON.stringify(ledger))

  const trades = Object.entries(ledger.wallets).map(([trader, w]) => ({ id: trader, trader, volumeUsd: w.volumeUsd, trades: w.trades }))
  const { wallets, referrals, points } = computePoints({ trades, referralBindings })
  const poolCount = pools.length

  const out = {
    updated: new Date().toISOString(),
    wallets: [...points.entries()]
      .map(([address, pts]) => ({
        address,
        points: Math.round(pts),
        volumeUsd: Math.round((wallets.get(address)?.volumeUsd ?? 0) * 100) / 100,
        trades: wallets.get(address)?.trades ?? 0,
        referrals: referrals.get(address) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 200),
  }

  await mkdir('data', { recursive: true })
  await writeFile('data/points.json', JSON.stringify(out))
  console.log(
    `points.json: ${out.wallets.length} wallets, ${poolCount} pools scanned [${scanFrom}-${head}], ${swaps.length} swaps seen / ${added} new, ETH $${price.toFixed(0)}, ${referralBindings.length} referral bindings`,
  )
}

// Only run the pipeline when executed directly — importing (tests) stays pure.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('points snapshot FAILED:', e?.message ?? e)
    process.exit(1)
  })
}
