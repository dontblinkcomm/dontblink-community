// 全站累计成交量：把我们自己发出去的每一个池子的**日 K 线**加起来。
//
// **为什么不能一次算完。** 池子有 1057 个（v1 存档 1041 + v2 15 + queue 1），而 GT 免费接口
// 实测第 3 批就 429（见 ours.mjs 里 2026-08-18 那次：fresh 58, failed 956）。所以这里是增量的：
// 每轮只刷一批，每个池子的结果单独存下来，总数是所有已知池子的和。日 K 是历史数据，
// 过去那些天不会再变，所以刷过的池子隔很久再刷一次也不会错太多。
//
// **总数只增不减。** 一轮里没刷到的池子沿用上次的值，而不是当成 0 ——
// 后者会让首页那个大数字随着 GT 的心情上下跳，而且跳低的时候没有任何迹象说明是我们没读到。
//
// 输出 data/volume-all.json：
//   { at, totalUsd, covered, known, pools: { [pool]: { v, days, at } } }
// covered < known 时前端显示 “≥” —— 那是下限，不是总数，两者必须分得开。

import { readFile, writeFile, mkdir } from 'node:fs/promises'

// 基址可覆盖:CI 上直连 GT,本地开发机出不了 GT 的网,用我们自己的代理跑一遍验管线。
const GT = (process.env.GT_BASE || 'https://api.geckoterminal.com/api/v2') + '/networks/robinhood'
const OUT = 'data/volume-all.json'
/**
 * 每轮刷多少个，以及每次之间隔多久。
 *
 * **2 秒不是随手写的:GT 免费档是 30 次/分钟。** 第一版写 1.2 秒 = 50 次/分钟，
 * 那是在自己把自己限流，然后所有池子都记成「读不到」。
 *
 * 这个 cron 名义上每 10 分钟一轮，**实测中位间隔 126 分钟**(单次运行 8.7 分钟，
 * 和调度间隔一样长，加上 concurrency 不取消，排队的定时运行被 GitHub 丢掉)。
 * 所以每轮多花两分钟不是问题，扫不完也不要紧 —— covered/known 会把「还没扫完」说出来。
 */
const BATCH = Number(process.env.VOL_BATCH || 60)
const GAP_MS = Number(process.env.VOL_GAP_MS || 2000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')) } catch { return fallback }
}

const ours = await readJson('data/ours.json', { tokens: [] })
/** pool → 24h 成交量。第一轮拿它排序，让大池子先落地。 */
const vol24 = new Map()
for (const t of ours.tokens ?? []) {
  if (!t.pool) continue
  const k = t.pool.toLowerCase()
  vol24.set(k, Math.max(vol24.get(k) ?? 0, Number(t.gt?.vol) || 0))
}
const pools = [...vol24.keys()]
if (pools.length === 0) {
  console.log('ours.json 里一个池子都没有 —— 不动 volume-all.json')
  process.exit(0)
}

const prev = await readJson(OUT, { pools: {} })
const store = { ...(prev.pools ?? {}) }

// 先刷从来没读过的，再刷最久没刷的。**不要随机挑** —— 随机挑会让某些池子长期抽不到，
// 而它们恰好可能是量最大的那几个。
//
// **没读过的那批之间，按 24h 成交量从大到小。** 全量扫完要十几轮(见上面的间隔实测)，
// 这期间首页显示的是一个带 `≥` 的下限。任意顺序意味着那个下限可能长时间明显偏低；
// 按量排序则让它第一轮就接近真值，后面只是慢慢补齐尾巴。
const now = Date.now()
const queue = pools
  .map((p) => ({ p, at: store[p]?.at ?? 0, v: vol24.get(p) ?? 0 }))
  .sort((a, b) => (a.at - b.at) || (b.v - a.v))
  .slice(0, BATCH)

let ok = 0
let zeroed = 0
/** **跳过的原因要数出来。** 只报「刷新 0/8」的话，没人分得清是 GT 限流、是这批池子真的
 *  没成交过、还是我把地址拼错了 —— 三种情况要做的事完全不同，而它们在日志里长得一样。 */
