// 「dontblink 自己发出去的币」这份名单 —— 站点首页该展示的东西。
//
// 为什么要有这个文件：Explore 的四个榜拉的是 GeckoTerminal 上 Robinhood 链的**全部**池子，
// 不区分谁发的。于是首页被别家 launchpad 的币占满，而我们自己发的（v1 999 枚 + v2 那几枚）
// 因为没成交量进不了榜 —— 一个 launchpad 的首页不展示自己发的币，说不过去。
//
// 名单从链上事件来，不从任何后台数据库来：
//   v1：V3LaunchpadGatedMax.LaunchCreated（legacy/dontblink-family/tokens.json 是截至 08-15 的存档，
//       这里在它之后继续扫链补新的）
//   v2：DontblinkPortal.Launched（含 instant / curve / queue 三种模式）
// 行情从 GT 的 pools/multi 批量拿（有池子的才有）；内盘币没有池子，行情字段留空、mode 标出来。
//
// 输出 data/ours.json：{ at, tokens: [{token,pool,mode,name,symbol,createdBlock,gt?}] }
// 每个端点失败都不让整轮作废；`at` 只在真拿到新数据时前进（同 snapshot.mjs 的规矩）。
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood'

const V1_LAUNCHPAD = '0xF441cc979fa862f2674b9188A7b529caFd3ce204'
const V1_TOPIC_CREATED = '0xa84c89db4ef0ae60697badbc52ac5cd74ad3b5ba62c9152b523bbb964f2d7388' // LaunchCreated(token,deployer,pool,tokenId,windowEnd)
const V2_PORTAL = '0x7a4EB7F99833178c6463184bd0D8d17b6FC2d59c'
const V2_TOPIC_LAUNCHED = '0x34a31071e22e927693791373b8825f9c18452461b3cea148ec4e2f34b1154f31' // Launched(nonce,token,creator,version,mode,quote,pool,tokenId,saleId,windowEnd)
const V2_FROM_BLOCK = 38269916 // v2 部署块
const CHUNK = 100_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let rpcId = 0
async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const j = await r.json()
  if (j.error) throw new Error(`${method}: ${j.error.message}`)
  return j.result
}
const hex = (n) => '0x' + n.toString(16)
const addr = (topic) => '0x' + topic.slice(26).toLowerCase()
const word = (data, i) => data.slice(2 + i * 64, 2 + (i + 1) * 64)

async function getLogs(address, topic0, from, to) {
  const out = []
  for (let a = from; a <= to; a += CHUNK) {
    const b = Math.min(a + CHUNK - 1, to)
    let logs
    for (let tries = 0; tries < 3; tries++) {
      try {
        logs = await rpc('eth_getLogs', [{ address, topics: [topic0], fromBlock: hex(a), toBlock: hex(b) }])
        break
      } catch (e) {
        if (tries === 2) throw e
        await sleep(2000)
      }
    }
    out.push(...logs)
  }
  return out
}

/** ERC20 name()/symbol() —— 只对 v2 新币读一次，v1 的存档里已经有了 */
async function erc20Meta(token) {
  const call = async (sig) => {
    const data = await rpc('eth_call', [{ to: token, data: sig }, 'latest'])
    if (!data || data === '0x') return ''
    const off = parseInt(word(data, 0), 16) * 2
    const len = parseInt(data.slice(2 + off, 2 + off + 64), 16)
    return Buffer.from(data.slice(2 + off + 64, 2 + off + 64 + len * 2), 'hex').toString('utf8')
  }
  return { name: await call('0x06fdde03'), symbol: await call('0x95d89b41') }
}

const prev = await readFile('data/ours.json', 'utf8').then((t) => JSON.parse(t)).catch(() => null)
/** 旧文件里的 gt 可能还是整份 GT 响应（2MB 那版）—— 沿用时先压成瘦格式，别把胖的又写回去 */
function slimGt(g) {
  if (!g || !g.data) return g ?? undefined
  const a = g.data.attributes ?? {}
  const base = (g.included ?? [])[0]
  const tx = a.transactions?.h24
  const img = base?.attributes?.image_url
  return {
    price: a.base_token_price_usd == null ? null : Number(a.base_token_price_usd),
    c1h: Number(a.price_change_percentage?.h1 ?? 0),
    c24h: Number(a.price_change_percentage?.h24 ?? 0),
    vol: Number(a.volume_usd?.h24 ?? 0),
    fdv: Number(a.fdv_usd ?? 0),
    tx: tx ? Number(tx.buys ?? 0) + Number(tx.sells ?? 0) : 0,
    at: a.pool_created_at ?? null,
    name: a.name ?? null,
    dex: g.data.relationships?.dex?.data?.id ?? null,
    img: img && img !== 'missing.png' ? img : null,
  }
}
for (const t of prev?.tokens ?? []) if (t.gt) t.gt = slimGt(t.gt)
const prevByToken = new Map((prev?.tokens ?? []).map((t) => [t.token, t]))

