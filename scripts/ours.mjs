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
    // **这里是压缩旧数据,不能盖新戳。** 写 Date.now() 会把三周前的价标成刚抓的,
    // 这个字段本身就成了谎言 —— 比不加还糟。来源不明就是 null。
    pAt: null,
    name: a.name ?? null,
    dex: g.data.relationships?.dex?.data?.id ?? null,
    img: img && img !== 'missing.png' ? img : null,
  }
}
for (const t of prev?.tokens ?? []) if (t.gt) t.gt = slimGt(t.gt)
const prevByToken = new Map((prev?.tokens ?? []).map((t) => [t.token, t]))
/** 链上扫描有没有失败过。**失败时绝不能用残缺的列表覆盖上一版。** */
let scanFailed = false

/**
 * **扫描游标:记住上次扫到哪个区块,别每轮从头再来。**
 *
 * 改之前,四次发现用的 getLogs 每轮都从各自的起点扫到链头:v1 两次从 37,388,780、
 * v2 两次从 38,269,916,而链头已经 48,800,000+。按 CHUNK=100,000 算,一次扫描 114 个请求,
 * **四次就是 456 个 getLogs,每 30 分钟一遍** —— Robinhood 的 RPC 因此反复回
 * `Too Many Requests`,而扫描一失败,币列表就会残缺(2026-08-28 站上两次丢掉 62 枚币)。
 *
 * 链头每小时走约 25,000 块,所以带游标之后每轮只需要一两个 chunk。
 *
 * **两条规矩:**
 *   1. 只有扫描成功才推进游标。失败就留在原地,下一轮从同一个位置重来 ——
 *      推进一个没扫成的区间,那段里的币就永远不会被发现,而且不会有任何迹象。
 *   2. 每次回退 OVERLAP 个区块再扫。多扫一点是幂等的(token 以地址为键),
 *      而少扫一点会漏币。
 */
const OVERLAP = 5_000
const prevScan = prev?.scan ?? {}
/** 上一轮之前发现的币要带过来 —— 不再每轮重扫历史,它们只存在于上一版里。
 *  v2 的币**完全**靠链上扫描,不带过来就等于每轮都要重扫 1000 万块才能看见它们。 */
const carryPrev = (tokens) => {
  let n = 0
  for (const t of prev?.tokens ?? []) {
    const k = String(t.token ?? '').toLowerCase()
    if (k && !tokens.has(k)) { tokens.set(k, t); n++ }
  }
  return n
}