const why = {}
const note = (k) => { why[k] = (why[k] ?? 0) + 1 }

/**
 * **429 要重试这一个池子，不能因此放弃整轮。**
 *
 * 2026-08-28 在 muse-mini 上实测：间隔 2s/4s/6s 三档，429 的比例分别是 4/10、5/10、3/10 ——
 * 和速率**没有关系**，它是随机的（共享出口 IP 被整体限流）。而第一版是「一撞 429 就 break」，
 * 于是每轮只能刷到五六个池子，1057 个要两百轮才扫得完。
 *
 * 改成每个池子最多试 3 次、每次退避加倍；只有连着 8 个池子全军覆没才判定 GT 整个不可用、
 * 提前收工 —— 那时候继续打也是白打。
 */
const MAX_TRY = 3
let consecutiveFail = 0
let giveUp = false

for (const { p } of queue) {
  if (giveUp) break
  let done = false
  for (let attempt = 1; attempt <= MAX_TRY && !done; attempt++) {
    try {
      const r = await fetch(`${GT}/pools/${p}/ohlcv/day?limit=1000`, { headers: { accept: 'application/json' } })
      if (r.status === 429) { await sleep(GAP_MS * attempt * 2); continue }
      // **404 = GT 里没有这个池子的记录 = 它没有可读的 DEX 成交，记 0 并算作已覆盖。**
      // 不这么做的话，那 1041 个早就没人碰的 v1 池永远进不了 covered，覆盖率卡在个位数，
      // 而前端那道「覆盖率不到 80% 就别改口径」的闸就永远打不开 —— 功能等于没上。
      // 记 `no: true` 是为了以后想重查时分得出「查过是 0」和「真有 0 成交」。
      if (r.status === 404) { store[p] = { v: 0, days: 0, at: now, no: true }; zeroed++; done = true; break }
      const txt = await r.text()
      let j = null
      try { j = JSON.parse(txt) } catch { note(`HTTP${r.status} 非JSON`); break }
      const rows = j?.data?.attributes?.ohlcv_list
      if (!Array.isArray(rows)) { note(`HTTP${r.status} ${String(j?.errors?.[0]?.title ?? j?.error ?? '无 ohlcv_list').slice(0, 40)}`); break }
      // **空数组不等于「这个池子没成交过」。** 同一个池子实测第一次返回 0 根、第二次 20 根 ——
      // 把空当成 0 写进去，就等于把一次读取失败固化成一个事实。留着不动，下一轮再来。
      if (rows.length === 0) { note('K线为空'); break }
      const v = rows.reduce((s, x) => s + (Number(x?.[5]) || 0), 0)
      store[p] = { v, days: rows.length, at: now }
      ok++
      done = true
    } catch (e) {
      note('THROW ' + String(e?.message ?? e).slice(0, 40))
      break
    }
  }
  if (done) consecutiveFail = 0
  else {
    consecutiveFail++
    note('三次都限流')
    if (consecutiveFail >= 8) { giveUp = true; note('连续 8 个全失败,判定 GT 不可用,提前收工') }
  }
  await sleep(GAP_MS)
}

const covered = pools.filter((p) => store[p]).length
const totalUsd = pools.reduce((s, p) => s + (store[p]?.v ?? 0), 0)

// 只保留还在册的池子，免得文件无限长胖
const kept = {}
for (const p of pools) if (store[p]) kept[p] = store[p]

await mkdir('data', { recursive: true })
await writeFile(OUT, JSON.stringify({ at: now, totalUsd, covered, known: pools.length, pools: kept }))

console.log(
  `volume-all: 本轮刷新 ${ok}/${queue.length}${giveUp ? '（GT 连续失败，提前收工）' : ''}；` +
  `其中 ${zeroed} 个 GT 查无此池(记 0)；已覆盖 ${covered}/${pools.length}；合计 $${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
)
for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`  跳过 ${n} 个：${k}`)
