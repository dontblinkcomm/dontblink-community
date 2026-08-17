// 从 Actions runner（对所有人是同一个稳定 IP）拉 GeckoTerminal 的榜单数据，
// 同源发布成 /data/boards.json。浏览器被限流或够不到 GT 时回落到这份快照
// —— 手机在运营商 CGNAT 后面共享一份 30 次/分钟的额度，几千台挤一个 IP。
//
// **一个端点失败不能让整次快照作废。** 老版本是 `if (!r.ok) throw`：
// GT 只要 429 一次，这一轮就什么都不写，而 cron 下一次可能是 50 分钟后。
// 2026-08-16 那晚线上首页空白，就是「快照过期 + 脚本全有全无」两件事叠出来的。
// 现在的规则：每个端点独立重试，失败就沿用上一份里那个端点的数据，
// 只有三个端点全军覆没才算这一轮失败。
import { mkdir, writeFile, readFile } from 'node:fs/promises'

const BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood'
const ENDPOINTS = {
  trending_pools: `${BASE}/trending_pools?include=base_token`,
  pools: `${BASE}/pools?page=1&sort=h24_volume_usd_desc&include=base_token`,
  new_pools: `${BASE}/new_pools?page=1&include=base_token`,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 429 是限流不是故障，值得等一等再试。退避 5s / 20s / 60s。 */
async function fetchBoard(key, url) {
  const backoff = [5_000, 20_000, 60_000]
  for (let i = 0; i <= backoff.length; i++) {
    const r = await fetch(url, { headers: { accept: 'application/json' } }).catch(() => null)
    if (r?.ok) {
      const j = await r.json()
      // 200 但 data 为空 = 上游出问题了，别拿它覆盖掉一份好数据
      if (Array.isArray(j?.data) && j.data.length > 0) return j
      console.log(`${key}: 200 但 data 为空，当失败处理`)
    } else {
      console.log(`${key}: ${r ? r.status : 'fetch failed'}`)
    }
    if (i < backoff.length) await sleep(backoff[i])
  }
  return null
}

const prev = await readFile('data/boards.json', 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => null)

const boards = {}
let fresh = 0
for (const [key, url] of Object.entries(ENDPOINTS)) {
  const j = await fetchBoard(key, url)
  if (j) {
    boards[key] = j
    fresh++
  } else if (prev?.boards?.[key]) {
    boards[key] = prev.boards[key]
    console.log(`${key}: 沿用上一份快照`)
  }
  await sleep(1_500) // 远离 GT 的突发限制
}

if (fresh === 0) {
  console.error('三个端点全部失败，本轮不写文件（保留上一份，不把它的时间戳刷新成假的）')
  process.exit(1)
}

await mkdir('data', { recursive: true })
// `at` 只在真的拿到新数据时前进 —— 否则前端会以为快照是新的，
// 而它其实是上一轮的内容，这会把「陈旧」伪装成「新鲜」。
await writeFile('data/boards.json', JSON.stringify({ at: Date.now(), boards }))
console.log(`boards.json written: ${Object.keys(boards).join(', ')}（新鲜 ${fresh}/3）`)