// ---- v1：存档 + 增量 ----
const archive = await readFile('legacy/dontblink-family/tokens.json', 'utf8').then((t) => JSON.parse(t)).catch(() => [])
const tokens = new Map()
for (const t of archive) {
  tokens.set(t.token.toLowerCase(), {
    token: t.token.toLowerCase(),
    pool: (t.pool ?? '').toLowerCase() || null,
    mode: 'v1',
    creator: (t.deployer ?? '').toLowerCase() || null,
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
console.log(`带过来上一版发现的 ${carryPrev(tokens)} 枚(游标 v1=${prevScan.v1 ?? '无'} v2=${prevScan.v2 ?? '无'})`)
/** 从游标往回退一点开始;没有游标(首次)就退回全量,和改之前一样。 */
const v1From = prevScan.v1 ? Math.max(archiveHead + 1, prevScan.v1 - OVERLAP) : archiveHead + 1
let v1ScannedTo = null
try {
  const logs = await getLogs(V1_LAUNCHPAD, V1_TOPIC_CREATED, v1From, head)
  // 存档之后新发的 v1 币没有本地图 —— 从 v1 的 LaunchMetadata 事件里取 imageURI（和 v2 同一个 topic）
  const v1Images = new Map()
  if (logs.length) {
    try {
      for (const lg of await getLogs(V1_LAUNCHPAD, '0x81757bd4a3f7375c9021d3bd561d1a8075d765544734931f26896acacda7ccdc', v1From, head)) {
        const [imageURI] = abiStrings(lg.data, 5)
        const img = imageFromTokenURI(imageURI)
        if (img) v1Images.set(addr(lg.topics[1]), img)
      }
    } catch {}
  }
  for (const lg of logs) {
    const token = addr(lg.topics[1])
    if (tokens.has(token)) continue
    const meta = prevByToken.get(token) ?? (await erc20Meta(token))
    tokens.set(token, {
      token,
      pool: '0x' + word(lg.data, 0).slice(24),
      mode: 'v1',
      creator: addr(lg.topics[2]),
      name: meta.name,
      symbol: meta.symbol,
      imageUrl: v1Images.get(token) ?? null,
      createdBlock: parseInt(lg.blockNumber, 16),
      createdAt: null,
    })
  }
  v1ScannedTo = head   // **只有走到这里才算扫成功,游标才推进**
  console.log(`v1 incremental: +${logs.length} (从 ${v1From})`)
} catch (e) {
  scanFailed = true
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
const v2From = prevScan.v2 ? Math.max(V2_FROM_BLOCK, prevScan.v2 - OVERLAP) : V2_FROM_BLOCK
let v2ScannedTo = null
const v2Images = new Map()
try {
  for (const lg of await getLogs(V2_PORTAL, V2_TOPIC_META, v2From, head)) {
    const [imageURI] = abiStrings(lg.data, 5)
    const img = imageFromTokenURI(imageURI)
    if (img) v2Images.set(addr(lg.topics[1]), img)
  }
} catch (e) {
  scanFailed = true
  console.log('v2 metadata scan failed:', String(e).slice(0, 120))
}
try {
  const logs = await getLogs(V2_PORTAL, V2_TOPIC_LAUNCHED, v2From, head)
  for (const lg of logs) {
    const token = addr(lg.topics[2])
    const mode = MODE[parseInt(word(lg.data, 1), 16)] ?? 'instant'
    const pool = '0x' + word(lg.data, 3).slice(24)
    const meta = prevByToken.get(token) ?? (await erc20Meta(token))
    tokens.set(token, {
      token,
      pool: /^0x0+$/.test(pool) ? null : pool,
      mode,
      creator: addr(lg.topics[3]),
      name: meta.name,
      symbol: meta.symbol,
      imageUrl: v2Images.get(token) ?? null,
      createdBlock: parseInt(lg.blockNumber, 16),
      createdAt: null,
    })
  }
  v2ScannedTo = head   // 同上:扫成功才推进
  console.log(`v2: ${logs.length} launches, ${v2Images.size} with image (从 ${v2From})`)
} catch (e) {
  scanFailed = true
  console.log('v2 scan failed:', String(e).slice(0, 120))
}

// ---- 行情：GT pools/multi，30 个一批 ----
// **v2 的币排在最前面，然后才按区块从新到旧。**
//
// 原来只按 createdBlock 排。看起来合理，实际后果是：v1 还在持续出币（区块比我们大部分
// v2 币都新），于是我们自己的 13 枚要和 1000+ 枚 v1 抢那点新鲜行情的名额。
// 2026-08-18 实测 GT 免费接口在第 3 批就 429：`fresh 58, failed 956` —— 1016 枚里只有
// 58 枚拿到新价，其余全部沿用旧数据，最老的停在 08-09（九天前）。
// GENESIS 就是这么排到几十位开外的：链上真实 FDV 约 $7.7K，首页却显示 $17.2K（34 小时
// 前的化石价），差 123%。
//
// v2 一共十几枚，永远落在第 1 批，而第 1 批从来没被限流过 —— 首页看的就是这些。
// v1 拿不到新行情是可以接受的（老板 2026-08-18：「以 v2 数据为主，v1 可有可无」）。
const isV2 = (t) => t.mode !== 'v1'
const withPool = [...tokens.values()]
  .filter((t) => t.pool)
  .sort((a, b) => (isV2(b) ? 1 : 0) - (isV2(a) ? 1 : 0) || b.createdBlock - a.createdBlock)
let fresh = 0
let failed = 0
/**
 * **一个批次失败不再放弃剩下全部。**
 *
 * 原来是「某一批连败三次 → gtDown → 后面 30 多批全部跳过」,理由写的是
 * 「35 批 × 25 秒退避 = 15 分钟,cron 等不起」。**那是 cron 还是每 10 分钟时写的。**
 * 2026-08-29 改成每小时之后,15 分钟完全等得起,而那条规则的代价是:
 * 实测一轮 `fresh 59, failed 1000` —— 它在第 2 批就放弃了整轮,
 * 一千枚币的价因此停在几小时前。
 *
 * 现在要连着 5 批全败才判定 GT 整体不可用。单批失败只影响那 30 枚(它们沿用旧值)。
 */
let gtDown = false
let batchStrikeRun = 0
const GIVE_UP_AFTER = 5
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
      batchStrikeRun++
      if (batchStrikeRun >= GIVE_UP_AFTER) {
        gtDown = true
        console.log(`GT 连续 ${GIVE_UP_AFTER} 批全败(第 ${i / 30 + 1}/${Math.ceil(withPool.length / 30)} 批),判定不可用,其余沿用旧行情`)
      }
    } else if (j) {
      batchStrikeRun = 0
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
        // 这条行情是什么时候抓的。**`at` 是池子创建时间,两回事** ——
        // 没有 pAt 就无从知道某一行的价是十分钟前的还是三周前的。
        pAt: Date.now(),
        name: a.name ?? null,
        dex: p.relationships?.dex?.data?.id ?? null,
        img: img && img !== 'missing.png' ? img : null,
      }
      fresh++
    } else if (prevByToken.get(t.token)?.gt) {
      t.gt = prevByToken.get(t.token).gt
    }
  }
  // **2.5 秒,不是 1.5 秒。** GT 免费档是 30 次/分钟,而 1.5 秒 = 40 次/分钟 ——
  // 那是在自己把自己限流。改成每小时跑之后,36 批 × 2.5 秒 = 90 秒,完全等得起。
  await sleep(2_500)
}
const v2Pools = withPool.filter(isV2)
const v2Fresh = v2Pools.filter((t) => t.gt && prevByToken.get(t.token)?.gt !== t.gt).length
console.log(`GT: fresh ${fresh}, failed ${failed}, pools ${withPool.length}, no-pool ${tokens.size - withPool.length}`)
// v2 是首页在看的那一批。它要是没拿满，说明连第 1 批都被限流了，属于要立刻处理的情况。
console.log(`GT v2: ${v2Fresh}/${v2Pools.length} fresh`)
if (v2Pools.length && v2Fresh < v2Pools.length) {
  console.log('WARNING: 有 v2 币没拿到新行情 —— 首页会显示过期价格')
}