// ---- v1：存档 + 增量 ----
const archive = await readFile('legacy/dontblink-family/tokens.json', 'utf8').then((t) => JSON.parse(t)).catch(() => [])
const tokens = new Map()
for (const t of archive) {
  tokens.set(t.token.toLowerCase(), {
    token: t.token.toLowerCase(),
    pool: (t.pool ?? '').toLowerCase() || null,
    mode: 'v1',
    name: t.name ?? '',
    symbol: t.symbol ?? '',
    // 存档里的 img 已经是站内完整路径（/legacy/dontblink-family/images/….webp），原样用。
    // 第一版又拼了一次前缀 → 双重路径 404 → 首页 v1 币的 logo 全部不显示。
    imageUrl: t.img || null,
    createdBlock: Number(t.createdBlock ?? 0),
    createdAt: t.createdAt ?? null,
  })
}
const head = parseInt(await rpc('eth_blockNumber', []), 16)
const archiveHead = Math.max(0, ...archive.map((t) => Number(t.createdBlock ?? 0)))
console.log(`v1 archive: ${archive.length} tokens up to block ${archiveHead}; head=${head}`)
try {
  const logs = await getLogs(V1_LAUNCHPAD, V1_TOPIC_CREATED, archiveHead + 1, head)
  for (const lg of logs) {
    const token = addr(lg.topics[1])
    if (tokens.has(token)) continue
    const meta = prevByToken.get(token) ?? (await erc20Meta(token))
    tokens.set(token, {
      token,
      pool: '0x' + word(lg.data, 0).slice(24),
      mode: 'v1',
      name: meta.name,
      symbol: meta.symbol,
      imageUrl: null,
      createdBlock: parseInt(lg.blockNumber, 16),
      createdAt: null,
    })
  }
  console.log(`v1 incremental: +${logs.length}`)
} catch (e) {
  console.log('v1 incremental scan failed, keeping archive only:', String(e).slice(0, 120))
}

