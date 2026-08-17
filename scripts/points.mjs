// Compute the SSI points snapshot from on-chain-verifiable data and publish it
// same-origin as /data/points.json (read by the Points page).
//
// Scoring (documented on the Points page — keep the two in sync):
//   - 1 USD of trade volume on any dontblink-launched pool = 1 point
//   - referral bonus: 10% of each invitee's base points goes to their referrer
//     (bindings come from the on-chain ReferralRegistry, event Bound)
//
// KNOWN LIMITATIONS (read before trusting the numbers for any real reward gate):
//   - Volume comes from GeckoTerminal's *recent* trades window per pool, not a
//     full historical index. Points therefore reflect a rolling window, not an
//     all-time cumulative total. For a true cumulative ledger you need to persist
//     and accumulate across runs (keyed by trade id) — not done here.
//   - Points == gross volume, which is trivially wash-farmable: a wallet doing
//     round-trip self-trades inflates its own score for only gas+fee cost. If
//     these points ever gate a real airdrop, add a per-wallet cap / net-volume /
//     round-trip exclusion FIRST. `trades` per wallet is surfaced so lopsided
//     trade-count vs volume patterns are at least visible.
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood'
const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const REFERRAL_REGISTRY = '0xe616b60bDD1E3aC0719eE2b81d2d0bd7018A957D'
const REGISTRY_DEPLOY_BLOCK = 6147237
// keccak256("Bound(address,address)")
const BOUND_TOPIC = '0x0d128562eaa47ab89086803e64a0f96847c0ed3cc63c26251f29ba1aede09d4e'
const LOG_CHUNK = 45000 // eth_getLogs block window; many RPCs cap the range

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- resilient GET against GeckoTerminal: retry on 429 / 5xx / network error ---
async function gt(path, { retries = 4 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${GT}${path}`, { headers: { accept: 'application/json' } })
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
    w.trades += 1
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
// 此前读的是 07-09 的 tokenlist.json —— 只有 2 枚测试币，所以榜单永远是空的。
// 只拉过去 24h 有成交的池（gt.tx > 0），按成交量取前 MAX_POOLS 个：GT 的 trades 端点本来
// 就是"最近一窗"，没成交的池拉了也是空，还白白吃限流。
const MAX_POOLS = Number(process.env.SNAPSHOT_MAX_POOLS ?? 60)

async function activePools() {
  const ours = JSON.parse(await readFile('data/ours.json', 'utf8'))
  return (ours.tokens ?? [])
    .filter((t) => t.pool && t.gt && Number(t.gt.tx ?? 0) > 0)
    .sort((a, b) => Number(b.gt.vol ?? 0) - Number(a.gt.vol ?? 0))
    .slice(0, MAX_POOLS)
    .map((t) => ({ token: t.token, pool: t.pool.toLowerCase(), symbol: t.symbol }))
}

async function collectTrades(pools) {
  const trades = []
  let poolCount = 0
  for (const { pool, symbol } of pools) {
    poolCount++
    try {
      const res = await gt(`/pools/${pool}/trades`)
      for (const t of Array.isArray(res?.data) ? res.data : []) {
        const a = t?.attributes ?? {}
        const usd = Number(a.volume_in_usd ?? 0)
        if (a.tx_from_address && usd > 0) {
          trades.push({ id: t.id, trader: a.tx_from_address, volumeUsd: usd })
        }
      }
    } catch (e) {
      console.error(`trades failed for ${symbol} pool ${pool}: ${e.message}`)
    }
  }
  return { trades, poolCount }
}

async function collectReferrals() {
  const bindings = []
  let head
  try {
    head = parseInt(await rpc('eth_blockNumber', []), 16)
  } catch (e) {
    console.error(`eth_blockNumber failed (referrals skipped): ${e.message}`)
    return bindings
  }
  // Chunk the range so a range-limited RPC doesn't reject the whole query.
  for (let from = REGISTRY_DEPLOY_BLOCK; from <= head; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, head)
    try {
      const logs = await rpc('eth_getLogs', [
        {
          address: REFERRAL_REGISTRY,
          topics: [BOUND_TOPIC],
          fromBlock: '0x' + from.toString(16),
          toBlock: '0x' + to.toString(16),
        },
      ])
      for (const log of logs) {
        bindings.push({
          invitee: '0x' + log.topics[1].slice(26),
          referrer: '0x' + log.topics[2].slice(26),
        })
      }
    } catch (e) {
      console.error(`referral logs [${from}-${to}] failed (non-fatal): ${e.message}`)
    }
  }
  return bindings
}

async function main() {
  const pools = await activePools()
  if (pools.length === 0) console.error('no active dontblink pools in ours.json; writing empty snapshot')

  const { trades, poolCount } = await collectTrades(pools)
  const referralBindings = await collectReferrals()
  const { wallets, referrals, points } = computePoints({ trades, referralBindings })

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
    `points.json: ${out.wallets.length} wallets from ${poolCount} active pools / ${trades.length} trades, ${referralBindings.length} referral bindings`,
  )
}

// Only run the pipeline when executed directly — importing (tests) stays pure.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('points snapshot FAILED:', e?.message ?? e)
    process.exit(1)
  })
}