// ---- 内盘（bonding curve）行情：GT 索引不到，自己从合约算 ----
//
// 内盘币还没建 Uniswap 池，GT 里根本不存在，所以首页一直显示 "On the curve" + 一排横杠。
// 但这些数据我们自己全有：报价是 CurveSale 的纯函数，成交量和笔数在它自己的
// Bought / Sold 事件里。一次 eth_call + 一次 getLogs 就够，不欠任何第三方。
//
// 刻意复用 `gt` 这个字段名和结构 —— 前端照着它渲染，这样内盘币不用改一行前端就能显示。
const CURVE_OF = '0x05adc47e' // curveOf(address)
const NET_IN_FOR = '0x4904ad2f' // netInFor(uint256) —— 买 1 枚要付多少 quote，恒有定义
const TOPIC_BOUGHT = '0x27330bd7589580547b6437e08f9c60653de63691d2d2b2c13bff9ee67da2a68d' // Bought(address,uint256,uint256,uint256,uint256)
const TOPIC_SOLD = '0xe029f26dbcf8c42dd2f352c10214a7fc26773dc62482c6241334a0402ac09a80' // Sold(address,uint256,uint256,uint256)

async function ethCall(to, data) {
  return rpc('eth_call', [{ to, data }, 'latest'])
}