// ---- v2 ----
const MODE = ['instant', 'queue', 'curve']
const V2_TOPIC_META = '0x81757bd4a3f7375c9021d3bd561d1a8075d765544734931f26896acacda7ccdc' // LaunchMetadata(token, imageURI, xUrl, webUrl, tgUrl, bio)
/** 解 ABI 里的动态 string（LaunchMetadata 的 data 段：5 个 string，头 5 个 word 是偏移） */
function abiStrings(data, n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const off = parseInt(word(data, i), 16) * 2
    const len = parseInt(data.slice(2 + off, 2 + off + 64), 16)
    out.push(Buffer.from(data.slice(2 + off + 64, 2 + off + 64 + len * 2), 'hex').toString('utf8'))
  }
  return out
}
/** imageURI 是 data:application/json;base64,{name,symbol,description,image} —— 取里面的 image（本身也是 data URI，≤8KB） */
function imageFromTokenURI(uri) {
  try {
    if (!uri?.startsWith('data:application/json;base64,')) return uri?.startsWith('http') ? uri : null
    const j = JSON.parse(Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf8'))
    return typeof j.image === 'string' && j.image.length < 12_000 ? j.image : null
  } catch {
    return null
  }
}
const v2Images = new Map()
try {
  for (const lg of await getLogs(V2_PORTAL, V2_TOPIC_META, V2_FROM_BLOCK, head)) {
    const [imageURI] = abiStrings(lg.data, 5)
    const img = imageFromTokenURI(imageURI)
    if (img) v2Images.set(addr(lg.topics[1]), img)
  }
} catch (e) {
  console.log('v2 metadata scan failed:', String(e).slice(0, 120))
}
try {
  const logs = await getLogs(V2_PORTAL, V2_TOPIC_LAUNCHED, V2_FROM_BLOCK, head)
  for (const lg of logs) {
    const token = addr(lg.topics[2])
    const mode = MODE[parseInt(word(lg.data, 1), 16)] ?? 'instant'
    const pool = '0x' + word(lg.data, 3).slice(24)
    const meta = prevByToken.get(token) ?? (await erc20Meta(token))
    tokens.set(token, {
      token,
      pool: /^0x0+$/.test(pool) ? null : pool,
      mode,
      name: meta.name,
      symbol: meta.symbol,
      imageUrl: v2Images.get(token) ?? null,
      createdBlock: parseInt(lg.blockNumber, 16),
      createdAt: null,
    })
  }
  console.log(`v2: ${logs.length} launches, ${v2Images.size} with image`)
} catch (e) {
  console.log('v2 scan failed:', String(e).slice(0, 120))
}

// ---- 行情：GT pools/multi，30 个一批 ----
// 新的在前：GT 一旦开始限流，至少最新那批币（首页最先看到的）已经拿到了行情。
const withPool = [...tokens.values()].filter((t) => t.pool).sort((a, b) => b.createdBlock - a.createdBlock)
let fresh = 0
let failed = 0
let gtDown = false // 连续被限流就别再撞了 —— 35 批 × 25 秒退避 = 15 分钟，cron 等不起
const MAX_BATCHES = Number(process.env.GT_MAX_BATCHES || 0) // 本地验管线用；Actions 上不设 = 全量
for (let i = 0; i < withPool.length; i += 30) {
  const batch = withPool.slice(i, i + 30)
  let j = null
  if (MAX_BATCHES && i / 30 >= MAX_BATCHES) gtDown = true
  if (!gtDown) {
    const url = `${GT}/pools/multi/${batch.map((t) => t.pool).join(',')}?include=base_token`
    let strikes = 0
    for (const wait of [0, 5_000, 20_000]) {
      if (wait) await sleep(wait)
      const r = await fetch(url, { headers: { accept: 'application/json' } }).catch(() => null)
      if (r?.ok) {
        j = await r.json()
        break
      }
      strikes++ // 429、5xx、网络失败一视同仁 —— 三次拿不到就是拿不到
      console.log(`  batch ${i / 30 + 1}: ${r ? r.status : 'fetch failed'}`)
    }
    if (!j && strikes >= 3) {
      gtDown = true
      console.log(`GT rate-limited at batch ${i / 30 + 1}/${Math.ceil(withPool.length / 30)}; keeping previous market data for the rest`)
    }
  }
  if (!j) {
    failed += batch.length
    for (const t of batch) if (prevByToken.get(t.token)?.gt) t.gt = prevByToken.get(t.token).gt
    continue
  }
  const included = j.included ?? []
  const byPool = new Map((j.data ?? []).map((p) => [p.attributes.address.toLowerCase(), p]))
  for (const t of batch) {
    const p = byPool.get(t.pool)
    if (p) {
      // **只存前端用到的字段。** 第一版把整份 GT 响应搬进来，1004 枚 = 2MB，
      // 每个访客每分钟拉一次 → 多刷几下就撞 GitHub Pages 的每 IP 限流，页面整个变成
      // "Rate limit exceeded"。现在每枚 ~200 字节。
      const a = p.attributes
      const baseId = p.relationships?.base_token?.data?.id
      const base = included.find((x) => x.id === baseId)
      const tx = a.transactions?.h24
      const img = base?.attributes?.image_url
      t.gt = {
        price: a.base_token_price_usd == null ? null : Number(a.base_token_price_usd),
        c1h: Number(a.price_change_percentage?.h1 ?? 0),
        c24h: Number(a.price_change_percentage?.h24 ?? 0),
        vol: Number(a.volume_usd?.h24 ?? 0),
        fdv: Number(a.fdv_usd ?? 0),
        tx: tx ? Number(tx.buys ?? 0) + Number(tx.sells ?? 0) : 0,
        at: a.pool_created_at ?? null,
        name: a.name ?? null,
        dex: p.relationships?.dex?.data?.id ?? null,
        img: img && img !== 'missing.png' ? img : null,
      }
      fresh++
    } else if (prevByToken.get(t.token)?.gt) {
      t.gt = prevByToken.get(t.token).gt
    }
  }
  await sleep(1_500)
}
console.log(`GT: fresh ${fresh}, failed ${failed}, pools ${withPool.length}, no-pool ${tokens.size - withPool.length}`)

if (fresh === 0 && tokens.size === 0) {
  console.error('nothing to write')
  process.exit(1)
}

// 被同名靓号版取代的旧发行 —— 链上永远在，但不进首页。只放这里、不放前端：改名单不用发版。
const SUPERSEDED = new Set([
  '0x51b5b3f3e3c4c2c6fe71e584ed91dcff61c738ff', // DONTBLINK Genesis（08-16 首发，非靓号）→ 0x50DA…CDbDb
  '0x49fcfa44d30f1e279954f82a321676d2e77640b9', // DONTBLINK Curve → 0x6f72…6dBDb
  '0xc11788e9e7199c662813574ab7e2018dd27c4d01', // DONTBLINK Drop → 0x4C7E…7dbdb
])
const list = [...tokens.values()].filter((t) => !SUPERSEDED.has(t.token)).sort((a, b) => b.createdBlock - a.createdBlock)
await mkdir('data', { recursive: true })
await writeFile('data/ours.json', JSON.stringify({ at: fresh > 0 ? Date.now() : (prev?.at ?? Date.now()), tokens: list }))
console.log(`ours.json written: ${list.length} tokens`)
