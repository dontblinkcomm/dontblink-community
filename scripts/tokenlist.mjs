// 标准代币清单（Uniswap Token List schema）+ 每枚币的 logo 落成真实文件。
//
// **为什么存在**：我们发的币在 fomo / GMGN / GeckoTerminal 上全是「?」占位图。
// 09-04 链上核过根因：BlinkToken **没有任何元数据函数**（tokenURI/uri/contractURI 全 revert），
// 图片只存在发射事件里；GT 全站只认出我们 1 枚币的图（BLINK，因为它在 CoinGecko 上有收录）。
// 也就是说：**图片对外部世界根本不可见** —— 不是别人不显示，是没地方可读。
//
// 产出聚合器和钱包都认的格式，放在稳定 URL 上：
//   /data/tokenlist.json   —— 标准清单（向各平台提交的就是这个 URL）
//   /logos/<address>.jpg   —— data-uri 内嵌图落成文件
//
// **严格过滤**：schema 对 name/symbol 有长度与字符限制，而我们有些币的 symbol 是一整篇文章。
// 混进去会让整份清单被拒收 —— 宁可少收几枚，也不能让整份废掉。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { toChecksum } from './lib/keccak.mjs'

const ORIGIN = 'https://dontblink.community'
const CHAIN_ID = 4663

// 上线自检：keccak 是自己写的，checksum 错了整份清单就是垃圾。
// 对照值取自 `cast to-check-sum-address`（2026-09-04 实跑）。
const SELFTEST = {
  '0x11c10293fb59a6cfe75ec01fc9b2a609e28a17bc': '0x11C10293fB59a6CFE75Ec01FC9B2a609E28a17BC',
  '0x0bd7d308f8e1639fab988df18a8011f41eacad73': '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  '0xefb0b09c66cb66943c1d5ce796f5f577070de46e': '0xefB0b09c66CB66943c1D5Ce796f5f577070de46e',
}
for (const [lower, want] of Object.entries(SELFTEST)) {
  const got = toChecksum(lower)
  if (got !== want) throw new Error(`keccak 自检失败：${lower} 得到 ${got}，应为 ${want}`)
}

// schema 约束（tokenlist.org）：symbol 至多 20 字符且只许这些字符；name 至多 40。
const SYMBOL_OK = /^[a-zA-Z0-9+\-%/$.]{1,20}$/
const clampName = (s) => String(s || '').replace(/[\x00-\x1f]/g, '').trim().slice(0, 40)

const ours = JSON.parse(await readFile('data/ours.json', 'utf8'))

await mkdir('logos', { recursive: true })
const tokens = []
const stats = { total: 0, noPool: 0, badSymbol: 0, noLogo: 0, wroteFile: 0, kept: 0 }

for (const t of ours.tokens) {
  stats.total++
  if (!t.pool) { stats.noPool++; continue }        // 没池子 = 还没上市，不进清单
  const sym = String(t.symbol || '').trim()
  if (!SYMBOL_OK.test(sym)) { stats.badSymbol++; continue }

  const addr = toChecksum(t.token)
  let logoURI = null
  const raw = String(t.imageUrl || '')
  if (raw.startsWith('data:image/')) {
    // 内嵌图落成文件 —— data-uri 对外部索引器等于不存在
    const m = raw.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
    if (m) {
      const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
      const file = `logos/${addr.toLowerCase()}.${ext}`
      await writeFile(file, Buffer.from(m[2], 'base64'))
      logoURI = `${ORIGIN}/${file}`
      stats.wroteFile++
    }
  } else if (raw.startsWith('/')) {
    logoURI = ORIGIN + raw          // 站内相对路径 → 绝对 URL（实测 200 image/webp）
  } else if (raw.startsWith('https://')) {
    logoURI = raw
  }
  if (!logoURI) stats.noLogo++

  tokens.push({
    chainId: CHAIN_ID,
    address: addr,
    name: clampName(t.name) || sym,
    symbol: sym,
    decimals: 18,                   // Portal 发的币固定 18 位
    ...(logoURI ? { logoURI } : {}),
  })
  stats.kept++
}

// 版本号：内容没变就不动 —— 否则聚合器会看到我们在无意义地刷版本
const prev = await readFile('data/tokenlist.json', 'utf8').then((t) => JSON.parse(t)).catch(() => null)
const same = prev && JSON.stringify(prev.tokens) === JSON.stringify(tokens)
const version = same ? prev.version : { major: 1, minor: (prev?.version?.minor ?? 0) + (prev ? 1 : 0), patch: 0 }

const list = {
  name: 'dontblink',
  timestamp: new Date().toISOString(),
  version,
  keywords: ['dontblink', 'robinhood chain', 'memecoin', 'launchpad'],
  logoURI: `${ORIGIN}/favicon.png`,
  tokens,
}
await writeFile('data/tokenlist.json', JSON.stringify(list, null, 1))

// 每枚币一份元数据 JSON（/meta/<address>.json）—— 新版 BlinkToken 的
// contractURI()/tokenURI() 指到这里（合约里是零存储的确定性 URL）。
// **这些文件必须存在**：链上函数指向一个 404，比什么都没有更糟。
await mkdir('meta', { recursive: true })
let metaWrote = 0
for (const t of tokens) {
  const src = ours.tokens.find((x) => x.token.toLowerCase() === t.address.toLowerCase())
  const meta = {
    name: t.name,
    symbol: t.symbol,
    decimals: 18,
    ...(t.logoURI ? { image: t.logoURI, logoURI: t.logoURI } : {}),
    ...(src?.gt?.name ? {} : {}),
    external_url: `https://dontblink.community/t/${(src?.pool || t.address).toLowerCase()}`,
  }
  await writeFile(`meta/${t.address.toLowerCase()}.json`, JSON.stringify(meta))
  metaWrote++
}
console.log(`meta/: ${metaWrote} 份`)
console.log(
  `tokenlist.json: 收录 ${stats.kept}/${stats.total}` +
  ` | 跳过 无池子 ${stats.noPool} / symbol 不合规 ${stats.badSymbol}` +
  ` | 落地 logo 文件 ${stats.wroteFile} / 无图 ${stats.noLogo}` +
  ` | 版本 ${version.major}.${version.minor}.${version.patch}`,
)