async function curveMarket(t, ethUsd) {
  const curve = '0x' + (await ethCall(V2_PORTAL, CURVE_OF + t.token.slice(2).padStart(64, '0'))).slice(26)
  if (/^0x0+$/.test(curve)) return null
  // 买 1 枚要付多少 quote（wei）→ 这就是当前挂单价
  const oneToken = (10n ** 18n).toString(16).padStart(64, '0')
  const raw = await ethCall(curve, NET_IN_FOR + oneToken).catch(() => null)
  if (!raw || raw === '0x') return null
  const priceEth = Number(BigInt(raw)) / 1e18
  const supRaw = await ethCall(t.token, '0x18160ddd').catch(() => null) // totalSupply()
  const supply = supRaw ? Number(BigInt(supRaw)) / 1e18 : 0
  return { curve, priceUsd: priceEth * ethUsd, fdv: priceEth * ethUsd * supply }
}

// ETH/USD：**从链上的 USDG/WETH 池直接算**，不问 GT。
//
// 第一版写的是找 GT 要 WETH 报价 —— 本地一跑就露馅：GT 对我们直接 429，
// ethUsd = 0，内盘一枚都定不了价。把内盘的显示挂在那个正在限流的接口上，
// 等于把刚修好的毛病原样搬到新功能里。
//
// 这条链上有 USDG（6 位小数），0.01% 档那个池子流动性最好。
// WETH(0x0bd7…) < USDG(0x5fc5…)，所以 WETH 是 token0，
// sqrtPriceX96² 得到的是「每 WETH 原始单位换多少 USDG 原始单位」，
// 再乘 10^(18-6) 换成人类单位。2026-08-18 实测得 $1,897.16，与 GT 口径一致。
const USDG_WETH_POOL = '0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca'
let ethUsd = 0
try {
  const slot0 = await ethCall(USDG_WETH_POOL, '0x3850c7bd') // slot0()
  const sqrtX96 = BigInt('0x' + slot0.slice(2, 66))
  const ratio = Number(sqrtX96) / 2 ** 96
  ethUsd = ratio * ratio * 10 ** 12
} catch (e) {
  console.log(`ETH 价读取失败: ${String(e).slice(0, 80)}`)
}
if (!(ethUsd > 100 && ethUsd < 100_000)) {
  // 读出个离谱的数就当没读到 —— 宁可内盘不显示，也不能把错价挂到首页上
  console.log(`ETH 价异常 (${ethUsd})，内盘行情本轮跳过`)
  ethUsd = 0
}

const curveTokens = [...tokens.values()].filter((t) => !t.pool && t.mode === 'curve')
let curveOk = 0
if (curveTokens.length && ethUsd > 0) {
  for (const t of curveTokens) {
    try {
      const m = await curveMarket(t, ethUsd)
      if (!m) continue
      const head2 = Number(await rpc('eth_blockNumber', []))
      const logs = [...(await getLogs(m.curve, TOPIC_BOUGHT, V2_FROM_BLOCK, head2)), ...(await getLogs(m.curve, TOPIC_SOLD, V2_FROM_BLOCK, head2))]
      // Bought(buyer, quoteIn, tokensOut, fee, refund) / Sold(seller, tokensIn, quoteOut, fee)
      // 只数条数与 quote 侧金额；两个事件的第 1 个非索引参数都是 quote 或 token 数量，
      // 这里按 topic 区分，认不出的就不计入，宁可少算也不瞎算。
      let vol = 0
      let tx = 0
      for (const lg of logs) {
        const t0 = lg.topics?.[0]
        if (t0 === TOPIC_BOUGHT) {
          // Bought(buyer, amountIn, tokensOut, fee+tax, refund)
          // **要减掉 refund**：amountIn 是用户发出的总额，超过单账号配额的部分会在同一笔里
          // 原路退回。直接拿 amountIn 当成交额会虚报 —— CURVE 这一枚实测能虚报出好几倍。
          const sent = BigInt('0x' + word(lg.data, 0))
          const refund = BigInt('0x' + word(lg.data, 3))
          vol += Number(sent > refund ? sent - refund : 0n) / 1e18
          tx++
        } else if (t0 === TOPIC_SOLD) {
          vol += Number(BigInt('0x' + word(lg.data, 1))) / 1e18
          tx++
        }
      }
      t.gt = {
        price: m.priceUsd,
        c1h: 0,
        c24h: 0,
        vol: vol * ethUsd,
        fdv: m.fdv,
        tx,
        at: null,
        // 这条行情是什么时候抓的。**`at` 是池子创建时间,两回事** ——
        // 没有 pAt 就无从知道某一行的价是十分钟前的还是三周前的。
        pAt: Date.now(),
        name: `${t.symbol} · curve`,
        dex: 'dontblink-curve',
        img: null,
      }
      curveOk++
    } catch (e) {
      console.log(`curve ${t.symbol}: ${String(e).slice(0, 80)}`)
    }
  }
}
console.log(`curve: ${curveOk}/${curveTokens.length} priced (ETH=$${ethUsd})`)

if (fresh === 0 && tokens.size === 0) {
  console.error('nothing to write')
  process.exit(1)
}

// 被同名靓号版取代的旧发行 —— 链上永远在，但不进首页。只放这里、不放前端：改名单不用发版。
const SUPERSEDED = new Set([
  '0x51b5b3f3e3c4c2c6fe71e584ed91dcff61c738ff', // DONTBLINK Genesis（08-16 首发，非靓号）→ 0x50DA…CDbDb
  '0x49fcfa44d30f1e279954f82a321676d2e77640b9', // DONTBLINK Curve → 0x6f72…6dBDb
  '0xc11788e9e7199c662813574ab7e2018dd27c4d01', // DONTBLINK Drop → 0x4C7E…7dbdb
  '0x1635df31006e4b1020b27a548d6c614960e1dbdb', // DONTBLINK Vault 误绑 @dontblinkfamily（前团队号）→ 0x4e95…f0DbDb 绑 @dontblink_cto
])
// **扫描失败过就把上一版里缺掉的补回来。**
//
// 2026-08-28 实测:Robinhood RPC 回 `Too Many Requests`,三个链上扫描全挂,
// 而 v1 只剩静态存档的 999 枚、v2 一枚不剩 —— 脚本照样把这份残缺列表写出去并发布,
// 站点因此少了 60 枚币(包括全部 v2,也就是我们现在真正在发的那些),一句报错都没有。
//
// 扫描失败的意思是「这一轮我们没看清」,不是「这些币没了」。上一版是我们看清过的,
// 拿它补上;下一轮扫描成功时自然会覆盖回来。
if (scanFailed) {
  let restored = 0
  for (const t of prev?.tokens ?? []) {
    const key = String(t.token ?? '').toLowerCase()
    if (key && !tokens.has(key)) { tokens.set(key, t); restored++ }
  }
  console.log(`链上扫描失败,从上一版补回 ${restored} 枚 —— 不用残缺的覆盖完整的`)
}

const list = [...tokens.values()].filter((t) => !SUPERSEDED.has(t.token)).sort((a, b) => b.createdBlock - a.createdBlock)

// 最后一道闸:扫描失败时列表**不许比上一版短**。补回逻辑应该已经保证了这一点,
// 但这个判断是免费的,而它挡住的是「站上少了几十枚币」这种没人会立刻发现的事故。
if (scanFailed && prev?.tokens?.length && list.length < prev.tokens.length) {
  console.log(`拒绝写入:扫描失败且列表从 ${prev.tokens.length} 缩到 ${list.length},保留上一版`)
  process.exit(0)
}
await mkdir('data', { recursive: true })
// 游标:扫成功的那条才前进,失败的沿用上一版的位置。
const scan = {
  v1: v1ScannedTo ?? prevScan.v1 ?? null,
  v2: v2ScannedTo ?? prevScan.v2 ?? null,
}
await writeFile('data/ours.json', JSON.stringify({ at: fresh > 0 ? Date.now() : (prev?.at ?? Date.now()), scan, tokens: list }))
console.log(`游标 → v1=${scan.v1} v2=${scan.v2}`)
console.log(`ours.json written: ${list.length} tokens`)
